import React, { useEffect, useMemo, useState } from 'react';

function stepIcon(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('запустил цепочку')) return '🚀';
  if (t.includes('ждал')) return '⏳';
  if (t.includes('отправил письмо')) return '✉️';
  if (t.includes('письмо было открыто') || t.includes('письмо не было открыто')) return '👁️';
  if (t.includes('письмо было кликнуто') || t.includes('письмо не было кликнуто')) return '👆';
  if (t.includes('дата соответствует') || t.includes('время соответствует')) return '✅';
  if (t.includes('цепочка завершена')) return '🛑';
  return '➡️';
}

export default function SimulationModal({ open, steps, userMessages, onClose }) {
  console.log('SimulationModal received:', { open, steps, userMessages });
  const safeSteps = useMemo(() => Array.isArray(steps) ? steps : [], [steps]);
  const safeUserMessages = useMemo(() => Array.isArray(userMessages) ? userMessages : [], [userMessages]);
  console.log('SimulationModal processed:', { safeSteps, safeUserMessages });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (index >= safeUserMessages.length - 1) return;
    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, safeUserMessages.length - 1)), 900);
    return () => clearTimeout(id);
  }, [index, open, safeUserMessages.length]);

  if (!open) return null;

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div className="ui-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ui-modal-header">
          <div className="ui-title" style={{ fontSize: 20 }}>Симуляция</div>
          <button className="ui-button" onClick={onClose}>Закрыть</button>
        </div>
        <div className="ui-modal-stage">
          <div style={{ marginBottom: 10, fontSize: 12, color: '#666' }}>
            Debug: userMessages length = {safeUserMessages.length}
          </div>
          {safeUserMessages.slice(0, index + 1).map((msg, i) => (
            <div key={i} className="ui-step">
              <span className="ui-step-icon">{stepIcon(msg)}</span>
              <span className="ui-step-text">{msg}</span>
            </div>
          ))}
          {safeUserMessages.length === 0 && (
            <div className="ui-step">Нет шагов</div>
          )}
        </div>
      </div>
    </div>
  );
}



