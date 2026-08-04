import { useEffect, useRef, useState } from 'react';
import TownGameApp from './TownGameApp';
import { TownEngine } from './systems/TownEngine';
import { useTownStore } from './systems/townStore';
import { MIN_VIEWPORT_WIDTH } from './constants';
import HudBar, { StageSideHint } from './ui/HudBar';
import DialoguePanel from './ui/DialoguePanel';
import QuestPanel, { MapOverlay } from './ui/QuestPanel';
import BuildingPanel from './ui/BuildingPanel';
import SettingsPanel from './ui/SettingsPanel';
import glossary from './data/glossary.json';

function NarrowGate({ children }: { children: React.ReactNode }) {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : MIN_VIEWPORT_WIDTH);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (w < MIN_VIEWPORT_WIDTH) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e2e8f0',
          padding: 32,
          textAlign: 'center',
          background: '#0f172a',
        }}
      >
        <div>
          <h1 style={{ fontSize: 22 }}>请使用 PC 浏览器全屏体验</h1>
          <p style={{ color: '#94a3b8' }}>
            创想小镇沙盒需要宽度 ≥ {MIN_VIEWPORT_WIDTH}px（当前 {w}px），不提供手机操控。
          </p>
          <a href="/" style={{ color: '#5eead4' }}>
            返回主站
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function InteractHint() {
  const prompt = useTownStore((s) => s.interactPrompt);
  if (!prompt) return null;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        background: 'rgba(15,23,42,0.85)',
        border: '1px solid #475569',
        color: '#f8fafc',
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 13,
      }}
    >
      {prompt}
    </div>
  );
}

/** 词典面板改用静态 import，避免 require */
function GlossaryPanel() {
  const overlay = useTownStore((s) => s.overlay);
  const setOverlay = useTownStore((s) => s.setOverlay);
  if (overlay !== 'glossary') return null;
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
      onClick={() => setOverlay(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          maxHeight: '82vh',
          overflow: 'auto',
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 20,
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>术语词典</h2>
          <button type="button" onClick={() => setOverlay(null)} style={{ cursor: 'pointer' }}>
            关闭
          </button>
        </div>
        {Object.entries(glossary).map(([k, v]) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <strong style={{ color: '#5eead4' }}>{k}</strong>
            <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const engineRef = useRef<TownEngine | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    useTownStore.getState().initFromStorage();
  }, []);

  return (
    <NarrowGate>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <TownGameApp engineRef={engineRef} onReady={() => setBooted(true)} />
        <HudBar />
        <StageSideHint />
        <InteractHint />
        <DialoguePanel />
        <QuestPanel engineRef={engineRef} />
        <MapOverlay />
        <GlossaryPanel />
        <BuildingPanel />
        <SettingsPanel />
        {!booted && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0f172a',
              color: '#94a3b8',
              zIndex: 50,
            }}
          >
            正在进入创想小镇…
          </div>
        )}
      </div>
    </NarrowGate>
  );
}
