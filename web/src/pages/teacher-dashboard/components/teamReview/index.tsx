import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Modal, Popover, Spin } from 'antd';
import type { TeacherPersonalClassRow } from '../../teacherPortalApi';
import UserAvatar from '../../../../components/UserAvatar';
import {
  addTeamMember,
  confirmTeacherAiGroupRandom,
  confirmTeacherGrouping,
  notifyTeacherTeamStudents,
  fetchTeacherGrouping,
  fetchTeacherTeamQuestions,
  normalizeTeamDimensionProfile,
  postTeacherAiGroupStream,
  removeTeamMember,
  setTeacherTeamLeader,
  TEAM_DIMENSION_BARS,
  type TeacherGroupingState,
  type TeamDimensionProfile,
} from '../../../../lib/teamFormationApi';

const MIN_PENDING_FOR_AI = 5;
const MAX_TEAM_SIZE = 6;

type AbilityProfile = TeamDimensionProfile;

// 学生信息类型
type Student = {
  id: string;
  name: string;
  studentId: string;
  major: string;
  grade: string;
  avatar: string;
  profile: AbilityProfile;
  skills: string[];
  status: 'pending' | 'grouped' | 'confirmed';
  teamId?: string;
  aiMatchedRole?: string;
  aiMatchedRoleLabel?: string;
  isTeamLeader?: boolean;
};

// 团队类型
type Team = {
  id: string;
  name: string;
  groupingStatus?: 'draft' | 'confirmed';
  members: Student[];
  avgProfile: AbilityProfile;
  complementScore: number;
};

// 已分组等演示数据（待组队走 API）
const mockStudentsGrouped: Student[] = (
[
  {
    id: 'stu-001',
    name: '张明',
    studentId: '2021001',
    major: '计算机科学',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20confident%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-001&orientation=squarish',
    profile: { techGeek: 85, designAesthetic: 45, businessOperator: 92 },
    skills: ['项目管理', '商业分析', 'Python'],
    status: 'pending',
  },
  {
    id: 'stu-002',
    name: '李娜',
    studentId: '2021002',
    major: '软件工程',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20friendly%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-002&orientation=squarish',
    profile: { techGeek: 92, designAesthetic: 55, businessOperator: 48 },
    skills: ['前端开发', 'React', 'TypeScript'],
    status: 'pending',
  },
  {
    id: 'stu-003',
    name: '王强',
    studentId: '2021003',
    major: '视觉传达设计',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20creative%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-003&orientation=squarish',
    profile: { techGeek: 38, designAesthetic: 95, businessOperator: 52 },
    skills: ['UI设计', 'Figma', '用户体验'],
    status: 'pending',
  },
  {
    id: 'stu-004',
    name: '陈雪',
    studentId: '2021004',
    major: '市场营销',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20confident%20business%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-004&orientation=squarish',
    profile: { techGeek: 42, designAesthetic: 68, businessOperator: 88 },
    skills: ['市场调研', '数据分析', '营销策划'],
    status: 'pending',
  },
  {
    id: 'stu-005',
    name: '刘洋',
    studentId: '2021005',
    major: '计算机科学',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20tech%20enthusiast%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-005&orientation=squarish',
    profile: { techGeek: 88, designAesthetic: 50, businessOperator: 55 },
    skills: ['后端开发', 'Java', '数据库'],
    status: 'pending',
  },
  {
    id: 'stu-006',
    name: '赵敏',
    studentId: '2021006',
    major: '视觉传达设计',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20artistic%20creative%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-006&orientation=squarish',
    profile: { techGeek: 45, designAesthetic: 90, businessOperator: 58 },
    skills: ['平面设计', 'Photoshop', '品牌设计'],
    status: 'pending',
  },
  {
    id: 'stu-007',
    name: '孙杰',
    studentId: '2021007',
    major: '工商管理',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20leadership%20confidence%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-007&orientation=squarish',
    profile: { techGeek: 50, designAesthetic: 60, businessOperator: 85 },
    skills: ['商业模式', '财务分析', '团队管理'],
    status: 'pending',
  },
  {
    id: 'stu-008',
    name: '周芳',
    studentId: '2021008',
    major: '软件工程',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20tech%20focused%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-008&orientation=squarish',
    profile: { techGeek: 90, designAesthetic: 48, businessOperator: 52 },
    skills: ['全栈开发', 'Node.js', 'MongoDB'],
    status: 'pending',
  },
  {
    id: 'stu-009',
    name: '吴涛',
    studentId: '2021009',
    major: '市场营销',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20business%20marketing%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-009&orientation=squarish',
    profile: { techGeek: 48, designAesthetic: 55, businessOperator: 82 },
    skills: ['市场推广', '社交媒体', '内容营销'],
    status: 'pending',
  },
  {
    id: 'stu-010',
    name: '郑浩',
    studentId: '2021010',
    major: '视觉传达设计',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20design%20creative%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-010&orientation=squarish',
    profile: { techGeek: 52, designAesthetic: 88, businessOperator: 60 },
    skills: ['交互设计', 'Sketch', '原型设计'],
    status: 'pending',
  },
  {
    id: 'stu-011',
    name: '钱丽',
    studentId: '2021011',
    major: '计算机科学',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20tech%20confident%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-011&orientation=squarish',
    profile: { techGeek: 86, designAesthetic: 58, businessOperator: 50 },
    skills: ['算法', 'C++', '数据结构'],
    status: 'pending',
  },
  {
    id: 'stu-012',
    name: '孙明',
    studentId: '2021012',
    major: '工商管理',
    grade: '大三',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20business%20professional%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=stu-012&orientation=squarish',
    profile: { techGeek: 55, designAesthetic: 62, businessOperator: 80 },
    skills: ['战略规划', '运营管理', '项目协调'],
    status: 'pending',
  },
] as Array<Omit<Student, 'profile'> & { profile: { techGeek: number; designAesthetic: number; businessOperator: number } }>
).map((s) => ({
  ...s,
  profile: normalizeTeamDimensionProfile(s.profile),
}));

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-3 rounded-xl shadow-lg z-[9999] flex items-center gap-2 text-sm font-medium`;
  div.innerHTML = `<i class="${type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}"></i><span>${message}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function hasPresetQuestionsReady(list: { title?: string }[]): boolean {
  const filled = list.filter((q) => (q.title ?? '').trim().length > 0);
  return filled.length >= 3;
}

