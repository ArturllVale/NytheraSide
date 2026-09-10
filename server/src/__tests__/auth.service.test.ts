import { AuthService } from '../modules/auth/auth.service';
import { prisma } from '../infra/prisma';
import { ErrorCodes } from '@nythera/shared';
import { rateLimiter } from '../infra/ratelimit';

describe('AuthService', () => {
  const email = 'test@example.com';
  const password = 'password123';
  const wrongPassword = 'wrong';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  beforeEach(async () => {
    await rateLimiter.reset(`login_attempts:${email}`);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it('should register a new user', async () => {
    const authService = new AuthService();
    const user = await authService.register(email, password);
    expect(user).toHaveProperty('id');
    expect(user.email).toBe(email);
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.email).toBe(email);
    expect(dbUser!.password_hash).not.toBe(password);
  });

  it('should not register an existing user', async () => {
    const authService = new AuthService();
    await expect(authService.register(email, password)).rejects.toMatchObject({
      code: ErrorCodes.AUTH_USER_EXISTS,
    });
  });

  it('should login with correct credentials', async () => {
    const authService = new AuthService();
    const result = await authService.login(email, password);
    expect(result).toHaveProperty('token');
    expect(result.user).toHaveProperty('id');
    expect(result.user.email).toBe(email);
    const session = await prisma.session.findUnique({ where: { token: result.token } });
    expect(session).not.toBeNull();
    expect(session!.user_id).toBe(result.user.id);
  });

  it('should not login with wrong password', async () => {
    const authService = new AuthService();
    await expect(authService.login(email, wrongPassword)).rejects.toMatchObject({
      code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    });
  });

  it('should rate limit login attempts', async () => {
    const authService = new AuthService();
    for (let i = 0; i < 5; i++) {
      await expect(authService.login(email, wrongPassword)).rejects.toMatchObject({
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      });
    }
    await expect(authService.login(email, wrongPassword)).rejects.toMatchObject({
      code: ErrorCodes.AUTH_RATE_LIMIT_EXCEEDED,
    });
  });

  it('should logout and clear session', async () => {
    const authService = new AuthService();
    // Use another user to avoid rate limit
    const loginEmail = 'logout@test.com';
    await prisma.user.deleteMany({ where: { email: loginEmail } });
    await authService.register(loginEmail, password);
    const loginResult = await authService.login(loginEmail, password);
    const token = loginResult.token;

    let session = await prisma.session.findUnique({ where: { token } });
    expect(session).not.toBeNull();

    await authService.logout(token);

    session = await prisma.session.findUnique({ where: { token } });
    expect(session).toBeNull();
  });

  it('should validate token and return user info', async () => {
    const authService = new AuthService();
    const loginResult = await authService.login(email, password);
    const token = loginResult.token;
    const payload = await authService.validateToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(loginResult.user.id);
  });

  it('should return null for invalid token', async () => {
    const authService = new AuthService();
    const payload = await authService.validateToken('invalid-token');
    expect(payload).toBeNull();
  });
});