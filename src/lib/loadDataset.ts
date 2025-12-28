import * as XLSX from 'xlsx';
import type { Question, QuestionType } from '../types';

type RawRow = Record<string, unknown>;

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function parseJsonArray(raw: unknown): string[] {
  const s = asString(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) return parsed.map((x) => asString(x));
    return [];
  } catch {
    return [];
  }
}

function normalizeType(raw: unknown): QuestionType {
  const t = asString(raw).trim();
  if (t === 'Fill-in-the-blank') return 'Fill-in-the-blank';
  return 'Multiple Choice';
}

export async function loadDatasetFromPublicXlsx(): Promise<Question[]> {
  const res = await fetch('/dataset.xlsx', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to fetch /dataset.xlsx (${res.status})`);
  const buf = await res.arrayBuffer();

  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('dataset.xlsx has no sheets');
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('dataset.xlsx first sheet is missing');

  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '' });
  const questions: Question[] = [];

  for (const row of rows) {
    const id = asString(row['id']).trim();
    if (!id) continue;

    const question = asString(row['Question']).trim();
    const chQuestion = asString(row['Ch_Question']).trim();
    const questionType = normalizeType(row['Question_Type']);

    const options = parseJsonArray(row['Options']);
    const chOptions = parseJsonArray(row['Ch_Options']);

    const answer = asString(row['Answer']).trim();
    const image = asString(row['Image']).trim();

    questions.push({
      id,
      question: question || undefined,
      chQuestion: chQuestion || undefined,
      questionType,
      options,
      chOptions,
      answer,
      image: image || undefined,
    });
  }

  if (questions.length === 0) {
    throw new Error('No questions parsed from dataset.xlsx');
  }

  return questions;
}