type TeamReviewProps = {
  personalClass: TeacherPersonalClassRow;
  onOpenQuestionsPreset: () => void;
  questionsSavedTick?: number;
};

function mapGroupingToUi(data: TeacherGroupingState): { students: Student[]; teams: Team[] } {
  const pending: Student[] = (data.pendingStudents || []).map((s) => ({
    id: s.id,
    name: s.name,
    studentId: s.studentId,
    major: '',
    grade: '',
    avatar: '',
    profile: normalizeTeamDimensionProfile(s.profile),
    skills: [] as string[],
    status: 'pending' as const,
    aiMatchedRole: s.aiMatchedRole,
    aiMatchedRoleLabel: s.aiMatchedRoleLabel,
  }));
  const teams: Team[] = (data.teams || []).map((t) => {
    const members: Student[] = (t.members || []).map((m) => ({
      id: m.id,
      name: m.name,
      studentId: m.studentId,
      major: '',
      grade: '',
      avatar: '',
      profile: normalizeTeamDimensionProfile(m.profile),
      skills: [] as string[],
      status: (t.groupingStatus === 'confirmed' ? 'confirmed' : 'grouped') as 'grouped' | 'confirmed',
      teamId: t.id,
      aiMatchedRole: m.aiMatchedRole,
      aiMatchedRoleLabel: m.aiMatchedRoleLabel,
      isTeamLeader: Boolean(m.isTeamLeader),
    }));
    const gs = t.groupingStatus === 'confirmed' ? 'confirmed' : 'draft';
    return {
      id: t.id,
      name: t.name,
      groupingStatus: gs,
      members,
      avgProfile: normalizeTeamDimensionProfile(t.avgProfile),
      complementScore: t.complementScore ?? 0,
    };
  });
  return { students: [...pending, ...teams.flatMap((t) => t.members)], teams };
}

