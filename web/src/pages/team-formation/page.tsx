
import { Link } from 'react-router-dom';
import { useState } from 'react';

type AbilityProfile = {
  techGeek: number;
  designAesthetic: number;
  businessOperator: number;
};

type JoinApplication = {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantAvatar: string;
  applicantMajor: string;
  applicantGrade: string;
  applicantSkills: string[];
  applicantProfile: AbilityProfile;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
};

type PublicTeam = {
  id: string;
  name: string;
  projectDirection: string;
  maxMembers: number;
  currentMembers: number;
  description: string;
  leaderName: string;
  leaderAvatar: string;
  leaderProfile: AbilityProfile;
  neededRoles: string[];
  tags: string[];
  inviteCode: string;
  applications: JoinApplication[];
  createdAt: string;
};

type MyTeam = {
  id: string;
  name: string;
  projectDirection: string;
  maxMembers: number;
  description: string;
  isLeader: boolean;
  inviteCode: string;
  members: {
    id: string;
    name: string;
    role: string;
    skills: string[];
    profile: AbilityProfile;
    avatar: string;
    major: string;
    grade: string;
  }[];
  applications: JoinApplication[];
  progress: number;
};

const profileQuestions = [
  {
    category: 'techGeek',
    question: '你对编程和技术开发的兴趣程度？',
    options: [
      { label: '非常感兴趣，经常自学编程', value: 100 },
      { label: '比较感兴趣，愿意学习', value: 75 },
      { label: '一般，可以尝试', value: 50 },
      { label: '不太感兴趣', value: 25 },
      { label: '完全不感兴趣', value: 0 },
    ],
  },
  {
    category: 'techGeek',
    question: '你是否有技术项目经验？',
    options: [
      { label: '有多个完整项目经验', value: 100 },
      { label: '有1-2个项目经验', value: 75 },
      { label: '参与过但未完成', value: 50 },
      { label: '只学过理论知识', value: 25 },
      { label: '没有任何经验', value: 0 },
    ],
  },
  {
    category: 'designAesthetic',
    question: '你对UI/UX设计和视觉美学的敏感度？',
    options: [
      { label: '非常敏感，有设计作品', value: 100 },
      { label: '比较敏感，关注设计趋势', value: 75 },
      { label: '一般，能分辨好坏', value: 50 },
      { label: '不太敏感', value: 25 },
      { label: '完全不关注', value: 0 },
    ],
  },
  {
    category: 'designAesthetic',
    question: '你是否掌握设计工具？',
    options: [
      { label: '精通多种设计工具', value: 100 },
      { label: '熟练使用1-2种工具', value: 75 },
      { label: '会基础操作', value: 50 },
      { label: '只了解不会用', value: 25 },
      { label: '完全不会', value: 0 },
    ],
  },
  {
    category: 'businessOperator',
    question: '你对商业模式和市场分析的理解程度？',
    options: [
      { label: '非常了解，有实战经验', value: 100 },
      { label: '比较了解，学过相关课程', value: 75 },
      { label: '一般了解', value: 50 },
      { label: '了解较少', value: 25 },
      { label: '完全不了解', value: 0 },
    ],
  },
  {
    category: 'businessOperator',
    question: '你的沟通协调和团队管理能力？',
    options: [
      { label: '非常强，有领导经验', value: 100 },
      { label: '比较强，善于沟通', value: 75 },
      { label: '一般水平', value: 50 },
      { label: '较弱', value: 25 },
      { label: '很弱', value: 0 },
    ],
  },
];

