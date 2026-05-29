import { useCallback, useEffect, useState } from 'react';
import VersionControl, { Version } from '../../../components/feature/VersionControl';
import TeamFormationAssessmentPanel from './TeamFormationAssessmentPanel';
import UserAvatar from '../../../components/UserAvatar';
import { getPortalToken, parseJwtPayload } from '../../../lib/authApi';
import {
  fetchStudentMyTeam,
  fetchStudentTeamSquare,
  fetchTeamSubmission,
  isTeamFormationDone,
  TEAM_DIMENSION_BARS,
  normalizeTeamDimensionProfile,
  updateStudentMyTeamProfile,
  type GroupingTeam,
  type TeamDimensionProfile,
} from '../../../lib/teamFormationApi';

type TeamFormationModuleProps = {
  classId: string;
  className: string;
  initialSubTab?: 'assessment' | 'waiting' | 'myteam' | 'square';
  onTeamUpdated?: () => void;
};

function MemberTextAvatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md';
}) {
  const cls = size === 'sm' ? 'border-2 border-white' : 'flex-shrink-0';
  return <UserAvatar name={name} avatarUrl={avatarUrl} size={size === 'sm' ? 'sm' : 'md'} className={cls} />;
}

function apiTeamToMyTeam(t: GroupingTeam): MyTeam {
  const members = (t.members || []).map((m) => {
    const roleKey = String(m.aiMatchedRole || '').toLowerCase();
    const roleLabel = m.aiMatchedRoleLabel || m.aiMatchedRole || '成员';
    const isLeader = Boolean(m.isTeamLeader);
    return {
      id: m.id,
      name: m.name,
      studentId: m.studentId || '',
      role: isLeader ? '队长' : '',
      aiMatchedRole: roleLabel as AIMatchedRole,
      skills: [] as string[],
      profile: normalizeTeamDimensionProfile(m.profile) as unknown as AbilityProfile,
      avatarUrl: m.avatarUrl || '',
      major: '',
      grade: '',
      isLeader,
    };
  });
  return {
    id: t.id,
    name: t.name,
    introduction: t.introduction || '',
    createdAt: t.createdAt || '',
    status: 'active',
    members,
  };
}

type AbilityProfile = {
  techGeek: number;
  designAesthetic: number;
  businessOperator: number;
};

type AIMatchedRole = '团队负责人' | '运营负责人' | '技术负责人' | '财务负责人' | '市场负责人';

type TeamMember = {
  id: string;
  name: string;
  studentId?: string;
  role: string;
  aiMatchedRole: AIMatchedRole;
  skills: string[];
  profile: AbilityProfile;
  avatarUrl: string;
  major: string;
  grade: string;
  isLeader: boolean;
};

type MyTeam = {
  id: string;
  name: string;
  introduction: string;
  members: TeamMember[];
  createdAt: string;
  status: 'forming' | 'active';
};

