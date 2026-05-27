type Props = {
  status: string;
  thinking: string;
  content: string;
  visible: boolean;
};

export default function MarketAnalysisStreamPanel({ status, thinking, content, visible }: Props) {
  if (!visible) return null;
  const display = thinking || content || status;
  if (!display && !status) return null;
  return (
    <div className="rounded-xl border border-green-200 bg-white p-4 max-h-48 overflow-y-auto">
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
