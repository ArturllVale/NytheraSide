import argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { ErrorCodes, isUserVip } from '@nythera/shared';
import { rateLimiter } from '../../infra/ratelimit';
import { prisma } from '../../infra/prisma';

config();

export class AuthService {
  async register(email: string, password: string) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw { code: ErrorCodes.AUTH_USER_EXISTS, message: 'User already exists' };
    }

    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        password_hash: passwordHash,
        role: 'normal',
      }
    });

    const { password_hash, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      isVip: isUserVip(user),
    };
  }

  async login(email: string, password: string) {
    const attemptsKey = `login_attempts:${email}`;
    const count = await rateLimiter.increment(attemptsKey, 900); // 15 mins window

    if (count > 5) {
      throw { code: ErrorCodes.AUTH_RATE_LIMIT_EXCEEDED, message: 'Too many attempts, try again later' };
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (password && password.length >= 8) {
        user = await prisma.user.create({
          data: {
            id: randomUUID(),
            email,
            password_hash: await argon2.hash(password),
            role: 'normal',
          }
        });
      } else {
        throw { code: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: `Usuário '${email}' não encontrado no banco de dados. Para novas contas, a senha deve ter ao menos 8 caracteres.` };
      }
    } else {
      const valid = await argon2.verify(user.password_hash, password);
      if (!valid) {
        throw { code: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: 'Senha incorreta para este usuário.' };
      }
    }

    await rateLimiter.reset(attemptsKey);

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.session.create({
      data: {
        id: randomUUID(),
        token,
        user_id: user.id,
        expires_at: expiresAt,
      }
    });

    const { password_hash, ...userWithoutPassword } = user;
    return {
      token,
      user: {
        ...userWithoutPassword,
        isVip: isUserVip(user),
      },
    };
  }

  async logout(token: string) {
    await prisma.session.deleteMany({ where: { token } });
  }

  async getUserById(userId: string) {
    const result = await prisma.user.findUnique({ where: { id: userId } });
    if (!result) {
      throw { code: ErrorCodes.AUTH_TOKEN_INVALID, message: 'User not found' };
    }
    const { password_hash, ...userWithoutPassword } = result;
    return {
      ...userWithoutPassword,
      isVip: isUserVip(result),
    };
  }

  async updateVipStatus(userId: string, action: number, days: number = 7) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw { code: ErrorCodes.AUTH_TOKEN_INVALID, message: 'Usuário não encontrado' };
    }

    let role = user.role;
    let vipUntil: Date | null = null;

    if (action === 1) {
      const now = new Date();
      const baseDate = (user.vip_until && user.vip_until > now) ? user.vip_until : now;
      vipUntil = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
      if (role === 'normal') {
        role = 'vip';
      }
    } else if (action === 0) {
      vipUntil = null;
      if (role === 'vip') {
        role = 'normal';
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        vip_until: vipUntil,
      },
    });

    const isVip = isUserVip(updated);
    return {
      success: true,
      role: updated.role,
      isVip,
      vipUntil: updated.vip_until ? updated.vip_until.toISOString() : null,
    };
  }

  async validateToken(token: string) {
    const session = await prisma.session.findUnique({ where: { token } });
    if (!session) {
      return null;
    }
    const now = new Date();
    if (session.expires_at < now) {
      await prisma.session.delete({ where: { token } });
      return null;
    }
    return { userId: session.user_id, expiresAt: session.expires_at };
  }
}
