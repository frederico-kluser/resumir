// Content script to handle DOM interaction on YouTube

// Helper to wait for an element to appear in the DOM
const waitForElement = (selector: string, timeout = 5000): Promise<Element | null> => {
	return new Promise((resolve) => {
		if (document.querySelector(selector)) {
			return resolve(document.querySelector(selector));
		}

		const observer = new MutationObserver(() => {
			if (document.querySelector(selector)) {
				resolve(document.querySelector(selector));
				observer.disconnect();
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		setTimeout(() => {
			observer.disconnect();
			resolve(null);
		}, timeout);
	});
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value?: string | null) =>
	(value ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();

const createTranscriptError = (code: string, message: string) => {
	const error = new Error(message);
	(error as any).code = code;
	return error;
};

const TRANSCRIPT_LABEL_KEYWORDS = [
	'show transcript',
	'view transcript',
	'open transcript',
	'transcript',
	'mostrar transcrição',
	'ver transcrição',
	'exibir transcrição',
	'mostrar transcricao',
	'ver transcricao',
	'mostrar transcripción',
	'ver transcripción',
	'mostrar transcripcion',
	'ver transcripcion',
	'afficher la transcription',
	'voir la transcription',
	'transcription',
	'trascrizione',
	'mostra trascrizione',
	'visualizza trascrizione',
	'transkript anzeigen',
	'zeige transkript',
	'transkription anzeigen',
	'pokaż transkrypcję',
	'pokaz transkrypcje',
	'показать расшифровку',
	'расшифровка',
	'показать субтитры',
	'عرض النص',
	'اظهار النص',
	'عرض النسخ',
	'إظهار النسخ',
	'逐字稿',
	'字幕稿',
	'查看逐字稿',
	'显示逐字稿',
	'tampilkan transkrip',
	'lihat transkrip',
	'transkrip',
	'प्रतिलिपि दिखाएं',
	'प्रतिलिपि देखें',
	'प्रतिलिपि',
	'ট্রান্সক্রিপ্ট দেখান',
	'ট্রান্সক্রিপ্ট',
]
	.map((keyword) => normalizeText(keyword))
	.filter(Boolean);

const matchesTranscriptKeyword = (value?: string | null) => {
	const normalized = normalizeText(value);
	return normalized.length > 0 && TRANSCRIPT_LABEL_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const collectTranscriptCandidates = (): HTMLElement[] => {
	const selectors =
		'button, tp-yt-paper-button, yt-button-shape button, tp-yt-paper-item, yt-chip-cloud-chip-renderer, a[role="button"]';
	return Array.from(document.querySelectorAll(selectors)).filter(
		(element): element is HTMLElement => element instanceof HTMLElement,
	);
};

const findTranscriptButton = (): HTMLElement | null => {
	for (const element of collectTranscriptCandidates()) {
		const label = `${element.innerText ?? ''} ${element.getAttribute('aria-label') ?? ''}`;
		if (matchesTranscriptKeyword(label)) {
			return element;
		}
	}
	return null;
};

const locateTranscriptButton = async ({
	attemptMenu = true,
	closeMenuAfterMatch = true,
}: { attemptMenu?: boolean; closeMenuAfterMatch?: boolean } = {}): Promise<HTMLElement | null> => {
	let match = findTranscriptButton();
	if (match) {
		return match;
	}

	const expandButton = document.querySelector('#expand') as HTMLElement | null;
	if (expandButton) {
		expandButton.click();
		await sleep(400);
		match = findTranscriptButton();
		if (match) {
			return match;
		}
	}

	if (!attemptMenu) {
		return null;
	}

	const overflowButton =
		(document.querySelector(
			'ytd-watch-metadata #bottom-row ytd-menu-renderer yt-button-shape button',
		) as HTMLElement | null) ||
		(document.querySelector('#actions ytd-menu-renderer yt-button-shape button') as HTMLElement | null);

	if (!overflowButton) {
		return null;
	}

	const wasExpanded = overflowButton.getAttribute('aria-expanded') === 'true';
	let openedByScript = false;

	if (!wasExpanded) {
		overflowButton.click();
		openedByScript = true;
		await sleep(400);
	}

	match = findTranscriptButton();

	if (match) {
		if (closeMenuAfterMatch && openedByScript && overflowButton.getAttribute('aria-expanded') === 'true') {
			overflowButton.click();
		}
		return match;
	}

	if (openedByScript && overflowButton.getAttribute('aria-expanded') === 'true') {
		overflowButton.click();
	}

	return null;
};

const getPlayerResponse = () => {
	const win = window as any;
	if (win.ytInitialPlayerResponse) {
		return win.ytInitialPlayerResponse;
	}
	if (win.ytplayer?.config?.args?.raw_player_response) {
		return win.ytplayer.config.args.raw_player_response;
	}
	if (win.ytcfg?.data_?.PLAYER_CONFIG?.args?.raw_player_response) {
		return win.ytcfg.data_.PLAYER_CONFIG.args.raw_player_response;
	}
	const playerEl: any = document.querySelector('ytd-player');
	if (playerEl?.player_?.getPlayerResponse) {
		try {
			return playerEl.player_.getPlayerResponse();
		} catch (error) {
			console.warn('Failed to read player response', error);
		}
	}
	if (playerEl?.player_?.playerResponse) {
		return playerEl.player_.playerResponse;
	}
	return null;
};

const checkCaptionsAvailability = async () => {
	try {
		const response = getPlayerResponse();
		const trackCount = Number(response?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) || 0;
		const transcriptTrigger = await locateTranscriptButton({ attemptMenu: true, closeMenuAfterMatch: true });
		const hasCaptions = trackCount > 0 || Boolean(transcriptTrigger);

		return {
			success: true,
			hasCaptions,
			details: {
				trackCount,
				transcriptButtonFound: Boolean(transcriptTrigger),
			},
		};
	} catch (error: any) {
		console.error('Caption check failed:', error);
		return { success: false, error: error.message };
	}
};

// Main function to automate opening and reading the transcript
const extractTranscriptFromDOM = async () => {
	try {
		// 1. Expand the description if strictly necessary (usually 'Show transcript' is visible in the bottom bar or description actions)
		// Try to find the "Show transcript" button directly first.
		// YouTube UI varies: sometimes it's a button in the description primary links, sometimes in the overflow.

		// Strategy: leverage language-aware label detection so the button is found regardless of locale.
		const transcriptBtn = await locateTranscriptButton({ attemptMenu: true, closeMenuAfterMatch: false });

		if (transcriptBtn) {
			transcriptBtn.click();
		} else {
			// It might already be open? Check for segments directly.
			const existingSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
			if (existingSegments.length === 0) {
				throw createTranscriptError('NO_TRANSCRIPT', 'Could not find a transcript control on this page.');
			}
		}

		// 2. Wait for the transcript container segments to load
		const segmentSelector = 'ytd-transcript-segment-renderer';
		const firstSegment = await waitForElement(segmentSelector);

		if (!firstSegment) {
			throw createTranscriptError('TRANSCRIPT_TIMEOUT', 'Transcript panel did not load in time.');
		}

		return { success: true, transcript: document.querySelector('#segments-container').innerText };
	} catch (error: any) {
		console.error('Resumir Extraction Error:', error);
		return { success: false, error: error.message, errorCode: (error as any)?.code };
	}
};

const seekToTimestamp = (seconds: number) => {
	try {
		const parsed = Number(seconds);
		if (!Number.isFinite(parsed)) {
			throw new Error('INVALID_TIME');
		}

		const video = document.querySelector('video') as HTMLVideoElement | null;
		if (!video) {
			return { success: false, error: 'VIDEO_NOT_FOUND' };
		}

		const safeTime = Math.max(0, parsed);
		video.currentTime = safeTime;
		return { success: true, currentTime: video.currentTime };
	} catch (error: any) {
		console.error('Video seek failed:', error);
		return { success: false, error: error.message };
	}
};

// Listen for messages from the SidePanel
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
	if (request.action === 'CHECK_CAPTIONS') {
		checkCaptionsAvailability()
			.then((result) => sendResponse(result))
			.catch((error) => {
				console.error('Caption check failed:', error);
				sendResponse({ success: false, error: error?.message || 'UNKNOWN_ERROR' });
			});
		return true;
	}

	if (request.action === 'SEEK_TO') {
		const rawSeconds =
			typeof request.timeInSeconds === 'number' ? request.timeInSeconds : request.payload?.timeInSeconds;
		sendResponse(seekToTimestamp(rawSeconds));
		return;
	}

	if (request.action === 'EXTRACT_TRANSCRIPT') {
		extractTranscriptFromDOM().then((result) => {
			console.log('Transcript extraction result:', result);
			sendResponse(result);
		});
		return true; // Indicates async response
	}
});
