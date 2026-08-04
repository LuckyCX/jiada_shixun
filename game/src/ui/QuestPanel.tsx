import quests from '../data/quests.json';
import mapData from '../data/map.json';
import { STAGE_LABELS, type StageId } from '../constants';
import { useTownStore } from '../systems/townStore';
import type { TownEngine } from '../systems/TownEngine';

type Props = {
  engineRef: React.MutableRefObject<TownEngine | null>;
};

export default function QuestPanel({ engineRef }: Props) {
  const overlay = useTownStore((s) => s.overlay);
  const setOverlay = useTownStore((s) => s.setOverlay);
  const save = useTownStore((s) => s.save);
  const dialoguesRead = save.dialoguesRead;
  if (overlay !== 'quest') return null;

  return (
    <ModalShell title="任务日志" onClose={() => setOverlay(null)}>
      <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 0 }}>
        可乱序进入建筑；推荐顺序如下。点击任务可前往对应 NPC 并对话。
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {quests.stages.map((q) => {
          const id = q.id as StageId;
          const done = save.stages[id];
          const talked = dialoguesRead.includes(q.needDialogue);
          return (
            <div
              key={q.id}
              style={{
                border: '1px solid #334155',
                borderRadius: 12,
                padding: 12,
                background: done ? 'rgba(22,163,74,0.12)' : 'rgba(30,41,59,0.6)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{q.title}</strong>
                <span style={{ color: done ? '#4ade80' : '#fbbf24' }}>{done ? '已完成' : '进行中'}</span>
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 6 }}>{q.desc}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                对话：{talked ? '已读' : '未读'} · 面板：{done ? '已提交' : '未提交'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={linkBtn}
                  onClick={() => {
                    engineRef.current?.goTalkStage(q.id);
                    setOverlay(null);
                  }}
                >
                  前往对话
                </button>
                <button
                  type="button"
                  style={linkBtn}
                  onClick={() => {
                    engineRef.current?.teleportNearBuilding(q.buildingId);
                    setOverlay(null);
                  }}
                >
                  传送到门口
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#64748b' }}>
        建筑一览：{mapData.buildings.map((b) => `${STAGE_LABELS[b.stageId as StageId]}=${b.name}`).join('；')}
      </div>
    </ModalShell>
  );
}

export function MapOverlay() {
  const overlay = useTownStore((s) => s.overlay);
  const setOverlay = useTownStore((s) => s.setOverlay);
  const player = useTownStore((s) => s.save.player);
  if (overlay !== 'map') return null;
  const scale = 4;
  return (
    <ModalShell title="小镇地图" onClose={() => setOverlay(null)}>
      <div
        style={{
          position: 'relative',
          width: 80 * scale,
          height: 60 * scale,
          background: '#1e293b',
          borderRadius: 8,
          margin: '0 auto',
          overflow: 'hidden',
        }}
      >
        {mapData.buildings.map((b) => (
          <div
            key={b.id}
            title={b.name}
            style={{
              position: 'absolute',
              left: b.x * scale,
              top: b.y * scale,
              width: b.w * scale,
              height: b.h * scale,
              background: b.color,
              borderRadius: 2,
              opacity: 0.9,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: (player.x / 32) * scale - 3,
            top: (player.y / 32) * scale - 3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#38bdf8',
            boxShadow: '0 0 0 2px #fff',
          }}
        />
      </div>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>蓝点为你的位置</p>
    </ModalShell>
  );
}

export function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 35,
        background: 'rgba(2,6,23,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: wide ? 'min(920px, 96vw)' : 'min(560px, 92vw)',
          maxHeight: '82vh',
          overflow: 'auto',
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 20,
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button type="button" onClick={onClose} style={linkBtn}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #475569',
  color: '#e2e8f0',
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: 12,
  marginTop: 8,
};
