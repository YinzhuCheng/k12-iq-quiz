const META_KEY = '__iq_meta__';

export type Meta = {
  startedAt?: number;
  submittedAt?: number;
  view?: 'start' | 'quiz' | 'result';
  currentId?: string;
  reviewId?: string;
  nickname?: string;
};

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Meta;
  } catch {
    return {};
  }
}

export function saveMeta(next: Meta) {
  localStorage.setItem(META_KEY, JSON.stringify(next));
}

export function getAnswer(id: string): string {
  return localStorage.getItem(id) ?? '';
}

export function setAnswer(id: string, value: string) {
  if (value === '') localStorage.removeItem(id);
  else localStorage.setItem(id, value);
}

export function clearAll(questionIds: string[]) {
  for (const id of questionIds) localStorage.removeItem(id);
  localStorage.removeItem(META_KEY);
}

