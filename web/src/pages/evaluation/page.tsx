import { Link } from 'react-router-dom';
import { useState } from 'react';
import AppModalPortal from '../../components/AppModalPortal';

// 团队评分明细弹窗组件
function TeamScoreDetailModal({ team, onClose }: { team: any; onClose: () => void }) {
  return (
    <AppModalPortal open onMaskClick={onClose} zIndex={50} className="p-6">
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{team.name} - 评分明细</h3>
              <p className="text-sm text-gray-600 mt-1">最终得分: <span className="text-2xl font-bold text-teal-600">{team.finalScore}</span></p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-2xl"></i>
            </button>
          </div>
        </div>
        
        <div className="p-8 space-y-6">
          {/* 评分概览 */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
              <div className="text-xs text-gray-600 mb-1">项目完成</div>
              <div className="text-2xl font-bold text-blue-600">{team.projectScore}</div>
              <div className="text-xs text-gray-500 mt-1">权重 50%</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4">
              <div className="text-xs text-gray-600 mb-1">迭代增值</div>
              <div className="text-2xl font-bold text-purple-600">{team.iterationScore}</div>
              <div className="text-xs text-gray-500 mt-1">权重 50%</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4">
              <div className="text-xs text-gray-600 mb-1">基础总分</div>
              <div className="text-2xl font-bold text-orange-600">{team.totalScore}</div>
              <div className="text-xs text-gray-500 mt-1">加权平均</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
              <div className="text-xs text-gray-600 mb-1">复盘加分</div>
              <div className="text-2xl font-bold text-green-600">+{team.retrospectiveBonus}</div>
              <div className="text-xs text-gray-500 mt-1">额外奖励</div>
            </div>
          </div>

          {/* 项目完成维度详细评分 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h4 className="text-lg font-bold text-gray-900 mb-4">项目完成维度评分</h4>
            <div className="space-y-4">
              {team.projectDimensions.map((dim: any, index: number) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{dim.name}</span>
                    <span className="text-lg font-bold text-teal-600">{dim.score}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{dim.comment}</p>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                      style={{ width: `${dim.score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 迭代增值维度详细评分 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h4 className="text-lg font-bold text-gray-900 mb-4">迭代增值维度评分</h4>
            <div className="space-y-4">
              {team.iterationDimensions.map((dim: any, index: number) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{dim.name}</span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full whitespace-nowrap">
                        {dim.value}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-purple-600">{dim.score}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{dim.comment}</p>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                      style={{ width: `${dim.score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 评阅人信息 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <h4 className="text-sm font-bold text-gray-900 mb-3">评阅信息</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <i className="ri-user-line text-gray-500"></i>
                <span className="text-gray-600">评阅人:</span>
                <span className="font-medium text-gray-900">{team.reviewer}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="ri-time-line text-gray-500"></i>
                <span className="text-gray-600">评阅时间:</span>
                <span className="font-medium text-gray-900">{team.reviewTime}</span>
              </div>
            </div>
          </div>

          {/* 综合评语 */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-6">
            <h4 className="text-sm font-bold text-teal-900 mb-3">综合评语</h4>
            <p className="text-sm text-teal-800 leading-relaxed">{team.comment}</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </AppModalPortal>
  );
}

export default function Evaluation() {
  const [activeTab, setActiveTab] = useState<'overview' | 'project-completion' | 'iteration-value' | 'joint-review' | 'behavior-data' | 'final-report'>('overview');
  const [showRetrospectiveModal, setShowRetrospectiveModal] = useState(false);
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<any>(null);

  // 双维评价数据
  const dualEvaluationData = {
    projectCompletion: {
      score: 88,
      weight: 50,
      finalScore: 44,
      dimensions: [
        { name: '技术落地性', score: 90, description: '产品原型完整，技术方案可行' },
        { name: '商业逻辑闭环', score: 85, description: '商业模式清晰，盈利路径明确' },
        { name: '市场生存潜力', score: 89, description: '市场需求真实，竞争优势明显' }
      ]
    },
    iterationValue: {
      score: 92,
      weight: 50,
      finalScore: 46,
      dimensions: [
        { name: '迭代次数', score: 95, value: '3次完整迭代', description: '完成3轮构建-衡量-学习循环' },
        { name: '方案修改幅度', score: 88, value: '重大调整2次', description: '基于数据进行了2次重大方向调整' },
        { name: '数据驱动决策', score: 93, value: '数据支撑率95%', description: '所有决策均有数据支撑' }
      ]
    },
    totalScore: 90,
    retrospectiveBonus: 5,
    finalScore: 95
  };

  // 评价进度追踪数据（新增详细信息）
  const evaluationProgress = [
    {
      id: 1,
      name: '创新科技小组',
      status: 'completed',
      projectScore: 88,
      iterationScore: 92,
      totalScore: 90,
      retrospectiveBonus: 5,
      finalScore: 95,
      reviewer: '李教授',
      reviewTime: '2024-03-15 14:30',
      comment: '项目整体完成度高，商业逻辑清晰，团队协作良好。迭代优化过程体现了很强的数据驱动思维，值得肯定。建议进一步优化成本控制方案。',
      projectDimensions: [
        { name: '技术落地性', score: 90, comment: '产品原型完整，技术方案可行，功能实现度高' },
        { name: '商业逻辑闭环', score: 85, comment: '商业模式清晰，盈利路径明确，但成本控制需加强' },
        { name: '市场生存潜力', score: 89, comment: '市场需求真实，竞争优势明显，用户画像精准' }
      ],
      iterationDimensions: [
        { name: '迭代次数', score: 95, value: '3次', comment: '完成3轮完整的构建-衡量-学习循环' },
        { name: '方案修改幅度', score: 88, value: '重大调整2次', comment: '基于数据进行了2次重大方向调整' },
        { name: '数据驱动决策', score: 93, value: '支撑率95%', comment: '所有决策均有充分的数据支撑' }
      ]
    },
    {
      id: 2,
      name: '智慧校园团队',
      status: 'completed',
      projectScore: 85,
      iterationScore: 88,
      totalScore: 86.5,
      retrospectiveBonus: 3,
      finalScore: 89.5,
      reviewer: '张教授',
      reviewTime: '2024-03-15 16:20',
      comment: '项目定位清晰，技术实现较好。迭代过程中能够根据反馈及时调整，展现了良好的学习能力。建议加强市场调研深度。',
      projectDimensions: [
        { name: '技术落地性', score: 88, comment: '技术方案合理，实现质量较高' },
        { name: '商业逻辑闭环', score: 82, comment: '商业模式基本清晰，盈利模式需进一步完善' },
        { name: '市场生存潜力', score: 86, comment: '市场定位准确，但竞争分析不够深入' }
      ],
      iterationDimensions: [
        { name: '迭代次数', score: 90, value: '2次', comment: '完成2轮有效迭代' },
        { name: '方案修改幅度', score: 85, value: '中等调整', comment: '根据反馈进行了合理调整' },
        { name: '数据驱动决策', score: 89, value: '支撑率88%', comment: '大部分决策有数据支撑' }
      ]
    },
    {
      id: 3,
      name: '绿色出行小队',
      status: 'pending',
      projectScore: 0,
      iterationScore: 0,
      totalScore: 0,
      retrospectiveBonus: 0,
      finalScore: 0,
      reviewer: '',
      reviewTime: '',
      comment: '',
      projectDimensions: [],
      iterationDimensions: []
    },
    {
      id: 4,
      name: '健康管理组',
      status: 'pending',
      projectScore: 0,
      iterationScore: 0,
      totalScore: 0,
      retrospectiveBonus: 0,
      finalScore: 0,
      reviewer: '',
      reviewTime: '',
      comment: '',
      projectDimensions: [],
      iterationDimensions: []
    }
  ];

  // 项目完成情况详细数据
  const projectCompletionDetails = [
    {
      stage: '组队与团队管理',
      completionRate: 100,
      quality: 95,
      highlights: ['团队结构合理', '角色分工明确', '协作效率高'],
      issues: []
    },
    {
      stage: '创新思维与创意生成',
      completionRate: 100,
      quality: 92,
      highlights: ['创意新颖独特', '运用多种创新方法', '团队讨论充分'],
      issues: []
    },
    {
      stage: '市场调研与用户画像',
      completionRate: 100,
      quality: 88,
      highlights: ['调研方法科学', '数据分析深入', '用户画像精准'],
      issues: ['样本量可以更大']
    },
    {
      stage: '产品设计与原型',
      completionRate: 100,
      quality: 90,
      highlights: ['原型交互完整', '功能设计合理', '用户体验良好'],
      issues: []
    },
    {
      stage: '商业模式设计',
      completionRate: 100,
      quality: 85,
      highlights: ['商业画布完整', 'SWOT分析透彻', '成本控制合理'],
      issues: ['收入预测可以更保守']
    },
    {
      stage: 'AI角色推荐',
      completionRate: 100,
      quality: 93,
      highlights: ['角色匹配度高', '分工执行到位'],
      issues: []
    },
    {
      stage: '商业计划书与PPT',
      completionRate: 100,
      quality: 91,
      highlights: ['逻辑严密', '呈现专业', '内容完整'],
      issues: []
    },
    {
      stage: '迭代优化',
      completionRate: 100,
      quality: 94,
      highlights: ['数据驱动决策', '快速响应调整', '持续优化迭代'],
      issues: []
    }
  ];

  // 迭代增值数据
  const iterationValueData = {
    iterations: [
      {
        cycle: 1,
        startDate: '2024-01-10',
        endDate: '2024-01-24',
        changes: [
          '调整目标用户群体：从全校学生缩小到宿舍区学生',
          '优化配送时间承诺：从30分钟调整为15分钟',
          '简化下单流程：从5步减少到3步'
        ],
        dataSupport: [
          '用户调研显示85%需求来自宿舍区',
          '竞品分析显示15分钟是核心竞争力',
          '用户测试显示流程过长导致30%流失'
        ],
        decision: '优化迭代',
        improvement: '点击率提升6.2%，留存率提升13.4%'
      },
      {
        cycle: 2,
        startDate: '2024-01-25',
        endDate: '2024-02-08',
        changes: [
          '调整定价策略：引入会员制度',
          '扩大配送范围：增加教学区覆盖',
          '增加客服功能：接入AI智能客服'
        ],
        dataSupport: [
          '价格敏感度分析显示会员制接受度高',
          '需求热力图显示教学区有35%潜在用户',
          '客服咨询量增长200%，需要自动化'
        ],
        decision: '优化迭代',
        improvement: '转化率提升3.8%，NPS提升16分'
      },
      {
        cycle: 3,
        startDate: '2024-02-09',
        endDate: '2024-02-23',
        changes: [
          '优化UI界面：简化视觉设计',
          '增加社交功能：用户可以分享订单',
          '完善评价体系：引入图片评价'
        ],
        dataSupport: [
          '用户反馈界面过于复杂',
          '社交分享可提升30%传播率',
          '图片评价可提升信任度'
        ],
        decision: '优化迭代',
        improvement: '用户满意度提升至4.5分'
      }
    ],
    totalModifications: 9,
    majorPivots: 2,
    dataBackedDecisions: 18,
    dataSupportRate: 95
  };

  // 数字孪生行为数据
  const behaviorData = {
    learningBehavior: {
      studyTime: 156,
      resourceViews: 342,
      notesCount: 89,
      discussionPosts: 127
    },
    collaborationActivity: {
      activeMembers: 5,
      totalMembers: 5,
      messages: 1247,
      filesShared: 156,
      meetingHours: 48
    },
    taskQuality: {
      avgScore: 91,
      submissionRate: 100,
      revisionCount: 23,
      feedbackResponseRate: 98
    },
    iterationMetrics: {
      buildPhaseHours: 120,
      measurePhaseTests: 15,
      learnPhaseInsights: 34,
      pivotDecisions: 2
    }
  };

  // 联合评审团成员
  const reviewers = [
    {
      name: '李教授',
      role: '校内教师',
      title: '创新创业学院',
      avatar: 'L',
      scores: {
        technical: 90,
        business: 85,
        market: 89
      },
      comment: '项目整体完成度高，商业逻辑清晰，团队协作良好。建议进一步优化成本控制方案。'
    },
    {
      name: '张总',
      role: '企业导师',
      title: '某科技公司CEO',
      avatar: 'Z',
      scores: {
        technical: 88,
        business: 90,
        market: 87
      },
      comment: '产品原型完整，市场定位精准。迭代优化过程体现了很强的数据驱动思维，值得肯定。'
    },
    {
      name: '王经理',
      role: '企业导师',
      title: '某投资机构合伙人',
      avatar: 'W',
      scores: {
        technical: 92,
        business: 86,
        market: 91
      },
      comment: '团队展现出优秀的学习能力和适应能力，从数据中快速发现问题并调整方向，这是创业成功的关键。'
    }
  ];

  const students = [
    {
      name: '张明',
      role: 'CEO',
      avatar: 'Z',
      projectScore: 88,
      iterationScore: 92,
      totalScore: 90,
      retrospectiveBonus: 5,
      finalScore: 95,
      rank: 1,
      contributions: ['主导商业模式设计', '协调团队协作', '完成3次迭代决策']
    },
    {
      name: '李娜',
      role: 'CMO',
      avatar: 'L',
      projectScore: 90,
      iterationScore: 89,
      totalScore: 89.5,
      retrospectiveBonus: 0,
      finalScore: 89.5,
      rank: 2,
      contributions: ['完成市场调研', '设计营销策略', '分析用户数据']
    },
    {
      name: '王强',
      role: 'CTO',
      avatar: 'W',
      projectScore: 85,
      iterationScore: 91,
      totalScore: 88,
      retrospectiveBonus: 0,
      finalScore: 88,
      rank: 3,
      contributions: ['开发产品原型', '技术方案设计', '数据看板搭建']
    },
    {
      name: '陈雪',
      role: 'CPO',
      avatar: 'C',
      projectScore: 87,
      iterationScore: 88,
      totalScore: 87.5,
      retrospectiveBonus: 0,
      finalScore: 87.5,
      rank: 4,
      contributions: ['产品功能设计', 'UI原型绘制', '用户体验优化']
    },
    {
      name: '刘洋',
      role: 'CFO',
      avatar: 'L',
      projectScore: 86,
      iterationScore: 90,
      totalScore: 88,
      retrospectiveBonus: 0,
      finalScore: 88,
      rank: 3,
      contributions: ['财务模型搭建', '成本分析', '投资回报测算']
    }
  ];

  // 班级整体成绩分布数据（新增）
  const gradeDistribution = [
    { range: '90以上', count: 8, percentage: 20, color: 'from-green-500 to-emerald-500' },
    { range: '80-90', count: 15, percentage: 37.5, color: 'from-teal-500 to-cyan-500' },
    { range: '70-80', count: 12, percentage: 30, color: 'from-blue-500 to-indigo-500' },
    { range: '60-70', count: 4, percentage: 10, color: 'from-amber-500 to-orange-500' },
    { range: '60以下', count: 1, percentage: 2.5, color: 'from-red-500 to-pink-500' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 cursor-pointer">
              <img src="https://public.readdy.ai/ai/img_res/a45fb981-255c-43bf-a2cd-2de142ce7a9c.png" alt="Logo" className="h-10 w-10 object-contain" />
              <span className="text-xl font-bold text-gray-900">嘉兴大学创业实训平台</span>
            </Link>
            <i className="ri-arrow-right-s-line text-gray-400"></i>
            <span className="text-sm text-gray-600">双维评价体系</span>
          </div>
          <button className="px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-full hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-question-line mr-2"></i>
            AI助手
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold text-gray-900">双维评价体系</h1>
            <span className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-bold rounded-full whitespace-nowrap">
              项目完成 50% + 迭代增值 50%
            </span>
          </div>
          <p className="text-lg text-gray-600">基于"项目完成+迭代增值"的全景增值评价模型，科学评估学习成果</p>
        </div>

        {/* 双维评价总览 */}
        <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl p-8 text-white mb-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-white/80">项目完成情况</span>
                <i className="ri-file-list-3-line text-2xl text-white/80"></i>
              </div>
              <div className="text-4xl font-bold mb-2">{dualEvaluationData.projectCompletion.score}</div>
              <div className="text-sm text-white/80 mb-4">权重 {dualEvaluationData.projectCompletion.weight}%</div>
              <div className="text-2xl font-bold text-white/90">
                得分: {dualEvaluationData.projectCompletion.finalScore}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-white/80">迭代增值情况</span>
                <i className="ri-refresh-line text-2xl text-white/80"></i>
              </div>
              <div className="text-4xl font-bold mb-2">{dualEvaluationData.iterationValue.score}</div>
              <div className="text-sm text-white/80 mb-4">权重 {dualEvaluationData.iterationValue.weight}%</div>
              <div className="text-2xl font-bold text-white/90">
                得分: {dualEvaluationData.iterationValue.finalScore}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 border-white/40">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-white/80">综合总分</span>
                <i className="ri-trophy-line text-2xl text-white/80"></i>
              </div>
              <div className="text-5xl font-bold mb-2">{dualEvaluationData.finalScore}</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/80">基础分: {dualEvaluationData.totalScore}</span>
                <span className="text-white/60">+</span>
                <span className="text-green-300">复盘加分: {dualEvaluationData.retrospectiveBonus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'overview' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-dashboard-line mr-2"></i>
              评价总览
            </button>
            <button
              onClick={() => setActiveTab('project-completion')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'project-completion' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-file-list-3-line mr-2"></i>
              项目完成评价
            </button>
            <button
              onClick={() => setActiveTab('iteration-value')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'iteration-value' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-refresh-line mr-2"></i>
              迭代增值评价
            </button>
            <button
              onClick={() => setActiveTab('joint-review')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'joint-review' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-team-line mr-2"></i>
              联合评审团
            </button>
            <button
              onClick={() => setActiveTab('behavior-data')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'behavior-data' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-bar-chart-box-line mr-2"></i>
              行为数据采集
            </button>
            <button
              onClick={() => setActiveTab('final-report')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'final-report' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-file-chart-line mr-2"></i>
              最终评价报告
            </button>
          </div>

          <div className="p-8">
            {/* 评价总览 */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-information-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">双维评价模型说明</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        总成绩 = 项目完成情况 × 50% + 迭代增值情况 × 50% + 败因复盘加分
                      </p>
                      <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
                        <div className="flex items-start gap-2">
                          <i className="ri-checkbox-circle-line text-teal-500 mt-0.5"></i>
                          <span><strong>项目完成情况：</strong>考核技术落地性、商业逻辑闭环、市场生存潜力</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <i className="ri-checkbox-circle-line text-teal-500 mt-0.5"></i>
                          <span><strong>迭代增值情况：</strong>考核迭代次数、方案修改幅度、数据驱动决策质量</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 评价进度追踪 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">评价进度追踪</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left text-sm font-medium text-gray-600 pb-3">团队名称</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">项目完成</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">迭代增值</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">基础分</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">复盘加分</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">最终得分</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">状态</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluationProgress.map((team, index) => (
                          <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="py-4 text-sm font-medium text-gray-900">{team.name}</td>
                            <td className="py-4 text-center text-sm text-gray-900">
                              {team.status === 'completed' ? team.projectScore : '-'}
                            </td>
                            <td className="py-4 text-center text-sm text-gray-900">
                              {team.status === 'completed' ? team.iterationScore : '-'}
                            </td>
                            <td className="py-4 text-center text-sm text-gray-900">
                              {team.status === 'completed' ? team.totalScore : '-'}
                            </td>
                            <td className="py-4 text-center">
                              {team.status === 'completed' && team.retrospectiveBonus > 0 ? (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">
                                  +{team.retrospectiveBonus}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-4 text-center">
                              {team.status === 'completed' ? (
                                <span className="text-lg font-bold text-teal-600">{team.finalScore}</span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-4 text-center">
                              {team.status === 'completed' ? (
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">
                                  已完成
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full whitespace-nowrap">
                                  待评价
                                </span>
                              )}
                            </td>
                            <td className="py-4 text-center">
                              {team.status === 'completed' ? (
                                <button
                                  onClick={() => setSelectedTeamDetail(team)}
                                  className="px-3 py-1.5 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  <i className="ri-eye-line mr-1"></i>
                                  查看详情
                                </button>
                              ) : (
                                <button className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                                  <i className="ri-edit-line mr-1"></i>
                                  开始评价
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 三大维度评分 */}
                <div className="grid md:grid-cols-3 gap-6">
                  {dualEvaluationData.projectCompletion.dimensions.map((dim, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-bold text-gray-900">{dim.name}</h4>
                        <div className="text-2xl font-bold text-teal-600">{dim.score}</div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">{dim.description}</p>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                          style={{ width: `${dim.score}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 迭代增值维度 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">迭代增值维度评分</h3>
                  <div className="space-y-6">
                    {dualEvaluationData.iterationValue.dimensions.map((dim, index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h4 className="text-sm font-bold text-gray-900">{dim.name}</h4>
                            <span className="px-3 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                              {dim.value}
                            </span>
                          </div>
                          <div className="text-xl font-bold text-teal-600">{dim.score}</div>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{dim.description}</p>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                            style={{ width: `${dim.score}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 学生成绩排名 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">学生成绩排名</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left text-sm font-medium text-gray-600 pb-3">排名</th>
                          <th className="text-left text-sm font-medium text-gray-600 pb-3">姓名</th>
                          <th className="text-left text-sm font-medium text-gray-600 pb-3">角色</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">项目完成</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">迭代增值</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">基础分</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">复盘加分</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-3">最终得分</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.sort((a, b) => b.finalScore - a.finalScore).map((student, index) => (
                          <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="py-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                index === 0 ? 'bg-amber-100 text-amber-600' :
                                index === 1 ? 'bg-gray-100 text-gray-600' :
                                index === 2 ? 'bg-orange-100 text-orange-600' :
                                'bg-gray-50 text-gray-500'
                              }`}>
                                {index + 1}
                              </div>
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                                  {student.avatar}
                                </div>
                                <span className="text-sm font-medium text-gray-900">{student.name}</span>
                              </div>
                            </td>
                            <td className="py-4 text-sm text-gray-600">{student.role}</td>
                            <td className="py-4 text-center text-sm font-medium text-gray-900">{student.projectScore}</td>
                            <td className="py-4 text-center text-sm font-medium text-gray-900">{student.iterationScore}</td>
                            <td className="py-4 text-center text-sm font-medium text-gray-900">{student.totalScore}</td>
                            <td className="py-4 text-center">
                              {student.retrospectiveBonus > 0 ? (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">
                                  +{student.retrospectiveBonus}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-4 text-center">
                              <span className="text-lg font-bold text-teal-600">{student.finalScore}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 项目完成评价 */}
            {activeTab === 'project-completion' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-file-list-3-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">项目完成情况评价（权重50%）</h4>
                      <p className="text-sm text-gray-600">
                        考核技术落地性、商业逻辑闭环、市场生存潜力三个维度
                      </p>
                    </div>
                  </div>
                </div>

                {/* 各阶段完成情况 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">各阶段完成情况</h3>
                  <div className="space-y-4">
                    {projectCompletionDetails.map((stage, index) => (
                      <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-base font-bold text-gray-900">{stage.stage}</h4>
                              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">
                                ✓ 已完成
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>完成率: {stage.completionRate}%</span>
                              <span>质量分: {stage.quality}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h5 className="text-xs font-bold text-green-900 mb-2">✓ 亮点</h5>
                            <ul className="space-y-1">
                              {stage.highlights.map((highlight, idx) => (
                                <li key={idx} className="text-xs text-green-800 flex items-start gap-2">
                                  <i className="ri-checkbox-circle-line mt-0.5"></i>
                                  <span>{highlight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          {stage.issues.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <h5 className="text-xs font-bold text-amber-900 mb-2">⚠ 待改进</h5>
                              <ul className="space-y-1">
                                {stage.issues.map((issue, idx) => (
                                  <li key={idx} className="text-xs text-amber-800 flex items-start gap-2">
                                    <i className="ri-error-warning-line mt-0.5"></i>
                                    <span>{issue}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                            style={{ width: `${stage.quality}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 三大维度详细评分 */}
                <div className="grid md:grid-cols-3 gap-6">
                  {dualEvaluationData.projectCompletion.dimensions.map((dim, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-4">
                        {dim.score}
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">{dim.name}</h4>
                      <p className="text-sm text-gray-600 mb-4">{dim.description}</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>评分</span>
                          <span className="font-medium">{dim.score} / 100</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              index === 0 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                              index === 1 ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                              'bg-gradient-to-r from-orange-500 to-amber-500'
                            }`}
                            style={{ width: `${dim.score}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 迭代增值评价 */}
            {activeTab === 'iteration-value' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-refresh-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">迭代增值情况评价（权重50%）</h4>
                      <p className="text-sm text-gray-600">
                        考核迭代次数、方案修改幅度、数据驱动决策质量
                      </p>
                    </div>
                  </div>
                </div>

                {/* 迭代统计 */}
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">完整迭代次数</span>
                      <i className="ri-refresh-line text-2xl text-white/80"></i>
                    </div>
                    <div className="text-4xl font-bold mb-1">{iterationValueData.iterations.length}</div>
                    <div className="text-xs text-white/80">构建-衡量-学习循环</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">方案修改次数</span>
                      <i className="ri-edit-line text-2xl text-white/80"></i>
                    </div>
                    <div className="text-4xl font-bold mb-1">{iterationValueData.totalModifications}</div>
                    <div className="text-xs text-white/80">重大调整 {iterationValueData.majorPivots} 次</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">数据驱动决策</span>
                      <i className="ri-bar-chart-line text-2xl text-white/80"></i>
                    </div>
                    <div className="text-4xl font-bold mb-1">{iterationValueData.dataBackedDecisions}</div>
                    <div className="text-xs text-white/80">数据支撑率 {iterationValueData.dataSupportRate}%</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">迭代增值得分</span>
                      <i className="ri-trophy-line text-2xl text-white/80"></i>
                    </div>
                    <div className="text-4xl font-bold mb-1">{dualEvaluationData.iterationValue.score}</div>
                    <div className="text-xs text-white/80">优秀水平</div>
                  </div>
                </div>

                {/* 迭代详情 */}
                <div className="space-y-6">
                  {iterationValueData.iterations.map((iteration, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                            {iteration.cycle}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">第 {iteration.cycle} 轮迭代</h3>
                            <p className="text-sm text-gray-600">{iteration.startDate} ~ {iteration.endDate}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6 mb-4">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 mb-3">方案调整</h4>
                          <ul className="space-y-2">
                            {iteration.changes.map((change, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                <i className="ri-arrow-right-circle-line text-teal-500 mt-0.5"></i>
                                <span>{change}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 mb-3">数据支撑</h4>
                          <ul className="space-y-2">
                            {iteration.dataSupport.map((data, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                <i className="ri-bar-chart-line text-purple-500 mt-0.5"></i>
                                <span>{data}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <i className="ri-line-chart-line text-green-600"></i>
                          <h4 className="text-sm font-bold text-green-900">优化效果</h4>
                        </div>
                        <p className="text-sm text-green-800">{iteration.improvement}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 败因复盘加分 */}
                <div className="bg-white border-2 border-amber-300 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white text-2xl">
                        <i className="ri-file-list-3-line"></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">败因复盘加分机制</h3>
                        <p className="text-sm text-gray-600">
                          即使项目最终失败，提交高质量的复盘报告也能获得加分。
                          请基于数据精准定位失败原因，并提出可行的改进方案。
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowRetrospectiveModal(true)}
                      className="px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-save-line mr-2"></i>
                      提交复盘报告
                    </button>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-amber-900 mb-3">加分标准</h4>
                    <div className="grid md:grid-cols-3 gap-4 text-sm text-amber-800">
                      <div className="flex items-start gap-2">
                        <i className="ri-star-line text-amber-600 mt-0.5"></i>
                        <span><strong>优秀（+5分）：</strong>深度分析失败原因，提出可行改进方案</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <i className="ri-star-line text-amber-600 mt-0.5"></i>
                        <span><strong>良好（+3分）：</strong>准确定位失败原因，有一定反思深度</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <i className="ri-star-line text-amber-600 mt-0.5"></i>
                        <span><strong>合格（+1分）：</strong>基本完成复盘报告，有失败总结</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 联合评审团 */}
            {activeTab === 'joint-review' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-team-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">联合评审团系统</h4>
                      <p className="text-sm text-gray-600">
                        由企业导师与校内教师组成联合评审团，从多维度评估项目质量
                      </p>
                    </div>
                  </div>
                </div>

                {/* 评审团成员 */}
                <div className="grid md:grid-cols-3 gap-6">
                  {reviewers.map((reviewer, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                          {reviewer.avatar}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-900">{reviewer.name}</h4>
                          <p className="text-sm text-gray-600">{reviewer.title}</p>
                          <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                            reviewer.role === '校内教师' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {reviewer.role}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-700">技术落地性</span>
                            <span className="text-sm font-medium text-gray-900">{reviewer.scores.technical}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                              style={{ width: `${reviewer.scores.technical}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-700">商业逻辑闭环</span>
                            <span className="text-sm font-medium text-gray-900">{reviewer.scores.business}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                              style={{ width: `${reviewer.scores.business}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-700">市场生存潜力</span>
                            <span className="text-sm font-medium text-gray-900">{reviewer.scores.market}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                              style={{ width: `${reviewer.scores.market}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="text-xs font-bold text-gray-900 mb-2">评审意见</h5>
                        <p className="text-sm text-gray-700 leading-relaxed">{reviewer.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 综合评审结果 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">综合评审结果</h3>
                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">技术落地性</h4>
                      <div className="text-3xl font-bold text-blue-600 mb-1">
                        {Math.round(reviewers.reduce((sum, r) => sum + r.scores.technical, 0) / reviewers.length)}
                      </div>
                      <div className="text-xs text-gray-600">平均分</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">商业逻辑闭环</h4>
                      <div className="text-3xl font-bold text-purple-600 mb-1">
                        {Math.round(reviewers.reduce((sum, r) => sum + r.scores.business, 0) / reviewers.length)}
                      </div>
                      <div className="text-xs text-gray-600">平均分</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">市场生存潜力</h4>
                      <div className="text-3xl font-bold text-orange-600 mb-1">
                        {Math.round(reviewers.reduce((sum, r) => sum + r.scores.market, 0) / reviewers.length)}
                      </div>
                      <div className="text-xs text-gray-600">平均分</div>
                    </div>
                  </div>

                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <i className="ri-checkbox-circle-line text-teal-600 text-xl mt-0.5"></i>
                      <div>
                        <h5 className="text-sm font-bold text-teal-900 mb-2">评审团综合意见</h5>
                        <p className="text-sm text-teal-800 leading-relaxed">
                          项目整体完成度高，技术方案可行，商业逻辑清晰，市场定位精准。
                          团队展现出优秀的迭代能力和数据驱动思维，从3轮迭代中持续优化产品方案。
                          建议进一步完善财务模型，加强成本控制，提升项目的商业可持续性。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 行为数据采集 */}
            {activeTab === 'behavior-data' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-bar-chart-box-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">评价智能体全周期无感采集</h4>
                      <p className="text-sm text-gray-600">
                        评价智能体自动采集学生从初稿到终稿的全流程行为数据，为评价提供客观依据
                      </p>
                    </div>
                  </div>
                </div>

                {/* 四大维度数据 */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* 学习行为 */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white">
                        <i className="ri-book-open-line text-xl"></i>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">学习行为数据</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-time-line text-blue-500 text-xl"></i>
                          <span className="text-sm text-gray-700">学习时长</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.learningBehavior.studyTime}小时</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-eye-line text-blue-500 text-xl"></i>
                          <span className="text-sm text-gray-700">资源浏览</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.learningBehavior.resourceViews}次</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-file-text-line text-blue-500 text-xl"></i>
                          <span className="text-sm text-gray-700">笔记记录</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.learningBehavior.notesCount}条</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-chat-3-line text-blue-500 text-xl"></i>
                          <span className="text-sm text-gray-700">讨论发言</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.learningBehavior.discussionPosts}次</span>
                      </div>
                    </div>
                  </div>

                  {/* 协作活跃度 */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white">
                        <i className="ri-team-line text-xl"></i>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">协作活跃度数据</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-user-line text-purple-500 text-xl"></i>
                          <span className="text-sm text-gray-700">活跃成员</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.collaborationActivity.activeMembers}/{behaviorData.collaborationActivity.totalMembers}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-message-3-line text-purple-500 text-xl"></i>
                          <span className="text-sm text-gray-700">消息数量</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.collaborationActivity.messages}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-folder-shared-line text-purple-500 text-xl"></i>
                          <span className="text-sm text-gray-700">文件共享</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.collaborationActivity.filesShared}个</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-vidicon-line text-purple-500 text-xl"></i>
                          <span className="text-sm text-gray-700">会议时长</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.collaborationActivity.meetingHours}小时</span>
                      </div>
                    </div>
                  </div>

                  {/* 任务质量 */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white">
                        <i className="ri-star-line text-xl"></i>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">任务质量数据</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-trophy-line text-orange-500 text-xl"></i>
                          <span className="text-sm text-gray-700">平均得分</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.taskQuality.avgScore}分</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-checkbox-circle-line text-orange-500 text-xl"></i>
                          <span className="text-sm text-gray-700">提交率</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.taskQuality.submissionRate}%</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-edit-line text-orange-500 text-xl"></i>
                          <span className="text-sm text-gray-700">修改次数</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.taskQuality.revisionCount}次</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-feedback-line text-orange-500 text-xl"></i>
                          <span className="text-sm text-gray-700">反馈响应率</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.taskQuality.feedbackResponseRate}%</span>
                      </div>
                    </div>
                  </div>

                  {/* 迭代指标 */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-white">
                        <i className="ri-refresh-line text-xl"></i>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">迭代指标数据</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-hammer-line text-green-500 text-xl"></i>
                          <span className="text-sm text-gray-700">构建阶段时长</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.iterationMetrics.buildPhaseHours}小时</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-bar-chart-line text-green-500 text-xl"></i>
                          <span className="text-sm text-gray-700">衡量阶段测试</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.iterationMetrics.measurePhaseTests}次</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-lightbulb-line text-green-500 text-xl"></i>
                          <span className="text-sm text-gray-700">学习阶段洞察</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.iterationMetrics.learnPhaseInsights}条</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <i className="ri-compass-line text-green-500 text-xl"></i>
                          <span className="text-sm text-gray-700">转型决策</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{behaviorData.iterationMetrics.pivotDecisions}次</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 数据可视化 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">评价智能体全流程数据可视化</h3>
                  <div className="space-y-6">
                    {[
                      { name: '学习投入度', value: 92, color: 'blue' },
                      { name: '协作活跃度', value: 95, color: 'purple' },
                      { name: '任务完成质量', value: 91, color: 'orange' },
                      { name: '迭代优化能力', value: 94, color: 'green' }
                    ].map((item, index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          <span className="text-lg font-bold text-gray-900">{item.value}</span>
                        </div>
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              item.color === 'blue' ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                              item.color === 'purple' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                              item.color === 'orange' ? 'bg-gradient-to-r from-orange-500 to-amber-500' :
                              'bg-gradient-to-r from-green-500 to-emerald-500'
                            }`}
                            style={{ width: `${item.value}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 最终评价报告 */}
            {activeTab === 'final-report' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-file-chart-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">最终评价报告</h4>
                      <p className="text-sm text-gray-600">
                        综合项目完成情况、迭代增值情况、行为数据分析，生成全面的评价报告
                      </p>
                    </div>
                  </div>
                </div>

                {/* 团队总体评价 */}
                <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl p-8 text-white">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold mb-2">团队总体评价</h2>
                      <p className="text-white/90">校园配送平台项目 · 创新科技小组</p>
                    </div>
                    <div className="text-right">
                      <div className="text-6xl font-bold mb-2">{dualEvaluationData.finalScore}</div>
                      <div className="text-lg text-white/90">优秀</div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                      <div className="text-sm text-white/80 mb-1">项目完成</div>
                      <div className="text-2xl font-bold">{dualEvaluationData.projectCompletion.score}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                      <div className="text-sm text-white/80 mb-1">迭代增值</div>
                      <div className="text-2xl font-bold">{dualEvaluationData.iterationValue.score}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                      <div className="text-sm text-white/80 mb-1">基础总分</div>
                      <div className="text-2xl font-bold">{dualEvaluationData.totalScore}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                      <div className="text-sm text-white/80 mb-1">复盘加分</div>
                      <div className="text-2xl font-bold text-green-300">+{dualEvaluationData.retrospectiveBonus}</div>
                    </div>
                  </div>
                </div>

                {/* 班级整体成绩分布 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">班级整体成绩分布</h3>
                  <div className="space-y-4">
                    {gradeDistribution.map((grade, index) => (
                      <div key={index} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-900 w-20">{grade.range}分</span>
                            <span className="text-xs text-gray-500">{grade.count}个团队</span>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{grade.percentage}%</span>
                        </div>
                        <div className="relative w-full h-8 bg-gray-100 rounded-lg overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${grade.color} transition-all duration-500 flex items-center justify-end pr-3`}
                            style={{ width: `${grade.percentage}%` }}
                          >
                            <span className="text-white text-xs font-bold">{grade.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-gray-900 mb-1">40</div>
                        <div className="text-xs text-gray-600">总团队数</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-teal-600 mb-1">85.2</div>
                        <div className="text-xs text-gray-600">平均分</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600 mb-1">95</div>
                        <div className="text-xs text-gray-600">最高分</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-amber-600 mb-1">58</div>
                        <div className="text-xs text-gray-600">最低分</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 详细评价内容 */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">项目亮点</h3>
                    <ul className="space-y-3">
                      {[
                        '团队协作高效，角色分工明确，成员配合默契',
                        '创意新颖独特，15分钟配送承诺具有竞争力',
                        '市场调研深入，用户画像精准，需求定位清晰',
                        '产品原型完整，交互设计合理，用户体验良好',
                        '商业模式清晰，盈利路径明确，财务测算合理',
                        '迭代能力突出，3轮优化持续提升核心指标',
                        '数据驱动决策，95%决策有数据支撑',
                        '学习能力强，能从失败中快速总结经验'
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <i className="ri-checkbox-circle-line text-green-500 mt-0.5"></i>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">改进建议</h3>
                    <ul className="space-y-3">
                      {[
                        '进一步扩大市场调研样本量，提高数据可信度',
                        '完善财务模型，加强成本控制和风险预警',
                        '优化产品功能优先级，聚焦核心价值主张',
                        '增加竞品分析深度，明确差异化竞争策略',
                        '加强团队技术能力培养，提升产品开发效率',
                        '建立更完善的用户反馈机制，持续优化体验'
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <i className="ri-error-warning-line text-amber-500 mt-0.5"></i>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 学生个人评价 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">学生个人评价</h3>
                  <div className="space-y-4">
                    {students.map((student, index) => (
                      <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                              {student.avatar}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-base font-bold text-gray-900">{student.name}</h4>
                                <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                                  {student.role}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <span>项目完成: {student.projectScore}</span>
                                <span>迭代增值: {student.iterationScore}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-teal-600 mb-1">{student.finalScore}</div>
                            <div className="text-xs text-gray-500">最终得分</div>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="text-xs font-bold text-gray-900 mb-2">主要贡献</h5>
                          <ul className="space-y-1">
                            {student.contributions.map((contribution, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                <i className="ri-star-line text-teal-500 mt-0.5"></i>
                                <span>{contribution}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 导出操作 */}
                <div className="flex gap-4">
                  <button className="flex-1 px-6 py-3 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-download-line mr-2"></i>
                    导出完整评价报告
                  </button>
                  <button className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-file-chart-line mr-2"></i>
                    生成数据分析图表
                  </button>
                  <button className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-mail-send-line mr-2"></i>
                    发送评价通知
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 复盘报告创建弹窗 */}
      {showRetrospectiveModal ? (
        <AppModalPortal
          open
          onMaskClick={() => setShowRetrospectiveModal(false)}
          zIndex={50}
          className="p-6"
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">提交败因复盘报告</h3>
                <button
                  onClick={() => setShowRetrospectiveModal(false)}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>提示：</strong>即使项目最终失败，提交高质量的复盘报告也能获得加分。
                  请基于数据精准定位失败原因，并提出可行的改进方案。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">报告标题</label>
                <input
                  type="text"
                  placeholder="例如：校园配送平台第2轮迭代失败复盘"
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">1. 项目背景与目标</label>
                <textarea
                  rows={4}
                  placeholder="简述项目初衷、目标用户、核心价值主张..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">2. 关键指标表现</label>
                <textarea
                  rows={4}
                  placeholder="列出核心指标的目标值与实际值，分析差距..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">3. 失败原因分析 ⭐</label>
                <textarea
                  rows={6}
                  placeholder="基于数据，精准定位失败的根本原因（市场、产品、团队、执行等）..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">4. 关键决策复盘</label>
                <textarea
                  rows={4}
                  placeholder="回顾重要决策节点，分析哪些决策是错误的，为什么..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">5. 经验教训总结</label>
                <textarea
                  rows={4}
                  placeholder="从失败中学到了什么，哪些经验可以应用到未来项目..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">6. 改进方案建议</label>
                <textarea
                  rows={4}
                  placeholder="如果重新开始，会如何调整方案和策略..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowRetrospectiveModal(false)}
                  className="flex-1 px-6 py-3 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-save-line mr-2"></i>
                  提交复盘报告
                </button>
                <button
                  onClick={() => setShowRetrospectiveModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </AppModalPortal>
      ) : null}

      {/* 团队评分明细弹窗 */}
      {selectedTeamDetail && (
        <TeamScoreDetailModal 
          team={selectedTeamDetail} 
          onClose={() => setSelectedTeamDetail(null)} 
        />
      )}
    </div>
  );
}