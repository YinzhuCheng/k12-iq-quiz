import * as XLSX from 'xlsx';
import type { Question, QuestionType } from '../types';

type RawRow = Record<string, unknown>;

const DATASET_CANDIDATES = ['/new.xlsx', '/output_k12_mcq_zh.xlsx', '/dataset.xlsx'] as const;

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

async function fetchFirstAvailableXlsx(): Promise<{ url: string; buf: ArrayBuffer }> {
  let lastStatus = '';
  for (const url of DATASET_CANDIDATES) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.ok) return { url, buf: await res.arrayBuffer() };
    lastStatus = `${url} (${res.status})`;
  }
  throw new Error(`Failed to fetch dataset xlsx. Last tried: ${lastStatus}`);
}

export async function loadDatasetFromPublicXlsx(): Promise<{ questions: Question[]; sourceUrl: string }> {
  const { url: sourceUrl, buf } = await fetchFirstAvailableXlsx();

  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error(`${sourceUrl} has no sheets`);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`${sourceUrl} first sheet is missing`);

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
    throw new Error(`No questions parsed from ${sourceUrl}`);
  }

  return { questions, sourceUrl };
}

