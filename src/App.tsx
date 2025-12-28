import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MathJaxContext } from 'better-react-mathjax';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Question, QuizView } from './types';
import { loadDatasetFromPublicXlsx } from './lib/loadDataset';
import { clearAll, getAnswer, loadMeta, saveMeta, setAnswer } from './lib/storage';
import { formatDuration } from './lib/time';
import { isAnswerCardV1, safeFilenamePart, type AnswerCardV1 } from './lib/answerCard';
import { ImageModal } from './components/ImageModal';
import { QuestionGrid, type GridItem } from './components/QuestionGrid';
import { QuestionPanel } from './components/QuestionPanel';

function normalizeChoice(s: string): string {
  return (s ?? '').trim().toUpperCase();
}

function normalizeFill(s: string): string {
  return (s ?? '').trim();
}

function isCorrect(q: Question, user: string): boolean {
  if (!user.trim()) return false;
  if (q.questionType === 'Multiple Choice') return normalizeChoice(user) === normalizeChoice(q.answer);
  return normalizeFill(user) === normalizeFill(String(q.answer ?? ''));
}

export function App() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState<string>('');
  const [datasetUrl, setDatasetUrl] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');

  const [view, setView] = useState<QuizView>('start');
  const [currentId, setCurrentId] = useState<string>('');
  const [reviewId, setReviewId] = useState<string>('');

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const [now, setNow] = useState<number>(() => Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = 'K12拓扑学测试题';
  }, []);

  useEffect(() => {
    loadDatasetFromPublicXlsx()
      .then(({ questions: qs, sourceUrl }) => {
        setQuestions(qs);
        setDatasetUrl(sourceUrl);

        // init answers from localStorage
        const init: Record<string, string> = {};
        for (const q of qs) init[q.id] = getAnswer(q.id);
        setAnswers(init);

        const meta = loadMeta();
        setNickname((meta.nickname ?? '').trim());
        const started = typeof meta.startedAt === 'number' ? meta.startedAt : undefined;
        const submitted = typeof meta.submittedAt === 'number' ? meta.submittedAt : undefined;

        const desiredView: QuizView =
          meta.view === 'result' && submitted ? 'result' : meta.view === 'quiz' && started ? 'quiz' : 'start';
        setView(desiredView);

        const fallbackId = qs[0]?.id ?? '';
        const cId = meta.currentId && qs.some((x) => x.id === meta.currentId) ? meta.currentId : fallbackId;
        const rId = meta.reviewId && qs.some((x) => x.id === meta.reviewId) ? meta.reviewId : cId;
        setCurrentId(cId);
        setReviewId(rId);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  useEffect(() => {
    timerRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const meta = useMemo(() => loadMeta(), [view, currentId, reviewId, questions?.length]);

  const startedAt = meta.startedAt ?? undefined;
  const submittedAt = meta.submittedAt ?? undefined;

  const total = questions?.length ?? 0;

  const answeredCount = useMemo(() => {
    if (!questions) return 0;
    let c = 0;
    for (const q of questions) if ((answers[q.id] ?? '').trim()) c += 1;
    return c;
  }, [questions, answers]);

  const elapsedMs = useMemo(() => {
    if (!startedAt) return 0;
    if (view === 'result' && submittedAt) return Math.max(0, submittedAt - startedAt);
    return Math.max(0, now - startedAt);
  }, [startedAt, submittedAt, view, now]);

  const currentIndex = useMemo(() => {
    if (!questions || !currentId) return 0;
    const idx = questions.findIndex((q) => q.id === currentId);
    return idx >= 0 ? idx : 0;
  }, [questions, currentId]);

  const reviewIndex = useMemo(() => {
    if (!questions || !reviewId) return 0;
    const idx = questions.findIndex((q) => q.id === reviewId);
    return idx >= 0 ? idx : 0;
  }, [questions, reviewId]);

  const score = useMemo(() => {
    if (!questions) return { correct: 0, total: 0 };
    let correct = 0;
    for (const q of questions) {
      const user = answers[q.id] ?? '';
      if (isCorrect(q, user)) correct += 1;
    }
    return { correct, total: questions.length };
  }, [questions, answers]);

  function persistMeta(next: Partial<ReturnType<typeof loadMeta>>) {
    const base = loadMeta();
    saveMeta({ ...base, ...next });
  }

  function startNew() {
    if (!questions) return;
    const keepNickname = nickname;
    clearAll(questions.map((q) => q.id));
    const startedAt = Date.now();
    saveMeta({ startedAt, view: 'quiz', currentId: questions[0].id, reviewId: questions[0].id, nickname: keepNickname });
    const init: Record<string, string> = {};
    for (const q of questions) init[q.id] = '';
    setAnswers(init);
    setCurrentId(questions[0].id);
    setReviewId(questions[0].id);
    setView('quiz');
  }

  function continueQuiz() {
    if (!questions) return;
    const m = loadMeta();
    const startedAt = typeof m.startedAt === 'number' ? m.startedAt : Date.now();
    const fallback = questions[0].id;
    const cId = m.currentId && questions.some((x) => x.id === m.currentId) ? m.currentId : fallback;
    persistMeta({ startedAt, view: 'quiz', currentId: cId });
    setCurrentId(cId);
    setView('quiz');
  }

  function goResult() {
    if (!questions) return;
    const m = loadMeta();
    const startedAt = typeof m.startedAt === 'number' ? m.startedAt : Date.now();
    const submittedAt = typeof m.submittedAt === 'number' ? m.submittedAt : Date.now();
    const fallback = questions[0].id;
    const rId = m.reviewId && questions.some((x) => x.id === m.reviewId) ? m.reviewId : fallback;
    saveMeta({ ...m, startedAt, submittedAt, view: 'result', reviewId: rId });
    setReviewId(rId);
    setView('result');
  }

  function updateAnswer(id: string, v: string) {
    setAnswer(id, v);
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  function jumpTo(id: string) {
    setCurrentId(id);
    persistMeta({ currentId: id });
  }

  function jumpReview(id: string) {
    setReviewId(id);
    persistMeta({ reviewId: id });
  }

  function submit() {
    if (!questions) return;
    const unanswered = questions.filter((q) => !(answers[q.id] ?? '').trim());
    if (unanswered.length > 0) {
      const ok = window.confirm(`你还有 ${unanswered.length} 题未作答。仍然要提交吗？`);
      if (!ok) return;
    }
    const m = loadMeta();
    const startedAt = typeof m.startedAt === 'number' ? m.startedAt : Date.now();
    const submittedAt = Date.now();
    saveMeta({ ...m, startedAt, submittedAt, view: 'result', reviewId: currentId, currentId });
    setReviewId(currentId);
    setView('result');
  }

  function clearAnswers() {
    if (!questions) return;
    const ok = window.confirm('确定要清空所有作答吗？此操作不可撤销。');
    if (!ok) return;
    for (const q of questions) setAnswer(q.id, '');
    const next: Record<string, string> = {};
    for (const q of questions) next[q.id] = '';
    setAnswers(next);
  }

  function downloadJson(filename: string, obj: unknown) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportAnswerCard() {
    if (!questions) return;
    const m = loadMeta();
    const exportedAt = Date.now();
    const percent = score.total ? Math.round((score.correct / score.total) * 1000) / 10 : 0;
    const card: AnswerCardV1 = {
      version: 1,
      exportedAt,
      datasetUrl: datasetUrl || undefined,
      nickname: (m.nickname ?? nickname ?? '').trim() || undefined,
      startedAt: typeof m.startedAt === 'number' ? m.startedAt : undefined,
      submittedAt: typeof m.submittedAt === 'number' ? m.submittedAt : undefined,
      score:
        typeof m.submittedAt === 'number'
          ? { correct: score.correct, total: score.total, percent }
          : undefined,
      answers: {},
    };
    for (const q of questions) card.answers[q.id] = answers[q.id] ?? '';

    const name = safeFilenamePart(card.nickname ?? '');
    const ts = new Date(exportedAt).toISOString().replace(/[:.]/g, '-');
    downloadJson(`answer-card_${name}_${ts}.json`, card);
  }

  function triggerImport() {
    importInputRef.current?.click();
  }

  async function handleImportFile(file: File) {
    if (!questions) return;
    const ok = window.confirm('导入会覆盖当前浏览器中的作答与进度。确定继续吗？');
    if (!ok) return;

    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      window.alert('导入失败：不是有效的 JSON 文件。');
      return;
    }
    if (!isAnswerCardV1(parsed)) {
      window.alert('导入失败：不是识别的答题卡格式（version: 1）。');
      return;
    }

    const card = parsed as AnswerCardV1;
    const nextAnswers: Record<string, string> = {};
    for (const q of questions) {
      const v = typeof card.answers[q.id] === 'string' ? card.answers[q.id] : '';
      setAnswer(q.id, v);
      nextAnswers[q.id] = v;
    }
    setAnswers(nextAnswers);

    const startedAt = typeof card.startedAt === 'number' ? card.startedAt : Date.now();
    const submittedAt = typeof card.submittedAt === 'number' ? card.submittedAt : undefined;
    const nn = (card.nickname ?? '').trim();
    setNickname(nn);

    const firstId = questions[0]?.id ?? '';
    saveMeta({
      ...loadMeta(),
      nickname: nn,
      startedAt,
      submittedAt,
      currentId: firstId,
      reviewId: firstId,
      view: submittedAt ? 'result' : 'quiz',
    });
    setCurrentId(firstId);
    setReviewId(firstId);
    setView(submittedAt ? 'result' : 'quiz');
  }

  async function exportPdfReport() {
    if (!reportRef.current) return;
    const node = reportRef.current;
    const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = Math.min(pageW / imgW, pageH / imgH);
    const w = imgW * ratio;
    const h = imgH * ratio;
    const x = (pageW - w) / 2;
    const y = 32;

    pdf.addImage(imgData, 'PNG', x, y, w, h);

    const name = safeFilenamePart(nickname);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    pdf.save(`report_${name}_${ts}.pdf`);
  }

  const mathJaxConfig = useMemo(
    () => ({
      loader: { load: ['input/tex', 'output/chtml'] },
      tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['\\[', '\\]']],
      },
    }),
    [],
  );

  if (error) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 18 }}>
          <h1 className="title">加载失败</h1>
          <p className="subtitle">
            无法读取题库 Excel。错误信息：<b>{error}</b>
          </p>
          <p className="subtitle" style={{ marginTop: 10 }}>
            请确认仓库存在 <code>public/output_k12_mcq_zh.xlsx</code>（优先）或 <code>public/dataset.xlsx</code>，并在部署后可通过对应 URL 访问。
          </p>
        </div>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 18 }}>
          <h1 className="title">K12拓扑学测试题</h1>
          <p className="subtitle">首次加载会在浏览器端解析 Excel（约 70+ 题）。</p>
        </div>
      </div>
    );
  }

  // ---------- Start page ----------
  if (view === 'start') {
    const hasProgress = !!startedAt && answeredCount > 0;
    const hasSubmitted = !!submittedAt;
    return (
      <MathJaxContext config={mathJaxConfig}>
        <div className="container">
          <div className="card" style={{ padding: 22 }}>
            <h1 className="title">K12拓扑学测试题</h1>
            <p className="subtitle">准备好了吗？给自己取个昵称，开始闯关吧。</p>

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <div>
                <div className="muted" style={{ marginBottom: 8, fontSize: 14 }}>
                  昵称（可选）
                </div>
                <input
                  className="input"
                  value={nickname}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNickname(v);
                    persistMeta({ nickname: v });
                  }}
                  placeholder="例如：小拓扑 / Euler / 认真答题的我"
                  maxLength={24}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge">题量：{questions.length}</span>
                <span className="badge">题库：{datasetUrl.replace('/', '') || 'unknown'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
              <button className="btn primary" onClick={startNew}>
                开始测试
              </button>
              <button className="btn" onClick={exportAnswerCard}>
                导出答题卡（JSON）
              </button>
              <button className="btn" onClick={triggerImport}>
                导入答题卡
              </button>

              {hasProgress ? (
                <button className="btn" onClick={continueQuiz}>
                  继续上次作答
                </button>
              ) : null}

              {hasSubmitted ? (
                <button className="btn" onClick={goResult}>
                  查看上次结果
                </button>
              ) : null}
            </div>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
                // allow re-select same file
                e.currentTarget.value = '';
              }}
            />
          </div>
        </div>
      </MathJaxContext>
    );
  }

  // ---------- Quiz page ----------
  if (view === 'quiz') {
    const q = questions[currentIndex];
    const gridItems: GridItem[] = questions.map((qq, i) => ({
      id: qq.id,
      index: i,
      className: (answers[qq.id] ?? '').trim() ? 'answered' : '',
    }));

    return (
      <MathJaxContext config={mathJaxConfig}>
        <div className="container">
          <div className="card">
            <div className="topbar">
              <div className="stats">
                <span>
                  进度：<b>{answeredCount}</b> / <b>{total}</b>
                </span>
                <span>
                  用时：<b>{formatDuration(elapsedMs)}</b>
                </span>
              </div>
              <div className="actions">
                <button className="btn" onClick={exportAnswerCard}>
                  导出答题卡
                </button>
                <button className="btn" onClick={triggerImport}>
                  导入答题卡
                </button>
                <button className="btn danger" onClick={clearAnswers}>
                  清空作答
                </button>
                <button className="btn primary" onClick={submit}>
                  提交
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="layout">
                <div className="card panel">
                  <div className="muted" style={{ marginBottom: 10 }}>
                    题号矩阵（可跳题）
                  </div>
                  <QuestionGrid
                    items={gridItems}
                    currentId={currentId}
                    onJump={(id) => {
                      setCurrentId(id);
                      persistMeta({ currentId: id });
                    }}
                  />
                </div>

                <div>
                  <QuestionPanel
                    index={currentIndex}
                    total={total}
                    question={q}
                    value={answers[q.id] ?? ''}
                    onChange={(v) => updateAnswer(q.id, v)}
                    onZoomImage={(src) => setZoomSrc(src)}
                    mode="quiz"
                    canPrev={currentIndex > 0}
                    canNext={currentIndex < questions.length - 1}
                    onPrev={() => jumpTo(questions[Math.max(0, currentIndex - 1)].id)}
                    onNext={() => jumpTo(questions[Math.min(questions.length - 1, currentIndex + 1)].id)}
                  />
                </div>
              </div>
            </div>
          </div>

          {zoomSrc ? <ImageModal src={zoomSrc} onClose={() => setZoomSrc(null)} /> : null}

          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </MathJaxContext>
    );
  }

  // ---------- Result page ----------
  const percent = score.total ? Math.round((score.correct / score.total) * 1000) / 10 : 0;

  const resultGrid: GridItem[] = questions.map((qq, i) => {
    const user = (answers[qq.id] ?? '').trim();
    if (!user) return { id: qq.id, index: i, className: 'unanswered', mark: '' };
    return isCorrect(qq, user)
      ? { id: qq.id, index: i, className: 'correct', mark: '✓' }
      : { id: qq.id, index: i, className: 'wrong', mark: '✗' };
  });

  const rq = questions[reviewIndex];
  const rUser = answers[rq.id] ?? '';
  const rCorrect = isCorrect(rq, rUser);

  return (
    <MathJaxContext config={mathJaxConfig}>
      <div className="container">
        <div className="card">
          <div className="resultHead">
            <div>
              <h1 className="title" style={{ marginBottom: 6 }}>
                测试结果
              </h1>
              <div className="muted">
                {nickname.trim() ? (
                  <>
                    {nickname.trim()}，做得不错！点击题号可进入回顾（Review）模式查看详情。
                  </>
                ) : (
                  <>点击题号可进入回顾（Review）模式查看详情。</>
                )}
              </div>
            </div>
            <div className="resultNums">
              <span className="badge success">
                得分：{score.correct} / {score.total}
              </span>
              <span className="badge">正确率：{percent}%</span>
              <span className="badge">总用时：{formatDuration(elapsedMs)}</span>
            </div>
          </div>

          <div className="panel">
            <div className="layout">
              <div className="card panel">
                <div className="muted" style={{ marginBottom: 10 }}>
                  结果矩阵
                </div>
                <QuestionGrid items={resultGrid} currentId={reviewId} onJump={(id) => jumpReview(id)} />
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span className="badge success">✓ 正确</span>
                  <span className="badge danger">✗ 错误</span>
                  <span className="badge">未答</span>
                </div>
              </div>

              <div>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn" onClick={continueQuiz}>
                    返回答题页继续修改
                  </button>
                  <button className="btn" onClick={exportAnswerCard}>
                    导出答题卡（JSON）
                  </button>
                  <button className="btn" onClick={triggerImport}>
                    导入答题卡
                  </button>
                  <button className="btn" onClick={() => void exportPdfReport()}>
                    导出成绩单（PDF）
                  </button>
                  <button className="btn danger" onClick={startNew}>
                    重新开始（清空并重置）
                  </button>
                </div>

                <div ref={reportRef} className="card" style={{ padding: 14, marginBottom: 12, borderStyle: 'dashed' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>K12拓扑学测试题 · 成绩单</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        昵称：<b>{nickname.trim() || '匿名'}</b>
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        题库：<code>{datasetUrl || '(unknown)'}</code>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="badge success" style={{ display: 'inline-flex' }}>
                        得分：{score.correct} / {score.total}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span className="badge">正确率：{percent}%</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span className="badge">总用时：{formatDuration(elapsedMs)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <QuestionPanel
                  index={reviewIndex}
                  total={total}
                  question={rq}
                  value={rUser}
                  onChange={() => {}}
                  onZoomImage={(src) => setZoomSrc(src)}
                  mode="review"
                  correct={rCorrect}
                  correctAnswer={rq.answer}
                  canPrev={reviewIndex > 0}
                  canNext={reviewIndex < questions.length - 1}
                  onPrev={() => jumpReview(questions[Math.max(0, reviewIndex - 1)].id)}
                  onNext={() => jumpReview(questions[Math.min(questions.length - 1, reviewIndex + 1)].id)}
                />
              </div>
            </div>
          </div>
        </div>

        {zoomSrc ? <ImageModal src={zoomSrc} onClose={() => setZoomSrc(null)} /> : null}

        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportFile(f);
            e.currentTarget.value = '';
          }}
        />
      </div>
    </MathJaxContext>
  );
}

