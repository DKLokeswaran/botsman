import { randomUUID } from "node:crypto";

export type Sequenced<E> = { readonly seq: number; readonly event: E };
type Listener<E> = (item: Sequenced<E>) => void;

type Stream<E> = {
  seq: number;
  recent: Sequenced<E>[];
  listeners: Set<Listener<E>>;
};

const KEEP_EVENTS = 1000;

// Numbers every event per stream and keeps the recent ones, so a reconnecting client gets only what it missed.
// The epoch changes on every server start; a client from an older epoch gets a fresh snapshot instead.
export class StreamHub<E> {
  readonly epoch = randomUUID();
  readonly #streams = new Map<string, Stream<E>>();

  publish(name: string, event: E): number {
    const stream = this.#stream(name);
    const item = { seq: ++stream.seq, event };
    stream.recent.push(item);
    if (stream.recent.length > KEEP_EVENTS) stream.recent.splice(0, stream.recent.length - KEEP_EVENTS);
    for (const listener of stream.listeners) listener(item);
    return item.seq;
  }

  currentSeq(name: string): number {
    return this.#streams.get(name)?.seq ?? 0;
  }

  // Events after `seq`, or undefined when some of them are no longer kept.
  since(name: string, epoch: string, seq: number): Sequenced<E>[] | undefined {
    if (epoch !== this.epoch) return undefined;
    const stream = this.#stream(name);
    if (seq > stream.seq) return undefined;
    const oldestKept = stream.recent[0]?.seq ?? stream.seq + 1;
    if (seq < oldestKept - 1) return undefined;
    return stream.recent.filter((item) => item.seq > seq);
  }

  subscribe(name: string, listener: Listener<E>): () => void {
    const stream = this.#stream(name);
    stream.listeners.add(listener);
    return () => stream.listeners.delete(listener);
  }

  #stream(name: string): Stream<E> {
    let stream = this.#streams.get(name);
    if (stream === undefined) {
      stream = { seq: 0, recent: [], listeners: new Set() };
      this.#streams.set(name, stream);
    }
    return stream;
  }
}