const mockPublicTeams: PublicTeam[] = [
  {
    id: 'team-001',
    name: '智慧校园先锋队',
    projectDirection: '智能教育平台',
    maxMembers: 5,
    currentMembers: 2,
    description: '致力于打造AI驱动的个性化学习平台，解决高校学生学习效率低下的痛点，已有初步产品原型。',
    leaderName: '张明',
    leaderAvatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20confident%20smile%20wearing%20glasses%20in%20modern%20tech%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20technology%20atmosphere%2C%20professional%20headshot%20style&width=200&height=200&seq=leader-pub-001&orientation=squarish',
    leaderProfile: { techGeek: 60, designAesthetic: 45, businessOperator: 92 },
    neededRoles: ['前端开发', 'UI设计师', '市场运营'],
    tags: ['教育科技', 'AI应用', '校园场景'],
    inviteCode: 'ZM8K2P',
    applications: [],
    createdAt: '2024-03-10',
  },
  {
    id: 'team-002',
    name: '绿色出行创客组',
    projectDirection: '共享单车优化方案',
    maxMembers: 4,
    currentMembers: 2,
    description: '针对现有共享单车运营痛点，设计更智能的调度算法和用户激励体系，已与本地运营商初步接触。',
    leaderName: '李雯',
    leaderAvatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20friendly%20confident%20smile%20in%20modern%20business%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20business%20atmosphere%2C%20professional%20headshot%20style&width=200&height=200&seq=leader-pub-002&orientation=squarish',
    leaderProfile: { techGeek: 35, designAesthetic: 55, businessOperator: 88 },
    neededRoles: ['后端开发', '数据分析'],
    tags: ['绿色出行', '智慧城市', '运营优化'],
    inviteCode: 'LW5N9Q',
    applications: [],
    createdAt: '2024-03-12',
  },
  {
    id: 'team-003',
    name: '健康生活实验室',
    projectDirection: '大学生健康管理App',
    maxMembers: 5,
    currentMembers: 3,
    description: '专注于大学生亚健康问题，通过可穿戴设备数据分析提供个性化健康建议，已完成用户调研。',
    leaderName: '王浩',
    leaderAvatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20male%20university%20student%20portrait%20with%20energetic%20healthy%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20health%20wellness%20atmosphere%2C%20professional%20headshot%20style&width=200&height=200&seq=leader-pub-003&orientation=squarish',
    leaderProfile: { techGeek: 50, designAesthetic: 40, businessOperator: 85 },
    neededRoles: ['产品设计', '市场推广'],
    tags: ['健康科技', '可穿戴设备', '大学生市场'],
    inviteCode: 'WH3R7T',
    applications: [],
    createdAt: '2024-03-14',
  },
  {
    id: 'team-004',
    name: '二手经济探索队',
    projectDirection: '校园二手交易平台',
    maxMembers: 4,
    currentMembers: 1,
    description: '打造校园内最活跃的二手物品交易社区，引入信用评分和AI估价系统，降低交易摩擦。',
    leaderName: '陈晓',
    leaderAvatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20female%20university%20student%20portrait%20with%20creative%20entrepreneurial%20expression%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20startup%20atmosphere%2C%20professional%20headshot%20style&width=200&height=200&seq=leader-pub-004&orientation=squarish',
    leaderProfile: { techGeek: 40, designAesthetic: 70, businessOperator: 80 },
    neededRoles: ['全栈开发', 'UI设计师', '运营策划'],
    tags: ['电商平台', '循环经济', '校园社区'],
    inviteCode: 'CX6M4W',
    applications: [],
    createdAt: '2024-03-15',
  },
];

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-3 rounded-xl shadow-lg z-[9999] flex items-center gap-2 text-sm font-medium`;
  div.innerHTML = `<i class="${type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}"></i><span>${message}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

