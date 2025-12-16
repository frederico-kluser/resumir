/**
 * DeepSeek Content Script
 *
 * This content script is injected into chat.deepseek.com to:
 * 1. Receive prompts from the Resumir extension
 * 2. Inject the prompt into the chat textarea
 * 3. Automatically submit the message
 */

declare var chrome: any;

const DEEPSEEK_STORAGE_KEY = 'resumir.deepseek.pendingPrompt';

// Selectors for DeepSeek chat interface
const SELECTORS = {
	// Textarea selectors (DeepSeek uses a textarea with specific ID)
	textarea: [
		'#chat-input',
		'textarea[placeholder]',
		'textarea',
		'[contenteditable="true"]',
		'.chat-input textarea',
		'[data-testid="chat-input"]',
	],
	// Send button selectors (specific to the send button with upload arrow icon)
	sendButton: [
		'div.ds-icon-button--l.ds-icon-button--sizing-container[role="button"][aria-disabled="false"]',
		'div.ds-icon-button--l[role="button"][aria-disabled="false"]',
		'button[type="submit"]',
		'button[aria-label*="send" i]',
		'button[aria-label*="enviar" i]',
		'.send-button',
		'[data-testid="send-button"]',
	],
};

/**
 * Wait for an element to appear in the DOM
 */
