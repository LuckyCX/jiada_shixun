import { useCallback, useEffect, useState } from 'react';
import { DatePicker, Input, Modal, Pagination, Select, Tag, Upload, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { TeacherPersonalClassRow } from '../teacherPortalApi';
import { listPersonalClassStudents, type TeacherRosterStudent } from '../teacherPortalApi';
import {
  listPersonalClassTasks,
  getPersonalClassTask,
  updatePersonalClassTask,
  deletePersonalClassTask,
  fetchTaskSubmissionDetail,
  downloadTaskSubmissionAttachment,
  TASK_PRIORITY_OPTIONS,
  type PersonalClassTask,
  type TaskPriority,
  type TaskSubmissionDetail,
  type TaskSubmissionStudent,
} from '../../../lib/personalClassTaskApi';
import TaskManagement from './taskManagement';
import type { GuidanceTargetScope, GuidanceUrgency } from '../../../lib/teacherGuidanceApi';
import {
  listTeacherGuidanceMessages,
  sendTeacherGuidanceMessage,
  withdrawTeacherGuidanceMessage,
  deleteTeacherGuidanceHistory,
  downloadTeacherGuidanceAttachment,
  type TeacherGuidanceHistoryRecord,
  type TeacherGuidanceAttachmentItem,
} from '../../../lib/teacherGuidanceApi';

interface GuidanceToolPanelProps {
  personalClass: TeacherPersonalClassRow;
  teams: { id: number; teamName: string; members: { name: string }[] }[];
  /** 从监控页「立即干预」跳入时预选小组 */
  presetTeamId?: number | null;
  onPresetTeamApplied?: () => void;
}

type GuidanceType = 'broadcast' | 'oneOnOne' | 'resource' | 'urge';
type ComposeMode = GuidanceType | 'trainingTask';
interface GuidanceRecord {
  id: string;
  type: ComposeMode;
  target: string;
  content: string;
  time: string;
  status: 'sent' | 'read' | 'replied';
  urgency?: TaskPriority;
  taskStatus?: PersonalClassTask['status'];
  sortAt: number;
  withdrawn?: boolean;
  messageId?: string;
  taskId?: string;
  targetScope?: GuidanceTargetScope;
  teamId?: string;
  studentId?: string;
  guidanceUrgency?: GuidanceUrgency;
  attachments?: TeacherGuidanceAttachmentItem[];
  makeupDeadline?: string;
  taskTitle?: string;
  taskModule?: string;
  taskPriority?: TaskPriority;
  taskDeadline?: string;
  taskRequiresStudentAttachment?: boolean;
  taskCompletedCount?: number;
  taskTotalTargets?: number;
  taskScope?: PersonalClassTask['scope'];
}

const formLabelClass = 'text-sm text-[rgba(0,0,0,0.88)] mb-2 block';

const typeConfig: Record<
  ComposeMode,
  {
    label: string;
    icon: string;
    color: string;
    bg: string;
    gradFrom: string;
    gradTo: string;
  }
> = {
  broadcast: {
    label: '全员通知',
    icon: 'ri-megaphone-line',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    gradFrom: 'from-teal-500',
    gradTo: 'to-cyan-500',
  },
  oneOnOne: {
    label: '一对一引导',
    icon: 'ri-chat-private-line',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    gradFrom: 'from-indigo-500',
    gradTo: 'to-purple-500',
  },
  resource: {
    label: '推送资源',
    icon: 'ri-send-plane-line',
    color: 'text-green-600',
    bg: 'bg-green-50',
    gradFrom: 'from-green-500',
    gradTo: 'to-emerald-500',
  },
  urge: {
    label: '学习督促',
    icon: 'ri-alarm-line',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    gradFrom: 'from-orange-500',
    gradTo: 'to-amber-500',
  },
  trainingTask: {
    label: '实训任务',
    icon: 'ri-task-line',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    gradFrom: 'from-blue-500',
    gradTo: 'to-indigo-500',
  },
};

const composeModeKeys: ComposeMode[] = [
  'broadcast',
  'oneOnOne',
  'resource',
  'urge',
  'trainingTask',
];

const guidanceTypeKeys: GuidanceType[] = ['broadcast', 'oneOnOne', 'resource', 'urge'];
const HISTORY_PAGE_SIZE = 10;
type HistoryStatusFilter = 'all' | 'sent' | 'withdrawn' | 'expired';

function parseRecordDeadlineMs(deadline?: string): number | null {
  if (!deadline?.trim()) return null;
  const s = deadline.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? `${s}T23:59:59`
    : /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)
      ? s.replace(' ', 'T')
      : s;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function isUrgeExpired(rec: GuidanceRecord): boolean {
  if (rec.type !== 'urge' || rec.withdrawn) return false;
  const t = parseRecordDeadlineMs(rec.makeupDeadline);
  return t != null && t < Date.now();
}

function recordFilterCategory(rec: GuidanceRecord): 'sent' | 'withdrawn' | 'expired' {
  if (rec.withdrawn) return 'withdrawn';
  if (rec.type === 'trainingTask') {
    if (rec.taskStatus === 'expired') return 'expired';
    if (rec.taskStatus === 'draft') return 'withdrawn';
    return 'sent';
  }
  if (isUrgeExpired(rec)) return 'expired';
  return 'sent';
}

function recordStatusTag(rec: GuidanceRecord) {
  const cat = recordFilterCategory(rec);
  if (cat === 'withdrawn') return { label: '已撤回', color: 'default' as const };
  if (cat === 'expired') return { label: '已过期', color: 'warning' as const };
  return { label: '已发送', color: 'success' as const };
}

function aggregateGuidanceStats(records: TeacherGuidanceHistoryRecord[]) {
  const out: Record<GuidanceType, { sent: number; readRate: number; batches: number }> = {
    broadcast: { sent: 0, readRate: 0, batches: 0 },
    oneOnOne: { sent: 0, readRate: 0, batches: 0 },
    resource: { sent: 0, readRate: 0, batches: 0 },
    urge: { sent: 0, readRate: 0, batches: 0 },
  };
  for (const type of guidanceTypeKeys) {
    const items = records.filter((r) => r.guidanceType === type);
    const sent = items.reduce((sum, r) => sum + (r.recipientCount || 0), 0);
    const read = items.reduce((sum, r) => sum + (r.readCount || 0), 0);
    out[type] = {
      sent,
      readRate: sent > 0 ? Math.round((read / sent) * 100) : 0,
      batches: items.length,
    };
  }
  return out;
}

const priorityBtnClass: Record<TaskPriority, string> = {
  urgent: 'bg-red-50 text-red-600 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  normal: 'bg-gray-50 text-gray-600 border-gray-200',
  low: 'bg-slate-50 text-slate-500 border-slate-200',
};

function parsePublishedAtMs(publishedAt: string): number {
  const s = publishedAt.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return new Date(s.replace(' ', 'T')).getTime();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(`${s.slice(0, 10)}T00:00:00`).getTime();
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatTaskHistoryTime(publishedAt: string) {
  if (!publishedAt?.trim()) return '—';
  const d = new Date(parsePublishedAtMs(publishedAt) || publishedAt);
  if (Number.isNaN(d.getTime())) return publishedAt;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function taskTargetLabel(task: PersonalClassTask) {
  if (task.scope === 'all') return '全体学生';
  const names = (task.teamProgress || []).map((t) => t.teamName).filter(Boolean);
  if (names.length) return names.join('、');
  return '指定团队';
}

const taskPriorityLabel = (p: string) =>
  TASK_PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p;

function taskToHistoryRecord(task: PersonalClassTask): GuidanceRecord {
  const target = taskTargetLabel(task);
  return {
    id: `task-${task.id}`,
    type: 'trainingTask',
    target,
    content: task.description?.trim() || '—',
    time: formatTaskHistoryTime(task.publishedAt),
    status: 'sent',
    taskStatus: task.status,
    taskId: task.id,
    taskTitle: task.title,
    taskModule: task.module,
    taskPriority: task.priority,
    taskDeadline: task.deadline,
    taskRequiresStudentAttachment: task.requiresStudentAttachment,
    taskCompletedCount: task.completedCount,
    taskTotalTargets: task.totalTargets,
    taskScope: task.scope,
    sortAt: task.publishedAt ? parsePublishedAtMs(task.publishedAt) : 0,
    attachments:
      task.attachments?.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
      })) ?? [],
  };
}

