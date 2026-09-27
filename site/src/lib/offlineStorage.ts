// IndexedDB wrapper for offline data storage
const DB_NAME = 'yarok-fleet-offline';
const DB_VERSION = 1;
const PENDING_STORE = 'pending-operations';
const CACHED_DATA_STORE = 'cached-data';

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

export interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt: number;
}

let db: IDBDatabase | null = null;

export async function openDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Store for pending operations (to sync when online)
      if (!database.objectStoreNames.contains(PENDING_STORE)) {
        const pendingStore = database.createObjectStore(PENDING_STORE, { keyPath: 'id' });
        pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        pendingStore.createIndex('table', 'table', { unique: false });
      }

      // Store for cached data (for offline reading)
      if (!database.objectStoreNames.contains(CACHED_DATA_STORE)) {
        const cacheStore = database.createObjectStore(CACHED_DATA_STORE, { keyPath: 'key' });
        cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };
  });
}

// Add a pending operation to sync later
export async function addPendingOperation(
  type: PendingOperation['type'],
  table: string,
  data: Record<string, unknown>
): Promise<string> {
  const database = await openDatabase();
  const id = `${table}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const operation: PendingOperation = {
    id,
    type,
    table,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PENDING_STORE, 'readwrite');
    const store = transaction.objectStore(PENDING_STORE);
    const request = store.add(operation);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

// Get all pending operations
export async function getPendingOperations(): Promise<PendingOperation[]> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PENDING_STORE, 'readonly');
    const store = transaction.objectStore(PENDING_STORE);
    const index = store.index('timestamp');
    const request = index.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Remove a pending operation after successful sync
export async function removePendingOperation(id: string): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PENDING_STORE, 'readwrite');
    const store = transaction.objectStore(PENDING_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Update retry count for failed operations
export async function updateRetryCount(id: string): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PENDING_STORE, 'readwrite');
    const store = transaction.objectStore(PENDING_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const operation = getRequest.result as PendingOperation;
      if (operation) {
        operation.retryCount += 1;
        store.put(operation);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Cache data for offline reading
export async function cacheData(
  key: string,
  data: unknown,
  ttlMinutes: number = 60
): Promise<void> {
  const database = await openDatabase();

  const cachedData: CachedData = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CACHED_DATA_STORE, 'readwrite');
    const store = transaction.objectStore(CACHED_DATA_STORE);
    const request = store.put(cachedData);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get cached data
export async function getCachedData<T>(key: string): Promise<T | null> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CACHED_DATA_STORE, 'readonly');
    const store = transaction.objectStore(CACHED_DATA_STORE);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as CachedData | undefined;
      if (result && result.expiresAt > Date.now()) {
        resolve(result.data as T);
      } else {
        // Data expired or not found
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Clear expired cache
export async function clearExpiredCache(): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CACHED_DATA_STORE, 'readwrite');
    const store = transaction.objectStore(CACHED_DATA_STORE);
    const index = store.index('expiresAt');
    const range = IDBKeyRange.upperBound(Date.now());
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Get pending operations count
export async function getPendingCount(): Promise<number> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PENDING_STORE, 'readonly');
    const store = transaction.objectStore(PENDING_STORE);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Clear all pending operations
export async function clearPendingOperations(): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PENDING_STORE, 'readwrite');
    const store = transaction.objectStore(PENDING_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
