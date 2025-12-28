import React, { useEffect } from 'react';

export function ImageModal(props: { src: string; title?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" onMouseDown={props.onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="muted" style={{ fontSize: 14 }}>
            {props.title ?? '图片预览'}
          </div>
          <button className="btn" onClick={props.onClose}>
            关闭
          </button>
        </div>
        <div className="modalBody">
          <img src={props.src} alt={props.title ?? 'image'} />
        </div>
      </div>
    </div>
  );
}

