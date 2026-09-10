/**
 * Local development intentionally uses in-process state. Redis wiring remains an
 * optional seam; production can require it through REDIS_REQUIRED=true.
 */
export interface RedisStatus { enabled: boolean; connected: boolean; required: boolean; }
export class RedisService {
  private connected = false;
  constructor(private readonly status: RedisStatus) {}
  async connect(): Promise<void> { this.connected = !this.status.enabled; }
  async disconnect(): Promise<void> { this.connected = false; }
  isReady(): boolean { return !this.status.required || this.connected; }
  describe(): RedisStatus { return { ...this.status, connected: this.connected }; }
}
