import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import { ChatDeepSeek } from '@langchain/deepseek';
import {
  AnalysisResult,
  ApiCredentials,
  Highlight,
  LanguageOption,
  LLMProvider,
  UserAnswerResult,
  ValidationIssue,
  ValidationResult,
} from '../types';

let lastAnalysisPrompt = '';

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  google: 'gemini-2.5-flash',
  openai: 'o4-mini',
  anthropic: 'claude-sonnet-4-5-20250929',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
};

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  model?: string;
}

const sanitizeLanguage = (targetLanguage?: LanguageOption) => ({
  languageName: targetLanguage?.name ?? 'English',
  languageCode: targetLanguage?.code ?? 'en',
});

const sanitizeTranscript = (value?: string) => value?.trim() ?? '';

const ensureCredentials = (credentials?: ApiCredentials | null) => {
  if (!credentials || !credentials.key?.trim()) {
    throw new Error('API Key not configured');
  }
};

const createLLM = (credentials: ApiCredentials, options: LLMOptions = {}): BaseChatModel => {
  ensureCredentials(credentials);

  const baseConfig = {
    temperature: options.temperature ?? 0.3,
    maxRetries: options.maxRetries ?? 2,
  };

  const model = options.model ?? DEFAULT_MODELS[credentials.provider];
  const apiKey = credentials.key.trim();

  switch (credentials.provider) {
    case 'google':
      return new ChatGoogleGenerativeAI({
        apiKey,
        model,
        temperature: baseConfig.temperature,
        maxOutputTokens: options.maxTokens,
        maxRetries: baseConfig.maxRetries,
      });
    case 'openai':
      return new ChatOpenAI({
        apiKey,
        model,
        temperature: baseConfig.temperature,
        maxTokens: options.maxTokens,
        maxRetries: baseConfig.maxRetries,
      });
    case 'anthropic':
      return new ChatAnthropic({
        apiKey,
        model,
        temperature: baseConfig.temperature,
        maxTokens: options.maxTokens,
        maxRetries: baseConfig.maxRetries,
      });
    case 'groq':
      return new ChatGroq({
        apiKey,
        model,
        temperature: baseConfig.temperature,
        maxTokens: options.maxTokens,
        maxRetries: baseConfig.maxRetries,
      });
    case 'deepseek':
      return new ChatDeepSeek({
        apiKey,
        model,
        temperature: baseConfig.temperature,
        maxTokens: options.maxTokens,
        maxRetries: baseConfig.maxRetries,
      });
    default:
      throw new Error(`Provider not supported: ${credentials.provider}`);
  }
};

