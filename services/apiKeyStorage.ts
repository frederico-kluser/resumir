import { ApiCredentials, LLMProvider } from '../types';

const STORAGE_KEY = 'tubegist:gemini_api_key';

declare const chrome: any;

const FALLBACK_PROVIDER: LLMProvider = 'google';

const serializeCredentials = (value: ApiCredentials): string => JSON.stringify(value);

const parseStoredCredentials = (raw: string | null): ApiCredentials | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.key === 'string') {
      const provider = typeof parsed.provider === 'string' ? (parsed.provider as LLMProvider) : FALLBACK_PROVIDER;
      return { provider, key: parsed.key };
    }

    if (!raw.trim().startsWith('{')) {
      return { provider: FALLBACK_PROVIDER, key: raw };
    }
  } catch {
    // Legacy format: raw string stored directly
    return { provider: FALLBACK_PROVIDER, key: raw };
  }

  if (!raw.trim().startsWith('{')) {
    return { provider: FALLBACK_PROVIDER, key: raw };
  }

  return null;
};

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

export async function getUserApiKey(): Promise<ApiCredentials | null> {
  try {
    let raw: string | null = null;

    if (hasChromeStorage) {
      raw = await getFromChromeStorage();
    } else if (hasLocalStorage) {
      raw = window.localStorage.getItem(STORAGE_KEY);
    }

    return parseStoredCredentials(raw);
  } catch (error) {
    console.error('Failed to load stored API key', error);
  }
  return null;
}

export async function saveUserApiKey(credentials: ApiCredentials): Promise<void> {
  const trimmed = credentials.key.trim();
  if (!trimmed) {
    throw new Error('API key cannot be empty');
  }

  const payload: ApiCredentials = {
    provider: credentials.provider,
    key: trimmed,
  };
  const serialized = serializeCredentials(payload);

  if (hasChromeStorage) {
    await setChromeStorage(serialized);
    return;
  }

  if (!hasLocalStorage) {
    throw new Error('No storage mechanism available');
  }

  window.localStorage.setItem(STORAGE_KEY, serialized);
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
