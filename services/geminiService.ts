import { GoogleGenAI, Type } from '@google/genai';
import {
	AnalysisResult,
	LanguageOption,
	UserAnswerResult,
	ValidationResult,
	ValidationIssue,
	Highlight,
} from '../types';

// We do NOT initialize 'ai' globally anymore.
// The key might not be selected when the file is first loaded.
// We initialize it inside the function call to grab the latest process.env.API_KEY.

// Store the original prompt for validation purposes
let lastAnalysisPrompt: string = '';

/**
 * Answers a specific user question based on the transcript.
 * This is a separate prompt focused ONLY on answering the user's question.
 */
export const answerUserQuestion = async (
	transcript: string,
	userQuery: string,
	apiKey: string,
	targetLanguage: LanguageOption,
): Promise<UserAnswerResult> => {
	if (!apiKey || !apiKey.trim()) {
		throw new Error('API Key not found. Please connect your Google account.');
	}

	const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
	const languageName = targetLanguage?.name ?? 'English';
	const languageCode = targetLanguage?.code ?? 'en';
	const sanitizedTranscript = transcript?.trim();
	const transcriptSection = sanitizedTranscript
		? `## Transcript\n${sanitizedTranscript}`
		: '## Transcript\nTranscript unavailable.';

	const prompt = `<role_and_objective>
You are Resumir's video analysis agent. Your mission is to answer the user's specific question based on the YouTube video transcript. Respond in ${languageName} (${languageCode}).
</role_and_objective>

<critical_rules>
IMPORTANT - You MUST follow these rules:
1. ALWAYS respond in ${languageName} (${languageCode}), preserving proper nouns and technical terms
2. ALWAYS cite exact timestamps in [MM:SS] format for every claim you make
3. NEVER invent or hallucinate content not present in the transcript
4. If the transcript does not contain information to answer this question, state that clearly instead of guessing
</critical_rules>

<user_question>
${userQuery}
</user_question>

<instructions>
## How to Answer
- Use Chain-of-Thought reasoning: think step by step about what the user wants
- Find the relevant parts of the transcript that answer the question
- Cite exact timestamps [MM:SS] for every claim you make
- Be direct and concise in your answer
- If the information is not in the transcript, say so clearly

## Timestamp Handling
- Use [MM:SS] format consistently (e.g., [01:30], [12:45])
- Include time ranges when relevant (e.g., "01:20 - 01:45")
</instructions>

<context>
${transcriptSection}
</context>

<output_format>
Return ONLY valid JSON conforming to the response schema.
- text: Your direct answer to the user's question
- relatedSegments: Array of time ranges relevant to the answer (e.g., "01:20 - 01:45")
Do NOT include markdown formatting, code blocks, or extra fields.
</output_format>

<reminder>
CRITICAL: Respond entirely in ${languageName}. Include accurate [MM:SS] timestamps. Never fabricate information not in the transcript.
</reminder>`;

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: prompt,
			config: {
				responseMimeType: 'application/json',
				responseSchema: {
					type: Type.OBJECT,
					properties: {
						text: { type: Type.STRING, description: "Direct answer to the user's question" },
						relatedSegments: {
							type: Type.ARRAY,
							items: { type: Type.STRING },
							description: "List of time ranges relevant to the answer (e.g., '01:20 - 01:45')",
						},
					},
					required: ['text', 'relatedSegments'],
				},
			},
		});

		if (response.text) {
			const data = JSON.parse(response.text);
			return data as UserAnswerResult;
		}

		throw new Error('Empty response from Gemini');
	} catch (error) {
		console.error('Gemini API Error (answerUserQuestion):', error);
		throw error;
	}
};

/**
 * Analyzes the video transcript and provides a summary with key moments.
 * This prompt does NOT include user questions - it's purely for summarization.
 * This version does NOT validate/improve the result - use improveResult() for that.
 */
