import { useCallback, useEffect, useState } from 'react';
import { Input, Modal, message } from 'antd';
import type { TeacherPersonalClassRow } from '../../teacherPortalApi';
import {
  fetchTeacherBmcReviews as fetchTeacherBmcReviewsDefault,
  reviewTeacherBmc as reviewTeacherBmcDefault,
  type TeacherBmcReviewItem,
} from '../../../../lib/teacherBmcReviewApi';
import { WAR_ROOM_MODULE_DEFS } from '../../../../lib/studentBusinessModelApi';

const LABELS: Record<string, string> = Object.fromEntries(
  WAR_ROOM_MODULE_DEFS.map((d) => [d.key, d.title])
);
const BMC_MODULE_KEYS = WAR_ROOM_MODULE_DEFS.map((d) => d.key);

type BmcReviewApi = {
  fetchTeacherBmcReviews: (
    classId: string,
    status: 'all' | 'pending' | 'approved' | 'rejected'
  ) => Promise<TeacherBmcReviewItem[]>;
  reviewTeacherBmc: (
    classId: string,
    teamId: string,
    body: { decision: 'approve' | 'reject'; comment: string }
  ) => Promise<{ teamId: string; status: string; reviewComment: string }>;
};

type Props = {
  personalClass: TeacherPersonalClassRow;
  /** 演示模式可注入 session 版 API；默认走真实教师接口 */
  api?: BmcReviewApi;
};

export default function BmcReview({ personalClass, api }: Props) {
  const classId = personalClass.id;
  const fetchList = api?.fetchTeacherBmcReviews || fetchTeacherBmcReviewsDefault;
  const reviewOne = api?.reviewTeacherBmc || reviewTeacherBmcDefault;
  const [items, setItems] = useState<TeacherBmcReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [active, setActive] = useState<TeacherBmcReviewItem | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return fetchList(classId, statusFilter)
      .then(setItems)
      .catch((e) => {
        setItems([]);
        message.error(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => setLoading(false));
  }, [classId, statusFilter, fetchList]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (decision: 'approve' | 'reject') => {
    if (!active) return;
    if (decision === 'reject' && !comment.trim()) {
      message.warning('驳回请填写评语');
      return;
    }
    setSubmitting(true);
    try {
      await reviewOne(classId, active.teamId, { decision, comment: comment.trim() });
      message.success(decision === 'approve' ? '已通过' : '已驳回');
      setActive(null);
      setComment('');
      void load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '审核失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">商业画布审核</h2>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer ${
                statusFilter === s ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              {s === 'all' ? '全部' : s === 'pending' ? '待审' : s === 'approved' ? '已通过' : '已驳回'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">加载中…</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">暂无待审画布</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.teamId}
              type="button"
              onClick={() => {
                setActive(item);
                setComment(item.reviewComment || '');
              }}
              className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 hover:border-teal-200 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{item.teamName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    提交人 {item.submitterName}
                    {item.savedAt ? ` · ${new Date(item.savedAt).toLocaleString('zh-CN')}` : ''}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${
                    item.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : item.status === 'rejected'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {item.status === 'approved' ? '已通过' : item.status === 'rejected' ? '已驳回' : '待审'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(active)}
        onCancel={() => setActive(null)}
        title={active ? `${active.teamName} · 商业画布` : '商业画布'}
        width={720}
        footer={null}
      >
        {active ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto">
              {(BMC_MODULE_KEYS || Object.keys(LABELS)).map((key) => (
                <div key={key} className="border border-gray-100 rounded-xl p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-1">{LABELS[key] || key}</div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {(active.bmc as Record<string, string>)[key] || '（空）'}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">评语</div>
              <Input.TextArea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="通过可写鼓励；驳回请说明修改要求"
              />
            </div>
            {active.status !== 'approved' ? (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit('reject')}
                  className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm cursor-pointer disabled:opacity-50"
                >
                  驳回
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit('approve')}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm cursor-pointer disabled:opacity-50"
                >
                  通过
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
