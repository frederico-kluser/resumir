import { TranscriptSegment } from './types';

// Mocking a Tech Review Video Transcript
export const MOCK_TRANSCRIPT: TranscriptSegment[] = [
  { start: 0, duration: 5, text: "Hey everyone, welcome back to the channel. Today we are reviewing the new AI Pin." },
  { start: 5, duration: 4, text: "It's a device that promises to replace your smartphone, but does it deliver?" },
  { start: 10, duration: 6, text: "Let's start with the design. It's incredibly small, magnetic, and feels premium." },
  { start: 17, duration: 8, text: "However, the battery life is the first major issue I encountered. It barely lasts 4 hours of heavy use." },
  { start: 26, duration: 5, text: "The projector display is cool, but in direct sunlight, it's basically invisible." },
  { start: 32, duration: 10, text: "Now, let's talk about the AI features. The translation is fast, but the hallucination rate is still too high for reliable work." },
  { start: 43, duration: 7, text: "I tried asking it to summarize my emails, and it missed three important messages from my boss." },
  { start: 51, duration: 6, text: "The camera quality is decent for 720p, but don't expect cinematic vlog quality here." },
  { start: 58, duration: 5, text: "Price? It costs $699 plus a $24 monthly subscription." },
  { start: 64, duration: 8, text: "In conclusion, it's a piece of future tech that isn't quite ready for the present. I'd wait for version 2." }
];

export const getFullTranscriptText = (): string => {
  return MOCK_TRANSCRIPT.map(seg => `[${formatTime(seg.start)}] ${seg.text}`).join("\n");
};

export const formatTime = (seconds: number): string => {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};