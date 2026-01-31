
export type Language = 'zh' | 'en';

export enum ModelProvider {
  Gemini = 'Gemini',
  DeepSeek = 'DeepSeek'
}

export interface Metric {
  id: string;
  name: string;
  description: string;
  weight: number; // Percentage 0-100
}

export interface Candidate {
  id: string;
  name: string;
  age?: string;
  education?: string;
  company?: string;
  phone?: string;
  rawText: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysis?: AnalysisResult;
  interviewGuide?: string;
}

export interface AnalysisResult {
  scores: Record<string, number>; // metricId -> score
  totalScore: number;
  reasons: Record<string, string>; // metricId -> reason
  summary: string;
  risks?: string[]; // Potential anomalies, missing info, or verification points
  detailedMetrics?: Record<string, { criteria: string, highlight: string }>; // NEW: Deep analysis data
}

export interface AppSettings {
  language: Language;
  geminiKey: string;
  deepSeekKey: string;
  deepSeekBaseUrl: string;
  selectedModel: string;
  provider: ModelProvider;
  systemDate?: string; // For manual override, otherwise uses new Date()
}

export interface JobConfig {
  title: string;
  description: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'process';
}

export const DEFAULT_METRICS: Metric[] = [
  { id: 'm1', name: '岗位匹配度', description: '候选人过往经历与岗位JD的契合程度', weight: 40 },
  { id: 'm2', name: '专业能力', description: '核心技能掌握深度与广度', weight: 30 },
  { id: 'm3', name: '创新能力', description: '解决复杂问题的思维与创新成果', weight: 15 },
  { id: 'm4', name: '稳定性', description: '过往任职时长与跳槽频率', weight: 15 },
];
