import { useTownStore } from '../systems/townStore';

export default function DialoguePanel() {
  const dialogue = useTownStore((s) => s.dialogue);
  const advance = useTownStore((s) => s.advanceDialogue);
  if (!dialogue) return null;
  const line = dialogue.lines[dialogue.lineIndex] || '';
  const last = dialogue.lineIndex >= dialogue.lines.length - 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 28,
        transform: 'translateX(-50%)',
        width: 'min(720px, 90vw)',
        zIndex: 40,
        background: 'rgba(15,23,42,0.95)',
        border: '1px solid #475569',
        borderRadius: 16,
        padding: 20,
        color: '#f1f5f9',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ fontSize: 13, color: '#5eead4', marginBottom: 8 }}>{dialogue.speaker}</div>
      <p style={{ margin: 0, lineHeight: 1.7, fontSize: 15, minHeight: 48 }}>{line}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {dialogue.lineIndex + 1}/{dialogue.lines.length} · 空格/E 继续
        </span>
        <button
          type="button"
          onClick={() => advance()}
          style={{
            background: '#0d9488',
            border: 'none',
            color: 'white',
            borderRadius: 8,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          {last ? '结束' : '下一句'}
        </button>
      </div>
    </div>
  );
}
