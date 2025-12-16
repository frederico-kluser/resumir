/**
 * Offline Prompt Service
 *
 * This service generates prompts for use with external AI services
 * like DeepSeek when no API key is configured.
 */

import { LanguageOption } from '../types';

const DEEPSEEK_STORAGE_KEY = 'resumir.deepseek.pendingPrompt';
const CHATGPT_STORAGE_KEY = 'resumir.chatgpt.pendingPrompt';
const GEMINI_STORAGE_KEY = 'resumir.gemini.pendingPrompt';

declare var chrome: any;

/**
 * Builds a prompt for video summarization (without user question)
 */
export const buildSummarizationPrompt = (
	transcript: string,
	targetLanguage: LanguageOption,
): string => {
	const languageName = targetLanguage?.name ?? 'English';
	const languageCode = targetLanguage?.code ?? 'en';
	const sanitizedTranscript = transcript?.trim() || 'Transcript unavailable.';

	return `You are a video analysis assistant. Analyze this YouTube video transcript and provide a structured summary.

**Language:** Respond entirely in ${languageName} (${languageCode}).

**Instructions:**
1. Create a concise summary (~100 words) that answers: What is the video about? Why is it important? Who is it for?
2. Identify 3-5 key moments with their timestamps in [MM:SS] format
3. Use exact timestamps from the transcript - do NOT invent timestamps
4. If information is unclear, acknowledge it rather than guessing

**Output Format:**
Please provide your response in this format:

## Summary
[Your ~100 word summary here]

## Key Moments
- [MM:SS] - [Brief description of what happens at this timestamp]
- [MM:SS] - [Brief description]
- [MM:SS] - [Brief description]
(3-5 key moments total)

---

**Video Transcript:**
${sanitizedTranscript}`;
};

/**
 * Builds a prompt for answering a user question about the video
 */
export const buildQuestionAnswerPrompt = (
	transcript: string,
	userQuestion: string,
	targetLanguage: LanguageOption,
): string => {
	const languageName = targetLanguage?.name ?? 'English';
	const languageCode = targetLanguage?.code ?? 'en';
	const sanitizedTranscript = transcript?.trim() || 'Transcript unavailable.';

	return `You are a video analysis assistant. Answer the user's question based on this YouTube video transcript.

**Language:** Respond entirely in ${languageName} (${languageCode}).

**User's Question:** ${userQuestion}

**Instructions:**
1. First, answer the user's specific question directly and concisely
2. Cite exact timestamps [MM:SS] for every claim you make
3. If the answer is not in the transcript, say so clearly - do NOT make up information
4. Then provide a brief summary of the video (~100 words)
5. List 3-5 key moments with their timestamps

**Output Format:**
Please provide your response in this format:

## Answer to Your Question
[Your direct answer with timestamp citations like [MM:SS]]

## Video Summary
[Your ~100 word summary here]

## Key Moments
- [MM:SS] - [Brief description of what happens at this timestamp]
- [MM:SS] - [Brief description]
- [MM:SS] - [Brief description]
(3-5 key moments total)

---

**Video Transcript:**
${sanitizedTranscript}`;
};

/**
 * Builds the appropriate prompt based on whether there's a user question
 */
export const buildOfflinePrompt = (
	transcript: string,
	targetLanguage: LanguageOption,
	userQuestion?: string,
): string => {
	if (userQuestion && userQuestion.trim()) {
		return buildQuestionAnswerPrompt(transcript, userQuestion.trim(), targetLanguage);
	}
	return buildSummarizationPrompt(transcript, targetLanguage);
};

/**
 * Stores the prompt in chrome.storage for the DeepSeek content script to pick up
 */
export const storePendingPrompt = async (prompt: string): Promise<void> => {
	if (typeof chrome !== 'undefined' && chrome.storage?.local) {
		await chrome.storage.local.set({ [DEEPSEEK_STORAGE_KEY]: prompt });
	} else {
		// Fallback to localStorage for development
		localStorage.setItem(DEEPSEEK_STORAGE_KEY, prompt);
	}
};

/**
 * Clears any pending prompt from storage
 */
export const clearPendingPrompt = async (): Promise<void> => {
	if (typeof chrome !== 'undefined' && chrome.storage?.local) {
		await chrome.storage.local.remove(DEEPSEEK_STORAGE_KEY);
	} else {
		localStorage.removeItem(DEEPSEEK_STORAGE_KEY);
	}
};

/**
 * Copies text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		console.error('Failed to copy to clipboard:', error);

		// Fallback method
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			return true;
		} catch (fallbackError) {
			console.error('Fallback copy also failed:', fallbackError);
			return false;
		}
	}
};

/**
 * Opens DeepSeek chat in a new tab
 */
export const openDeepSeekChat = (): void => {
	const deepseekUrl = 'https://chat.deepseek.com/';

	if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
		chrome.tabs.create({ url: deepseekUrl });
	} else {
		window.open(deepseekUrl, '_blank');
	}
};

/**
 * Opens ChatGPT in a new tab
 */
export const openChatGPT = (): void => {
	const chatgptUrl = 'https://chatgpt.com/';

	if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
		chrome.tabs.create({ url: chatgptUrl });
	} else {
		window.open(chatgptUrl, '_blank');
	}
};

/**
 * Opens Gemini Chat in a new tab
 */
export const openGeminiChat = (): void => {
	const geminiUrl = 'https://gemini.google.com/';

	if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
		chrome.tabs.create({ url: geminiUrl });
	} else {
		window.open(geminiUrl, '_blank');
	}
};

/**
 * Stores the prompt in chrome.storage for the specified service's content script to pick up
 */
export const storePendingPromptForService = async (prompt: string, service: 'deepseek' | 'chatgpt' | 'gemini'): Promise<void> => {
	let storageKey: string;
	switch (service) {
		case 'deepseek':
			storageKey = DEEPSEEK_STORAGE_KEY;
			break;
		case 'chatgpt':
			storageKey = CHATGPT_STORAGE_KEY;
			break;
		case 'gemini':
			storageKey = GEMINI_STORAGE_KEY;
			break;
	}

	if (typeof chrome !== 'undefined' && chrome.storage?.local) {
		await chrome.storage.local.set({ [storageKey]: prompt });
	} else {
		// Fallback to localStorage for development
		localStorage.setItem(storageKey, prompt);
	}
};