// 扩展到10道题目
const profileQuestions = [
  {
    question: '你对编程和技术开发的兴趣程度？',
    category: 'techGeek',
    options: [
      { label: '非常感兴趣，经常自学编程', value: 100 },
      { label: '比较感兴趣，愿意学习', value: 75 },
      { label: '一般，可以尝试', value: 50 },
      { label: '不太感兴趣', value: 25 },
      { label: '完全不感兴趣', value: 0 },
    ],
  },
  {
    question: '你是否有技术项目经验？',
    category: 'techGeek',
    options: [
      { label: '有多个完整项目经验', value: 100 },
      { label: '有1-2个项目经验', value: 75 },
      { label: '参与过但未完成', value: 50 },
      { label: '只学过理论知识', value: 25 },
      { label: '没有任何经验', value: 0 },
    ],
  },
  {
    question: '你对UI/UX设计和视觉美学的敏感度？',
    category: 'designAesthetic',
    options: [
      { label: '非常敏感，有设计作品', value: 100 },
      { label: '比较敏感，关注设计趋势', value: 75 },
      { label: '一般，能分辨好坏', value: 50 },
      { label: '不太敏感', value: 25 },
      { label: '完全不关注', value: 0 },
    ],
  },
  {
    question: '你是否掌握设计工具？',
    category: 'designAesthetic',
    options: [
      { label: '精通多种设计工具', value: 100 },
      { label: '熟练使用1-2种工具', value: 75 },
      { label: '会基础操作', value: 50 },
      { label: '只了解不会用', value: 25 },
      { label: '完全不会', value: 0 },
    ],
  },
  {
    question: '你对商业模式和市场分析的理解程度？',
    category: 'businessOperator',
    options: [
      { label: '非常了解，有实战经验', value: 100 },
      { label: '比较了解，学过相关课程', value: 75 },
      { label: '一般了解', value: 50 },
      { label: '了解较少', value: 25 },
      { label: '完全不了解', value: 0 },
    ],
  },
  {
    question: '你的沟通协调和团队管理能力？',
    category: 'businessOperator',
    options: [
      { label: '非常强，有领导经验', value: 100 },
      { label: '比较强，善于沟通', value: 75 },
      { label: '一般水平', value: 50 },
      { label: '较弱', value: 25 },
      { label: '很弱', value: 0 },
    ],
  },
  {
    question: '你在团队中更倾向于承担什么角色？',
    category: 'businessOperator',
    options: [
      { label: '领导者，制定方向和决策', value: 100 },
      { label: '协调者，沟通和组织', value: 75 },
      { label: '执行者，完成具体任务', value: 50 },
      { label: '支持者，辅助他人工作', value: 25 },
      { label: '不确定', value: 0 },
    ],
  },
  {
    question: '你对数据分析和逻辑思维的能力？',
    category: 'techGeek',
    options: [
      { label: '非常强，擅长数据分析', value: 100 },
      { label: '比较强，能理解数据', value: 75 },
      { label: '一般水平', value: 50 },
      { label: '较弱', value: 25 },
      { label: '很弱', value: 0 },
    ],
  },
  {
    question: '你对创意和创新的敏感度？',
    category: 'designAesthetic',
    options: [
      { label: '非常敏感，经常有新想法', value: 100 },
      { label: '比较敏感，能提出创意', value: 75 },
      { label: '一般水平', value: 50 },
      { label: '较弱', value: 25 },
      { label: '很弱', value: 0 },
    ],
  },
  {
    question: '你对市场营销和用户需求的理解？',
    category: 'businessOperator',
    options: [
      { label: '非常了解，有实践经验', value: 100 },
      { label: '比较了解，关注市场动态', value: 75 },
      { label: '一般了解', value: 50 },
      { label: '了解较少', value: 25 },
      { label: '完全不了解', value: 0 },
    ],
  },
];

