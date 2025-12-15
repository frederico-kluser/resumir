export interface TranscriptSegment {
  text: string;
  start: number; // seconds
  duration: number; // seconds
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export interface Citation {
  start: number;
  end: number;
}

export interface Highlight {
  timestamp: string; // e.g., "02:15"
  description: string;
}

export interface UserAnswerResult {
  text: string;
  relatedSegments: string[]; // Timestamps e.g., "01:20 - 01:45"
}

export interface AnalysisResult {
  customAnswer?: UserAnswerResult;
  summary: string;
  keyMoments: Highlight[];
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

// Validation system types
export type ValidationField = 'summary' | 'keyMoments' | 'customAnswer';
export type IssueType = 'incorrect_timestamp' | 'hallucination' | 'missing_info' | 'inaccurate_description' | 'wrong_language';
export type CorrectionAction = 'replace' | 'remove' | 'add';

export interface ValidationCorrection {
  action: CorrectionAction;
  value?: string | Highlight | { text: string; relatedSegments: string[] };
}

export interface ValidationIssue {
  field: ValidationField;
  index?: number; // For keyMoments array, which index to fix
  issueType: IssueType;
  description: string;
  correction: ValidationCorrection;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

// Add global window types for AI Studio
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<string | void>;
    getSelectedApiKey?: () => Promise<string | null>;
    selectedApiKey?: string;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}