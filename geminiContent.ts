/**
 * Gemini Content Script
 *
 * This content script is injected into gemini.google.com to:
 * 1. Receive prompts from the Resumir extension
 * 2. Inject the prompt into the chat textarea
 * 3. Automatically submit the message
 */

declare var chrome: any;

const GEMINI_STORAGE_KEY = 'resumir.gemini.pendingPrompt';

// Selectors for Gemini chat interface
const SELECTORS = {
	// Textarea selectors (Gemini uses rich-textarea and contenteditable)
	textarea: [
		'rich-textarea[aria-label]',
		'rich-textarea .ql-editor',
		'.ql-editor[contenteditable="true"]',
		'[contenteditable="true"][aria-label*="prompt" i]',
		'[contenteditable="true"][aria-label*="Enter" i]',
		'[contenteditable="true"]',
		'textarea[aria-label*="prompt" i]',
		'textarea',
	],
	// Send button selectors
	sendButton: [
		'button[aria-label*="Send" i]',
		'button[aria-label*="Enviar" i]',
		'button.send-button',
		'button[mat-icon-button] mat-icon',
		'button mat-icon[fonticon="send"]',
		'button[aria-label*="message" i]',
		'.send-button-container button',
		'button[type="submit"]',
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
 * Set value in textarea (handles Gemini's rich-textarea and contenteditable)
 */
const setTextareaValue = (element: Element, value: string): boolean => {
	try {
		// Gemini uses contenteditable divs with Quill editor
		if (element.getAttribute('contenteditable') === 'true' ||
			element.classList.contains('ql-editor') ||
			element.tagName.toLowerCase() === 'rich-textarea') {

			// Find the actual editable element
			let editableElement = element;
			if (element.tagName.toLowerCase() === 'rich-textarea') {
				const qlEditor = element.querySelector('.ql-editor');
				if (qlEditor) {
					editableElement = qlEditor;
				}
			}

			// Clear existing content and set new value
			editableElement.innerHTML = '';
			const p = document.createElement('p');
			p.textContent = value;
			editableElement.appendChild(p);

			// Dispatch input event
			editableElement.dispatchEvent(new InputEvent('input', {
				bubbles: true,
				cancelable: true,
				inputType: 'insertText',
				data: value,
			}));

			// Also dispatch on the rich-textarea parent if exists
			if (element.tagName.toLowerCase() === 'rich-textarea') {
				element.dispatchEvent(new InputEvent('input', {
					bubbles: true,
					cancelable: true,
					inputType: 'insertText',
					data: value,
				}));
			}

			return true;
		} else if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
			// Regular textarea/input fallback
			const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
				element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
				'value'
			)?.set;

			if (nativeInputValueSetter) {
				nativeInputValueSetter.call(element, value);
			} else {
				element.value = value;
			}

			element.dispatchEvent(new InputEvent('input', {
				bubbles: true,
				cancelable: true,
				inputType: 'insertText',
				data: value,
			}));
			element.dispatchEvent(new Event('change', { bubbles: true }));
			return true;
		}
		return false;
	} catch (error) {
		console.error('[Resumir Gemini] Error setting textarea value:', error);
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
		console.log('[Resumir Gemini] Dispatched Enter key event');
		return true;
	} catch (error) {
		console.error('[Resumir Gemini] Error dispatching Enter:', error);
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
						console.log('[Resumir Gemini] Clicked send button:', selector);
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
		console.log('[Resumir Gemini] No send button found, trying Enter key');
		return submitWithEnter(textarea);
	}

	console.warn('[Resumir Gemini] Could not find send button');
	return false;
};

/**
 * Inject prompt into Gemini chat
 */
const injectPrompt = async (prompt: string): Promise<{ success: boolean; error?: string }> => {
	console.log('[Resumir Gemini] Injecting prompt...');

	// Wait for textarea to be available
	const textarea = await waitForElement(SELECTORS.textarea);

	if (!textarea) {
		return {
			success: false,
			error: 'Could not find chat input. Please make sure the Gemini page is fully loaded.'
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

	console.log('[Resumir Gemini] Prompt injected successfully');

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
			const result = await chrome.storage.local.get(GEMINI_STORAGE_KEY);
			const pendingPrompt = result[GEMINI_STORAGE_KEY];

			if (pendingPrompt) {
				console.log('[Resumir Gemini] Found pending prompt');

				// Clear the stored prompt immediately to prevent re-injection on refresh
				await chrome.storage.local.remove(GEMINI_STORAGE_KEY);

				// Wait for page to be fully ready
				await new Promise(resolve => setTimeout(resolve, 2000));

				// Inject the prompt
				const result = await injectPrompt(pendingPrompt);

				if (!result.success) {
					console.error('[Resumir Gemini] Injection failed:', result.error);
					// Show alert to user
					alert(`Resumir: ${result.error}`);
				}
			}
		}
	} catch (error) {
		console.error('[Resumir Gemini] Error checking pending prompt:', error);
	}
};

/**
 * Listen for messages from the extension
 */
const setupMessageListener = () => {
	if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
		chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response: any) => void) => {
			if (message.action === 'INJECT_PROMPT') {
				console.log('[Resumir Gemini] Received INJECT_PROMPT message');

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
console.log('[Resumir Gemini] Content script loaded');
setupMessageListener();

// Check for pending prompt when page loads
if (document.readyState === 'complete') {
	checkPendingPrompt();
} else {
	window.addEventListener('load', checkPendingPrompt);
}
