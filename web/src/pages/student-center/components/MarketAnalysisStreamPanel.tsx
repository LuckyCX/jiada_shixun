import { useEffect, useRef } from 'react';

type Props = {
  status: string;
  thinking: string;
  content: string;
  visible: boolean;
  /** 仅展示加载文案，不展示模型思考/流式正文 */
  loadingOnly?: boolean;
};

export default function MarketAnalysisStreamPanel({
  status,
  thinking,
  content,
  visible,
  loadingOnly = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thinking, content, status, visible]);

  if (!visible) return null;
  const label = status || '思考中…';
  if (loadingOnly) {
    return (
      <div className="border-b border-gray-100 bg-white px-6 py-3 flex-shrink-0">
        <p className="text-sm text-gray-600 flex items-center gap-2 m-0">
          <i className="ri-loader-4-line animate-spin text-indigo-500" />
          {label}
        </p>
      </div>
    );
  }

  const display = thinking || content || status;
  if (!display && !status) return null;

  return (
    <div
      ref={scrollRef}
      className="rounded-xl border border-green-200 bg-white p-4 max-h-48 overflow-y-auto flex flex-col justify-end"
    >
      {status && !thinking && !content && (
        <p className="text-sm text-gray-600 flex items-center gap-2">
          <i className="ri-loader-4-line animate-spin text-green-500" />
          {status}
        </p>
      )}
      {(thinking || content) && (
        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans m-0">{thinking || content}</pre>
      )}
    </div>
  );
}
