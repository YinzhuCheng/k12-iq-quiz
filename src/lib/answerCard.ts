export type AnswerCardV1 = {
  version: 1;
  exportedAt: number;
  datasetUrl?: string;
  nickname?: string;
  startedAt?: number;
  submittedAt?: number;
  score?: { correct: number; total: number; percent: number };
  answers: Record<string, string>;
};

export function isAnswerCardV1(x: unknown): x is AnswerCardV1 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (typeof o.exportedAt !== 'number') return false;
  if (!o.answers || typeof o.answers !== 'object') return false;
  return true;
}

export function safeFilenamePart(s: string): string {
  return (s || 'anonymous')
    .trim()
    .slice(0, 24)
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/^_+|_+$/g, '') || 'anonymous';
}