export const analyzeVideo = async (
	transcript: string,
	apiKey: string,
	targetLanguage: LanguageOption,
): Promise<Omit<AnalysisResult, 'customAnswer'>> => {
	if (!apiKey || !apiKey.trim()) {
		throw new Error('API Key not found. Please connect your Google account.');
	}

	const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
	const languageName = targetLanguage?.name ?? 'English';
	const languageCode = targetLanguage?.code ?? 'en';
	const sanitizedTranscript = transcript?.trim();
	const transcriptSection = sanitizedTranscript
		? `## Transcript\n${sanitizedTranscript}`
		: '## Transcript\nTranscript unavailable. Explain why and request assistance extracting it.';

	const prompt = `<role_and_objective>
You are Resumir's video analysis agent. Your mission is to analyze YouTube video transcripts and provide structured summaries with navigable timestamps in ${languageName} (${languageCode}).
</role_and_objective>

<critical_rules>
IMPORTANT - You MUST follow these rules:
1. ALWAYS respond in ${languageName} (${languageCode}), preserving proper nouns and technical terms
2. ALWAYS include timestamps in [MM:SS] format for every key moment
3. NEVER invent or hallucinate content not present in the transcript
4. If information is insufficient, acknowledge the limitation instead of guessing
</critical_rules>

<instructions>
## Analysis Approach
- Read the transcript carefully and identify the main themes
- Extract 3-5 key moments that capture the video's essence
- Create a concise summary (~100 words) that answers: What? Why? For whom?

## Timestamp Handling
- Use [MM:SS] format consistently (e.g., [01:30], [12:45])
- Each key moment MUST have an accurate timestamp from the transcript
- When citing claims, include the timestamp where that information appears

## Tone and Style
- Be concise and direct
- Focus on actionable insights
- Use clear, accessible language appropriate for ${languageName}

## Error Recovery
- If the transcript is empty or corrupted, explain the issue clearly
- If certain sections are unclear, note this and provide best-effort analysis
- Suggest alternatives if complete analysis is not possible
</instructions>

<context>
${transcriptSection}
</context>

<reasoning_steps>
Before generating your response, follow these steps:
1. Scan the transcript to understand the overall topic and structure
2. Identify the main argument or narrative thread
3. Select 3-5 moments that best represent the content
4. Verify each timestamp matches the actual content
5. Structure your response according to the output schema
</reasoning_steps>

<output_format>
Return ONLY valid JSON conforming to the response schema.
- summary: Executive summary of ~100 words
- keyMoments: Array of 3-5 objects with timestamp and description
Do NOT include markdown formatting, code blocks, or extra fields.
</output_format>

<reminder>
CRITICAL: Respond entirely in ${languageName}. Include accurate [MM:SS] timestamps. Never fabricate information not in the transcript.
</reminder>`;

	// Store the prompt for later validation
	lastAnalysisPrompt = prompt;

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: prompt,
			config: {
				responseMimeType: 'application/json',
				responseSchema: {
					type: Type.OBJECT,
					properties: {
						summary: {
							type: Type.STRING,
							description: 'A concise executive summary of the video content (approx 100 words).',
						},
						keyMoments: {
							type: Type.ARRAY,
							description: 'A list of 3-5 crucial moments in the video.',
							items: {
								type: Type.OBJECT,
								properties: {
									timestamp: { type: Type.STRING, description: 'Start time of the moment (MM:SS)' },
									description: { type: Type.STRING, description: 'Brief title or description of the moment' },
								},
								required: ['timestamp', 'description'],
							},
						},
					},
					required: ['summary', 'keyMoments'],
				},
			},
		});

		if (response.text) {
			const data = JSON.parse(response.text) as AnalysisResult;

			// Filter out any keyMoments that are missing required fields (timestamp or description)
			// This is a safety net in case the schema validation doesn't catch everything
			if (data.keyMoments && Array.isArray(data.keyMoments)) {
				data.keyMoments = data.keyMoments.filter((moment) => {
					const hasTimestamp =
						moment.timestamp && typeof moment.timestamp === 'string' && moment.timestamp.trim() !== '';
					const hasDescription =
						moment.description && typeof moment.description === 'string' && moment.description.trim() !== '';
					if (!hasTimestamp || !hasDescription) {
						console.warn('Filtered out invalid keyMoment:', moment);
					}
					return hasTimestamp && hasDescription;
				});
			}

			return data as Omit<AnalysisResult, 'customAnswer'>;
		}

		throw new Error('Empty response from Gemini');
	} catch (error) {
		console.error('Gemini API Error:', error);
		throw error;
	}
};

/**
 * Improves an existing analysis result by validating against the transcript
 * and fixing any issues found. This is a separate step from initial generation.
 */
export const improveResult = async (
	result: AnalysisResult,
	transcript: string,
	apiKey: string,
	targetLanguage: LanguageOption,
): Promise<AnalysisResult> => {
	if (!apiKey || !apiKey.trim()) {
		throw new Error('API Key not found. Please connect your Google account.');
	}

	const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
	const languageName = targetLanguage?.name ?? 'English';
	const languageCode = targetLanguage?.code ?? 'en';
	const sanitizedTranscript = transcript?.trim() || '';

	// Use the stored prompt or create a minimal one
	const originalPrompt = lastAnalysisPrompt || `Analyze in ${languageName} (${languageCode})`;

	const validatedResult = await validateAndFixResult(
		ai,
		result,
		sanitizedTranscript,
		originalPrompt,
		languageName,
		languageCode,
	);

	return validatedResult;
};

