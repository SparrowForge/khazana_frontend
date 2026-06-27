// Minimal promise wrapper around the browser's native IndexedDB.
// Kept dependency-free (no `idb` package) and intentionally tiny — it only
// exposes the handful of operations the offline POS engine needs.

const DB_NAME = "khazana-pos-offline";
const DB_VERSION = 1;

/** Object stores. Offline orders are namespaced per-user via the `userId` index. */
export const STORE_ORDERS = "offlineOrders";
export const STORE_STOCK = "stockCache";
export const STORE_META = "meta";
export const STORE_CATALOG = "catalog";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        const os = db.createObjectStore(STORE_ORDERS, { keyPath: "localId" });
        os.createIndex("byUser", "userId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_STOCK)) {
        // Cached stock keyed by itemId, scoped per-user so two cashiers on one
        // machine don't share each other's offline-deducted counts.
        db.createObjectStore(STORE_STOCK, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_CATALOG)) {
        // Full product catalog snapshot so the terminal can boot cold-offline.
        db.createObjectStore(STORE_CATALOG, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
  return dbPromise;
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode) {
  return db.transaction(store, mode).objectStore(store);
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  const db = await openDb();
  await wrap(tx(db, store, "readwrite").put(value as unknown as Record<string, unknown>));
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return wrap<T>(tx(db, store, "readonly").get(key) as IDBRequest<T>);
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  await wrap(tx(db, store, "readwrite").delete(key));
}

/** Read all rows of a store, optionally filtered by an index value. */
export async function idbGetAll<T>(
  store: string,
  index?: { name: string; value: IDBValidKey },
): Promise<T[]> {
  const db = await openDb();
  const os = tx(db, store, "readonly");
  const source = index ? os.index(index.name) : os;
  const req = index ? source.getAll(index.value) : (source as IDBObjectStore).getAll();
  return wrap<T[]>(req as IDBRequest<T[]>);
}
