import { useState } from 'react';
import VersionControl, { Version } from '../../../components/feature/VersionControl';

type AbilityProfile = {
  techGeek: number;
  designAesthetic: number;
  businessOperator: number;
};

type AIMatchedRole = '团队负责人' | '运营负责人' | '技术负责人' | '财务负责人' | '市场负责人';

type TeamMember = {
  id: string;
  name: string;
  role: string;
  aiMatchedRole: AIMatchedRole;
  skills: string[];
  profile: AbilityProfile;
  avatar: string;
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
        avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20confident%20leadership%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20business%20atmosphere&width=200&height=200&seq=sc-matched-m1&orientation=squarish',
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
        avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20focused%20technical%20expression%20in%20modern%20tech%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m2&orientation=squarish',
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
        avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20creative%20artistic%20expression%20in%20modern%20design%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m3&orientation=squarish',
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
        avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20friendly%20marketing%20smile%20in%20modern%20business%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m4&orientation=squarish',
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
        avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20strategic%20leadership%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m5&orientation=squarish',
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
        avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20technical%20expertise%20expression%20in%20modern%20tech%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m6&orientation=squarish',
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
        avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20analytical%20focused%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-matched-m7&orientation=squarish',
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

export default function TeamFormationModule() {
  const [activeTab, setActiveTab] = useState<'assessment' | 'waiting' | 'myteam' | 'square'>('assessment');
  
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
  
  // 我的团队
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [editingTeamInfo, setEditingTeamInfo] = useState(false);
  const [teamInfoForm, setTeamInfoForm] = useState({ name: '', introduction: '' });
  const [editingMemberRole, setEditingMemberRole] = useState<string | null>(null);
  const [memberRoleInput, setMemberRoleInput] = useState('');
  
  // 匹配团队广场
  const [matchedTeams] = useState<MyTeam[]>(mockMatchedTeams);

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
          avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20university%20student%20portrait%20with%20confident%20friendly%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-me-avatar&orientation=squarish',
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
          avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20university%20student%20portrait%20with%20technical%20focused%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-teammate-a&orientation=squarish',
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
          avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20university%20student%20portrait%20with%20marketing%20friendly%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=sc-teammate-b&orientation=squarish',
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

  // 保存团队信息
  const handleSaveTeamInfo = () => {
    if (!teamInfoForm.name || !teamInfoForm.introduction) {
      showToast('请填写完整的团队信息', 'error');
      return;
    }
    
    if (!myTeam) return;
    
    const hasLeader = myTeam.members.some(m => m.isLeader);
    if (!hasLeader) {
      showToast('请先设置队长', 'error');
      return;
    }
    
    setMyTeam({
      ...myTeam,
      name: teamInfoForm.name,
      introduction: teamInfoForm.introduction,
      status: 'active',
    });
    
    setEditingTeamInfo(false);
    showToast('团队信息已保存');
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
    { key: 'waiting' as const, label: '等待组队', icon: 'ri-time-line', badge: waitingForTeam ? '进行中' : null },
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
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
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
            <div className="space-y-5">
              {!assessmentCompleted ? (
                <>
                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <i className="ri-file-list-3-line text-lg text-white"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">能力画像测评（10题）</h3>
                        <p className="text-xs text-gray-600">通过10道问题，精准识别你的"技术极客"、"设计美学"、"商业操盘"三类特质</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300" style={{ width: `${(currentQuestion / profileQuestions.length) * 100}%` }}></div>
                      </div>
                      <span className="text-xs font-medium text-gray-600 whitespace-nowrap">{currentQuestion}/{profileQuestions.length}</span>
                    </div>
                  </div>
                  <div className="bg-white border-2 border-gray-100 rounded-xl p-5">
                    <span className="inline-block px-2.5 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full mb-4 whitespace-nowrap">问题 {currentQuestion + 1}/{profileQuestions.length}</span>
                    <h3 className="text-base font-bold text-gray-900 mb-5">{profileQuestions[currentQuestion].question}</h3>
                    <div className="space-y-2.5">
                      {profileQuestions[currentQuestion].options.map((option, index) => (
                        <button key={index} onClick={() => handleAnswerSelect(option.value)}
                          className={`w-full p-3.5 text-left border-2 rounded-xl transition-all cursor-pointer ${answers[currentQuestion] === option.value ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${answers[currentQuestion] === option.value ? 'border-teal-500 bg-teal-500' : 'border-gray-300'}`}>
                              {answers[currentQuestion] === option.value && <i className="ri-check-line text-white text-xs"></i>}
                            </div>
                            <span className="text-sm text-gray-800">{option.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : !videoUploaded ? (
                <>
                  <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="ri-checkbox-circle-fill text-xl"></i>
                      <h3 className="text-base font-bold">测评完成！</h3>
                    </div>
                    <p className="text-white/80 text-xs">已生成能力画像，请上传自我介绍视频进行AI分析</p>
                  </div>
                  
                  {/* 能力雷达图 */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '技术极客', icon: 'ri-code-s-slash-line', color: 'from-teal-500 to-cyan-500', value: abilityProfile.techGeek },
                      { label: '设计美学', icon: 'ri-palette-line', color: 'from-orange-400 to-amber-400', value: abilityProfile.designAesthetic },
                      { label: '商业操盘', icon: 'ri-line-chart-line', color: 'from-green-500 to-emerald-500', value: abilityProfile.businessOperator },
                    ].map(item => (
                      <div key={item.label} className="bg-white border-2 border-gray-100 rounded-xl p-4">
                        <div className={`w-9 h-9 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-3`}>
                          <i className={`${item.icon} text-base text-white`}></i>
                        </div>
                        <p className="text-xs font-bold text-gray-900 mb-2">{item.label}</p>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-gray-400">指数</span>
                          <span className="font-bold text-gray-900">{Math.round(item.value)}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 视频上传 */}
                  <div className="bg-white border-2 border-gray-100 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <i className="ri-video-line text-teal-600"></i>
                      上传自我介绍视频
                    </h3>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-xl p-6 text-center mb-4">
                      <i className="ri-upload-cloud-line text-4xl text-blue-500 mb-3 block"></i>
                      <p className="text-sm font-medium text-gray-900 mb-2">点击选择或拖拽视频文件</p>
                      <p className="text-xs text-gray-500 mb-4">支持 MP4、MOV 格式，建议时长 1-3 分钟</p>
                      <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" id="video-upload" />
                      <label htmlFor="video-upload" className="inline-block px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all cursor-pointer whitespace-nowrap">
                        <i className="ri-folder-open-line mr-1.5"></i>选择视频
                      </label>
                    </div>
                    
                    {videoFile && (
                      <div className="bg-gray-50 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-3">
                          <i className="ri-file-video-line text-2xl text-blue-500"></i>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{videoFile.name}</p>
                            <p className="text-xs text-gray-500">{(videoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <button onClick={() => setVideoFile(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                            <i className="ri-close-line"></i>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 flex items-start gap-2">
                      <i className="ri-information-line mt-0.5"></i>
                      <div>
                        <p className="font-bold mb-1">视频内容建议：</p>
                        <ul className="space-y-0.5 list-disc list-inside">
                          <li>简单介绍自己的专业、兴趣和特长</li>
                          <li>分享你在团队中擅长的角色和贡献</li>
                          <li>表达你对创新创业的热情和期待</li>
                        </ul>
                      </div>
                    </div>

                    <button 
                      onClick={handleSubmitVideo}
                      disabled={!videoFile || aiAnalyzing}
                      className={`w-full px-5 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                        !videoFile || aiAnalyzing 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:shadow-lg'
                      }`}>
                      {aiAnalyzing ? (
                        <>
                          <i className="ri-loader-4-line mr-2 animate-spin"></i>
                          AI正在分析视频内容...
                        </>
                      ) : (
                        <>
                          <i className="ri-send-plane-line mr-2"></i>
                          提交视频并开始AI分析
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="ri-checkbox-circle-fill text-xl"></i>
                      <h3 className="text-base font-bold">AI分析完成！</h3>
                    </div>
                    <p className="text-white/80 text-xs">已为你匹配最适合的团队角色</p>
                  </div>

                  {/* AI匹配角色 */}
                  <div className="bg-white border-2 border-green-200 rounded-xl p-5">
                    <div className="text-center mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <i className="ri-user-star-line text-3xl text-white"></i>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">AI为你匹配的角色</h3>
                      <div className="inline-block px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-base font-bold rounded-xl">
                        {aiMatchedRole}
                      </div>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                      <p className="text-xs font-bold text-green-900 mb-2">角色分析：</p>
                      <p className="text-xs text-green-800">
                        {aiMatchedRole === '团队负责人' && '你的商业操盘能力和领导力突出，适合统筹团队整体方向和决策'}
                        {aiMatchedRole === '技术负责人' && '你的技术能力和逻辑思维优秀，适合负责技术开发和架构设计'}
                        {aiMatchedRole === '运营负责人' && '你的协调能力和执行力强，适合负责团队运营和日常管理'}
                        {aiMatchedRole === '财务负责人' && '你的数据分析和财务规划能力强，适合负责财务管理和成本控制'}
                        {aiMatchedRole === '市场负责人' && '你的市场洞察和营销能力突出，适合负责市场推广和用户运营'}
                      </p>
                    </div>

                    <button 
                      onClick={handleSubmitForTeamMatching}
                      className="w-full px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                      <i className="ri-send-plane-line mr-2"></i>
                      提交并等待教师组队
                    </button>
                  </div>
                </>
              )}
            </div>
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
                          <p className="text-sm font-bold text-gray-900">你的AI匹配角色</p>
                          <p className="text-xs text-gray-600">{aiMatchedRole}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '技术', value: abilityProfile.techGeek, color: 'from-teal-500 to-cyan-500' },
                          { label: '设计', value: abilityProfile.designAesthetic, color: 'from-orange-400 to-amber-400' },
                          { label: '商业', value: abilityProfile.businessOperator, color: 'from-green-500 to-emerald-500' },
                        ].map(item => (
                          <div key={item.label} className="bg-white rounded-lg p-2.5">
                            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                            <p className="text-sm font-bold text-gray-900 mb-1.5">{Math.round(item.value)}</p>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 模拟按钮（实际使用时删除） */}
                    <button 
                      onClick={handleSimulateTeamFormed}
                      className="mt-6 px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                      <i className="ri-flask-line mr-2"></i>
                      模拟教师组队完成（测试用）
                    </button>
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
                      </div>
                      {myTeam.status === 'forming' && (
                        <button 
                          onClick={() => {
                            setEditingTeamInfo(true);
                            setTeamInfoForm({ name: myTeam.name, introduction: myTeam.introduction });
                          }}
                          className="px-3 py-1.5 bg-white/20 border border-white/30 text-white text-xs font-medium rounded-lg hover:bg-white/30 transition-colors whitespace-nowrap cursor-pointer">
                          <i className="ri-edit-line mr-1"></i>编辑
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border border-white/30 whitespace-nowrap ${myTeam.status === 'active' ? 'bg-green-500/20 text-white' : 'bg-orange-500/20 text-white'}`}>
                        {myTeam.status === 'active' ? '已激活' : '待完善'}
                      </span>
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
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">团队介绍 *</label>
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
                          <button onClick={handleSaveTeamInfo} className="flex-1 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                            <i className="ri-check-line mr-1.5"></i>保存
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
                      {myTeam.status === 'forming' && <span className="text-xs text-orange-600">（请设置队长）</span>}
                    </h3>
                    <div className="space-y-2">
                      {myTeam.members.map(member => (
                        <div key={member.id} className="bg-gray-50 rounded-xl p-3 hover:bg-teal-50/50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                              <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-sm font-bold text-gray-900">{member.name}</span>
                                  {member.isLeader && (
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full whitespace-nowrap flex items-center gap-0.5">
                                      <i className="ri-vip-crown-fill text-xs"></i>队长
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">{member.major} · {member.grade}</p>
                              </div>
                            </div>
                            {myTeam.status === 'forming' && (
                              <button 
                                onClick={() => handleToggleLeader(member.id)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                                  member.isLeader 
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}>
                                {member.isLeader ? '取消队长' : '设为队长'}
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full whitespace-nowrap">
                                {member.aiMatchedRole}
                              </span>
                              {editingMemberRole === member.id ? (
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="text" 
                                    value={memberRoleInput} 
                                    onChange={e => setMemberRoleInput(e.target.value)} 
                                    placeholder="输入角色" 
                                    className="w-24 px-2 py-0.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-teal-500" 
                                  />
                                  <button onClick={() => handleSaveMemberRole(member.id)} className="w-6 h-6 flex items-center justify-center bg-teal-500 text-white rounded hover:bg-teal-600 cursor-pointer">
                                    <i className="ri-check-line text-xs"></i>
                                  </button>
                                  <button onClick={() => { setEditingMemberRole(null); setMemberRoleInput(''); }} className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-600 rounded hover:bg-gray-300 cursor-pointer">
                                    <i className="ri-close-line text-xs"></i>
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {member.role && (
                                    <span className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-full whitespace-nowrap">
                                      {member.role}
                                    </span>
                                  )}
                                  {myTeam.status === 'forming' && (
                                    <button 
                                      onClick={() => {
                                        setEditingMemberRole(member.id);
                                        setMemberRoleInput(member.role);
                                      }}
                                      className="text-xs text-teal-600 hover:text-teal-700 cursor-pointer">
                                      <i className="ri-edit-line"></i>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 协作空间 */}
                  {myTeam.status === 'active' && (
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
                  )}
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

              <div className="space-y-3">
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
                          <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full object-cover border-2 border-white" />
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
                      <span className="text-xs text-gray-400">创建于 {team.createdAt}</span>
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
