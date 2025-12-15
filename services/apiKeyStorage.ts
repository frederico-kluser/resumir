const STORAGE_KEY = 'tubegist:gemini_api_key';

declare const chrome: any;

type StorageResolver = (value?: string | null) => void;

type StorageRejecter = (reason?: unknown) => void;

const hasChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage?.local;
const hasLocalStorage = typeof window !== 'undefined' && !!window.localStorage;

function getFromChromeStorage(): Promise<string | null> {
  return new Promise((resolve: StorageResolver, reject: StorageRejecter) => {
    chrome.storage.local.get([STORAGE_KEY], (result: Record<string, string>) => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        reject(lastError);
        return;
      }
      resolve(result?.[STORAGE_KEY] ?? null);
    });
  });
}

function setChromeStorage(value: string | null): Promise<void> {
  return new Promise((resolve: StorageResolver, reject: StorageRejecter) => {
    const callback = () => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        reject(lastError);
        return;
      }
      resolve();
    };

    if (value === null) {
      chrome.storage.local.remove([STORAGE_KEY], callback);
    } else {
      chrome.storage.local.set({ [STORAGE_KEY]: value }, callback);
    }
  });
}

export async function getUserApiKey(): Promise<string | null> {
  try {
    if (hasChromeStorage) {
      return await getFromChromeStorage();
    }
    if (hasLocalStorage) {
      return window.localStorage.getItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to load stored API key', error);
  }
  return null;
}

export async function saveUserApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error('API key cannot be empty');
  }

  if (hasChromeStorage) {
    await setChromeStorage(trimmed);
    return;
  }

  if (!hasLocalStorage) {
    throw new Error('No storage mechanism available');
  }

  window.localStorage.setItem(STORAGE_KEY, trimmed);
}

export async function clearUserApiKey(): Promise<void> {
  if (hasChromeStorage) {
    await setChromeStorage(null);
    return;
  }

  if (hasLocalStorage) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
