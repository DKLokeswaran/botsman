import type { LocalCache } from "@botsman/client-core";

const STORE = "entries";

// The local cache in the browser's IndexedDB, used by the web dashboard and the Windows app's window.
export function indexedDbCache(name = "botsman"): LocalCache {
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const store = (await opened).transaction(STORE, mode).objectStore(STORE);
    return new Promise<T>((resolve, reject) => {
      const request = work(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  return {
    get: async (key) => (await run<string | undefined>("readonly", (store) => store.get(key))) ?? undefined,
    set: async (key, value) => void (await run("readwrite", (store) => store.put(value, key))),
    clear: async () => void (await run("readwrite", (store) => store.clear())),
  };
}
