# Privacy Policy

**Last Updated: December 15, 2025**

## Introduction

Resumir ("we", "our", or "the extension") is a Chrome browser extension that helps users analyze YouTube videos using Google's Gemini AI. We are committed to protecting your privacy and being transparent about how we handle your data.

## Summary

**Your data stays on your device.** Resumir is designed with a privacy-first approach:
- All data is stored locally in your browser
- We do not operate any external servers
- We do not collect, track, or share your personal information
- The only external communication is with Google's Gemini API (using your own API key)

## Information We Collect

### Information You Provide

| Data Type | Purpose | Storage Location |
|-----------|---------|------------------|
| **Google Gemini API Key** | Required to enable AI-powered video analysis | Chrome's local storage (`chrome.storage.local`) |
| **Questions/Queries** | To generate answers about video content | Cached locally in IndexedDB |
| **Language Preference** | To display the interface in your preferred language | Browser's localStorage |

### Information Automatically Processed

| Data Type | Purpose | Storage Location |
|-----------|---------|------------------|
| **YouTube Video ID & URL** | To identify videos and cache summaries | IndexedDB (local) |
| **Video Transcripts** | Extracted from YouTube's built-in captions to enable AI analysis | Temporarily processed, then cached locally |
| **Generated Summaries** | Cached results for faster access on repeat visits | IndexedDB (local) |

## How We Use Your Information

Your information is used exclusively for the core functionality of the extension:

1. **Video Analysis**: Transcripts are sent to Google's Gemini API to generate summaries and answer your questions
2. **Caching**: Results are stored locally to provide faster access when you revisit videos
3. **Personalization**: Your language preference is saved to display the interface in your chosen language

## Data Sharing

### What We Share

| Recipient | Data Shared | Purpose |
|-----------|-------------|---------|
| **Google Gemini API** | Video transcripts, your questions, your API key | To perform AI analysis and generate responses |

### What We Do NOT Do

- We do **not** operate any backend servers
- We do **not** collect analytics or telemetry
- We do **not** track your browsing behavior
- We do **not** sell or share your data with third parties
- We do **not** display advertisements
- We do **not** create user profiles or accounts

## Data Storage

All data is stored locally on your device:

| Storage Method | Data Stored | Retention |
|----------------|-------------|-----------|
| `chrome.storage.local` | API key | Until you clear it or uninstall the extension |
| `IndexedDB` | Video summaries, timestamps, cached answers | Until you clear browser data or uninstall |
| `localStorage` | Language preference | Until you clear browser data or uninstall |

## Third-Party Services

### Google Gemini API

When you use Resumir, video transcripts and your questions are sent to Google's Gemini API for processing. This communication is governed by:
- [Google's Terms of Service](https://policies.google.com/terms)
- [Google's Privacy Policy](https://policies.google.com/privacy)
- [Google AI Terms of Service](https://ai.google.dev/terms)

**Note**: You provide your own API key, and we do not have access to your Google account or API usage data.

### YouTube

Resumir accesses publicly available caption/transcript data from YouTube videos you are watching. This is done through standard browser interactions and does not involve any YouTube API calls or authentication.

## Your Rights and Controls

You have full control over your data:

| Action | How To |
|--------|--------|
| **Delete API Key** | Use the "Clear API Key" option in the extension |
| **Clear Cached Data** | Clear your browser's IndexedDB data or uninstall the extension |
| **Reset Language** | Clear localStorage or select a new language in the extension |
| **Remove All Data** | Uninstall the extension from Chrome |

## Data Security

We implement the following security measures:

- **Local Storage**: Your API key is stored in Chrome's secure local storage, which is encrypted by the browser
- **No External Transmission**: Data is never sent to our servers (we don't have any)
- **Minimal Permissions**: We only request the permissions necessary for core functionality:
  - `sidePanel`: Display the extension interface
  - `tabs`: Detect when you're on YouTube
  - `scripting`: Extract transcripts from YouTube pages
  - `webNavigation`: Track YouTube URL changes

## Children's Privacy

Resumir is not directed at children under 13 years of age. We do not knowingly collect personal information from children.

## Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this document. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Open Source

Resumir is open source. You can review our code to verify our privacy practices:
- [GitHub Repository](https://github.com/frederico-kluser/resumir)

## Contact

If you have any questions or concerns about this Privacy Policy, please open an issue on our GitHub repository.

---

## Summary Table

| Aspect | Details |
|--------|---------|
| **Data Collection** | Minimal (API key, preferences, video data) |
| **Data Storage** | 100% local (your browser only) |
| **External Services** | Google Gemini API only |
| **Tracking/Analytics** | None |
| **Advertisements** | None |
| **Data Selling** | Never |
| **User Accounts** | Not required |

---

*This privacy policy is provided in good faith to explain how Resumir handles data. For the most accurate and up-to-date information, please review the source code.*
