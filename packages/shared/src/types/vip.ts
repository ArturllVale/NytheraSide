export type UserRole = 'normal' | 'vip' | 'gm' | 'admin';

export interface UserVipInfo {
  role?: string;
  vip_until?: Date | string | null;
}

export function isUserVip(user: UserVipInfo | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || 'normal').toLowerCase();
  if (role === 'admin' || role === 'gm') return true;
  if (role === 'vip' && !user.vip_until) return true;
  if (user.vip_until) {
    const expires = new Date(user.vip_until).getTime();
    if (!isNaN(expires) && expires > Date.now()) return true;
  }
  return false;
}

export function getUserMaxSlots(user: UserVipInfo | null | undefined): number {
  return isUserVip(user) ? 6 : 4;
}