function guidanceToHistoryRecord(r: TeacherGuidanceHistoryRecord): GuidanceRecord {
  const sortAt = r.sentAt
    ? new Date(r.sentAt).getTime()
    : /^\d{4}-\d{2}-\d{2}/.test(r.time)
      ? new Date(r.time.replace(' ', 'T')).getTime()
      : 0;
  return {
    id: r.id,
    type: r.guidanceType,
    target: r.target,
    content: r.content,
    time: r.time,
    status: r.status === 'replied' ? 'replied' : r.readCount > 0 ? 'read' : 'sent',
    sortAt,
    messageId: r.id,
    targetScope: r.targetScope,
    teamId: r.teamId,
    studentId: r.studentId,
    guidanceUrgency: r.urgency,
    attachments: r.attachments,
    withdrawn: Boolean(r.withdrawn),
    makeupDeadline: r.makeupDeadline,
  };
}

const quickTemplates: Record<GuidanceType, string[]> = {
  broadcast: [
    '请各小组注意本阶段知识点检测截止时间，请尽快完成学习。',
    '本周将开展线上答疑，欢迎同学们积极提问，共同解决学习难点。',
    '请各小组按时提交本阶段实践成果，逾期将影响评价。',
  ],
  oneOnOne: [
    '注意到你在本阶段遇到了困难，建议参考案例库中的相关案例，有问题随时提问。',
    '你的学习进度有所滞后，建议合理安排时间，优先完成知识点学习与检测。',
  ],
  resource: [
    '推送相关学习资源，请结合案例库参考学习，有助于本阶段实践操作。',
    '推送优秀案例供参考，建议团队讨论后借鉴经验用于自身实践。',
    '推送知识点补充材料，帮助你更好地理解本阶段核心概念。',
  ],
  urge: [
    '你已多天未登录平台，请尽快完成本阶段学习任务，避免影响整体进度。',
    '本阶段知识点检测未达标，请重新学习后再次参加检测，截止时间为本周五。',
    '实践成果提交已超时，请于明天18:00前完成提交，否则将影响本环节评价。',
  ],
};