export default function TeamReview({ personalClass, onOpenQuestionsPreset, questionsSavedTick = 0 }: TeamReviewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [aiGrouping, setAiGrouping] = useState(false);
  const [aiGroupStep, setAiGroupStep] = useState('');
  const [aiThinkingLines, setAiThinkingLines] = useState<string[]>([]);
  const [joinTeamStudentId, setJoinTeamStudentId] = useState<string | null>(null);
  const [joinTeamTargetId, setJoinTeamTargetId] = useState<string | null>(null);
  const [questionsChecked, setQuestionsChecked] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(true);
  const [presetAlertClosed, setPresetAlertClosed] = useState(false);

  const reloadGrouping = useCallback(() => {
    setLoadingStudents(true);
    return fetchTeacherGrouping(personalClass.id)
      .then((data) => {
        const ui = mapGroupingToUi(data);
        setStudents(ui.students);
        setTeams(ui.teams);
      })
      .catch(() => {
        setStudents([]);
        setTeams([]);
      })
      .finally(() => setLoadingStudents(false));
  }, [personalClass.id]);

  useEffect(() => {
    void reloadGrouping();
  }, [reloadGrouping]);

  useEffect(() => {
    setPresetAlertClosed(false);
    setQuestionsChecked(false);
    fetchTeacherTeamQuestions(personalClass.id)
      .then((list) => setQuestionsReady(hasPresetQuestionsReady(list)))
      .catch(() => setQuestionsReady(false))
      .finally(() => setQuestionsChecked(true));
  }, [personalClass.id, questionsSavedTick]);

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'grouped'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 计算能力互补得分
  const calculateComplementScore = (members: Student[]): number => {
    if (members.length === 0) return 0;
    
    const avgS = members.reduce((sum, m) => sum + m.profile.strategic, 0) / members.length;
    const avgM = members.reduce((sum, m) => sum + m.profile.market, 0) / members.length;
    const avgT = members.reduce((sum, m) => sum + m.profile.techRisk, 0) / members.length;

    const varS = members.reduce((sum, m) => sum + Math.pow(m.profile.strategic - avgS, 2), 0) / members.length;
    const varM = members.reduce((sum, m) => sum + Math.pow(m.profile.market - avgM, 2), 0) / members.length;
    const varT = members.reduce((sum, m) => sum + Math.pow(m.profile.techRisk - avgT, 2), 0) / members.length;

    const complementScore = Math.min(100, (varS + varM + varT) / 30);
    
    return Math.round(complementScore);
  };

  const appendAiThinking = (text: string) => {
    setAiThinkingLines((prev) => {
      const merged = (prev.join('\n') + text).split('\n').map((s) => s.trim()).filter(Boolean);
      return merged.slice(-4);
    });
  };

  const hasDraftTeams = teams.some((t) => t.groupingStatus === 'draft');
  const hasExistingTeams = teams.some((t) => t.members.length > 0);
  const minPendingForAiClick = hasExistingTeams ? 1 : MIN_PENDING_FOR_AI;
  const teamCanEdit = (t: Team) => t.groupingStatus === 'draft' || t.groupingStatus === 'confirmed';

  const applyGroupingDone = (data: TeacherGroupingState, toastMsg?: string) => {
    const ui = mapGroupingToUi(data);
    setStudents(ui.students);
    setTeams(ui.teams);
    if (toastMsg) showToast(toastMsg);
  };

  const handleAutoGroup = async () => {
    const pendingStudents = students.filter((s) => s.status === 'pending');
    if (pendingStudents.length < minPendingForAiClick) {
      showToast(
        hasExistingTeams
          ? '暂无待组队学生'
          : `首次 AI 组队需至少 ${MIN_PENDING_FOR_AI} 人（无已有团队时由 AI 一次性划分，且每组至少 3 人）`,
        'error'
      );
      return;
    }
    setAiGrouping(true);
    setAiGroupStep(hasExistingTeams ? '正在按角色补位…' : '正在连接模型…');
    setAiThinkingLines([]);
    try {
      await postTeacherAiGroupStream(personalClass.id, {
        onStatus: (msg) => setAiGroupStep(msg),
        onThinking: (t) => appendAiThinking(t),
        onDone: (data) => {
          if (data.needsRandomConfirm) {
            const n = data.remainderCount ?? data.remainderStudents?.length ?? 0;
            applyGroupingDone(data);
            Modal.confirm({
              title: '随机插入剩余学生',
              content: `待分组学生仅剩 ${n} 人，将随机插入已分好的团队，组内角色可能重复。是否继续？`,
              okText: '确认插入',
              cancelText: '取消',
              onOk: async () => {
                const next = await confirmTeacherAiGroupRandom(personalClass.id);
                applyGroupingDone(next, '已随机插入剩余学生');
              },
            });
            return;
          }
          applyGroupingDone(data, `AI 智能组队完成，共 ${mapGroupingToUi(data).teams.length} 个团队`);
        },
        onError: (message) => {
          showToast(message, 'error');
        },
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'AI 组队失败', 'error');
    } finally {
      setAiGrouping(false);
      setAiGroupStep('');
      setAiThinkingLines([]);
    }
  };

  const handleSetTeamLeader = async (studentId: string, teamId: string) => {
    try {
      const data = await setTeacherTeamLeader(personalClass.id, teamId, studentId);
      const ui = mapGroupingToUi(data);
      setStudents(ui.students);
      setTeams(ui.teams);
      showToast('已指定队长');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  };

  const handleRemoveFromTeam = async (studentId: string, teamId: string) => {
    try {
      const data = await removeTeamMember(personalClass.id, teamId, studentId);
      const ui = mapGroupingToUi(data);
      setStudents(ui.students);
      setTeams(ui.teams);
      showToast('已将学生移出团队');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  };

  const handleAddToTeam = async (studentId: string, teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (team && team.members.length >= MAX_TEAM_SIZE) {
      showToast(`团队人数已达上限（${MAX_TEAM_SIZE} 人）`, 'error');
      return;
    }
    try {
      const data = await addTeamMember(personalClass.id, teamId, studentId);
      const ui = mapGroupingToUi(data);
      setStudents(ui.students);
      setTeams(ui.teams);
      setJoinTeamStudentId(null);
      setJoinTeamTargetId(null);
      showToast('已将学生添加到团队');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  };

  // 拖拽开始
  const handleDragStart = (student: Student) => {
    setDraggedStudent(student);
  };

  // 拖拽到团队
  const handleDropToTeam = (teamId: string) => {
    if (!draggedStudent) return;
    
    // 如果学生已在其他团队，先移除
    if (draggedStudent.teamId) {
      handleRemoveFromTeam(draggedStudent.id, draggedStudent.teamId);
    }
    
    handleAddToTeam(draggedStudent.id, teamId);
    setDraggedStudent(null);
  };

  const inTeamCount = teams.reduce((s, t) => s + t.members.length, 0);

  const handleConfirmGrouping = async () => {
    if (!hasDraftTeams) {
      showToast('没有待确认的草稿团队', 'error');
      return;
    }
    try {
      const data = await confirmTeacherGrouping(personalClass.id);
      const ui = mapGroupingToUi(data);
      setStudents(ui.students);
      setTeams(ui.teams);
      setShowConfirmModal(false);
      showToast('已确认组队，团队状态已锁定为已确认');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '确认失败', 'error');
    }
  };

  const handleNotifyStudents = async () => {
    if (inTeamCount < 1) {
      showToast('还没有已入队学生', 'error');
      return;
    }
    try {
      const data = await notifyTeacherTeamStudents(personalClass.id);
      showToast(`已向 ${data.notifiedCount ?? inTeamCount} 名已入队学生发送通知`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '发送通知失败', 'error');
    }
  };

  // 筛选学生
  const filteredStudents = students.filter(s => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchSearch = !searchKeyword || s.name.includes(searchKeyword) || s.studentId.includes(searchKeyword);
    return matchStatus && matchSearch;
  });

  const pendingCount = students.filter(s => s.status === 'pending').length;
  const editableTeams = teams.filter(
    (t) => teamCanEdit(t) && t.members.length > 0 && t.members.length < MAX_TEAM_SIZE
  );
  const groupedCount = students.filter(s => s.status === 'grouped').length;
  const confirmedCount = students.filter(s => s.status === 'confirmed').length;

  return (
    <div className="space-y-6">
      {questionsChecked && !questionsReady && !presetAlertClosed && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={() => setPresetAlertClosed(true)}
          message="尚未完成组队问题预设"
          description={
            <span>
              请先配置至少 3 道组队测评题，学生才能提交组队测评。
              <button
                type="button"
                onClick={onOpenQuestionsPreset}
                className="ml-2 text-teal-600 font-medium underline cursor-pointer"
              >
                去预设
              </button>
            </span>
          }
        />
      )}

      {/* 头部统计 */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold mb-2">组队审核管理</h2>
            <p className="text-white/80 text-sm">所有学生已完成能力画像测评，可以开始组队</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenQuestionsPreset}
              className="px-5 py-2.5 bg-white/90 text-teal-700 text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2"
            >
              <i className="ri-questionnaire-line text-base"></i>
              组队问题预设
            </button>
            {teams.length === 0 ? (
              <button
                type="button"
                disabled={pendingCount < minPendingForAiClick || aiGrouping}
                onClick={() => void handleAutoGroup()}
                className={`px-5 py-2.5 bg-white text-teal-700 text-sm font-bold rounded-xl whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                  pendingCount < minPendingForAiClick || aiGrouping ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                }`}
              >
                {aiGrouping ? <Spin size="small" /> : <i className="ri-magic-line text-base" />}
                AI 智能组队
              </button>
            ) : (
              <>
                {pendingCount >= minPendingForAiClick ? (
                  <button
                    type="button"
                    disabled={aiGrouping}
                    onClick={() => void handleAutoGroup()}
                    className={`px-5 py-2.5 bg-white text-teal-700 text-sm font-bold rounded-xl whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                      aiGrouping ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                    }`}
                  >
                    {aiGrouping ? <Spin size="small" /> : <i className="ri-magic-line text-base" />}
                    AI 智能组队
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!hasDraftTeams}
                  onClick={() => setShowConfirmModal(true)}
                  className={`px-5 py-2.5 bg-white text-teal-700 text-sm font-bold rounded-xl whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    !hasDraftTeams ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                  }`}
                >
                  <i className="ri-check-double-line text-base"></i>
                  确认组队
                </button>
                <button
                  type="button"
                  disabled={inTeamCount < 1}
                  onClick={() => void handleNotifyStudents()}
                  className={`px-5 py-2.5 bg-white/90 text-teal-800 text-sm font-bold rounded-xl whitespace-nowrap flex items-center gap-2 cursor-pointer border border-white/60 ${
                    inTeamCount < 1 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                  }`}
                >
                  <i className="ri-send-plane-line text-base"></i>
                  通知学生
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '总学生数', value: students.length, icon: 'ri-user-line', color: 'bg-white/20' },
            { label: '待组队', value: pendingCount, icon: 'ri-time-line', color: 'bg-amber-500/30' },
            { label: '已分组', value: groupedCount, icon: 'ri-team-line', color: 'bg-green-500/30' },
            { label: '已确认', value: confirmedCount, icon: 'ri-checkbox-circle-line', color: 'bg-blue-500/30' },
          ].map((stat, i) => (
            <div key={i} className={`${stat.color} backdrop-blur-sm border border-white/30 rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/80">{stat.label}</span>
                <i className={`${stat.icon} text-xl text-white`}></i>
              </div>
              <div className="text-3xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
 

      {aiGrouping && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Spin size="small" />
            <span className="text-sm font-bold text-amber-900">{aiGroupStep || 'AI 正在智能分组…'}</span>
          </div>
          {aiThinkingLines.length > 0 ? (
            <div className="border border-amber-100 bg-white/60 rounded-xl p-3">
              <div className="text-[10px] font-semibold text-amber-800 mb-1.5">思考过程</div>
              <div className="max-h-28 overflow-y-auto text-xs text-amber-950/90 whitespace-pre-wrap leading-relaxed space-y-1">
                {aiThinkingLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-amber-800/80">等待模型输出思考内容…</p>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 左侧：待组队学生池 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-6">
            <div className="bg-gray-50 border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <i className="ri-user-add-line text-teal-600"></i>
                待组队学生池
                <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-bold rounded-full whitespace-nowrap">
                  {filteredStudents.filter(s => s.status === 'pending').length}
                </span>
              </h3>
            </div>
            <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto space-y-2">
              {filteredStudents.filter(s => s.status === 'pending').length === 0 ? (
                <div className="text-center py-8">
                  <i className="ri-checkbox-circle-line text-4xl text-gray-300 block mb-2"></i>
                  <p className="text-sm text-gray-400">所有学生已分组</p>
                </div>
              ) : (
                filteredStudents.filter(s => s.status === 'pending').map(student => (
                  <div
                    key={student.id}
                    draggable
                    onDragStart={() => handleDragStart(student)}
                    className="relative bg-gray-50 border border-gray-200 rounded-xl p-3 hover:border-teal-300 hover:bg-teal-50/30 transition-all cursor-move"
                  >
                    {editableTeams.length > 0 && (
                      <Popover
                        trigger="click"
                        open={joinTeamStudentId === student.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setJoinTeamStudentId(null);
                            setJoinTeamTargetId(null);
                          } else {
                            setJoinTeamStudentId(student.id);
                          }
                        }}
                        content={
                          <div className="w-52 space-y-2">
                            <p className="text-xs font-bold text-gray-800">选择目标团队</p>
                            {editableTeams.map((t) => (
                              <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="radio"
                                  name={`join-${student.id}`}
                                  checked={joinTeamTargetId === t.id}
                                  onChange={() => setJoinTeamTargetId(t.id)}
                                />
                                {t.name}（{t.members.length}人）
                              </label>
                            ))}
                            <Button
                              type="primary"
                              size="small"
                              block
                              disabled={!joinTeamTargetId}
                              onClick={() => {
                                if (joinTeamTargetId) void handleAddToTeam(student.id, joinTeamTargetId);
                              }}
                            >
                              确认加入
                            </Button>
                          </div>
                        }
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setJoinTeamStudentId(student.id);
                            setJoinTeamTargetId(editableTeams[0]?.id ?? null);
                          }}
                          className="absolute top-2 right-2 z-10 px-2 py-0.5 text-[10px] font-medium bg-teal-600 text-white rounded-md hover:bg-teal-700 cursor-pointer"
                        >
                          加入团队
                        </button>
                      </Popover>
                    )}
                    <div className="flex items-start gap-3">
                      <UserAvatar name={student.name || '?'} size="lg" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 leading-snug mb-1">{student.name}</h4>
                        <div className="flex gap-1 mb-1.5">
                          <span className="self-start px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                            {student.studentId}
                          </span>
                          {student.aiMatchedRoleLabel ? (
                            <span className="self-start px-1.5 py-0.5 bg-teal-100 text-teal-700 text-[10px] rounded-full leading-snug">
                              {student.aiMatchedRoleLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          {TEAM_DIMENSION_BARS.map((item) => (
                            <div key={item.key} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-14">{item.label}</span>
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                                  style={{ width: `${student.profile[item.key]}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-700 w-8 text-right">
                                {student.profile[item.key]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 右侧：已组队团队 */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {teams.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-team-line text-4xl text-gray-400"></i>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">还没有组建团队</h3>
                <p className="text-sm text-gray-500 mb-5">点击"AI 智能组队"自动分组 </p>
                <button
                  type="button"
                  onClick={() => void handleAutoGroup()}
                  disabled={pendingCount < minPendingForAiClick || aiGrouping}
                  className={`px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer ${
                    pendingCount < minPendingForAiClick || aiGrouping ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {aiGrouping ? <Spin size="small" className="mr-2" /> : <i className="ri-magic-line mr-2" />}
                  AI 智能组队
                </button>
              </div>
            ) : (
              teams.map((team, index) => (
                <div
                  key={team.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropToTeam(team.id)}
                  className="bg-white rounded-2xl border-2 border-gray-100 hover:border-teal-200 transition-all overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-bold text-lg">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-base font-bold">{team.name}</h3>
                          <p className="text-xs text-white/80">{team.members.length} 名成员</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white/80 mb-1">互补得分</div>
                        <div className="text-2xl font-bold">{team.complementScore}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* 团队平均能力 */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <h4 className="text-xs font-bold text-gray-700 mb-3">团队平均能力</h4>
                      <div className="space-y-2">
                        {[
                          { label: '战略统筹', value: team.avgProfile.strategic, color: 'from-violet-500 to-purple-500' },
                          { label: '市场运营', value: team.avgProfile.market, color: 'from-orange-400 to-amber-400' },
                          { label: '技术风控', value: team.avgProfile.techRisk, color: 'from-teal-500 to-cyan-500' },
                        ].map(item => (
                          <div key={item.label} className="flex items-center gap-3">
                            <span className="text-xs text-gray-600 w-16">{item.label}</span>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                            </div>
                            <span className="text-xs font-bold text-gray-900 w-10 text-right">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 成员列表 */}
                    <div className="space-y-2">
                      {team.members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-teal-50/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex-shrink-0 bg-teal-600 text-white flex items-center justify-center text-sm font-bold"
                              aria-hidden
                            >
                              {[...(member.name || '?').trim()][0] || '?'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-sm font-bold text-gray-900">{member.name}</span>
                                <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full whitespace-nowrap">
                                  {member.studentId}
                                </span>
                                {member.aiMatchedRoleLabel ? (
                                  <span className="inline-block px-1.5 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full whitespace-nowrap">
                                    {member.aiMatchedRoleLabel}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">未分配角色</span>
                                )}
                                {member.isTeamLeader && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full whitespace-nowrap">
                                    <i className="ri-vip-crown-fill text-[10px]"></i>
                                    队长
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {teamCanEdit(team) && (
                              <button
                                type="button"
                                onClick={() => void handleSetTeamLeader(member.id, team.id)}
                                disabled={member.isTeamLeader}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer border ${
                                  member.isTeamLeader
                                    ? 'bg-amber-50 text-amber-400 border-amber-100 cursor-default'
                                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                <i className="ri-vip-crown-line mr-1"></i>
                                指定队长
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleRemoveFromTeam(member.id, team.id)}
                              disabled={!teamCanEdit(team)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap cursor-pointer border border-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <i className="ri-close-line mr-1"></i>
                              移出
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {teamCanEdit(team) && team.members.length < MAX_TEAM_SIZE && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                        <i className="ri-information-line"></i>
                        <span>拖拽左侧学生到此区域可添加成员（最多 {MAX_TEAM_SIZE} 人）</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 确认组队弹窗 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-7">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-double-line text-3xl text-white"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">确认组队</h3>
              <p className="text-sm text-gray-500">
                将当前所有草稿团队标记为已确认，学生组队状态同步为已确认。不会发送通知，请另行点击「通知学生」。
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">团队总数</span>
                <span className="font-bold text-gray-900">{teams.length} 个</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">草稿团队数</span>
                <span className="font-bold text-gray-900">
                  {teams.filter((t) => t.groupingStatus === 'draft').length} 个
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">待组队学生</span>
                <span className="font-bold text-amber-600">{pendingCount} 人</span>
              </div>
            </div>

            {pendingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 flex items-start gap-2">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span>还有 {pendingCount} 名学生未分组，确认后这些学生将保持待组队状态</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-5 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => void handleConfirmGrouping()}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer"
              >
                <i className="ri-check-double-line mr-2"></i>
                确认组队
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}