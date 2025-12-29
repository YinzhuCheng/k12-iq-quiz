import React from 'react';
import { MathJax } from 'better-react-mathjax';
import type { Question } from '../types';
import { normalizeMathText } from '../lib/mathText';

function letters(i: number) {
  return String.fromCharCode('A'.charCodeAt(0) + i);
}

function toPublicImagePath(image?: string): string | null {
  const raw = (image ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('/')) return raw;
  return `/${raw}`;
}

function pickText(question: Question): { stem: string; options: string[] } {
  const stem = (question.chQuestion?.trim() || question.question?.trim() || '').trim();
  const zh = question.chOptions.map((s) => s.trim()).filter(Boolean);
  const en = question.options.map((s) => s.trim()).filter(Boolean);
  const options = zh.length > 0 ? zh : en;
  return { stem, options };
}

function stripLeadingChoiceLabel(raw: string, letter: string): string {
  // Remove duplicated prefixes like "A:", "A：", "A.", "(A)", "A、", "A)" etc.
  // Only strips when the prefix matches the expected option letter.
  const s = raw.trim();
  const escaped = letter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `^\\s*(?:\\(?\\s*${escaped}\\s*\\)?\\s*)[\\.:：、\\-)\\]]\\s*`,
    'i',
  );
  const out = s.replace(re, '').trimStart();
  return out || s;
}

export function QuestionPanel(props: {
  index: number; // 0-based
  total: number;
  question: Question;
  value: string;
  onChange: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onZoomImage: (src: string) => void;
  mode: 'quiz' | 'review';
  correct?: boolean;
  correctAnswer?: string;
}) {
  const { stem, options } = pickText(props.question);
  const imgSrc = toPublicImagePath(props.question.image);

  const imageEl =
    imgSrc ? (
      <div className="imgWrap">
        <img
          className="img"
          src={imgSrc}
          alt={`Q${props.index + 1}`}
          onClick={() => props.onZoomImage(imgSrc)}
        />
      </div>
    ) : null;

  const correctAnswer = (props.correctAnswer ?? props.question.answer ?? '').trim();
  const userAnswer = (props.value ?? '').trim();

  return (
    <div className="card">
      <div className="questionCard">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="qTitle">
            第 {props.index + 1} / {props.total} 题
          </h2>
          {props.mode === 'review' ? (
            props.correct ? (
              <span className="badge success">✓ 正确</span>
            ) : userAnswer ? (
              <span className="badge danger">✗ 错误</span>
            ) : (
              <span className="badge">未作答</span>
            )
          ) : null}
        </div>

        <div className="qStem">
          <MathJax dynamic inline>
            <span>{normalizeMathText(stem || '(题干为空)')}</span>
          </MathJax>
        </div>

        {/* Always render image below the text (ignore <image1> placeholder) */}
        {imageEl}

        {props.question.questionType === 'Multiple Choice' ? (
          <div className="options" role="radiogroup" aria-label="Multiple Choice Options">
            {options.map((opt, i) => {
              const letter = letters(i);
              const optText = stripLeadingChoiceLabel(opt, letter);
              const optDisplay = normalizeMathText(optText);

              const isCorrect = props.mode === 'review' && letter === correctAnswer;
              const isUser = props.mode === 'review' && letter === userAnswer;

              const border = isCorrect
                ? '1px solid rgba(239,68,68,0.75)'
                : isUser
                  ? '1px solid rgba(245,158,11,0.75)'
                  : undefined;
              const background = isCorrect
                ? 'rgba(239,68,68,0.06)'
                : isUser
                  ? 'rgba(245,158,11,0.06)'
                  : undefined;

              return (
                <label key={letter} className="option" style={{ border, background }}>
                  <input
                    type="radio"
                    name={`q_${props.question.id}`}
                    value={letter}
                    checked={props.value === letter}
                    disabled={props.mode === 'review'}
                    onChange={(e) => props.onChange(e.target.value)}
                  />
                  <div className="optionLabel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <b>{letter}.</b>
                      {isCorrect ? <span className="badge danger">正确答案</span> : null}
                      {isUser ? <span className="badge">你的选择</span> : null}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <MathJax dynamic inline>
                        <span>{optDisplay}</span>
                      </MathJax>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="muted" style={{ marginBottom: 8 }}>
              填空题：请输入你的答案。
            </div>
            <input
              className="input"
              value={props.value}
              disabled={props.mode === 'review'}
              onChange={(e) => props.onChange(e.target.value)}
              placeholder="请输入答案"
            />

            {props.mode === 'review' ? (
              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge danger">正确答案：{correctAnswer || '(空)'}</span>
                <span className={props.correct ? 'badge success' : 'badge danger'}>
                  你的答案：{userAnswer || '(未作答)'}
                </span>
              </div>
            ) : null}
          </div>
        )}

        <div className="navRow">
          <button className="btn" onClick={props.onPrev} disabled={!props.canPrev}>
            上一题
          </button>
          <button className="btn primary" onClick={props.onNext} disabled={!props.canNext}>
            下一题
          </button>
        </div>
      </div>
    </div>
  );
}

