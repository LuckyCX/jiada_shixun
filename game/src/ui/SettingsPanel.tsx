import { useTownStore } from '../systems/townStore';
import { ModalShell } from './QuestPanel';
import { exportSummaryJson } from '../systems/SandboxSave';

export default function SettingsPanel() {
  const overlay = useTownStore((s) => s.overlay);
  const setOverlay = useTownStore((s) => s.setOverlay);
  const reset = useTownStore((s) => s.resetSandbox);
  const save = useTownStore((s) => s.save);
  if (overlay !== 'settings') return null;

  return (
    <ModalShell title="设置 · 沙盒" onClose={() => setOverlay(null)}>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        沙盒进度保存在本机 localStorage，与教学班作业隔离。音频默认静音（V0.1 无 BGM）。
      </p>
      <ul style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.8 }}>
        <li>鼠标左键点击地面移动；点击 NPC 对话；点击门口进入建筑</li>
        <li>WASD / 方向键仍可移动（备用），Shift 奔跑</li>
        <li>E / 空格：近距离互动 / 对话下一句</li>
        <li>J 任务 · M 地图 · Esc 设置</li>
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          style={btn}
          onClick={() => {
            if (window.confirm('确认重置沙盒？进度将清空。')) {
              reset();
              window.location.reload();
            }
          }}
        >
          重置沙盒
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => {
            const data = exportSummaryJson(save);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chuangxiang-town-summary-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          导出通关纪要
        </button>
        <a href="/" style={{ ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          返回主站
        </a>
      </div>
    </ModalShell>
  );
}

const btn: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #475569',
  color: '#e2e8f0',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: 13,
};
