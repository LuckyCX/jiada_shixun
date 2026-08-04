import { useTownStore } from '../systems/townStore';
import { STAGE_LABELS, STAGE_ORDER } from '../constants';

export default function HudBar() {
  const done = useTownStore((s) => s.doneCount());
  const setOverlay = useTownStore((s) => s.setOverlay);
  const recommended = useTownStore((s) => s.recommendedStage());

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.92), rgba(15,23,42,0.45), transparent)',
        color: '#f8fafc',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, pointerEvents: 'auto' }}>
        <strong style={{ fontSize: 18 }}>创想小镇</strong>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            background: '#0f766e',
            color: '#ecfdf5',
          }}
        >
          沙盒
        </span>
        <span style={{ fontSize: 13, color: '#cbd5e1' }}>
          任务 {done}/7
          {recommended ? ` · 推荐：${STAGE_LABELS[recommended]}` : ' · 已通关'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
        <button type="button" style={btnStyle} onClick={() => setOverlay('quest')}>
          任务 J
        </button>
        <button type="button" style={btnStyle} onClick={() => setOverlay('map')}>
          地图 M
        </button>
        <button type="button" style={btnStyle} onClick={() => setOverlay('glossary')}>
          词典
        </button>
        <button type="button" style={btnStyle} onClick={() => setOverlay('settings')}>
          设置 Esc
        </button>
        <a href="/" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          返回主站
        </a>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  border: '1px solid #334155',
  background: 'rgba(30,41,59,0.9)',
  color: '#e2e8f0',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};

export function StageSideHint() {
  const recommended = useTownStore((s) => s.recommendedStage());
  const stages = useTownStore((s) => s.save.stages);
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: 72,
        zIndex: 18,
        width: 160,
        padding: 10,
        borderRadius: 12,
        background: 'rgba(15,23,42,0.82)',
        border: '1px solid #334155',
        color: '#e2e8f0',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>七阶段</div>
      {STAGE_ORDER.map((id) => (
        <div
          key={id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
            color: stages[id] ? '#4ade80' : recommended === id ? '#fbbf24' : '#94a3b8',
          }}
        >
          <span>{STAGE_LABELS[id]}</span>
          <span>{stages[id] ? '✓' : recommended === id ? '→' : '·'}</span>
        </div>
      ))}
    </div>
  );
}
