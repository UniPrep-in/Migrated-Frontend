// Remembers in the browser (IndexedDB) that this visitor already submitted the
// guidance form, so the modal isn't shown to them again.

const DB_NAME = "uniprep";
const DB_VERSION = 1;
const STORE_NAME = "guidance";
const SUBMISSION_KEY = "submission";

export type GuidanceSubmission = {
  phone: string;
  submittedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function getGuidanceSubmission(): Promise<GuidanceSubmission | null> {
  try {
    const value = await withStore<GuidanceSubmission | undefined>("readonly", (store) =>
      store.get(SUBMISSION_KEY),
    );
    return value ?? null;
  } catch {
    // Blocked or unavailable storage — treat as not submitted.
    return null;
  }
}

export async function saveGuidanceSubmission(phone: string): Promise<void> {
  const submission: GuidanceSubmission = { phone, submittedAt: new Date().toISOString() };
  try {
    await withStore("readwrite", (store) => store.put(submission, SUBMISSION_KEY));
  } catch {
    // Not critical: the modal may just show again on a later visit.
  }
}