/**
 * Validates the analysis result against the original transcript
 * and returns a list of issues with corrections
 */
const validateResult = async (
	ai: GoogleGenAI,
	result: AnalysisResult,
	transcript: string,
	originalPrompt: string,
	languageName: string,
	languageCode: string,
): Promise<ValidationResult> => {
	const validationPrompt = `<role_and_objective>
You are a strict quality assurance agent for Resumir. Your mission is to validate video analysis results against the original transcript and identify any errors or inconsistencies.
</role_and_objective>

<critical_rules>
IMPORTANT - You MUST follow these rules:
1. Compare EVERY claim in the result against the actual transcript
2. Verify ALL timestamps are accurate and exist in the transcript
3. Check that the response is in the correct language: ${languageName} (${languageCode})
4. Identify any hallucinated content (information not present in transcript)
5. Be thorough but fair - only flag genuine issues
</critical_rules>

<original_prompt>
${originalPrompt}
</original_prompt>

<analysis_result_to_validate>
${JSON.stringify(result, null, 2)}
</analysis_result_to_validate>

<original_transcript>
${transcript}
</original_transcript>

<validation_instructions>
For each issue found, you MUST provide:
1. Which field has the problem (summary, keyMoments, customAnswer)
2. For keyMoments, specify the array index (0-based)
3. The type of issue:
   - "incorrect_timestamp": timestamp doesn't match the content in transcript
   - "hallucination": information not present in the transcript
   - "missing_info": important information from transcript was omitted
   - "inaccurate_description": description doesn't match what's said at that timestamp
   - "wrong_language": content is not in ${languageName}
4. A clear description of what's wrong
5. The correction with:
   - action: "replace" (fix the value), "remove" (delete it), or "add" (add missing content)
   - value: the corrected content (for replace/add actions)

For keyMoments corrections:
- The value must be an object with "timestamp" (string, MM:SS format) and "description" (string)

For summary corrections:
- The value must be a string

For customAnswer corrections:
- The value must be an object with "text" (string) and "relatedSegments" (string array)
</validation_instructions>

<output_format>
Return a JSON object with:
- isValid: boolean (true if no issues found)
- issues: array of issue objects (empty if isValid is true)

Be precise and only report real issues. If the result is accurate, return isValid: true with empty issues array.
</output_format>`;

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: validationPrompt,
			config: {
				responseMimeType: 'application/json',
				responseSchema: {
					type: Type.OBJECT,
					properties: {
						isValid: {
							type: Type.BOOLEAN,
							description: 'Whether the analysis result is valid and accurate',
						},
						issues: {
							type: Type.ARRAY,
							description: 'List of issues found in the analysis result',
							items: {
								type: Type.OBJECT,
								properties: {
									field: {
										type: Type.STRING,
										description: 'The field with the issue: summary, keyMoments, or customAnswer',
									},
									index: {
										type: Type.NUMBER,
										description: 'For keyMoments, the 0-based index of the problematic item',
										nullable: true,
									},
									issueType: {
										type: Type.STRING,
										description:
											'Type of issue: incorrect_timestamp, hallucination, missing_info, inaccurate_description, wrong_language',
									},
									description: {
										type: Type.STRING,
										description: "Clear description of what's wrong",
									},
									correction: {
										type: Type.OBJECT,
										description: 'How to fix the issue',
										properties: {
											action: {
												type: Type.STRING,
												description: 'Action to take: replace, remove, or add',
											},
											value: {
												type: Type.OBJECT,
												description:
													'The corrected value (structure depends on field type). For keyMoments: must include both timestamp and description. For summary: must include text. For customAnswer: must include text and relatedSegments.',
												nullable: true,
												properties: {
													// For string fields (summary) and customAnswer
													text: {
														type: Type.STRING,
														nullable: true,
														description: 'Required for summary and customAnswer corrections',
													},
													// For keyMoments - both timestamp and description are required together
													timestamp: {
														type: Type.STRING,
														nullable: true,
														description: 'Required for keyMoments corrections (MM:SS format)',
													},
													description: {
														type: Type.STRING,
														nullable: true,
														description: 'Required for keyMoments corrections',
													},
													// For customAnswer
													relatedSegments: {
														type: Type.ARRAY,
														items: { type: Type.STRING },
														nullable: true,
														description: 'Required for customAnswer corrections',
													},
												},
											},
										},
										required: ['action'],
									},
								},
								required: ['field', 'issueType', 'description', 'correction'],
							},
						},
					},
					required: ['isValid', 'issues'],
				},
			},
		});

		if (response.text) {
			return JSON.parse(response.text) as ValidationResult;
		}

		return { isValid: true, issues: [] };
	} catch (error) {
		console.error('Validation Error:', error);
		// If validation fails, assume the original result is valid
		return { isValid: true, issues: [] };
	}
};

