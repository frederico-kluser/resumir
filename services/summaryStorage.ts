import { AnalysisResult } from '../types';

const DB_NAME = 'tubegist-summaries';
const DB_VERSION = 1;
const STORE_NAME = 'summaries';

export interface StoredSummary {
  videoId: string;
  result: AnalysisResult;
  videoUrl: string;
  language: string;
  userQuery: string;
  createdAt: number;
  updatedAt: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Extract YouTube video ID from URL
 */
export function extractVideoId(url: string | null): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // Handle youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }

    // Handle youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
  } catch {
    // Invalid URL
  }

  return null;
}

/**
 * Open or get the IndexedDB database instance
 */
function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle database being closed unexpectedly
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'videoId' });

        // Create indexes for querying
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Save a summary for a video
 */
export async function saveSummary(
  videoId: string,
  result: AnalysisResult,
  videoUrl: string,
  language: string,
  userQuery: string = ''
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const now = Date.now();

    // First, try to get existing entry to preserve createdAt
    const getRequest = store.get(videoId);

    getRequest.onsuccess = () => {
      const existing = getRequest.result as StoredSummary | undefined;

      const entry: StoredSummary = {
        videoId,
        result,
        videoUrl,
        language,
        userQuery,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };

      const putRequest = store.put(entry);

      putRequest.onerror = () => {
        console.error('Failed to save summary:', putRequest.error);
        reject(putRequest.error);
      };

      putRequest.onsuccess = () => {
        resolve();
      };
    };

    getRequest.onerror = () => {
      // If get fails, still try to save with new createdAt
      const entry: StoredSummary = {
        videoId,
        result,
        videoUrl,
        language,
        userQuery,
        createdAt: now,
        updatedAt: now
      };

      const putRequest = store.put(entry);

      putRequest.onerror = () => {
        console.error('Failed to save summary:', putRequest.error);
        reject(putRequest.error);
      };

      putRequest.onsuccess = () => {
        resolve();
      };
    };

    transaction.onerror = () => {
      console.error('Transaction failed:', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Get a saved summary for a video
 */
export async function getSummary(videoId: string): Promise<StoredSummary | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(videoId);

      request.onerror = () => {
        console.error('Failed to get summary:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };
    });
  } catch (error) {
    console.error('Failed to access summary storage:', error);
    return null;
  }
}

/**
 * Delete a saved summary
 */
export async function deleteSummary(videoId: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(videoId);

    request.onerror = () => {
      console.error('Failed to delete summary:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Get all saved summaries (useful for debugging or showing history)
 */
export async function getAllSummaries(): Promise<StoredSummary[]> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => {
        console.error('Failed to get all summaries:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result ?? []);
      };
    });
  } catch (error) {
    console.error('Failed to access summary storage:', error);
    return [];
  }
}

/**
 * Clear all saved summaries
 */
export async function clearAllSummaries(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => {
      console.error('Failed to clear summaries:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}