// 模拟已匹配的团队数据
const mockMatchedTeams: MyTeam[] = [
  {
    id: 'team-001',
    name: '智慧校园先锋队',
    introduction: '致力于打造AI驱动的个性化学习平台，解决高校学生学习效率低下的痛点',
    members: [
      {
        id: 'm1',
        name: '张明',
        role: '队长',
        aiMatchedRole: '团队负责人',
        skills: ['项目管理', '商业分析'],
        profile: { techGeek: 60, designAesthetic: 45, businessOperator: 92 },
        avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20confident%20leadership%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20business%20atmosphere&width=200&height=200&seq=sc-matched-m1&orientation=squarish',
        major: '工商管理',
        grade: '大三',
        isLeader: true,
      },
      {
        id: 'm2',
        name: '李雯',
        role: '技术开发',
        aiMatchedRole: '技术负责人',
        skills: ['前端开发', 'Python'],
        profile: { techGeek: 88, designAesthetic: 55, businessOperator: 40 },
        avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20focused%20technical%20expression%20in%20modern%20tech%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m2&orientation=squarish',
        major: '计算机科学',
        grade: '大二',
        isLeader: false,
      },
      {
        id: 'm3',
        name: '王浩',
        role: 'UI设计师',
        aiMatchedRole: '运营负责人',
        skills: ['UI设计', 'Figma'],
        profile: { techGeek: 35, designAesthetic: 90, businessOperator: 50 },
        avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20creative%20artistic%20expression%20in%20modern%20design%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m3&orientation=squarish',
        major: '视觉传达',
        grade: '大三',
        isLeader: false,
      },
      {
        id: 'm4',
        name: '陈晓',
        role: '市场运营',
        aiMatchedRole: '市场负责人',
        skills: ['市场调研', '内容运营'],
        profile: { techGeek: 30, designAesthetic: 60, businessOperator: 85 },
        avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20friendly%20marketing%20smile%20in%20modern%20business%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m4&orientation=squarish',
        major: '市场营销',
        grade: '大二',
        isLeader: false,
      },
    ],
    createdAt: '2024-03-15',
    status: 'active',
  },
  {
    id: 'team-002',
    name: '绿色出行创客组',
    introduction: '针对现有共享单车运营痛点，设计更智能的调度算法和用户激励体系',
    members: [
      {
        id: 'm5',
        name: '刘洋',
        role: '队长',
        aiMatchedRole: '团队负责人',
        skills: ['战略规划', '团队管理'],
        profile: { techGeek: 50, designAesthetic: 40, businessOperator: 88 },
        avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20strategic%20leadership%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m5&orientation=squarish',
        major: '工商管理',
        grade: '大三',
        isLeader: true,
      },
      {
        id: 'm6',
        name: '赵敏',
        role: '后端开发',
        aiMatchedRole: '技术负责人',
        skills: ['Java', '数据库'],
        profile: { techGeek: 92, designAesthetic: 35, businessOperator: 45 },
        avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20technical%20expertise%20expression%20in%20modern%20tech%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m6&orientation=squarish',
        major: '软件工程',
        grade: '大二',
        isLeader: false,
      },
      {
        id: 'm7',
        name: '孙强',
        role: '数据分析',
        aiMatchedRole: '财务负责人',
        skills: ['数据分析', 'Excel'],
        profile: { techGeek: 70, designAesthetic: 30, businessOperator: 65 },
        avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20analytical%20focused%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m7&orientation=squarish',
        major: '数据科学',
        grade: '大三',
        isLeader: false,
      },
    ],
    createdAt: '2024-03-16',
    status: 'active',
  },
];

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-5 py-3 rounded-xl shadow-lg z-[9999] flex items-center gap-2 text-sm font-medium`;
  div.innerHTML = `<i class="${type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}"></i><span>${message}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