export default function TeamFormation() {
  const [activeTab, setActiveTab] = useState<'profile' | 'square' | 'myteam'>('profile');
  const [abilityProfile, setAbilityProfile] = useState<AbilityProfile>({ techGeek: 0, designAesthetic: 0, businessOperator: 0 });
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [isRecommendedLeader, setIsRecommendedLeader] = useState(false);
  const [showLeaderPrompt, setShowLeaderPrompt] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  // 招募广场
  const [publicTeams, setPublicTeams] = useState<PublicTeam[]>(mockPublicTeams);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterTag, setFilterTag] = useState('全部');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyTarget, setApplyTarget] = useState<PublicTeam | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [appliedTeamIds, setAppliedTeamIds] = useState<string[]>([]);

  // 我的团队
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', projectDirection: '', maxMembers: 5, description: '', neededRoles: '' });
  const [reviewApp, setReviewApp] = useState<JoinApplication | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [assignRoleInput, setAssignRoleInput] = useState('');

  // 能力画像答题
  const handleAnswerSelect = (value: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);
    if (currentQuestion < profileQuestions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      const profile: AbilityProfile = {
        techGeek: (newAnswers[0] + newAnswers[1]) / 2,
        designAesthetic: (newAnswers[2] + newAnswers[3]) / 2,
        businessOperator: (newAnswers[4] + newAnswers[5]) / 2,
      };
      setAbilityProfile(profile);
      setProfileCompleted(true);
      const maxScore = Math.max(profile.techGeek, profile.designAesthetic, profile.businessOperator);
      if (profile.businessOperator === maxScore && profile.businessOperator >= 70) {
        setIsRecommendedLeader(true);
        setShowLeaderPrompt(true);
      }
    }
  };

  // 创建队伍
  const handleCreateTeam = () => {
    if (!teamForm.name || !teamForm.projectDirection || !teamForm.description) {
      showToast('请填写完整的队伍信息', 'error');
      return;
    }
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newTeam: MyTeam = {
      id: Date.now().toString(),
      name: teamForm.name,
      projectDirection: teamForm.projectDirection,
      maxMembers: teamForm.maxMembers,
      description: teamForm.description,
      isLeader: true,
      inviteCode,
      members: [{
        id: 'me',
        name: '我（队长）',
        role: '队长',
        skills: ['项目管理', '商业分析'],
        profile: abilityProfile,
        avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20university%20student%20portrait%20with%20leadership%20confidence%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=me-leader-001&orientation=squarish',
        major: '工商管理',
        grade: '大三',
      }],
      applications: [],
      progress: 10,
    };
    // 同步到招募广场
    const newPublicTeam: PublicTeam = {
      id: newTeam.id,
      name: teamForm.name,
      projectDirection: teamForm.projectDirection,
      maxMembers: teamForm.maxMembers,
      currentMembers: 1,
      description: teamForm.description,
      leaderName: '我',
      leaderAvatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20university%20student%20portrait%20with%20leadership%20confidence%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=me-leader-001&orientation=squarish',
      leaderProfile: abilityProfile,
      neededRoles: teamForm.neededRoles ? teamForm.neededRoles.split('，').map(r => r.trim()) : ['待定'],
      tags: [teamForm.projectDirection],
      inviteCode,
      applications: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    setPublicTeams(prev => [newPublicTeam, ...prev]);
    setMyTeam(newTeam);
    setShowCreateModal(false);
    setTeamForm({ name: '', projectDirection: '', maxMembers: 5, description: '', neededRoles: '' });
    setActiveTab('myteam');
    showToast('队伍创建成功！已发布到招募广场');
  };

  // 申请加入
  const handleApply = () => {
    if (!applyTarget) return;
    const newApp: JoinApplication = {
      id: Date.now().toString(),
      applicantId: 'me',
      applicantName: '我',
      applicantAvatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20university%20student%20portrait%20with%20friendly%20smile%20in%20modern%20campus%20setting%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20professional%20headshot%20style&width=200&height=200&seq=applicant-me-001&orientation=squarish',
      applicantMajor: '计算机科学',
      applicantGrade: '大二',
      applicantSkills: ['前端开发', 'UI设计'],
      applicantProfile: abilityProfile,
      message: applyMessage,
      status: 'pending',
      appliedAt: new Date().toISOString(),
    };
    setPublicTeams(prev => prev.map(t =>
      t.id === applyTarget.id ? { ...t, applications: [...t.applications, newApp] } : t
    ));
    setAppliedTeamIds(prev => [...prev, applyTarget.id]);
    setShowApplyModal(false);
    setApplyMessage('');
    setApplyTarget(null);
    showToast('申请已发送，等待队长审核');
  };

  // 队长审核
  const handleReview = (approved: boolean) => {
    if (!reviewApp || !myTeam) return;
    const updatedApps = myTeam.applications.map(a =>
      a.id === reviewApp.id ? { ...a, status: approved ? 'approved' as const : 'rejected' as const } : a
    );
    let updatedMembers = myTeam.members;
    if (approved) {
      updatedMembers = [...myTeam.members, {
        id: reviewApp.applicantId + Date.now(),
        name: reviewApp.applicantName,
        role: assignRoleInput || '成员',
        skills: reviewApp.applicantSkills,
        profile: reviewApp.applicantProfile,
        avatar: reviewApp.applicantAvatar,
        major: reviewApp.applicantMajor,
        grade: reviewApp.applicantGrade,
      }];
    }
    setMyTeam({ ...myTeam, applications: updatedApps, members: updatedMembers });
    setShowReviewModal(false);
    setReviewApp(null);
    setAssignRoleInput('');
    showToast(approved ? `已同意 ${reviewApp.applicantName} 加入，角色：${assignRoleInput || '成员'}` : `已拒绝 ${reviewApp.applicantName} 的申请`);
  };

  // 筛选招募广场
  const allTags = ['全部', ...Array.from(new Set(publicTeams.flatMap(t => t.tags)))];
  const filteredTeams = publicTeams.filter(t => {
    const matchSearch = !searchKeyword || t.name.includes(searchKeyword) || t.projectDirection.includes(searchKeyword) || t.description.includes(searchKeyword);
    const matchTag = filterTag === '全部' || t.tags.includes(filterTag);
    return matchSearch && matchTag;
  });

  const pendingCount = myTeam?.applications.filter(a => a.status === 'pending').length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 cursor-pointer">
              <img src="https://public.readdy.ai/ai/img_res/a45fb981-255c-43bf-a2cd-2de142ce7a9c.png" alt="Logo" className="h-10 w-10 object-contain" />
              <span className="text-xl font-bold text-gray-900">嘉兴大学创业实训平台</span>
            </Link>
            <i className="ri-arrow-right-s-line text-gray-400"></i>
            <span className="text-sm text-gray-600">智能组队系统</span>
          </div>
          <button className="px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-full hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-question-line mr-2"></i>AI助手
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">智能组队系统</h1>
          <p className="text-gray-500">完成能力画像 → 浏览招募广场 → 申请加入或创建队伍</p>
        </div>

        {/* 队长推荐弹窗 */}
        {showLeaderPrompt && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-vip-crown-fill text-4xl text-white"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">系统推荐你担任队长！</h3>
                <p className="text-gray-500 text-sm">你的商业操盘能力得分 <span className="font-bold text-amber-600">{Math.round(abilityProfile.businessOperator)}</span> 分，在三项能力中最为突出</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 space-y-2 text-sm text-gray-700">
                <div className="flex items-start gap-2"><i className="ri-checkbox-circle-fill text-amber-500 mt-0.5"></i><span>创建队伍并设定项目方向，队伍自动发布到招募广场</span></div>
                <div className="flex items-start gap-2"><i className="ri-checkbox-circle-fill text-amber-500 mt-0.5"></i><span>审核其他同学的加入申请，查看其能力画像是否互补</span></div>
                <div className="flex items-start gap-2"><i className="ri-checkbox-circle-fill text-amber-500 mt-0.5"></i><span>同意后为成员分配角色，管理团队协作</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowLeaderPrompt(false); setActiveTab('square'); }} className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">先去招募广场看看</button>
                <button onClick={() => { setShowLeaderPrompt(false); setShowCreateModal(true); }} className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                  <i className="ri-vip-crown-line mr-2"></i>立即创建队伍
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 创建队伍弹窗 */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2"><i className="ri-team-line text-teal-600"></i>创建队伍</h3>
                <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><i className="ri-close-line text-xl"></i></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">队伍名称 *</label>
                  <input type="text" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} placeholder="例如：创新科技团队" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">项目方向 *</label>
                  <input type="text" value={teamForm.projectDirection} onChange={e => setTeamForm({ ...teamForm, projectDirection: e.target.value })} placeholder="例如：智能教育平台" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">招募人数</label>
                  <select value={teamForm.maxMembers} onChange={e => setTeamForm({ ...teamForm, maxMembers: Number(e.target.value) })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm cursor-pointer">
                    {[3, 4, 5, 6].map(n => <option key={n} value={n}>{n}人</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">需要的角色（用中文顿号分隔）</label>
                  <input type="text" value={teamForm.neededRoles} onChange={e => setTeamForm({ ...teamForm, neededRoles: e.target.value })} placeholder="例如：前端开发、UI设计师、市场运营" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">队伍简介 *</label>
                  <textarea value={teamForm.description} onChange={e => setTeamForm({ ...teamForm, description: e.target.value })} placeholder="介绍你的团队和项目愿景，吸引合适的成员加入..." rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm resize-none" maxLength={500} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">取消</button>
                <button onClick={handleCreateTeam} className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                  <i className="ri-check-line mr-2"></i>创建并发布到招募广场
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 申请加入弹窗 */}
        {showApplyModal && applyTarget && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">申请加入</h3>
                <button onClick={() => setShowApplyModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><i className="ri-close-line text-xl"></i></button>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <p className="text-sm font-bold text-gray-900 mb-1">{applyTarget.name}</p>
                <p className="text-xs text-gray-500">{applyTarget.projectDirection} · 队长：{applyTarget.leaderName}</p>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">申请留言（向队长介绍自己）</label>
                <textarea value={applyMessage} onChange={e => setApplyMessage(e.target.value)} placeholder="介绍你的技能特长、为什么想加入这个团队..." rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm resize-none" maxLength={300} />
                <p className="text-xs text-gray-400 mt-1 text-right">{applyMessage.length}/300</p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 text-sm text-teal-800 flex items-start gap-2">
                <i className="ri-information-line mt-0.5"></i>
                <span>申请提交后，队长将看到你的能力画像和留言，审核通过后你将收到通知</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowApplyModal(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">取消</button>
                <button onClick={handleApply} className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                  <i className="ri-send-plane-line mr-2"></i>提交申请
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 审核申请弹窗 */}
        {showReviewModal && reviewApp && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">审核申请</h3>
                <button onClick={() => setShowReviewModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><i className="ri-close-line text-xl"></i></button>
              </div>
              <div className="flex items-start gap-4 mb-5">
                <img src={reviewApp.applicantAvatar} alt={reviewApp.applicantName} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                <div>
                  <h4 className="text-base font-bold text-gray-900 mb-1">{reviewApp.applicantName}</h4>
                  <p className="text-sm text-gray-500 mb-2">{reviewApp.applicantMajor} · {reviewApp.applicantGrade}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewApp.applicantSkills.map(s => (
                      <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2 mb-5">
                {[
                  { label: '技术极客', value: reviewApp.applicantProfile.techGeek, color: 'from-teal-500 to-cyan-500' },
                  { label: '设计美学', value: reviewApp.applicantProfile.designAesthetic, color: 'from-orange-400 to-amber-400' },
                  { label: '商业操盘', value: reviewApp.applicantProfile.businessOperator, color: 'from-green-500 to-emerald-500' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-medium text-gray-800">{Math.round(item.value)}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              {reviewApp.message && (
                <div className="bg-gray-50 rounded-xl p-4 mb-5">
                  <p className="text-xs text-gray-500 mb-1">申请留言</p>
                  <p className="text-sm text-gray-700">{reviewApp.message}</p>
                </div>
              )}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">同意后分配角色</label>
                <input type="text" value={assignRoleInput} onChange={e => setAssignRoleInput(e.target.value)} placeholder="例如：前端开发、UI设计师..." className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleReview(false)} className="flex-1 px-6 py-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors whitespace-nowrap cursor-pointer border border-red-200">
                  <i className="ri-close-line mr-2"></i>拒绝申请
                </button>
                <button onClick={() => handleReview(true)} className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                  <i className="ri-check-line mr-2"></i>同意并加入
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex border-b border-gray-100">
            {[
              { key: 'profile' as const, label: '能力画像', icon: 'ri-user-star-line', badge: profileCompleted ? '✓' : null },
              { key: 'square' as const, label: '招募广场', icon: 'ri-store-2-line', badge: null },
              { key: 'myteam' as const, label: '我的团队', icon: 'ri-shield-user-line', badge: pendingCount > 0 ? String(pendingCount) : null },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === tab.key ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/30' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
                {tab.badge && (
                  <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full whitespace-nowrap ${tab.badge === '✓' ? 'bg-green-100 text-green-600' : 'bg-red-500 text-white'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* ── 能力画像 ── */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {!profileCompleted ? (
                  <>
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-6">
                      <div className="flex items-start gap-4 mb-5">
                        <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <i className="ri-user-star-line text-2xl text-white"></i>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">能力画像采集</h3>
                          <p className="text-sm text-gray-600">通过6道问题，精准识别你的"技术极客"、"设计美学"、"商业操盘"三类特质，为你匹配最互补的团队</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300" style={{ width: `${(currentQuestion / profileQuestions.length) * 100}%` }}></div>
                        </div>
                        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">{currentQuestion}/{profileQuestions.length}</span>
                      </div>
                    </div>
                    <div className="bg-white border-2 border-gray-100 rounded-2xl p-8">
                      <span className="inline-block px-3 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full mb-5 whitespace-nowrap">问题 {currentQuestion + 1}/{profileQuestions.length}</span>
                      <h3 className="text-xl font-bold text-gray-900 mb-7">{profileQuestions[currentQuestion].question}</h3>
                      <div className="space-y-3">
                        {profileQuestions[currentQuestion].options.map((option, index) => (
                          <button key={index} onClick={() => handleAnswerSelect(option.value)}
                            className={`w-full p-4 text-left border-2 rounded-xl transition-all cursor-pointer ${answers[currentQuestion] === option.value ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'}`}>
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
                ) : (
                  <>
                    <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl p-7 text-white">
                      <div className="flex items-center gap-3 mb-3">
                        <i className="ri-checkbox-circle-fill text-2xl"></i>
                        <h3 className="text-xl font-bold">能力画像采集完成！</h3>
                      </div>
                      <p className="text-white/80 text-sm">系统已为你生成专属能力画像，现在可以前往招募广场寻找队伍</p>
                      {isRecommendedLeader && (
                        <div className="mt-4 bg-white/20 border border-white/30 rounded-xl p-4 flex items-center gap-3">
                          <i className="ri-vip-crown-fill text-2xl text-amber-300"></i>
                          <div>
                            <p className="font-bold text-sm mb-0.5">系统推荐你担任队长</p>
                            <p className="text-xs text-white/80">商业操盘能力突出，适合领导团队</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="grid md:grid-cols-3 gap-5">
                      {[
                        { label: '技术极客', icon: 'ri-code-s-slash-line', color: 'from-teal-500 to-cyan-500', value: abilityProfile.techGeek, desc: '编程开发、技术实现、系统架构' },
                        { label: '设计美学', icon: 'ri-palette-line', color: 'from-orange-400 to-amber-400', value: abilityProfile.designAesthetic, desc: 'UI/UX设计、视觉呈现、用户体验' },
                        { label: '商业操盘', icon: 'ri-line-chart-line', color: 'from-green-500 to-emerald-500', value: abilityProfile.businessOperator, desc: '商业模式、市场分析、团队管理' },
                      ].map(item => (
                        <div key={item.label} className="bg-white border-2 border-gray-100 rounded-2xl p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`w-11 h-11 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center`}>
                              <i className={`${item.icon} text-xl text-white`}></i>
                            </div>
                            <h4 className="text-base font-bold text-gray-900">{item.label}</h4>
                          </div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-500">能力指数</span>
                            <span className="font-bold text-gray-900 text-lg">{Math.round(item.value)}</span>
                          </div>
                          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                            <div className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-700`} style={{ width: `${item.value}%` }}></div>
                          </div>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => { setProfileCompleted(false); setCurrentQuestion(0); setAnswers([]); setIsRecommendedLeader(false); }}
                        className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                        <i className="ri-refresh-line mr-1.5"></i>重新测评
                      </button>
                      {isRecommendedLeader && (
                        <button onClick={() => setShowCreateModal(true)}
                          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                          <i className="ri-vip-crown-line mr-1.5"></i>创建队伍（推荐）
                        </button>
                      )}
                      <button onClick={() => setActiveTab('square')}
                        className="flex-1 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                        前往招募广场<i className="ri-arrow-right-line ml-1.5"></i>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── 招募广场 ── */}
            {activeTab === 'square' && (
              <div className="space-y-6">
                {!profileCompleted && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <i className="ri-error-warning-line text-amber-600 text-xl mt-0.5"></i>
                    <div>
                      <p className="text-sm font-bold text-amber-900 mb-1">建议先完成能力画像</p>
                      <p className="text-sm text-amber-700">完成测评后，申请时队长可以看到你的能力画像，提高通过率</p>
                    </div>
                  </div>
                )}

                {/* 搜索和筛选 */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <input type="text" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="搜索队伍名称、项目方向..." className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {allTags.map(tag => (
                      <button key={tag} onClick={() => setFilterTag(tag)}
                        className={`px-4 py-2 text-xs font-medium rounded-full transition-colors whitespace-nowrap cursor-pointer ${filterTag === tag ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">共 <span className="font-bold text-gray-900">{filteredTeams.length}</span> 支队伍正在招募</p>
                  {!myTeam && profileCompleted && (
                    <button onClick={() => setShowCreateModal(true)}
                      className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                      <i className="ri-add-line mr-1.5"></i>创建我的队伍
                    </button>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  {filteredTeams.map(team => {
                    const isApplied = appliedTeamIds.includes(team.id);
                    const isMyTeamCard = myTeam?.id === team.id;
                    const isFull = team.currentMembers >= team.maxMembers;
                    return (
                      <div key={team.id} className={`bg-white border-2 rounded-2xl p-6 hover:shadow-lg transition-all ${isMyTeamCard ? 'border-teal-300 bg-teal-50/30' : 'border-gray-100 hover:border-teal-200'}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="text-base font-bold text-gray-900">{team.name}</h3>
                              {isMyTeamCard && <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">我的队伍</span>}
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${isFull ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                                {isFull ? '已满员' : '招募中'}
                              </span>
                            </div>
                            <p className="text-sm text-teal-600 font-medium mb-2">{team.projectDirection}</p>
                          </div>
                          <div className="text-right ml-3 flex-shrink-0">
                            <span className="text-sm font-bold text-gray-900">{team.currentMembers}</span>
                            <span className="text-xs text-gray-400">/{team.maxMembers}人</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{team.description}</p>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {team.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap">{tag}</span>
                          ))}
                        </div>

                        <div className="mb-4">
                          <p className="text-xs text-gray-500 mb-2">缺少角色</p>
                          <div className="flex flex-wrap gap-1.5">
                            {team.neededRoles.map(role => (
                              <span key={role} className="px-2.5 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded-full border border-orange-200 whitespace-nowrap">{role}</span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <img src={team.leaderAvatar} alt={team.leaderName} className="w-8 h-8 rounded-full object-cover" />
                            <div>
                              <p className="text-xs font-medium text-gray-900">{team.leaderName}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1"><i className="ri-vip-crown-line text-amber-500"></i>队长</p>
                            </div>
                          </div>
                          {!isMyTeamCard && (
                            <button
                              disabled={isApplied || isFull}
                              onClick={() => { setApplyTarget(team); setShowApplyModal(true); }}
                              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                                isApplied ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                                isFull ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                                'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:shadow-md'
                              }`}
                            >
                              {isApplied ? <><i className="ri-time-line mr-1.5"></i>已申请</> : isFull ? '已满员' : <><i className="ri-user-add-line mr-1.5"></i>申请加入</>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredTeams.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-search-line text-2xl text-gray-400"></i>
                    </div>
                    <p className="text-gray-500">没有找到匹配的队伍</p>
                  </div>
                )}
              </div>
            )}

            {/* ── 我的团队 ── */}
            {activeTab === 'myteam' && (
              <div className="space-y-6">
                {!myTeam ? (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <i className="ri-team-line text-4xl text-gray-400"></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">还没有加入团队</h3>
                    <p className="text-gray-500 mb-6 text-sm">前往招募广场申请加入，或创建自己的队伍</p>
                    <div className="flex gap-4 justify-center">
                      <button onClick={() => setActiveTab('square')} className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                        <i className="ri-store-2-line mr-2"></i>浏览招募广场
                      </button>
                      {profileCompleted && (
                        <button onClick={() => setShowCreateModal(true)} className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer">
                          <i className="ri-add-circle-line mr-2"></i>创建队伍
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 队伍信息卡 */}
                    <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl p-7 text-white">
                      <div className="flex items-start justify-between mb-5">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-bold">{myTeam.name}</h2>
                            {myTeam.isLeader && (
                              <span className="px-2.5 py-0.5 bg-amber-400/30 border border-amber-300/50 text-amber-200 text-xs font-medium rounded-full whitespace-nowrap flex items-center gap-1">
                                <i className="ri-vip-crown-fill"></i>队长
                              </span>
                            )}
                          </div>
                          <p className="text-white/80 text-sm mb-1">{myTeam.projectDirection}</p>
                          <p className="text-white/70 text-xs">成员 {myTeam.members.length}/{myTeam.maxMembers} 人</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border border-white/30 ${myTeam.members.length >= myTeam.maxMembers ? 'bg-gray-500/20 text-white/70' : 'bg-green-500/20 text-white'}`}>
                            {myTeam.members.length >= myTeam.maxMembers ? '已满员' : '招募中'}
                          </span>
                        </div>
                      </div>
                      {myTeam.isLeader && (
                        <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-white/70 mb-1">邀请码</p>
                            <p className="text-2xl font-bold font-mono tracking-widest">{myTeam.inviteCode}</p>
                          </div>
                          <button onClick={() => { navigator.clipboard.writeText(myTeam.inviteCode); showToast('邀请码已复制'); }}
                            className="px-4 py-2 bg-white text-teal-600 text-sm font-medium rounded-lg hover:bg-white/90 transition-colors whitespace-nowrap cursor-pointer">
                            <i className="ri-file-copy-line mr-1.5"></i>复制
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 待审核申请 */}
                    {myTeam.isLeader && myTeam.applications.filter(a => a.status === 'pending').length > 0 && (
                      <div className="bg-white border-2 border-orange-200 rounded-2xl p-6">
                        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <i className="ri-notification-3-line text-orange-500"></i>
                          待审核申请
                          <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full whitespace-nowrap">{myTeam.applications.filter(a => a.status === 'pending').length}</span>
                        </h3>
                        <div className="space-y-3">
                          {myTeam.applications.filter(a => a.status === 'pending').map(app => (
                            <div key={app.id} className="flex items-center justify-between p-4 bg-orange-50 rounded-xl">
                              <div className="flex items-center gap-3">
                                <img src={app.applicantAvatar} alt={app.applicantName} className="w-10 h-10 rounded-full object-cover" />
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{app.applicantName}</p>
                                  <p className="text-xs text-gray-500">{app.applicantMajor} · {app.applicantGrade}</p>
                                </div>
                              </div>
                              <button onClick={() => { setReviewApp(app); setShowReviewModal(true); }}
                                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-medium rounded-lg hover:shadow-md transition-all whitespace-nowrap cursor-pointer">
                                查看并审核
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 已处理申请 */}
                    {myTeam.isLeader && myTeam.applications.filter(a => a.status !== 'pending').length > 0 && (
                      <div className="bg-white border-2 border-gray-100 rounded-2xl p-6">
                        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <i className="ri-history-line text-gray-500"></i>已处理申请
                        </h3>
                        <div className="space-y-2">
                          {myTeam.applications.filter(a => a.status !== 'pending').map(app => (
                            <div key={app.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                              <div className="flex items-center gap-3">
                                <img src={app.applicantAvatar} alt={app.applicantName} className="w-9 h-9 rounded-full object-cover" />
                                <p className="text-sm font-medium text-gray-700">{app.applicantName}</p>
                              </div>
                              <span className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${app.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {app.status === 'approved' ? '已同意' : '已拒绝'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 团队成员 */}
                    <div className="bg-white border-2 border-gray-100 rounded-2xl p-6">
                      <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <i className="ri-group-line text-teal-600"></i>团队成员
                      </h3>
                      <div className="space-y-3">
                        {myTeam.members.map(member => (
                          <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-teal-50/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <img src={member.avatar} alt={member.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                              <div>
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-sm font-bold text-gray-900">{member.name}</span>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${member.role === '队长' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>
                                    {member.role === '队长' && <i className="ri-vip-crown-line mr-1"></i>}{member.role}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">{member.major} · {member.grade}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {member.skills.slice(0, 2).map(s => (
                                <span key={s} className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-full whitespace-nowrap">{s}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 协作空间 */}
                    <div className="bg-white border-2 border-gray-100 rounded-2xl p-6">
                      <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <i className="ri-apps-line text-teal-600"></i>团队协作空间
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { icon: 'ri-folder-line', label: '文档库', desc: '共享文档和资料', color: 'from-teal-500 to-cyan-500' },
                          { icon: 'ri-chat-3-line', label: '讨论区', desc: '团队交流讨论', color: 'from-orange-400 to-amber-400' },
                          { icon: 'ri-task-line', label: '任务看板', desc: '任务分配与追踪', color: 'from-green-500 to-emerald-500' },
                        ].map(item => (
                          <button key={item.label} className="p-4 bg-gray-50 border border-gray-100 rounded-xl hover:shadow-md hover:border-teal-200 transition-all text-left cursor-pointer">
                            <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-3`}>
                              <i className={`${item.icon} text-lg text-white`}></i>
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{item.label}</h4>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
