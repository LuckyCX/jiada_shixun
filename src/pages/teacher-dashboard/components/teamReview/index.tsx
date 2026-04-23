import { useState } from 'react';

// 学生能力画像类型
type AbilityProfile = {
  techGeek: number;
  designAesthetic: number;
  businessOperator: number;
};

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
};

// 团队类型
type Team = {
  id: string;
  name: string;
  members: Student[];
  avgProfile: AbilityProfile;
  complementScore: number;
};

// Mock 学生数据
const mockStudents: Student[] = [
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
];

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-3 rounded-xl shadow-lg z-[9999] flex items-center gap-2 text-sm font-medium`;
  div.innerHTML = `<i class="${type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}"></i><span>${message}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

export default function TeamReview() {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'grouped'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 计算能力互补得分
  const calculateComplementScore = (members: Student[]): number => {
    if (members.length === 0) return 0;
    
    const avgTech = members.reduce((sum, m) => sum + m.profile.techGeek, 0) / members.length;
    const avgDesign = members.reduce((sum, m) => sum + m.profile.designAesthetic, 0) / members.length;
    const avgBusiness = members.reduce((sum, m) => sum + m.profile.businessOperator, 0) / members.length;
    
    // 计算方差（越小说明越不均衡，互补性越好）
    const techVariance = members.reduce((sum, m) => sum + Math.pow(m.profile.techGeek - avgTech, 2), 0) / members.length;
    const designVariance = members.reduce((sum, m) => sum + Math.pow(m.profile.designAesthetic - avgDesign, 2), 0) / members.length;
    const businessVariance = members.reduce((sum, m) => sum + Math.pow(m.profile.businessOperator - avgBusiness, 2), 0) / members.length;
    
    // 方差越大，互补性越好
    const complementScore = Math.min(100, (techVariance + designVariance + businessVariance) / 30);
    
    return Math.round(complementScore);
  };

  // AI 智能组队
  const handleAutoGroup = () => {
    const pendingStudents = students.filter(s => s.status === 'pending');
    
    if (pendingStudents.length < 3) {
      showToast('待组队学生不足3人，无法自动组队', 'error');
      return;
    }

    // 简单的贪心算法：按能力互补性分组
    const newTeams: Team[] = [];
    const remaining = [...pendingStudents];
    let teamCounter = 1;

    while (remaining.length >= 3) {
      // 找出技术、设计、商业能力最突出的三个学生
      const sortedByTech = [...remaining].sort((a, b) => b.profile.techGeek - a.profile.techGeek);
      const sortedByDesign = [...remaining].sort((a, b) => b.profile.designAesthetic - a.profile.designAesthetic);
      const sortedByBusiness = [...remaining].sort((a, b) => b.profile.businessOperator - a.profile.businessOperator);

      const techExpert = sortedByTech[0];
      const designExpert = sortedByDesign.find(s => s.id !== techExpert.id) || sortedByDesign[1];
      const businessExpert = sortedByBusiness.find(s => s.id !== techExpert.id && s.id !== designExpert.id) || sortedByBusiness[2];

      const teamMembers = [techExpert, designExpert, businessExpert];
      
      // 如果还有剩余学生且团队未满，添加第4人
      const remainingAfterCore = remaining.filter(s => !teamMembers.find(m => m.id === s.id));
      if (remainingAfterCore.length > 0 && teamMembers.length < 5) {
        teamMembers.push(remainingAfterCore[0]);
      }

      const avgProfile: AbilityProfile = {
        techGeek: Math.round(teamMembers.reduce((sum, m) => sum + m.profile.techGeek, 0) / teamMembers.length),
        designAesthetic: Math.round(teamMembers.reduce((sum, m) => sum + m.profile.designAesthetic, 0) / teamMembers.length),
        businessOperator: Math.round(teamMembers.reduce((sum, m) => sum + m.profile.businessOperator, 0) / teamMembers.length),
      };

      const complementScore = calculateComplementScore(teamMembers);

      newTeams.push({
        id: `team-${Date.now()}-${teamCounter}`,
        name: `团队 ${teamCounter}`,
        members: teamMembers,
        avgProfile,
        complementScore,
      });

      // 从剩余列表中移除已分组的学生
      teamMembers.forEach(member => {
        const index = remaining.findIndex(s => s.id === member.id);
        if (index > -1) remaining.splice(index, 1);
      });

      teamCounter++;
    }

    // 更新学生状态
    const updatedStudents = students.map(s => {
      const team = newTeams.find(t => t.members.some(m => m.id === s.id));
      if (team) {
        return { ...s, status: 'grouped' as const, teamId: team.id };
      }
      return s;
    });

    setStudents(updatedStudents);
    setTeams(newTeams);
    showToast(`AI 智能组队完成，共生成 ${newTeams.length} 个团队`);
  };

  // 手动调整：从团队中移除学生
  const handleRemoveFromTeam = (studentId: string, teamId: string) => {
    const updatedStudents = students.map(s =>
      s.id === studentId ? { ...s, status: 'pending' as const, teamId: undefined } : s
    );
    
    const updatedTeams = teams.map(t => {
      if (t.id === teamId) {
        const newMembers = t.members.filter(m => m.id !== studentId);
        if (newMembers.length === 0) return null;
        
        const avgProfile: AbilityProfile = {
          techGeek: Math.round(newMembers.reduce((sum, m) => sum + m.profile.techGeek, 0) / newMembers.length),
          designAesthetic: Math.round(newMembers.reduce((sum, m) => sum + m.profile.designAesthetic, 0) / newMembers.length),
          businessOperator: Math.round(newMembers.reduce((sum, m) => sum + m.profile.businessOperator, 0) / newMembers.length),
        };
        
        return {
          ...t,
          members: newMembers,
          avgProfile,
          complementScore: calculateComplementScore(newMembers),
        };
      }
      return t;
    }).filter(Boolean) as Team[];

    setStudents(updatedStudents);
    setTeams(updatedTeams);
    showToast('已将学生移出团队');
  };

  // 手动调整：添加学生到团队
  const handleAddToTeam = (studentId: string, teamId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    if (team.members.length >= 5) {
      showToast('团队人数已达上限（5人）', 'error');
      return;
    }

    const updatedStudents = students.map(s =>
      s.id === studentId ? { ...s, status: 'grouped' as const, teamId } : s
    );

    const updatedTeams = teams.map(t => {
      if (t.id === teamId) {
        const newMembers = [...t.members, student];
        const avgProfile: AbilityProfile = {
          techGeek: Math.round(newMembers.reduce((sum, m) => sum + m.profile.techGeek, 0) / newMembers.length),
          designAesthetic: Math.round(newMembers.reduce((sum, m) => sum + m.profile.designAesthetic, 0) / newMembers.length),
          businessOperator: Math.round(newMembers.reduce((sum, m) => sum + m.profile.businessOperator, 0) / newMembers.length),
        };
        
        return {
          ...t,
          members: newMembers,
          avgProfile,
          complementScore: calculateComplementScore(newMembers),
        };
      }
      return t;
    });

    setStudents(updatedStudents);
    setTeams(updatedTeams);
    showToast('已将学生添加到团队');
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

  // 确认组队并通知学生
  const handleConfirmGrouping = () => {
    if (teams.length === 0) {
      showToast('还没有任何团队，请先进行组队', 'error');
      return;
    }

    const updatedStudents = students.map(s =>
      s.status === 'grouped' ? { ...s, status: 'confirmed' as const } : s
    );

    setStudents(updatedStudents);
    setShowConfirmModal(false);
    showToast(`组队确认成功！已通知 ${teams.reduce((sum, t) => sum + t.members.length, 0)} 名学生`);
  };

  // 重置所有组队
  const handleResetAll = () => {
    if (!window.confirm('确定要重置所有组队吗？此操作不可撤销。')) return;
    
    const resetStudents = students.map(s => ({ ...s, status: 'pending' as const, teamId: undefined }));
    setStudents(resetStudents);
    setTeams([]);
    showToast('已重置所有组队');
  };

  // 筛选学生
  const filteredStudents = students.filter(s => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchSearch = !searchKeyword || s.name.includes(searchKeyword) || s.studentId.includes(searchKeyword);
    return matchStatus && matchSearch;
  });

  const pendingCount = students.filter(s => s.status === 'pending').length;
  const groupedCount = students.filter(s => s.status === 'grouped').length;
  const confirmedCount = students.filter(s => s.status === 'confirmed').length;

  return (
    <div className="space-y-6">
      {/* 头部统计 */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold mb-2">组队审核管理</h2>
            <p className="text-white/80 text-sm">所有学生已完成能力画像测评，可以开始组队</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoGroup}
              disabled={pendingCount < 3}
              className={`px-5 py-2.5 bg-white text-teal-600 text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                pendingCount < 3 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <i className="ri-magic-line text-base"></i>
              AI 智能组队
            </button>
            {teams.length > 0 && (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2"
              >
                <i className="ri-check-double-line text-base"></i>
                确认组队并通知学生
              </button>
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

      {/* 操作栏 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="搜索学生姓名或学号..."
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 w-64"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {[
                { key: 'all' as const, label: '全部' },
                { key: 'pending' as const, label: '待组队' },
                { key: 'grouped' as const, label: '已分组' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    filterStatus === f.key ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {teams.length > 0 && (
            <button
              onClick={handleResetAll}
              className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors whitespace-nowrap cursor-pointer border border-red-200"
            >
              <i className="ri-restart-line mr-1.5"></i>
              重置所有组队
            </button>
          )}
        </div>
      </div>

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
                    className="bg-gray-50 border border-gray-200 rounded-xl p-3 hover:border-teal-300 hover:bg-teal-50/30 transition-all cursor-move"
                  >
                    <div className="flex items-start gap-3">
                      <img src={student.avatar} alt={student.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-gray-900">{student.name}</h4>
                          <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full whitespace-nowrap">{student.studentId}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{student.major} · {student.grade}</p>
                        <div className="space-y-1">
                          {[
                            { label: '技术', value: student.profile.techGeek, color: 'from-teal-500 to-cyan-500' },
                            { label: '设计', value: student.profile.designAesthetic, color: 'from-orange-400 to-amber-400' },
                            { label: '商业', value: student.profile.businessOperator, color: 'from-green-500 to-emerald-500' },
                          ].map(item => (
                            <div key={item.label} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-8">{item.label}</span>
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full bg-gradient-to-r ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                              </div>
                              <span className="text-xs font-medium text-gray-700 w-8 text-right">{item.value}</span>
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
                <p className="text-sm text-gray-500 mb-5">点击"AI 智能组队"自动分组，或手动拖拽学生到团队</p>
                <button
                  onClick={handleAutoGroup}
                  disabled={pendingCount < 3}
                  className={`px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer ${
                    pendingCount < 3 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <i className="ri-magic-line mr-2"></i>
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
                          { label: '技术极客', value: team.avgProfile.techGeek, color: 'from-teal-500 to-cyan-500' },
                          { label: '设计美学', value: team.avgProfile.designAesthetic, color: 'from-orange-400 to-amber-400' },
                          { label: '商业操盘', value: team.avgProfile.businessOperator, color: 'from-green-500 to-emerald-500' },
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
                            <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-bold text-gray-900">{member.name}</span>
                                <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full whitespace-nowrap">{member.studentId}</span>
                              </div>
                              <div className="flex gap-1.5">
                                {member.skills.slice(0, 2).map(skill => (
                                  <span key={skill} className="px-1.5 py-0.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-full whitespace-nowrap">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFromTeam(member.id, team.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap cursor-pointer border border-red-200"
                          >
                            <i className="ri-close-line mr-1"></i>
                            移出
                          </button>
                        </div>
                      ))}
                    </div>

                    {team.members.length < 5 && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                        <i className="ri-information-line"></i>
                        <span>拖拽左侧学生到此区域可添加成员（最多5人）</span>
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">确认组队并通知学生</h3>
              <p className="text-sm text-gray-500">确认后将向所有学生发送组队通知，学生将看到自己的团队信息</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">团队总数</span>
                <span className="font-bold text-gray-900">{teams.length} 个</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">已分组学生</span>
                <span className="font-bold text-gray-900">{groupedCount} 人</span>
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
                onClick={handleConfirmGrouping}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer"
              >
                <i className="ri-send-plane-line mr-2"></i>
                确认并通知学生
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}