export default function TeamFormationModule({ classId, className, initialSubTab, onTeamUpdated }: TeamFormationModuleProps) {
  const [activeTab, setActiveTab] = useState<'assessment' | 'waiting' | 'myteam' | 'square'>(
    initialSubTab || 'assessment'
  );
  
  // 测评相关
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [abilityProfile, setAbilityProfile] = useState<AbilityProfile>({ techGeek: 0, designAesthetic: 0, businessOperator: 0 });
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  
  // 视频上传相关
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploaded, setVideoUploaded] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiMatchedRole, setAiMatchedRole] = useState<AIMatchedRole | null>(null);
  
  // 等待组队
  const [waitingForTeam, setWaitingForTeam] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [waitingRoleLabel, setWaitingRoleLabel] = useState<string | null>(null);
  const [waitingDimensionProfile, setWaitingDimensionProfile] = useState<TeamDimensionProfile>({
    strategic: 0,
    market: 0,
    techRisk: 0,
  });

  const loadWaitingSummary = useCallback(async () => {
    try {
      const sub = await fetchTeamSubmission(classId);
      setSubmissionStatus(sub.status || null);
      if (sub.status && sub.status !== 'draft') setAssessmentCompleted(true);
      if (sub.aiMatchedRole || isTeamFormationDone(sub.status)) {
        setWaitingRoleLabel(sub.aiMatchedRoleLabel || sub.aiMatchedRole);
        setWaitingDimensionProfile(normalizeTeamDimensionProfile(sub.dimensionProfile || {}));
      }
      setWaitingForTeam(sub.status === 'pending_teacher');
    } catch {
      /* ignore */
    }
  }, [classId]);

  useEffect(() => {
    void loadWaitingSummary();
  }, [loadWaitingSummary]);

  useEffect(() => {
    if (initialSubTab) setActiveTab(initialSubTab);
  }, [initialSubTab]);

  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [currentStudentId, setCurrentStudentId] = useState('');

  useEffect(() => {
    const token = getPortalToken('student');
    const sub = token ? parseJwtPayload(token)?.sub : null;
    if (sub) setCurrentStudentId(String(sub));
  }, []);

  const isCurrentUserLeader = Boolean(
    myTeam?.members.some((m) => m.id === currentStudentId && m.isLeader)
  );
  const [editingTeamInfo, setEditingTeamInfo] = useState(false);
  const [savingTeamInfo, setSavingTeamInfo] = useState(false);
  const [teamInfoForm, setTeamInfoForm] = useState({ name: '', introduction: '' });
  const [editingMemberRole, setEditingMemberRole] = useState<string | null>(null);
  const [memberRoleInput, setMemberRoleInput] = useState('');
  const [matchedTeams, setMatchedTeams] = useState<MyTeam[]>([]);

  const loadTeamsFromApi = useCallback(async () => {
    try {
      const [mine, square, sub] = await Promise.all([
        fetchStudentMyTeam(classId),
        fetchStudentTeamSquare(classId),
        fetchTeamSubmission(classId).catch(() => null),
      ]);
      setMyTeam(mine ? apiTeamToMyTeam(mine as GroupingTeam) : null);
      setMatchedTeams(Array.isArray(square) ? (square as GroupingTeam[]).map(apiTeamToMyTeam) : []);
      if (sub?.status) {
        setSubmissionStatus(sub.status);
        setWaitingForTeam(sub.status === 'pending_teacher');
        if (sub.status !== 'draft') setAssessmentCompleted(true);
      }
    } catch {
      setMyTeam(null);
      setMatchedTeams([]);
    }
  }, [classId]);

  useEffect(() => {
    void loadTeamsFromApi();
  }, [loadTeamsFromApi]);

  useEffect(() => {
    if (myTeam && (activeTab === 'assessment' || activeTab === 'waiting')) {
      setActiveTab('myteam');
    }
  }, [myTeam, activeTab]);

  const handleTabClick = (key: 'assessment' | 'waiting' | 'myteam' | 'square') => {
    if (myTeam && (key === 'assessment' || key === 'waiting')) {
      setActiveTab('myteam');
      return;
    }
    setActiveTab(key);
  };

  const showWaitingBadge = submissionStatus === 'pending_teacher' && !myTeam;

  // 版本控制
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);

  const handleSaveVersion = (summary: string) => {
    const newVersion: Version = {
      id: `version-${Date.now()}`,
      versionNumber: versions.length + 1,
      timestamp: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
      summary,
      data: {
        abilityProfile,
        assessmentCompleted,
        videoUploaded,
        aiMatchedRole,
        waitingForTeam,
        myTeam,
        answers,
        currentQuestion,
      },
    };
    setVersions([...versions, newVersion]);
    setCurrentVersion(newVersion.versionNumber);
    showToast('版本已保存');
  };

  const handleRestore = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    
    const data = version.data;
    setAbilityProfile(data.abilityProfile || { techGeek: 0, designAesthetic: 0, businessOperator: 0 });
    setAssessmentCompleted(data.assessmentCompleted || false);
    setVideoUploaded(data.videoUploaded || false);
    setAiMatchedRole(data.aiMatchedRole || null);
    setWaitingForTeam(data.waitingForTeam || false);
    setMyTeam(data.myTeam || null);
    setAnswers(data.answers || []);
    setCurrentQuestion(data.currentQuestion || 0);
    setCurrentVersion(version.versionNumber);
    showToast(`已回撤到版本 v${version.versionNumber}`);
  };

  // 答题
  const handleAnswerSelect = (value: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);
    
    if (currentQuestion < profileQuestions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      // 计算能力画像
      const techGeekScores = [newAnswers[0], newAnswers[1], newAnswers[7]];
      const designScores = [newAnswers[2], newAnswers[3], newAnswers[8]];
      const businessScores = [newAnswers[4], newAnswers[5], newAnswers[6], newAnswers[9]];
      
      const profile: AbilityProfile = {
        techGeek: techGeekScores.reduce((a, b) => a + b, 0) / techGeekScores.length,
        designAesthetic: designScores.reduce((a, b) => a + b, 0) / designScores.length,
        businessOperator: businessScores.reduce((a, b) => a + b, 0) / businessScores.length,
      };
      
      setAbilityProfile(profile);
      setAssessmentCompleted(true);
      showToast('测评完成！请上传自我介绍视频');
    }
  };

  // 视频上传
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
    }
  };

  const handleSubmitVideo = () => {
    if (!videoFile) {
      showToast('请先选择视频文件', 'error');
      return;
    }
    
    setAiAnalyzing(true);
    
    // 模拟AI分析过程
    setTimeout(() => {
      // 根据能力画像匹配角色
      const { techGeek, designAesthetic, businessOperator } = abilityProfile;
      let matchedRole: AIMatchedRole;
      
      if (businessOperator >= techGeek && businessOperator >= designAesthetic) {
        if (businessOperator >= 70) {
          matchedRole = '团队负责人';
        } else {
          matchedRole = '运营负责人';
        }
      } else if (techGeek >= designAesthetic) {
        matchedRole = '技术负责人';
      } else {
        matchedRole = '市场负责人';
      }
      
      setAiMatchedRole(matchedRole);
      setVideoUploaded(true);
      setAiAnalyzing(false);
      showToast('AI分析完成！已为你匹配适合的角色');
    }, 3000);
  };

  // 提交等待组队
  const handleSubmitForTeamMatching = () => {
    setWaitingForTeam(true);
    setActiveTab('waiting');
    showToast('已提交！等待教师进行智能组队');
  };

  // 模拟教师组队完成
  const handleSimulateTeamFormed = () => {
    const newTeam: MyTeam = {
      id: `team-${Date.now()}`,
      name: '',
      introduction: '',
      members: [
        {
          id: 'me',
          name: '我',
          role: '',
          aiMatchedRole: aiMatchedRole!,
          skills: ['待完善'],
          profile: abilityProfile,
          avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20university%20student%20portrait%20with%20confident%20friendly%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-me-avatar&orientation=squarish',
          major: '计算机科学',
          grade: '大二',
          isLeader: false,
        },
        {
          id: 'm2',
          name: '队友A',
          role: '',
          aiMatchedRole: '技术负责人',
          skills: ['前端开发'],
          profile: { techGeek: 85, designAesthetic: 50, businessOperator: 40 },
          avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20university%20student%20portrait%20with%20technical%20focused%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-teammate-a&orientation=squarish',
          major: '软件工程',
          grade: '大三',
          isLeader: false,
        },
        {
          id: 'm3',
          name: '队友B',
          role: '',
          aiMatchedRole: '市场负责人',
          skills: ['市场调研'],
          profile: { techGeek: 35, designAesthetic: 60, businessOperator: 80 },
          avatarUrl: 'https://readdy.ai/api/search-image?query=professional%20asian%20university%20student%20portrait%20with%20marketing%20friendly%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-teammate-b&orientation=squarish',
          major: '市场营销',
          grade: '大二',
          isLeader: false,
        },
      ],
      createdAt: new Date().toISOString().split('T')[0],
      status: 'forming',
    };
    
    setMyTeam(newTeam);
    setWaitingForTeam(false);
    setActiveTab('myteam');
    showToast('组队完成！请设置队长并完善团队信息');
  };

  // 设置/取消队长
  const handleToggleLeader = (memberId: string) => {
    if (!myTeam) return;
    
    const updatedMembers = myTeam.members.map(m => ({
      ...m,
      isLeader: m.id === memberId ? !m.isLeader : false,
      role: m.id === memberId && !m.isLeader ? '队长' : m.role === '队长' ? '' : m.role,
    }));
    
    setMyTeam({ ...myTeam, members: updatedMembers });
    
    const member = myTeam.members.find(m => m.id === memberId);
    if (member?.isLeader) {
      showToast(`已取消 ${member.name} 的队长设置`);
    } else {
      showToast(`已设置 ${member?.name} 为队长`);
    }
  };

  const handleSaveTeamInfo = async () => {
    if (!teamInfoForm.name.trim()) {
      showToast('请填写团队名称', 'error');
      return;
    }
    if (!myTeam || !isCurrentUserLeader) {
      showToast('仅队长可修改团队信息', 'error');
      return;
    }
    setSavingTeamInfo(true);
    try {
      const updated = await updateStudentMyTeamProfile(classId, {
        name: teamInfoForm.name.trim(),
        introduction: teamInfoForm.introduction.trim(),
      });
      if (updated) setMyTeam(apiTeamToMyTeam(updated));
      else
        setMyTeam({
          ...myTeam,
          name: teamInfoForm.name.trim(),
          introduction: teamInfoForm.introduction.trim(),
        });
      setEditingTeamInfo(false);
      onTeamUpdated?.();
      showToast('团队信息已保存');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败', 'error');
    } finally {
      setSavingTeamInfo(false);
    }
  };

  // 编辑成员角色
  const handleSaveMemberRole = (memberId: string) => {
    if (!myTeam || !memberRoleInput.trim()) {
      showToast('请输入角色名称', 'error');
      return;
    }
    
    const updatedMembers = myTeam.members.map(m =>
      m.id === memberId ? { ...m, role: memberRoleInput } : m
    );
    
    setMyTeam({ ...myTeam, members: updatedMembers });
    setEditingMemberRole(null);
    setMemberRoleInput('');
    showToast('角色已更新');
  };

  const tabs = [
    { key: 'assessment' as const, label: '能力测评', icon: 'ri-file-list-3-line', badge: assessmentCompleted ? '✓' : null },
    { key: 'waiting' as const, label: '等待组队', icon: 'ri-time-line', badge: showWaitingBadge ? '进行中' : null },
    { key: 'myteam' as const, label: '我的团队', icon: 'ri-team-line', badge: myTeam ? '✓' : null },
    { key: 'square' as const, label: '团队广场', icon: 'ri-community-line', badge: null },
  ];

  return (
    <div className="space-y-5">
      {/* 版本控制工具栏 */}
      <VersionControl
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="智能组队系统"
      />

      {/* 模块头部 */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <i className="ri-group-line text-2xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">智能组队系统</h2>
            <p className="text-white/80 text-sm">完成测评 → 上传视频 → AI分析 → 等待组队 → 完善团队信息</p>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100">
          {tabs.map(tab => (
            <button key={tab.key} type="button" onClick={() => handleTabClick(tab.key)}
              className={`flex-1 px-4 py-3.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === tab.key ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/30' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}>
              <i className={tab.icon}></i>
              {tab.label}
              {tab.badge && (
                <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full whitespace-nowrap ${tab.badge === '✓' ? 'bg-green-100 text-green-600' : tab.badge === '进行中' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── 能力测评 ── */}
          {activeTab === 'assessment' && (
            <TeamFormationAssessmentPanel
              classId={classId}
              onSubmitted={() => {
                setActiveTab('waiting');
                setWaitingForTeam(true);
                void loadWaitingSummary();
                void loadTeamsFromApi();
              }}
            />
          )}

          {/* ── 等待组队 ── */}
          {activeTab === 'waiting' && (
            <div className="space-y-5">
              {waitingForTeam ? (
                <>
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse">
                      <i className="ri-time-line text-4xl text-white"></i>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">等待教师进行智能组队</h3>
                    <p className="text-sm text-gray-500 mb-6">所有同学完成测评后，教师将根据能力互补原则进行智能组队</p>
                    
                    <div className="max-w-md mx-auto bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <i className="ri-user-star-line text-lg text-white"></i>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900">你的 AI 匹配角色</p>
                          <p className="text-xs text-gray-600">{waitingRoleLabel || aiMatchedRole || '—'}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {TEAM_DIMENSION_BARS.map((item) => (
                          <div key={item.key} className="bg-white rounded-lg p-2.5">
                            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                            <p className="text-sm font-bold text-gray-900 mb-1.5">{waitingDimensionProfile[item.key]}</p>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                                style={{ width: `${Math.min(100, waitingDimensionProfile[item.key])}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="ri-time-line text-3xl text-gray-400"></i>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">暂未提交组队申请</h3>
                  <p className="text-sm text-gray-500 mb-5">请先完成能力测评和视频上传</p>
                  <button 
                    onClick={() => setActiveTab('assessment')}
                    className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                    <i className="ri-arrow-left-line mr-2"></i>
                    返回测评
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── 我的团队 ── */}
          {activeTab === 'myteam' && (
            <div className="space-y-4">
              {!myTeam ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="ri-team-line text-3xl text-gray-400"></i>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">还未分配到团队</h3>
                  <p className="text-sm text-gray-500 mb-5">请先完成测评并等待教师组队</p>
                  <button 
                    onClick={() => setActiveTab('assessment')}
                    className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                    <i className="ri-arrow-left-line mr-2"></i>
                    前往测评
                  </button>
                </div>
              ) : (
                <>
                  {/* 团队状态提示 */}
                  {myTeam.status === 'forming' && (
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <i className="ri-error-warning-line text-orange-500 text-xl mt-0.5"></i>
                        <div>
                          <p className="text-sm font-bold text-orange-900 mb-1">团队信息待完善</p>
                          <p className="text-xs text-orange-700">请设置队长并完善团队名称和介绍，完成后即可开始协作</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 团队信息卡 */}
                  <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl p-5 text-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h2 className="text-base font-bold mb-1">{myTeam.name || '待设置团队名称'}</h2>
                        <p className="text-white/80 text-xs">{myTeam.introduction || '待完善团队介绍'}</p>
                        {myTeam.createdAt ? (
                          <p className="text-white/60 text-[10px] mt-1">创建于 {myTeam.createdAt}</p>
                        ) : null}
                      </div>
                      {isCurrentUserLeader && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeamInfo(true);
                            setTeamInfoForm({ name: myTeam.name, introduction: myTeam.introduction });
                          }}
                          className="px-3 py-1.5 bg-white/20 border border-white/30 text-white text-xs font-medium rounded-lg hover:bg-white/30 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-edit-line mr-1"></i>
                          编辑
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/70">成员 {myTeam.members.length} 人</span>
                    </div>
                  </div>

                  {/* 编辑团队信息弹窗 */}
                  {editingTeamInfo && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-lg font-bold text-gray-900">完善团队信息</h3>
                          <button onClick={() => setEditingTeamInfo(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">
                            <i className="ri-close-line text-xl"></i>
                          </button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">团队名称 *</label>
                            <input 
                              type="text" 
                              value={teamInfoForm.name} 
                              onChange={e => setTeamInfoForm({ ...teamInfoForm, name: e.target.value })} 
                              placeholder="例如：创新科技团队" 
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm" 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">团队介绍</label>
                            <textarea 
                              value={teamInfoForm.introduction} 
                              onChange={e => setTeamInfoForm({ ...teamInfoForm, introduction: e.target.value })} 
                              placeholder="介绍你们的团队愿景和目标..." 
                              rows={3} 
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm resize-none" 
                              maxLength={200}
                            />
                          </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                          <button onClick={() => setEditingTeamInfo(false)} className="flex-1 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">取消</button>
                          <button
                            type="button"
                            disabled={savingTeamInfo}
                            onClick={() => void handleSaveTeamInfo()}
                            className="flex-1 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-60"
                          >
                            <i className="ri-check-line mr-1.5"></i>
                            {savingTeamInfo ? '保存中…' : '保存'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 团队成员 */}
                  <div className="bg-white border-2 border-gray-100 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <i className="ri-group-line text-teal-600"></i>
                      团队成员
                      <span className="text-xs font-normal text-gray-400">共 {myTeam.members.length} 人</span>
                    </h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3">
                      {myTeam.members.map((member) => (
                        <div
                          key={member.id}
                          className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col items-center text-center hover:border-teal-200 hover:bg-teal-50/40 transition-colors"
                        >
                          <MemberTextAvatar name={member.name} avatarUrl={member.avatarUrl} />
                          <div className="mt-2 flex flex-wrap items-center justify-center gap-1 w-full">
                            <span className="text-sm font-bold text-gray-900 truncate max-w-full">{member.name}</span>
                            {member.isLeader && (
                              <span className="px-1 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full whitespace-nowrap inline-flex items-center gap-0.5">
                                <i className="ri-vip-crown-fill"></i>
                                队长
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-[11px] text-gray-500 w-full truncate">
                            {member.studentId || '—'}
                          </p>
                          <p className="text-[11px] text-teal-700 font-medium w-full truncate leading-snug">
                            {member.aiMatchedRole}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 协作空间 */}
                  {/* {myTeam.status === 'active' && (
                    <div className="bg-white border-2 border-gray-100 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <i className="ri-apps-line text-teal-600"></i>团队协作空间
                      </h3>
                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { icon: 'ri-folder-line', label: '文档库', color: 'from-teal-500 to-cyan-500' },
                          { icon: 'ri-chat-3-line', label: '讨论区', color: 'from-orange-400 to-amber-400' },
                          { icon: 'ri-task-line', label: '任务看板', color: 'from-green-500 to-emerald-500' },
                        ].map(item => (
                          <button key={item.label} className="p-3 bg-gray-50 border border-gray-100 rounded-xl hover:shadow-sm hover:border-teal-200 transition-all text-left cursor-pointer">
                            <div className={`w-9 h-9 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-2`}>
                              <i className={`${item.icon} text-base text-white`}></i>
                            </div>
                            <p className="text-xs font-bold text-gray-900">{item.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )} */}
                </>
              )}
            </div>
          )}

          {/* ── 团队广场 ── */}
          {activeTab === 'square' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">共 <span className="font-bold text-gray-900">{matchedTeams.length}</span> 支已匹配团队</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {matchedTeams.map(team => (
                  <div key={team.id} className={`border-2 rounded-xl p-4 transition-all ${myTeam?.id === team.id ? 'border-teal-300 bg-teal-50/30' : 'border-gray-100 hover:border-teal-200 hover:shadow-sm bg-white'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-gray-900">{team.name}</h3>
                          {myTeam?.id === team.id && (
                            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">我的团队</span>
                          )}
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">
                            已激活
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{team.introduction}</p>
                      </div>
                      <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">{team.members.length}人</span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      {team.members.slice(0, 4).map(member => (
                        <div key={member.id} className="relative group">
                          <MemberTextAvatar name={member.name} avatarUrl={member.avatarUrl} size="sm" />
                          {member.isLeader && (
                            <i className="ri-vip-crown-fill absolute -top-1 -right-1 text-xs text-amber-500 bg-white rounded-full"></i>
                          )}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {member.name} · {member.aiMatchedRole}
                          </div>
                        </div>
                      ))}
                      {team.members.length > 4 && (
                        <span className="text-xs text-gray-400">+{team.members.length - 4}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">
                        {team.createdAt ? `创建于 ${team.createdAt}` : '创建时间待定'}
                      </span>
                      {myTeam?.id === team.id && (
                        <button 
                          onClick={() => setActiveTab('myteam')}
                          className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-medium rounded-lg hover:shadow-md transition-all whitespace-nowrap cursor-pointer">
                          <i className="ri-arrow-right-line mr-1"></i>进入团队
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
