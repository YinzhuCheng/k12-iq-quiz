import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MathJaxContext } from 'better-react-mathjax';
import type { Question, QuizView } from './types';
import { loadDatasetFromPublicXlsx } from './lib/loadDataset';
import { clearAll, getAnswer, loadMeta, saveMeta, setAnswer } from './lib/storage';
import { formatDuration } from './lib/time';
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

  const [view, setView] = useState<QuizView>('start');
  const [currentId, setCurrentId] = useState<string>('');
  const [reviewId, setReviewId] = useState<string>('');

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const [now, setNow] = useState<number>(() => Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    loadDatasetFromPublicXlsx()
      .then((qs) => {
        setQuestions(qs);

        // init answers from localStorage
        const init: Record<string, string> = {};
        for (const q of qs) init[q.id] = getAnswer(q.id);
        setAnswers(init);

        const meta = loadMeta();
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
    clearAll(questions.map((q) => q.id));
    const startedAt = Date.now();
    saveMeta({ startedAt, view: 'quiz', currentId: questions[0].id, reviewId: questions[0].id });
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
            无法读取 <code>/dataset.xlsx</code>。错误信息：<b>{error}</b>
          </p>
          <p className="subtitle" style={{ marginTop: 10 }}>
            请确认仓库存在 <code>public/dataset.xlsx</code>，并在部署后可通过 <code>/dataset.xlsx</code> 访问。
          </p>
        </div>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 18 }}>
          <h1 className="title">正在加载题库…</h1>
          <p className="subtitle">首次加载会在浏览器端解析 Excel（约 70+ 题）。</p>
        </div>
      </div>
    );
  }

  // ---------- Start page ----------
  if (view === 'start') {
    const hasProgress = !!startedAt && answeredCount > 0;
    const hasSubmitted = !!submittedAt;
    const sampleImage = (() => {
      const hit = questions.find((q) => (q.image ?? '').trim());
      if (!hit?.image) return '';
      return hit.image.startsWith('/') ? hit.image : `/${hit.image}`;
    })();
    return (
      <MathJaxContext config={mathJaxConfig}>
        <div className="container">
          <div className="card" style={{ padding: 22 }}>
            <h1 className="title">IQ 测试（网页版答题器）</h1>
            <p className="subtitle">
              白底、居中、大按钮、题号矩阵跳题，支持图片放大与公式渲染。你的作答会自动保存到浏览器（localStorage），刷新不会丢失。
            </p>
            <p className="subtitle" style={{ marginTop: 10 }}>
              <b>Data loaded.</b> 已读取题库，共 <b>{questions.length}</b> 题。
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
              <button className="btn primary" onClick={startNew}>
                开始测试
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

            <div style={{ marginTop: 16 }} className="muted">
              题量：<b>{questions.length}</b> 题（数据来自 <code>/dataset.xlsx</code>），图片来自 <code>/images/</code>。
            </div>

            {sampleImage ? (
              <div style={{ marginTop: 14 }}>
                <div className="muted" style={{ marginBottom: 8 }}>
                  图片示例（来自 <code>/images/...</code>）：
                </div>
                <img
                  className="img"
                  style={{ maxHeight: 220, cursor: 'default' }}
                  src={sampleImage}
                  alt="sample"
                />
              </div>
            ) : null}
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
              <div className="muted">点击题号可进入回顾（Review）模式查看详情。</div>
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
                  <button className="btn danger" onClick={startNew}>
                    重新开始（清空并重置）
                  </button>
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
      </div>
    </MathJaxContext>
  );
}

