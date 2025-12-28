import React from 'react';

export type GridItem = {
  id: string;
  index: number; // 0-based
  className?: string;
  mark?: string; // e.g. ✓ / ✗
};

export function QuestionGrid(props: {
  items: GridItem[];
  currentId?: string;
  onJump: (id: string) => void;
}) {
  return (
    <div className="grid" aria-label="Question Grid">
      {props.items.map((it) => {
        const isCurrent = props.currentId && it.id === props.currentId;
        const cls = ['qbtn', it.className, isCurrent ? 'current' : ''].filter(Boolean).join(' ');
        return (
          <button key={it.id} className={cls} onClick={() => props.onJump(it.id)} title={`第 ${it.index + 1} 题`}>
            {it.index + 1}
            {it.mark ? <span className="mark">{it.mark}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

