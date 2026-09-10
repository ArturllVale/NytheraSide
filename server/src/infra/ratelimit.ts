// Simple in-memory rate limiter to replace Redis
export class RateLimiter {
  private counts = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const current = this.counts.get(key);

    if (current && current.expiresAt > now) {
      current.count += 1;
      return current.count;
    } else {
      this.counts.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return 1;
    }
  }

  async reset(key: string): Promise<void> {
    this.counts.delete(key);
  }
}

export const rateLimiter = new RateLimiter();