import { useEffect, useRef } from 'react';
import { TownEngine } from './systems/TownEngine';

type Props = {
  engineRef: React.MutableRefObject<TownEngine | null>;
  onReady?: () => void;
};

export default function TownGameApp({ engineRef, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const engine = new TownEngine();
    engineRef.current = engine;
    let cancelled = false;
    void engine.mount(host).then(() => {
      if (cancelled) {
        engine.destroy();
        return;
      }
      onReady?.();
    });
    return () => {
      cancelled = true;
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [engineRef, onReady]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