export default function GuidanceToolPanel({
  personalClass,
  teams = [],
  presetTeamId,
  onPresetTeamApplied,
}: GuidanceToolPanelProps) {
  const classId = personalClass.id;
  const [activeType, setActiveType] = useState<ComposeMode>('broadcast');
  const [targetType, setTargetType] = useState<'all' | 'team' | 'student'>('all');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rosterStudents, setRosterStudents] = useState<TeacherRosterStudent[]>([]);
  const [content, setContent] = useState('');
  const [deadline, setDeadline] = useState<Dayjs | null>(null);
  const [resourceFiles, setResourceFiles] = useState<File[]>([]);
  const [urgency, setUrgency] = useState<GuidanceUrgency>('normal');
  const [records, setRecords] = useState<GuidanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsHistory, setStatsHistory] = useState<TeacherGuidanceHistoryRecord[]>([]);
  const [taskStats, setTaskStats] = useState({ total: 0, published: 0, draft: 0, expired: 0 });
  const [statsTasks, setStatsTasks] = useState<PersonalClassTask[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'stats'>('compose');
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('all');
  const [submissionDetail, setSubmissionDetail] = useState<TaskSubmissionDetail | null>(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionView, setSubmissionView] = useState<'class' | 'team'>('class');

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [guidanceList, taskRes] = await Promise.all([
        listTeacherGuidanceMessages(classId),
        listPersonalClassTasks(classId),
      ]);
      const merged = [
        ...guidanceList.map(guidanceToHistoryRecord),
        ...(taskRes.tasks || []).map(taskToHistoryRecord),
      ].sort((a, b) => b.sortAt - a.sortAt);
      setRecords(merged);
    } catch {
      setRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void listPersonalClassStudents(classId)
      .then(setRosterStudents)
      .catch(() => setRosterStudents([]));
  }, [classId]);

  useEffect(() => {
    if (presetTeamId == null) return;
    setActiveTab('compose');
    setActiveType('urge');
    setTargetType('team');
    setSelectedTeamId(String(presetTeamId));
    setSelectedStudentId('');
    onPresetTeamApplied?.();
  }, [presetTeamId, onPresetTeamApplied]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    void loadHistory();
  }, [activeTab, loadHistory]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyStatusFilter]);

  const filteredHistoryRecords =
    historyStatusFilter === 'all'
      ? records
      : records.filter((r) => recordFilterCategory(r) === historyStatusFilter);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredHistoryRecords.length / HISTORY_PAGE_SIZE));
    setHistoryPage((p) => (p > maxPage ? maxPage : p));
  }, [filteredHistoryRecords.length]);

  const loadStatsData = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [hist, taskRes] = await Promise.all([
        listTeacherGuidanceMessages(classId),
        listPersonalClassTasks(classId),
      ]);
      setStatsHistory(hist);
      const list = taskRes.tasks || [];
      setStatsTasks(list);
      setTaskStats({
        total: list.length,
        published: list.filter((t) => t.status === 'published').length,
        draft: list.filter((t) => t.status === 'draft').length,
        expired: list.filter((t) => t.status === 'expired').length,
      });
    } catch {
      setStatsHistory([]);
      setStatsTasks([]);
      setTaskStats({ total: 0, published: 0, draft: 0, expired: 0 });
    } finally {
      setStatsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (activeTab !== 'stats') return;
    void loadStatsData();
  }, [activeTab, loadStatsData]);

  const guidanceStats = aggregateGuidanceStats(statsHistory);
  const guidanceTotals = guidanceTypeKeys.reduce(
    (acc, type) => {
      const items = statsHistory.filter((r) => r.guidanceType === type);
      acc.sent += items.reduce((sum, r) => sum + (r.recipientCount || 0), 0);
      acc.read += items.reduce((sum, r) => sum + (r.readCount || 0), 0);
      acc.batches += items.length;
      return acc;
    },
    { sent: 0, read: 0, batches: 0 }
  );
  const avgReadRate =
    guidanceTotals.sent > 0 ? Math.round((guidanceTotals.read / guidanceTotals.sent) * 100) : 0;

  const publishedTasks = statsTasks.filter((t) => t.status === 'published');
  const taskTargetTotal = publishedTasks.reduce((s, t) => s + (t.totalTargets || 0), 0);
  const taskCompletedTotal = publishedTasks.reduce((s, t) => s + (t.completedCount || 0), 0);
  const taskCompletionRate =
    taskTargetTotal > 0 ? Math.round((taskCompletedTotal / taskTargetTotal) * 100) : 0;

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryRecords.length / HISTORY_PAGE_SIZE));
  const historyPageSafe = Math.min(historyPage, historyTotalPages);
  const pagedHistoryRecords = filteredHistoryRecords.slice(
    (historyPageSafe - 1) * HISTORY_PAGE_SIZE,
    historyPageSafe * HISTORY_PAGE_SIZE
  );

  const handleQuickTemplate = (tpl: string) => setContent(tpl);

  const handleDownloadGuidanceAttachment = (attachmentId: string, fileName: string) => {
    void downloadTeacherGuidanceAttachment(classId, attachmentId, fileName).catch((e) => {
      message.error(e instanceof Error ? e.message : '下载失败');
    });
  };

  const openTaskSubmissionDetail = async (rec: GuidanceRecord) => {
    const taskId = rec.taskId;
    if (!taskId) return;
    setSubmissionLoading(true);
    setSubmissionView(rec.taskScope === 'all' ? 'class' : 'team');
    setSubmissionDetail(null);
    try {
      setSubmissionDetail(await fetchTaskSubmissionDetail(classId, taskId));
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载提交详情失败');
    } finally {
      setSubmissionLoading(false);
    }
  };

  const renderStudentSubmission = (student: TaskSubmissionStudent, requiresAttachment: boolean) => (
    <div key={student.studentId} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{student.name || student.studentNo || '学生'}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {student.studentNo || '无学号'} · {student.teamName || '未分组'}
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${student.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
        >
          {student.completed ? '已完成' : '未完成'}
        </span>
      </div>
      {requiresAttachment && student.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {student.attachments.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() =>
                void downloadTaskSubmissionAttachment(
                  classId,
                  submissionDetail?.taskId || '',
                  file.id,
                  file.fileName
                )
              }
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-gray-200 text-xs text-teal-700 hover:bg-teal-50 cursor-pointer"
            >
              <i className="ri-attachment-2"></i>
              <span className="max-w-[180px] truncate">{file.fileName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const withdrawRecordForDelete = async (rec: GuidanceRecord) => {
    if (rec.type === 'trainingTask') {
      const tid = rec.taskId || rec.id.replace(/^task-/, '');
      const task = await getPersonalClassTask(classId, tid);
      if (task.status === 'draft') return;
      await updatePersonalClassTask(classId, tid, {
        title: task.title,
        description: task.description,
        module: task.module,
        priority: task.priority,
        deadline: task.deadline,
        scope: task.scope,
        teamIds: task.targetTeamIds,
        attachmentsEnabled: task.attachmentsEnabled,
        requiresStudentAttachment: task.requiresStudentAttachment,
        resourceLinkEnabled: false,
        resourceNodeIds: [],
        status: 'draft',
      });
      return;
    }
    if (rec.messageId && !rec.withdrawn) {
      await withdrawTeacherGuidanceMessage(classId, rec.messageId);
    }
  };

  const handleDeleteRecord = (rec: GuidanceRecord) => {
    const isExpired = recordFilterCategory(rec) === 'expired';
    Modal.confirm({
      title: '确认删除',
      content: isExpired
        ? '将先撤回学生端展示，再删除记录，删除后不可恢复。'
        : '删除后不可恢复，相关附件将一并删除。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await withdrawRecordForDelete(rec);
          if (rec.type === 'trainingTask') {
            const tid = rec.taskId || rec.id.replace(/^task-/, '');
            await deletePersonalClassTask(classId, tid);
          } else if (rec.messageId) {
            await deleteTeacherGuidanceHistory(classId, rec.messageId);
          }
          message.success('已删除');
          await loadHistory();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败');
        }
      },
    });
  };

  const handleWithdrawRecord = (rec: GuidanceRecord) => {
    Modal.confirm({
      title: '确认撤回',
      content: '撤回后学生端将不再显示该条引导，记录仍保留在列表中。',
      okText: '撤回',
      cancelText: '取消',
      onOk: async () => {
        setWithdrawingId(rec.id);
        try {
          if (rec.type === 'trainingTask') {
            const tid = rec.taskId || rec.id.replace(/^task-/, '');
            const task = await getPersonalClassTask(classId, tid);
            await updatePersonalClassTask(classId, tid, {
              title: task.title,
              description: task.description,
              module: task.module,
              priority: task.priority,
              deadline: task.deadline,
              scope: task.scope,
              teamIds: task.targetTeamIds,
              attachmentsEnabled: task.attachmentsEnabled,
              requiresStudentAttachment: task.requiresStudentAttachment,
              resourceLinkEnabled: false,
              resourceNodeIds: [],
              status: 'draft',
            });
            message.success('已撤回');
          } else if (rec.messageId) {
            await withdrawTeacherGuidanceMessage(classId, rec.messageId);
            message.success('已撤回');
          }
          await loadHistory();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '撤回失败');
        } finally {
          setWithdrawingId(null);
        }
      },
    });
  };

  const handleSend = () => {
    if (activeType === 'trainingTask' || !content.trim() || sending) return;
    if (targetType === 'team' && !selectedTeamId) {
      setSendError('请选择小组');
      return;
    }
    if (targetType === 'student' && !selectedStudentId) {
      setSendError('请选择学生');
      return;
    }
    setSendError('');
    setSending(true);
    const filesToSend = activeType === 'resource' ? resourceFiles : undefined;
    void sendTeacherGuidanceMessage(
      classId,
      {
        guidanceType: activeType as GuidanceType,
        targetScope: targetType,
        content: content.trim(),
        urgency: activeType === 'broadcast' ? urgency : undefined,
        teamId: targetType === 'team' ? selectedTeamId : undefined,
        studentId: targetType === 'student' ? selectedStudentId : undefined,
        makeupDeadline:
          activeType === 'urge' && deadline
            ? deadline.format('YYYY-MM-DD HH:mm')
            : undefined,
      },
      filesToSend
    )
      .then(() => {
        setContent('');
        setDeadline(null);
        setResourceFiles([]);
        setUrgency('normal');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
        setHistoryPage(1);
        void loadHistory();
      })
      .catch((e) => {
        setSendError(e instanceof Error ? e.message : '发送失败');
      })
      .finally(() => setSending(false));
  };

  const conf = typeConfig[activeType];
  const isTrainingTaskMode = activeType === 'trainingTask';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 标题栏 */}
      <div className={`px-5 py-4 bg-gradient-to-r ${conf.gradFrom} ${conf.gradTo}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg">
              <i className={`${conf.icon} text-white text-sm`}></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">精准引导工具</h3>
              <p className="text-xs text-white">动态干预 · 过程引导</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white/20 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('compose')}
              className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'compose'
                  ? 'bg-white text-gray-800 font-medium shadow-sm'
                  : 'text-white/80'
              }`}
            >
              发送引导
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'bg-white text-gray-800 font-medium shadow-sm'
                  : 'text-white/80'
              }`}
            >
              效果统计
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-white text-gray-800 font-medium shadow-sm'
                  : 'text-white/80'
              }`}
            >
              历史记录
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'compose' ? (
          <div className="space-y-4">
            <div>
              <span className={formLabelClass}>引导方式</span>
              <div className="grid grid-cols-5 gap-2">
                {composeModeKeys.map((type) => {
                  const c = typeConfig[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setActiveType(type)}
                      className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border-2 transition-all cursor-pointer ${
                        activeType === type
                          ? `border-current ${c.color} ${c.bg}`
                          : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <i className={`${c.icon} text-base`}></i>
                      <span className="text-xs font-medium leading-tight text-center">
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isTrainingTaskMode ? (
              <TaskManagement
                key={editingTaskId ?? 'new-task'}
                personalClass={personalClass}
                embedded
                embeddedEditTaskId={editingTaskId}
                onTasksChanged={() => {
                  setEditingTaskId(undefined);
                  void loadHistory();
                }}
              />
            ) : (
              <>
            {/* 发送对象 */}
            <div>
              <span className={formLabelClass}>发送对象</span>
              <div className="flex items-center gap-2 mb-2">
                {[
                  { value: 'all', label: '全体学生' },
                  { value: 'team', label: '指定小组' },
                  { value: 'student', label: '指定学生' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTargetType(opt.value as typeof targetType)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                      targetType === opt.value
                        ? 'border-teal-400 bg-teal-50 text-teal-700 font-medium'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {targetType === 'team' && (
                <Select
                  className="w-full"
                  placeholder="请选择小组"
                  value={selectedTeamId || undefined}
                  onChange={setSelectedTeamId}
                  options={teams.map((t) => ({ value: String(t.id), label: t.teamName }))}
                  allowClear
                />
              )}
              {targetType === 'student' && (
                <Select
                  className="w-full"
                  placeholder="请选择学生"
                  value={selectedStudentId || undefined}
                  onChange={setSelectedStudentId}
                  showSearch
                  optionFilterProp="label"
                  options={rosterStudents.map((s) => ({ value: s.id, label: s.name }))}
                  allowClear
                />
              )}
            </div>

            {/* 紧急程度（仅全员通知显示） */}
            {activeType === 'broadcast' && (
              <div>
                <span className={formLabelClass}>紧急程度</span>
                <div className="flex flex-wrap items-center gap-2">
                  {TASK_PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setUrgency(opt.value)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                        urgency === opt.value
                          ? `${priorityBtnClass[opt.value]} font-medium`
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 快捷模板 */}
            <div>
              <span className={formLabelClass}>快捷模板</span>
              <div className="space-y-1.5">
                {quickTemplates[activeType].map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickTemplate(tpl)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 bg-gray-50 hover:bg-teal-50 hover:text-teal-700 rounded-lg border border-gray-100 hover:border-teal-200 transition-all cursor-pointer leading-relaxed"
                  >
                    <i className="ri-file-copy-line mr-1.5 text-gray-400"></i>
                    {tpl.length > 40 ? tpl.slice(0, 40) + '...' : tpl}
                  </button>
                ))}
              </div>
            </div>

            {/* 内容输入 */}
            <div>
              <span className={formLabelClass}>引导内容</span>
              <Input.TextArea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 500))}
                placeholder="输入引导内容，或点击上方模板快速填充..."
                rows={4}
                className="!rounded-xl"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">{content.length}/500</span>
              </div>
              {activeType === 'resource' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className={formLabelClass}>附件（单文件不超过 100MB）</span>
                  <Upload
                    multiple
                    beforeUpload={(file) => {
                      if (file.size > 100 * 1024 * 1024) {
                        setSendError('单文件不能超过 100MB');
                        return Upload.LIST_IGNORE;
                      }
                      setSendError('');
                      setResourceFiles((prev) => [...prev, file]);
                      return false;
                    }}
                    onRemove={(file) => {
                      const idx = Number(String(file.uid).replace('pending-', ''));
                      if (!Number.isNaN(idx)) {
                        setResourceFiles((prev) => prev.filter((_, i) => i !== idx));
                      }
                      return true;
                    }}
                    fileList={resourceFiles.map((f, i) => ({
                      uid: `pending-${i}`,
                      name: f.name,
                      status: 'done' as const,
                    }))}
                  >
                    <button
                      type="button"
                      className="text-sm text-teal-600 hover:text-teal-700 cursor-pointer"
                    >
                      选择文件
                    </button>
                  </Upload>
                </div>
              )}
            </div>

            {activeType === 'urge' && (
              <div>
                <span className={formLabelClass}>补学截止时间</span>
                <DatePicker
                  className="w-full"
                  showTime
                  value={deadline}
                  onChange={(v) => setDeadline(v)}
                  format="YYYY-MM-DD HH:mm"
                />
              </div>
            )}

            {sendError && (
              <p className="text-xs text-red-600">{sendError}</p>
            )}

            {/* 发送按钮 */}
            <button
              onClick={handleSend}
              disabled={!content.trim() || sending}
              className={`w-full py-3 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                content.trim() && !sending
                  ? `bg-gradient-to-r ${conf.gradFrom} ${conf.gradTo} text-white hover:opacity-90 shadow-sm`
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <i className={`${conf.icon} mr-2`}></i>
              {sending ? '发送中…' : `发送${conf.label}`}
            </button>

            {/* 成功提示 */}
            {showSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <i className="ri-check-circle-fill text-green-500"></i>
                <span className="text-sm text-green-700 font-medium">
                  引导消息已成功发送！
                </span>
              </div>
            )}
              </>
            )}
          </div>
        ) : activeTab === 'stats' ? (
          <div className="space-y-6">
            {statsLoading ? (
              <p className="text-xs text-gray-400 py-8 text-center">加载中…</p>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-3">实训任务</p>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      {
                        label: '任务总数',
                        value: taskStats.total,
                        icon: 'ri-file-list-3-line',
                        color: 'from-teal-500 to-cyan-500',
                      },
                      {
                        label: '已发布',
                        value: taskStats.published,
                        icon: 'ri-send-plane-line',
                        color: 'from-green-500 to-emerald-500',
                      },
                     
                      {
                        label: '已过期',
                        value: taskStats.expired,
                        icon: 'ri-time-line',
                        color: 'from-gray-400 to-gray-500',
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-2xl border border-gray-100 p-5 shadow-sm bg-white"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}
                          >
                            <i className={`${card.icon} text-white text-base`}></i>
                          </div>
                          <span className="text-3xl font-bold text-gray-900">{card.value}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-700">{card.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-3">引导与任务</p>
                  <div className="grid grid-cols-5 gap-3">
                    {guidanceTypeKeys.map((type) => {
                      const c = typeConfig[type];
                      const stat = guidanceStats[type];
                      return (
                        <div
                          key={type}
                          className={`rounded-xl p-4 border ${c.bg} border-gray-100`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div
                              className={`w-8 h-8 flex items-center justify-center rounded-lg ${c.bg}`}
                            >
                              <i className={`${c.icon} ${c.color} text-sm`}></i>
                            </div>
                            <span className={`text-xs font-semibold ${c.color}`}>{c.label}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-baseline justify-between">
                              <span className="text-xs text-gray-500">送达人次</span>
                              <span className={`text-lg font-bold ${c.color}`}>{stat.sent}</span>
                            </div>
                            {/* <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">已读率</span>
                              <div className="flex items-center gap-1">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full bg-gradient-to-r ${c.gradFrom} ${c.gradTo}`}
                                    style={{ width: `${stat.readRate}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-semibold text-gray-700">
                                  {stat.readRate}%
                                </span>
                              </div> 
                            </div>*/}
                          </div>
                        </div>
                      );
                    })}
                    {(() => {
                      const c = typeConfig.trainingTask;
                      return (
                        <div
                          key="trainingTask"
                          className={`rounded-xl p-4 border ${c.bg} border-gray-100`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div
                              className={`w-8 h-8 flex items-center justify-center rounded-lg ${c.bg}`}
                            >
                              <i className={`${c.icon} ${c.color} text-sm`}></i>
                            </div>
                            <span className={`text-xs font-semibold ${c.color}`}>{c.label}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-baseline justify-between">
                              <span className="text-xs text-gray-500">已发布</span>
                              <span className={`text-lg font-bold ${c.color}`}>
                                {taskStats.published}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">完成率</span>
                              <div className="flex items-center gap-1">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full bg-gradient-to-r ${c.gradFrom} ${c.gradTo}`}
                                    style={{ width: `${taskCompletionRate}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-semibold text-gray-700">
                                  {taskCompletionRate}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl p-4 bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="ri-send-plane-2-fill text-teal-600"></i>
                      <span className="text-xs font-semibold text-gray-600">引导送达总人次</span>
                    </div>
                    <p className="text-2xl font-bold text-teal-600">{guidanceTotals.sent}</p>
                  </div>
                  <div className="rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="ri-eye-fill text-indigo-600"></i>
                      <span className="text-xs font-semibold text-gray-600">引导平均已读率</span>
                    </div>
                    <p className="text-2xl font-bold text-indigo-600">{avgReadRate}%</p>
                  </div>
                  <div className="rounded-xl p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="ri-task-line text-blue-600"></i>
                      <span className="text-xs font-semibold text-gray-600">活跃实训任务</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{taskStats.published}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* 历史记录 */
          <div className="flex flex-col min-h-0 max-h-[calc(100vh-220px)] space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
              <p className="text-xs font-semibold text-gray-500">最近引导记录</p>
              <div className="flex items-center gap-2">
                <Select
                  size="small"
                  className="w-28"
                  value={historyStatusFilter}
                  onChange={(v) => setHistoryStatusFilter(v)}
                  options={[
                    { value: 'all', label: '全部' },
                    { value: 'sent', label: '已发送' },
                    { value: 'withdrawn', label: '已撤回' },
                    { value: 'expired', label: '已过期' },
                  ]}
                />
                <span className="text-xs text-gray-400">{filteredHistoryRecords.length} 条</span>
              </div>
            </div>
            <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
              {historyLoading ? (
                <p className="text-xs text-gray-400 py-6 text-center">加载中…</p>
              ) : filteredHistoryRecords.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">暂无发送记录</p>
              ) : (
              pagedHistoryRecords.map((rec) => {
                const c = typeConfig[rec.type];
                const statusTag = recordStatusTag(rec);
                const recordCat = recordFilterCategory(rec);
                const canWithdraw = recordCat === 'sent';
                const canDelete = recordCat === 'withdrawn' || recordCat === 'expired';
                return (
                  <div
                    key={rec.id}
                    className={`rounded-xl p-3 border ${c.bg} border-gray-100`}
                  >
                    <div className="flex items-start justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <i className={`${c.icon} ${c.color} text-xs shrink-0`}></i>
                        <span
                          className={`px-1.5 py-0.5 text-xs font-medium rounded-full shrink-0 ${c.bg} ${c.color}`}
                        >
                          {c.label}
                        </span>
                        <span className="text-xs text-gray-500 truncate">→ {rec.target}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {canWithdraw && (
                          <button
                            type="button"
                            disabled={withdrawingId === rec.id}
                            onClick={() => handleWithdrawRecord(rec)}
                            className="text-xs text-orange-600 hover:text-orange-700 cursor-pointer disabled:opacity-50"
                          >
                            撤回
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(rec)}
                            className="text-xs text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            删除
                          </button>
                        )}
                        <Tag bordered={false} color={statusTag.color} className="mr-0">
                          {statusTag.label}
                        </Tag>
                      </div>
                    </div>
                    {rec.type === 'trainingTask' ? (
                      <div className="mt-1 space-y-1 text-xs text-gray-600">
                        <p>
                          <span className="text-gray-500">任务标题：</span>
                          {rec.taskTitle || '—'}
                        </p>
                        <p>
                          <span className="text-gray-500">实训模块：</span>
                          {rec.taskModule || '—'}
                        </p>
                        <p>
                          <span className="text-gray-500">截止时间：</span>
                          {rec.taskDeadline || '—'}
                        </p>
                        <p>
                          <span className="text-gray-500">紧急程度：</span>
                          {rec.taskPriority ? taskPriorityLabel(rec.taskPriority) : '—'}
                        </p>
                        <p>
                          <span className="text-gray-500">发布对象：</span>
                          {rec.target}
                        </p>
                        <p className="leading-relaxed line-clamp-3">
                          <span className="text-gray-500">任务描述：</span>
                          {rec.content}
                        </p>
                        {rec.taskStatus !== 'draft' && (
                          <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                            <p>
                              <span className="text-gray-500">是否要求反馈附件：</span>
                              {rec.taskRequiresStudentAttachment ? '是' : '否'}
                            </p>
                            {rec.taskRequiresStudentAttachment && (
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-gray-500 shrink-0">提交进度：</span>
                              <div className="flex-1 min-w-[80px] max-w-[200px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-teal-500 to-cyan-500"
                                  style={{
                                    width: `${
                                      (rec.taskTotalTargets ?? 0) > 0
                                        ? Math.round(
                                            ((rec.taskCompletedCount ?? 0) / (rec.taskTotalTargets ?? 1)) * 100
                                          )
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                              <span className="text-teal-700 font-medium shrink-0">
                                {rec.taskCompletedCount ?? 0} / {rec.taskTotalTargets ?? 0}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void openTaskSubmissionDetail(rec)}
                              className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs rounded-lg hover:bg-teal-100 cursor-pointer shrink-0"
                            >
                              详情
                            </button>
                          </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                          {rec.content}
                        </p>
                        {rec.type === 'urge' && rec.makeupDeadline && (
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="text-gray-500">补学截止时间：</span>
                            {rec.makeupDeadline}
                          </p>
                        )}
                      </>
                    )}
                    {rec.attachments && rec.attachments.length > 0 && (
                      <div className="mt-2">
                        <h5 className="text-xs font-bold text-gray-700 mb-2">附件：</h5>
                        <div className="flex flex-wrap gap-2">
                          {rec.attachments.map((file) =>
                            rec.type === 'resource' ? (
                              <button
                                type="button"
                                key={file.id}
                                onClick={() =>
                                  handleDownloadGuidanceAttachment(file.id, file.fileName)
                                }
                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                              >
                                <i className="ri-file-line text-teal-500"></i>
                                <span>{file.fileName}</span>
                                <i className="ri-download-line text-gray-400"></i>
                              </button>
                            ) : (
                              <span
                                key={file.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600"
                              >
                                <i className="ri-file-line text-teal-500"></i>
                                <span>{file.fileName}</span>
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end mt-2 pt-1">
                      <span className="text-xs text-gray-400">{rec.time}</span>
                    </div>
                  </div>
                );
              })
              )}
            </div>
            {!historyLoading && filteredHistoryRecords.length > HISTORY_PAGE_SIZE && (
              <div className="flex justify-end pt-1 shrink-0">
                <Pagination
                  size="small"
                  current={historyPageSafe}
                  pageSize={HISTORY_PAGE_SIZE}
                  total={filteredHistoryRecords.length}
                  showSizeChanger={false}
                  onChange={(page) => setHistoryPage(page)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        title="提交详情"
        open={submissionLoading || !!submissionDetail}
        onCancel={() => {
          setSubmissionDetail(null);
          setSubmissionLoading(false);
        }}
        footer={null}
        width={920}
      >
        {submissionLoading || !submissionDetail ? (
          <div className="py-12 text-center text-sm text-gray-400">加载中…</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                已完成 {submissionDetail.completedCount} / {submissionDetail.totalTargets}
              </div>
              {submissionDetail.scope === 'all' && (
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                  {[
                    { key: 'class' as const, label: '全班视图' },
                    { key: 'team' as const, label: '小组视图' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSubmissionView(item.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${submissionView === item.key ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {submissionDetail.scope === 'all' && submissionView === 'class' ? (
              <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                {submissionDetail.students.map((student) =>
                  renderStudentSubmission(student, submissionDetail.requiresStudentAttachment)
                )}
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {submissionDetail.teams.map((team) => (
                  <div key={team.teamId} className="rounded-2xl border border-gray-100 p-4">
                    <div className="text-sm font-bold text-gray-900 mb-3">{team.teamName}</div>
                    <div className="grid grid-cols-2 gap-3">
                      {team.members.map((student) =>
                        renderStudentSubmission(student, submissionDetail.requiresStudentAttachment)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}