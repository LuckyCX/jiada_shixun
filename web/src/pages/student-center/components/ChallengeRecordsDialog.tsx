import { Modal, Empty } from 'antd';
import type { ChallengeSessionRecord } from '../../../lib/studentMarketResearchApi';

type Props = {
  open: boolean;
  loading: boolean;
  records: ChallengeSessionRecord[];
  onClose: () => void;
};

export default function ChallengeRecordsDialog({ open, loading, records, onClose }: Props) {
  const byStudent = records.reduce<Record<string, ChallengeSessionRecord[]>>((acc, r) => {
    const key = r.studentName || r.studentId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <Modal title="人机对抗记录" open={open} onCancel={onClose} footer={null} width={720} destroyOnClose>
      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">加载中…</p>
      ) : records.length === 0 ? (
        <Empty description="暂无已完成记录" />
      ) : (
        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {Object.entries(byStudent).map(([name, list]) => (
            <div key={name}>
              <h4 className="text-sm font-bold text-gray-900 mb-3">{name}</h4>
              <div className="space-y-4">
                {list.map((rec) => {
                  const rep = rec.finalReport;
                  if (!rep) return null;
                  return (
                    <div key={rec.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">{rec.completedAt || rec.createdAt}</span>
                        <span className="text-lg font-bold text-indigo-600">{rep.totalScore} 分</span>
                      </div>
                      {rep.strengths?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">优势</p>
                          <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
                            {rep.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {rep.weaknesses?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">不足</p>
                          <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
                            {rep.weaknesses.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {rep.suggestions?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">建议</p>
                          <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
                            {rep.suggestions.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
