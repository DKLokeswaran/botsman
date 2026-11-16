// A value that screens can watch. React reads it through `useSyncExternalStore`.
export class Store<T> {
  #value: T;
  readonly #listeners = new Set<() => void>();

  constructor(initial: T) {
    this.#value = initial;
  }

  get = (): T => this.#value;

  set(next: T): void {
    if (Object.is(next, this.#value)) return;
    this.#value = next;
    for (const listener of [...this.#listeners]) listener();
  }

  update(change: (current: T) => T): void {
    this.set(change(this.#value));
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
}
