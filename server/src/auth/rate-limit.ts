// Counts attempts per key in a fixed window, so login can refuse a flood of guesses.
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

  // Records one attempt and says whether it is allowed.
  take(key: string): boolean {
    const now = this.#now();
    const window = this.#windows.get(key);
    if (window === undefined || now - window.start >= this.#windowMs) {
      this.#windows.set(key, { start: now, count: 1 });
      this.#forgetOld(now);
      return true;
    }
    window.count++;
    return window.count <= this.#limit;
  }

  #forgetOld(now: number): void {
    for (const [key, window] of this.#windows) {
      if (now - window.start >= this.#windowMs) this.#windows.delete(key);
    }
  }
}
