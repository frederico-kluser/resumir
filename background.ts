// This script runs in the background to detect YouTube tabs and show badge notifications
// when captions are available

declare var chrome: any;
declare var OffscreenCanvas: any;

// Track the state of caption availability per tab
const tabCaptionState: Map<number, boolean | null> = new Map();

// Icon states with emoji overlays
type IconState = 'default' | 'checking' | 'available';

// Cache for generated icon image data
const iconCache: Map<string, ImageData> = new Map();

// Load base icon as ImageBitmap
const loadBaseIcon = async (size: number): Promise<ImageBitmap> => {
  const response = await fetch(chrome.runtime.getURL(`assets/logo-${size}.png`));
  const blob = await response.blob();
  return createImageBitmap(blob);
};

// Generate icon with emoji overlay
const generateIconWithOverlay = async (
  size: number,
  emoji: string | null
): Promise<ImageData> => {
  const cacheKey = `${size}-${emoji || 'none'}`;

  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;

  // Draw base icon
  const baseIcon = await loadBaseIcon(size);
  ctx.drawImage(baseIcon, 0, 0, size, size);

  // Draw emoji overlay in top-right corner if provided
  if (emoji) {
    const emojiSize = Math.floor(size * 0.45);
    const x = size - emojiSize + Math.floor(size * 0.05);
    const y = -Math.floor(size * 0.05);

    ctx.font = `${emojiSize}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(emoji, x + emojiSize, y);
  }

  const imageData = ctx.getImageData(0, 0, size, size);
  iconCache.set(cacheKey, imageData);
  return imageData;
};

// Set icon for a specific tab based on state
const setIconState = async (tabId: number, state: IconState) => {
  try {
    let emoji: string | null = null;

    switch (state) {
      case 'checking':
        emoji = '💭'; // Thought bubble - processing
        break;
      case 'available':
        emoji = '🔍'; // Magnifying glass - captions available
        break;
      default:
        emoji = null; // No overlay
    }

    const [icon16, icon48] = await Promise.all([
      generateIconWithOverlay(16, emoji),
      generateIconWithOverlay(48, emoji),
    ]);

    await chrome.action.setIcon({
      tabId,
      imageData: {
        16: icon16,
        48: icon48,
      },
    });
  } catch (error) {
    console.warn('Failed to set icon:', error);
  }
};

// Reset icon to default state for a specific tab
const resetIcon = async (tabId: number) => {
  await setIconState(tabId, 'default');
};

// Handle side panel opening on click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: any) => console.error('Failed to set panel behavior:', error));

// Check captions availability for a tab
const checkCaptionsForTab = async (tabId: number) => {
  try {
    // Show checking state (thought bubble emoji)
    await setIconState(tabId, 'checking');

    // Send message to content script to check captions
    const response = await chrome.tabs.sendMessage(tabId, { action: 'CHECK_CAPTIONS' });

    if (response?.success && response.hasCaptions) {
      // Captions available - show magnifying glass emoji
      tabCaptionState.set(tabId, true);
      await setIconState(tabId, 'available');
    } else {
      // No captions available - reset to default icon
      tabCaptionState.set(tabId, false);
      await resetIcon(tabId);
    }
  } catch (error) {
    // Content script might not be ready yet, or communication failed
    console.warn('Failed to check captions for tab:', tabId, error);
    tabCaptionState.set(tabId, null);
    await resetIcon(tabId);
  }
};

// Check if URL is a YouTube video page
const isYouTubeVideoPage = (url: string | undefined): boolean => {
  return Boolean(url && url.includes('youtube.com/watch'));
};

// Monitor tab updates to detect YouTube video pages
chrome.tabs.onUpdated.addListener(
  async (tabId: number, changeInfo: any, tab: any) => {
    // Only process when the page is fully loaded
    if (changeInfo.status !== 'complete') {
      return;
    }

    if (isYouTubeVideoPage(tab.url)) {
      // Give the page a moment to fully initialize the player
      setTimeout(() => checkCaptionsForTab(tabId), 1500);
    } else {
      // Not a YouTube video page - reset icon and state
      tabCaptionState.delete(tabId);
      await resetIcon(tabId);
    }
  }
);

// Monitor tab activation to update icon when switching tabs
chrome.tabs.onActivated.addListener(async (activeInfo: { tabId: number }) => {
  const tabId = activeInfo.tabId;

  try {
    const tab = await chrome.tabs.get(tabId);

    if (isYouTubeVideoPage(tab.url)) {
      // Check if we already have state for this tab
      const cachedState = tabCaptionState.get(tabId);

      if (cachedState === true) {
        await setIconState(tabId, 'available');
      } else if (cachedState === false) {
        await resetIcon(tabId);
      } else {
        // Unknown state, check captions
        await checkCaptionsForTab(tabId);
      }
    } else {
      await resetIcon(tabId);
    }
  } catch (error) {
    console.warn('Failed to handle tab activation:', error);
  }
});

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener((tabId: number) => {
  tabCaptionState.delete(tabId);
});

// Handle URL changes within the same tab (YouTube SPA navigation)
chrome.webNavigation?.onHistoryStateUpdated?.addListener(
  async (details: { tabId: number; url: string }) => {
    const { tabId, url } = details;

    if (isYouTubeVideoPage(url)) {
      // New video loaded via SPA navigation, check captions after a delay
      setTimeout(() => checkCaptionsForTab(tabId), 1500);
    } else {
      // No longer on a video page
      tabCaptionState.delete(tabId);
      await resetIcon(tabId);
    }
  },
  { url: [{ hostContains: 'youtube.com' }] }
);

// Re-inject content script into a tab
const reinjectContentScript = async (tabId: number): Promise<boolean> => {
  try {
    // First check if the tab exists and is a YouTube video page
    const tab = await chrome.tabs.get(tabId);
    if (!isYouTubeVideoPage(tab.url)) {
      console.warn('Cannot reinject: not a YouTube video page');
      return false;
    }

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });

    console.log('Content script re-injected successfully for tab:', tabId);
    return true;
  } catch (error) {
    console.error('Failed to reinject content script:', error);
    return false;
  }
};

// Listen for messages from content script or side panel
chrome.runtime.onMessage.addListener(
  (request: any, sender: any, sendResponse: any) => {
    // Handle content script re-injection request
    if (request.action === 'REINJECT_CONTENT_SCRIPT') {
      const tabId = request.tabId;
      if (tabId) {
        reinjectContentScript(tabId)
          .then((success) => sendResponse({ success }))
          .catch((error) => sendResponse({ success: false, error: error?.message }));
        return true; // Indicates async response
      }
      sendResponse({ success: false, error: 'No tab ID provided' });
      return;
    }

    // Handle caption status updates from content script
    if (request.action === 'CAPTION_STATUS_UPDATE' && sender.tab?.id) {
      const tabId = sender.tab.id;
      const hasCaptions = request.hasCaptions;

      tabCaptionState.set(tabId, hasCaptions);

      if (hasCaptions) {
        setIconState(tabId, 'available');
      } else {
        resetIcon(tabId);
      }

      sendResponse({ success: true });
      return;
    }

    // Handle request to refresh caption check
    if (request.action === 'REFRESH_CAPTION_CHECK') {
      const tabId = request.tabId || sender.tab?.id;
      if (tabId) {
        checkCaptionsForTab(tabId);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No tab ID provided' });
      }
      return;
    }
  }
);