/**
 * Applies corrections from validation issues to the analysis result
 */
const applyCorrections = (result: AnalysisResult, issues: ValidationIssue[]): AnalysisResult => {
	// Create a deep copy to avoid mutating the original
	const correctedResult: AnalysisResult = JSON.parse(JSON.stringify(result));

	// Sort issues by field and index to process them in order
	// Process removals in reverse order to avoid index shifting
	const sortedIssues = [...issues].sort((a, b) => {
		if (a.field !== b.field) return a.field.localeCompare(b.field);
		if (a.correction.action === 'remove' && b.correction.action !== 'remove') return 1;
		if (a.correction.action !== 'remove' && b.correction.action === 'remove') return -1;
		return (b.index ?? 0) - (a.index ?? 0); // Reverse order for removals
	});

	for (const issue of sortedIssues) {
		const { field, index, correction } = issue;

		switch (field) {
			case 'summary':
				if (correction.action === 'replace' && correction.value) {
					// Handle both string and object value formats
					const newValue =
						typeof correction.value === 'string'
							? correction.value
							: (correction.value as any).text || (correction.value as any).description;
					if (newValue) {
						correctedResult.summary = newValue;
					}
				}
				break;

			case 'keyMoments':
				if (index !== undefined && index >= 0) {
					if (correction.action === 'remove') {
						correctedResult.keyMoments.splice(index, 1);
					} else if (correction.action === 'replace' && correction.value) {
						const value = correction.value as any;
						const newMoment: Highlight = {
							timestamp: value.timestamp || correctedResult.keyMoments[index]?.timestamp || '00:00',
							description: value.description || value.text || '',
						};
						if (index < correctedResult.keyMoments.length) {
							correctedResult.keyMoments[index] = newMoment;
						}
					}
				} else if (correction.action === 'add' && correction.value) {
					const value = correction.value as any;
					const newMoment: Highlight = {
						timestamp: value.timestamp || '00:00',
						description: value.description || value.text || '',
					};
					correctedResult.keyMoments.push(newMoment);
				}
				break;

			case 'customAnswer':
				if (correction.action === 'remove') {
					delete correctedResult.customAnswer;
				} else if (correction.action === 'replace' && correction.value) {
					const value = correction.value as any;
					correctedResult.customAnswer = {
						text: value.text || '',
						relatedSegments: value.relatedSegments || [],
					};
				} else if (correction.action === 'add' && correction.value && !correctedResult.customAnswer) {
					const value = correction.value as any;
					correctedResult.customAnswer = {
						text: value.text || '',
						relatedSegments: value.relatedSegments || [],
					};
				}
				break;
		}
	}

	return correctedResult;
};

/**
 * Validates the analysis result and applies corrections if needed
 */
const validateAndFixResult = async (
	ai: GoogleGenAI,
	result: AnalysisResult,
	transcript: string,
	originalPrompt: string,
	languageName: string,
	languageCode: string,
): Promise<AnalysisResult> => {
	const validation = await validateResult(ai, result, transcript, originalPrompt, languageName, languageCode);

	if (validation.isValid || validation.issues.length === 0) {
		console.log('Validation passed: No issues found');
		return result;
	}

	console.log(`Validation found ${validation.issues.length} issues, applying corrections...`);
	console.log('Issues:', JSON.stringify(validation.issues, null, 2));

	const correctedResult = applyCorrections(result, validation.issues);

	// Final safety filter: ensure all keyMoments have both timestamp and description
	if (correctedResult.keyMoments && Array.isArray(correctedResult.keyMoments)) {
		correctedResult.keyMoments = correctedResult.keyMoments.filter((moment) => {
			const hasTimestamp = moment.timestamp && typeof moment.timestamp === 'string' && moment.timestamp.trim() !== '';
			const hasDescription =
				moment.description && typeof moment.description === 'string' && moment.description.trim() !== '';
			if (!hasTimestamp || !hasDescription) {
				console.warn('Filtered out invalid corrected keyMoment:', moment);
			}
			return hasTimestamp && hasDescription;
		});
	}

	console.log('Corrections applied successfully');
	return correctedResult;
};