const extractJsonFromText = (raw: string): string => {
  const fenced = raw.match(/```json([\s\S]*?)```/i) || raw.match(/```([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  return raw.trim();
};

const parseJsonContent = <T>(raw: string, context: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const fallback = extractJsonFromText(raw);
    if (fallback !== raw) {
      try {
        return JSON.parse(fallback) as T;
      } catch (fallbackError) {
        console.error(`${context} JSON parse failed`, fallbackError);
      }
    }
    console.error(`${context} raw response`, raw);
    throw new Error(`${context} returned invalid JSON`);
  }
};

const invokeModelForJson = async <T>(llm: BaseChatModel, prompt: string, context: string): Promise<T> => {
  const runnable = llm.pipe(new StringOutputParser());
  const raw = (await runnable.invoke(prompt)).trim();
  if (!raw) {
    throw new Error(`${context} returned an empty response`);
  }
  return parseJsonContent<T>(raw, context);
};

const mapProviderLabel = (provider: LLMProvider): string => {
  switch (provider) {
    case 'google':
      return 'Google Gemini';
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'groq':
      return 'Groq';
    case 'deepseek':
      return 'DeepSeek';
    default:
      return provider;
  }
};

export const validateProviderCredentials = async (credentials: ApiCredentials): Promise<void> => {
  ensureCredentials(credentials);

  try {
    const llm = createLLM(credentials, {
      temperature: 0,
      maxTokens: 8,
      maxRetries: 0,
    });
    const runnable = llm.pipe(new StringOutputParser());
    await runnable.invoke('Respond with OK');
  } catch (error) {
    const providerLabel = mapProviderLabel(credentials.provider);
    const message =
      (error as Error)?.message?.trim() || `Unable to reach ${providerLabel}. Please verify the API key.`;
    throw new Error(`${providerLabel}: ${message}`);
  }
};

const sanitizeUserAnswer = (value: Partial<UserAnswerResult>): UserAnswerResult => {
  const text = typeof value.text === 'string' && value.text.trim().length > 0 ? value.text.trim() : '';
  const relatedSegments = Array.isArray(value.relatedSegments)
    ? value.relatedSegments
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0)
    : [];

  return {
    text,
    relatedSegments,
  };
};

const sanitizeKeyMoments = (moments: unknown): Highlight[] => {
  if (!Array.isArray(moments)) {
    return [];
  }

  return moments
    .map((moment) => ({
      timestamp: typeof moment?.timestamp === 'string' ? moment.timestamp.trim() : '',
      description: typeof moment?.description === 'string' ? moment.description.trim() : '',
    }))
    .filter((moment) => moment.timestamp.length > 0 && moment.description.length > 0);
};

const buildQuestionPrompt = (
  transcript: string,
  userQuery: string,
  languageName: string,
  languageCode: string,
): string => `You are Resumir's video analysis agent. Your mission is to answer the user's question using the YouTube transcript. Respond in ${languageName} (${languageCode}).

<critical_rules>
1. ALWAYS respond in ${languageName} (${languageCode}), preserving names and technical terms.
2. Cite timestamps in [MM:SS] format for every claim.
3. NEVER invent content that is not present in the transcript.
4. If the transcript lacks the answer, state that clearly.
</critical_rules>

<user_question>
${userQuery}
</user_question>

<transcript>
${transcript}
</transcript>

<output_format>
Return ONLY valid JSON with:
- text: your direct answer to the question
- relatedSegments: array of timestamp ranges like "01:20 - 01:45"
</output_format>`;

const buildSummaryPrompt = (
  transcript: string,
  languageName: string,
  languageCode: string,
): string => `You are Resumir's video analysis agent. Analyze the transcript and provide a structured summary in ${languageName} (${languageCode}).

<critical_rules>
1. Respond in ${languageName} (${languageCode}).
2. Include timestamps in [MM:SS] format for every key moment.
3. Never hallucinate information that is not in the transcript.
4. If the transcript is empty or corrupted, explain the limitation.
</critical_rules>

<instructions>
- Identify the main themes and extract 3-5 key moments.
- Summarize the video in ~100 words answering what, why, and who.
- Keep language concise and actionable.
</instructions>

<transcript>
${transcript}
</transcript>

<output_format>
Return ONLY valid JSON:
{
  "summary": string,
  "keyMoments": [{ "timestamp": "MM:SS", "description": string }]
}
</output_format>`;

const buildValidationPrompt = (
  result: AnalysisResult,
  transcript: string,
  originalPrompt: string,
  languageName: string,
  languageCode: string,
): string => `<role_and_objective>
You are a strict quality assurance agent for Resumir. Validate the analysis result against the transcript.
</role_and_objective>

<critical_rules>
1. Compare every claim with the transcript.
2. Verify all timestamps exist in the transcript.
3. Confirm the response is in ${languageName} (${languageCode}).
4. Flag hallucinations or missing information.
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

<output_format>
Return JSON with:
- isValid: boolean
- issues: array of issues with field, index, issueType, description, and correction
</output_format>`;

export const answerUserQuestion = async (
  transcript: string,
  userQuery: string,
  credentials: ApiCredentials,
  targetLanguage: LanguageOption,
): Promise<UserAnswerResult> => {
  ensureCredentials(credentials);

  const { languageName, languageCode } = sanitizeLanguage(targetLanguage);
  const sanitizedTranscript = sanitizeTranscript(transcript) || 'Transcript unavailable.';
  const llm = createLLM(credentials, { temperature: 0.25, maxTokens: 1024, maxRetries: 3 });
  const prompt = buildQuestionPrompt(sanitizedTranscript, userQuery, languageName, languageCode);
  const response = await invokeModelForJson<UserAnswerResult>(llm, prompt, 'answerUserQuestion');

  return sanitizeUserAnswer(response);
};

export const analyzeVideo = async (
  transcript: string,
  credentials: ApiCredentials,
  targetLanguage: LanguageOption,
): Promise<Omit<AnalysisResult, 'customAnswer'>> => {
  ensureCredentials(credentials);

  const { languageName, languageCode } = sanitizeLanguage(targetLanguage);
  const sanitizedTranscript = sanitizeTranscript(transcript) || 'Transcript unavailable. Explain the limitation.';
  const llm = createLLM(credentials, { temperature: 0.3, maxTokens: 2048, maxRetries: 3 });
  const prompt = buildSummaryPrompt(sanitizedTranscript, languageName, languageCode);

  lastAnalysisPrompt = prompt;

  const response = await invokeModelForJson<Omit<AnalysisResult, 'customAnswer'>>(llm, prompt, 'analyzeVideo');

  return {
    summary: typeof response.summary === 'string' ? response.summary : '',
    keyMoments: sanitizeKeyMoments((response as AnalysisResult).keyMoments),
  };
};

export const improveResult = async (
  result: AnalysisResult,
  transcript: string,
  credentials: ApiCredentials,
  targetLanguage: LanguageOption,
): Promise<AnalysisResult> => {
  ensureCredentials(credentials);

  const { languageName, languageCode } = sanitizeLanguage(targetLanguage);
  const sanitizedTranscript = sanitizeTranscript(transcript);
  const llm = createLLM(credentials, { temperature: 0.2, maxTokens: 2048, maxRetries: 3 });
  const originalPrompt = lastAnalysisPrompt || `Analyze in ${languageName} (${languageCode})`;

  return validateAndFixResult(llm, result, sanitizedTranscript, originalPrompt, languageName, languageCode);
};

const validateResult = async (
  llm: BaseChatModel,
  result: AnalysisResult,
  transcript: string,
  originalPrompt: string,
  languageName: string,
  languageCode: string,
): Promise<ValidationResult> => {
  const prompt = buildValidationPrompt(result, transcript, originalPrompt, languageName, languageCode);

  try {
    return await invokeModelForJson<ValidationResult>(llm, prompt, 'validateResult');
  } catch (error) {
    console.error('Validation Error:', error);
    return { isValid: true, issues: [] };
  }
};

const applyCorrections = (result: AnalysisResult, issues: ValidationIssue[]): AnalysisResult => {
  const correctedResult: AnalysisResult = JSON.parse(JSON.stringify(result));

  const sortedIssues = [...issues].sort((a, b) => {
    if (a.field !== b.field) return a.field.localeCompare(b.field);
    if (a.correction.action === 'remove' && b.correction.action !== 'remove') return 1;
    if (a.correction.action !== 'remove' && b.correction.action === 'remove') return -1;
    return (b.index ?? 0) - (a.index ?? 0);
  });

  for (const issue of sortedIssues) {
    const { field, index, correction } = issue;

    switch (field) {
      case 'summary':
        if (correction.action === 'replace' && correction.value) {
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

const validateAndFixResult = async (
  llm: BaseChatModel,
  result: AnalysisResult,
  transcript: string,
  originalPrompt: string,
  languageName: string,
  languageCode: string,
): Promise<AnalysisResult> => {
  const validation = await validateResult(llm, result, transcript, originalPrompt, languageName, languageCode);

  if (validation.isValid || validation.issues.length === 0) {
    return {
      ...result,
      keyMoments: sanitizeKeyMoments(result.keyMoments),
    };
  }

  const correctedResult = applyCorrections(result, validation.issues);
  correctedResult.keyMoments = sanitizeKeyMoments(correctedResult.keyMoments);
  return correctedResult;
};
