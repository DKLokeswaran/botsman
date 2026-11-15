// Counts events per key in a fixed window, so login can refuse a flood of wrong passwords.
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  readonly #windows = new Map<string, { start: number; count: number }>();

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
  }

  // Whether the key is still under its limit in the current window.
  allows(key: string): boolean {
    const window = this.#current(key);
    return window === undefined || window.count < this.#limit;
  }

  // Counts one event for the key.
  record(key: string): void {
    const window = this.#current(key);
    if (window !== undefined) {
      window.count++;
      return;
    }
    this.#forgetOld();
    this.#windows.set(key, { start: this.#now(), count: 1 });
  }

  #current(key: string): { start: number; count: number } | undefined {
    const window = this.#windows.get(key);
    return window !== undefined && this.#now() - window.start < this.#windowMs ? window : undefined;
  }

  #forgetOld(): void {
    const now = this.#now();
    for (const [key, window] of this.#windows) {
      if (now - window.start >= this.#windowMs) this.#windows.delete(key);
    }
  }
}
