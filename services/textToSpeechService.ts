import { GoogleGenAI } from '@google/genai';

/**
 * Converts PCM audio data to a playable WAV blob
 * The Gemini TTS API returns audio as PCM at 24000Hz, 16-bit, mono
 */
function pcmToWav(pcmData: ArrayBuffer): Blob {
	const sampleRate = 24000;
	const numChannels = 1;
	const bitsPerSample = 16;
	const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
	const blockAlign = numChannels * (bitsPerSample / 8);
	const dataSize = pcmData.byteLength;
	const headerSize = 44;
	const totalSize = headerSize + dataSize;

	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);

	// RIFF header
	writeString(view, 0, 'RIFF');
	view.setUint32(4, totalSize - 8, true);
	writeString(view, 8, 'WAVE');

	// fmt chunk
	writeString(view, 12, 'fmt ');
	view.setUint32(16, 16, true); // chunk size
	view.setUint16(20, 1, true); // audio format (PCM)
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitsPerSample, true);

	// data chunk
	writeString(view, 36, 'data');
	view.setUint32(40, dataSize, true);

	// Copy PCM data
	const pcmView = new Uint8Array(pcmData);
	const wavView = new Uint8Array(buffer);
	wavView.set(pcmView, headerSize);

	return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
}

export type AudioState = 'idle' | 'loading' | 'playing';

export interface TextToSpeechResult {
	audioBlob: Blob;
	audioUrl: string;
}

/**
 * Generates speech audio from text using the Gemini TTS API
 * @param text The text to convert to speech
 * @param apiKey The Gemini API key
 * @returns Audio blob and URL for playback
 */
export async function generateSpeech(text: string, apiKey: string): Promise<TextToSpeechResult> {
	if (!apiKey || !apiKey.trim()) {
		throw new Error('API Key not found');
	}

	if (!text || !text.trim()) {
		throw new Error('No text provided');
	}

	const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

	// Use the TTS model with natural voice
	const response = await ai.models.generateContent({
		model: 'gemini-2.5-flash-preview-tts',
		contents: [{ parts: [{ text: text.trim() }] }],
		config: {
			responseModalities: ['AUDIO'],
			speechConfig: {
				voiceConfig: {
					prebuiltVoiceConfig: { voiceName: 'Kore' },
				},
			},
		},
	});

	// Extract the audio data from the response
	const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

	if (!audioData) {
		throw new Error('No audio data received from API');
	}

	// Convert base64 to ArrayBuffer
	const binaryString = atob(audioData);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}

	// Convert PCM to WAV
	const wavBlob = pcmToWav(bytes.buffer);
	const audioUrl = URL.createObjectURL(wavBlob);

	return {
		audioBlob: wavBlob,
		audioUrl,
	};
}

/**
 * Cleans up an audio URL created by generateSpeech
 */
export function revokeAudioUrl(url: string): void {
	if (url) {
		URL.revokeObjectURL(url);
	}
}