const waitForElement = (selectors: string[], timeout = 10000): Promise<Element | null> => {
	return new Promise((resolve) => {
		// Check if element already exists
		for (const selector of selectors) {
			const element = document.querySelector(selector);
			if (element) {
				resolve(element);
				return;
			}
		}

		// Set up observer to wait for element
		const observer = new MutationObserver(() => {
			for (const selector of selectors) {
				const element = document.querySelector(selector);
				if (element) {
					observer.disconnect();
					resolve(element);
					return;
				}
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		// Timeout
		setTimeout(() => {
			observer.disconnect();
			resolve(null);
		}, timeout);
	});
};

/**
 * Set value in textarea using native setter (works with React)
 */
const setTextareaValue = (element: Element, value: string): boolean => {
	try {
		if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
			// Use native setter to bypass React's controlled input
			const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
				element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
				'value'
			)?.set;

			if (nativeInputValueSetter) {
				nativeInputValueSetter.call(element, value);
			} else {
				element.value = value;
			}

			// Dispatch InputEvent which React listens to
			const inputEvent = new InputEvent('input', {
				bubbles: true,
				cancelable: true,
				inputType: 'insertText',
				data: value,
			});
			element.dispatchEvent(inputEvent);

			// Also dispatch change event
			element.dispatchEvent(new Event('change', { bubbles: true }));

			return true;
		} else if (element.getAttribute('contenteditable') === 'true') {
			// Contenteditable div
			element.textContent = value;
			element.dispatchEvent(new InputEvent('input', {
				bubbles: true,
				cancelable: true,
				inputType: 'insertText',
				data: value,
			}));
			return true;
		}
		return false;
	} catch (error) {
		console.error('[Resumir DeepSeek] Error setting textarea value:', error);
		return false;
	}
};

/**
 * Submit by pressing Enter key on the textarea
 */
const submitWithEnter = (textarea: Element): boolean => {
	try {
		const enterEvent = new KeyboardEvent('keydown', {
			key: 'Enter',
			code: 'Enter',
			keyCode: 13,
			which: 13,
			bubbles: true,
			cancelable: true,
		});
		textarea.dispatchEvent(enterEvent);
		console.log('[Resumir DeepSeek] Dispatched Enter key event');
		return true;
	} catch (error) {
		console.error('[Resumir DeepSeek] Error dispatching Enter:', error);
		return false;
	}
};

/**
 * Find and click the send button
 */
const clickSendButton = async (textarea?: Element): Promise<boolean> => {
	// Wait a bit for the button to become enabled after text input
	await new Promise(resolve => setTimeout(resolve, 500));

	// First try to find and click the send button
	for (const selector of SELECTORS.sendButton) {
		try {
			const elements = document.querySelectorAll(selector);
			for (const element of elements) {
				if (element instanceof HTMLElement) {
					// Check if button is visible and enabled
					const style = window.getComputedStyle(element);
					const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
					const isDisabled = element.getAttribute('aria-disabled') === 'true' ||
						(element as HTMLButtonElement).disabled;

					if (isVisible && !isDisabled) {
						element.click();
						console.log('[Resumir DeepSeek] Clicked send button:', selector);
						return true;
					}
				}
			}
		} catch (error) {
			// Continue trying other selectors
		}
	}

	// If no button found, try submitting with Enter key
	if (textarea) {
		console.log('[Resumir DeepSeek] No send button found, trying Enter key');
		return submitWithEnter(textarea);
	}

	console.warn('[Resumir DeepSeek] Could not find send button');
	return false;
};

/**
 * Inject prompt into DeepSeek chat
 */
const injectPrompt = async (prompt: string): Promise<{ success: boolean; error?: string }> => {
	console.log('[Resumir DeepSeek] Injecting prompt...');

	// Wait for textarea to be available
	const textarea = await waitForElement(SELECTORS.textarea);

	if (!textarea) {
		return {
			success: false,
			error: 'Could not find chat input. Please make sure the DeepSeek chat page is fully loaded.'
		};
	}

	// Focus the textarea
	(textarea as HTMLElement).focus();

	// Set the value
	const valueSet = setTextareaValue(textarea, prompt);
	if (!valueSet) {
		return {
			success: false,
			error: 'Could not set text in chat input.'
		};
	}

	console.log('[Resumir DeepSeek] Prompt injected successfully');

	// Try to click send button (pass textarea for Enter key fallback)
	const sent = await clickSendButton(textarea);

	if (!sent) {
		// If we couldn't auto-send, at least the text is there
		return {
			success: true,
			error: 'Text injected but could not auto-send. Please click the send button manually.'
		};
	}

	return { success: true };
};

/**
 * Check for pending prompt in storage and inject it
 */
const checkPendingPrompt = async () => {
	try {
		// Try chrome.storage first
		if (typeof chrome !== 'undefined' && chrome.storage?.local) {
			const result = await chrome.storage.local.get(DEEPSEEK_STORAGE_KEY);
			const pendingPrompt = result[DEEPSEEK_STORAGE_KEY];

			if (pendingPrompt) {
				console.log('[Resumir DeepSeek] Found pending prompt');

				// Clear the stored prompt immediately to prevent re-injection on refresh
				await chrome.storage.local.remove(DEEPSEEK_STORAGE_KEY);

				// Wait for page to be fully ready
				await new Promise(resolve => setTimeout(resolve, 2000));

				// Inject the prompt
				const result = await injectPrompt(pendingPrompt);

				if (!result.success) {
					console.error('[Resumir DeepSeek] Injection failed:', result.error);
					// Show alert to user
					alert(`Resumir: ${result.error}`);
				}
			}
		}
	} catch (error) {
		console.error('[Resumir DeepSeek] Error checking pending prompt:', error);
	}
};

/**
 * Listen for messages from the extension
 */
const setupMessageListener = () => {
	if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
		chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response: any) => void) => {
			if (message.action === 'INJECT_PROMPT') {
				console.log('[Resumir DeepSeek] Received INJECT_PROMPT message');

				injectPrompt(message.prompt).then(result => {
					sendResponse(result);
				});

				return true; // Keep channel open for async response
			}

			if (message.action === 'PING') {
				sendResponse({ success: true, ready: true });
				return false;
			}
		});
	}
};

// Initialize
console.log('[Resumir DeepSeek] Content script loaded');
setupMessageListener();

// Check for pending prompt when page loads
if (document.readyState === 'complete') {
	checkPendingPrompt();
} else {
	window.addEventListener('load', checkPendingPrompt);
}
