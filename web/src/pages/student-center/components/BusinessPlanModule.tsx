import { useState } from 'react';
import VersionControl, { Version } from '../../../components/feature/VersionControl';

export default function BusinessPlanModule() {
  const [activeTab, setActiveTab] = useState<'plan' | 'analysis'>('plan');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [showGenerateOptions, setShowGenerateOptions] = useState(false);
  const [editorContent, setEditorContent] = useState("一、执行摘要&#10;&#10;本项目致力于打造校园智能配送平台，通过AI算法优化配送路径，为大学生提供15分钟快速配送服务。项目针对校园外卖配送效率低、等待时间长的痛点，结合智能路径规划技术，实现高效、低成本的配送服务。&#10;&#10;市场调研显示，85%的学生对现有配送服务不满意，主要问题集中在配送时间长和配送费用高。我们的解决方案通过技术创新和精细化运营，将配送时间缩短至15分钟以内，配送费控制在2-3元，显著提升用户体验。&#10;&#10;团队由4名核心成员组成，分别负责技术开发、市场营销、财务管理和产品设计。首年预计服务10,000名用户，实现营收45万元，净利润15万元。");
  const [planSections, setPlanSections] = useState([
    { title: '执行摘要', progress: 100, status: 'completed' },
    { title: '项目背景', progress: 100, status: 'completed' },
    { title: '市场分析', progress: 100, status: 'completed' },
    { title: '产品与服务', progress: 80, status: 'editing' },
    { title: '商业模式', progress: 60, status: 'editing' },
    { title: '营销策略', progress: 40, status: 'editing' },
    { title: '财务规划', progress: 20, status: 'pending' },
    { title: '团队介绍', progress: 0, status: 'pending' }
  ]);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    id: string;
    fileName: string;
    uploadTime: string;
    result: string;
  }>>([]);

  const generatingSteps = [
    { title: '执行摘要', icon: 'ri-file-list-3-line' },
    { title: '项目背景', icon: 'ri-lightbulb-line' },
    { title: '市场分析', icon: 'ri-bar-chart-box-line' },
    { title: '产品与服务', icon: 'ri-product-hunt-line' },
    { title: '商业模式', icon: 'ri-money-dollar-circle-line' },
    { title: '营销策略', icon: 'ri-megaphone-line' },
    { title: '财务规划', icon: 'ri-line-chart-line' },
    { title: '团队介绍', icon: 'ri-team-line' }
  ];

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    setGeneratingStep(0);

    // 模拟逐步生成各章节
    for (let i = 0; i < generatingSteps.length; i++) {
      setGeneratingStep(i);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // 生成完整内容
    const generatedContent = `一、执行摘要

本项目致力于打造校园智能配送平台，通过AI算法优化配送路径，为大学生提供15分钟快速配送服务。项目针对校园外卖配送效率低、等待时间长的痛点，结合智能路径规划技术，实现高效、低成本的配送服务。

市场调研显示，85%的学生对现有配送服务不满意，主要问题集中在配送时间长和配送费用高。我们的解决方案通过技术创新和精细化运营，将配送时间缩短至15分钟以内，配送费控制在2-3元，显著提升用户体验。

团队由4名核心成员组成，分别负责技术开发、市场营销、财务管理和产品设计。首年预计服务10,000名用户，实现营收45万元，净利润15万元。

二、项目背景

2.1 行业现状
当前校园配送市场规模达500亿元，年增长率保持在25%以上。随着大学生消费能力提升和便利性需求增加，校园配送服务已成为刚需。然而，现有配送平台普遍存在配送时间长（平均45分钟）、配送费高（5-8元）、服务质量不稳定等问题。

2.2 创业机会
通过前期市场调研，我们发现校园配送市场存在明显的服务空白：学生对15分钟快速配送有强烈需求，愿意为高效服务支付合理费用。同时，校园场景相对封闭，配送路径可预测性强，非常适合AI算法优化。

2.3 项目定位
我们定位为"校园智能配送专家"，专注服务大学生群体，通过技术创新提供极致配送体验。核心竞争力在于AI路径规划算法和精细化运营能力。

三、市场分析

3.1 目标市场
目标用户为在校大学生，年龄18-24岁，月均消费能力800-1500元。根据调研数据，目标院校在校生规模3万人，其中70%有定期使用配送服务的习惯，月均订单频次12次。

3.2 市场规模
单校市场容量：3万人 × 70% × 12次/月 × 5元/单 = 126万元/月
首年目标覆盖3所高校，预计市场规模378万元/年
三年内计划覆盖15所高校，市场规模可达1890万元/年

3.3 竞争分析
主要竞争对手包括美团外卖、饿了么等综合平台，以及校园跑腿等本地服务。我们的差异化优势在于：
• 配送速度：15分钟 vs 竞品45分钟
• 配送费用：2-3元 vs 竞品5-8元
• 服务专注：专注校园场景，深度理解学生需求
• 技术驱动：AI算法持续优化配送效率

3.4 用户画像
根据问卷调研（样本量500份），典型用户画像如下：
• 李晓雨，女，20岁，大二学生，月生活费1200元
• 痛点：课间时间紧张，外卖经常送达时已下课
• 需求：快速配送，价格合理，食品安全有保障
• 使用场景：午餐、晚餐、夜宵，周末购物代取

四、产品与服务

4.1 核心功能
• 智能下单：一键下单，AI推荐常用商品
• 实时追踪：配送员位置实时显示，预计送达时间精准
• 路径优化：AI算法规划最优配送路径，确保15分钟送达
• 评价反馈：完善的评价体系，持续优化服务质量

4.2 技术架构
采用微服务架构，核心模块包括：
• 订单管理系统：处理订单创建、分配、追踪
• AI调度引擎：基于机器学习的路径规划算法
• 配送员APP：实时接单、导航、反馈
• 用户小程序：下单、支付、评价一体化

4.3 服务流程
用户下单 → AI分配配送员 → 商家出餐 → 配送员取餐 → 智能路径导航 → 15分钟送达 → 用户评价

4.4 产品原型
已完成小程序端和配送员端原型设计，核心页面包括首页、商品列表、订单详情、实时追踪等。UI设计简洁友好，操作流程顺畅。

五、商业模式

5.1 收入来源
• 配送服务费：每单收取2-3元配送费，预计占总收入60%
• 平台佣金：向商家收取8%交易佣金，预计占总收入30%
• 广告收入：平台内商家推广位，预计占总收入10%

5.2 成本结构
• 配送员成本：占总成本50%（按单计费，每单1.5元）
• 技术开发：占总成本20%（服务器、开发维护）
• 市场推广：占总成本15%（地推、补贴、广告）
• 运营管理：占总成本15%（人员、办公、其他）

5.3 盈利模式
通过规模化运营降低单位成本，提升配送效率。首年预计单量10万单，实现盈亏平衡；第二年单量30万单，净利润率达15%；第三年单量80万单，净利润率达25%。

5.4 合作伙伴
• 校园商家：食堂、超市、奶茶店等
• 配送团队：招募在校学生兼职配送
• 技术供应商：云服务、支付接口、地图API

六、营销策略

6.1 推广计划
• 地推活动：开学季在校园设点宣传，发放优惠券
• 社群运营：建立各院系配送群，提供专属优惠
• KOL合作：与校园网红、学生会合作推广
• 补贴策略：新用户首单免配送费，老用户推荐奖励

6.2 品牌定位
"快人一步，智享校园" - 强调速度优势和智能体验

6.3 渠道策略
• 线上：微信小程序为主要入口，公众号内容营销
• 线下：校园海报、食堂广告位、宿舍楼宣传栏
• 口碑：优质服务驱动用户自发传播

6.4 用户留存
• 会员体系：月卡用户享受配送费折扣
• 积分系统：订单积分可兑换优惠券
• 活动运营：定期推出限时优惠、满减活动

七、财务规划

7.1 启动资金
总计需要启动资金20万元，用途分配如下：
• 技术开发：8万元（小程序、后台系统、AI算法）
• 市场推广：6万元（地推、补贴、广告）
• 运营成本：4万元（办公、人员、设备）
• 流动资金：2万元（应急储备）

7.2 收入预测
第一年：
• 月均订单量：8,000单
• 年度总订单：96,000单
• 配送费收入：24万元（2.5元/单）
• 佣金收入：18万元（商品均价25元，佣金率8%）
• 广告收入：3万元
• 年度总收入：45万元

第二年：
• 月均订单量：25,000单
• 年度总收入：135万元

第三年：
• 月均订单量：65,000单
• 年度总收入：350万元

7.3 成本预测
第一年总成本：30万元
• 配送成本：14.4万元（1.5元/单）
• 技术成本：6万元
• 推广成本：5万元
• 运营成本：4.6万元

7.4 盈利预测
• 第一年：净利润15万元，利润率33%
• 第二年：净利润45万元，利润率33%
• 第三年：净利润120万元，利润率34%

八、团队介绍

8.1 核心成员
• 张明 - CEO兼技术负责人
  计算机科学专业，擅长算法设计和系统架构，曾获全国大学生创新创业大赛金奖，有2年互联网公司实习经验。

• 李晓雨 - COO兼市场负责人
  市场营销专业，擅长用户调研和品牌推广，曾主导校园多个大型活动，拥有丰富的校园资源和运营经验。

• 王强 - CFO兼财务负责人
  金融学专业，擅长财务分析和成本控制，持有会计从业资格证，曾在会计师事务所实习，具备扎实的财务管理能力。

• 陈思 - CPO兼产品负责人
  工业设计专业，擅长用户体验设计和产品规划，作品曾获红点设计奖提名，对产品细节有极致追求。

8.2 团队优势
• 专业互补：技术、市场、财务、产品四大核心能力齐备
• 校园资源：团队成员均为在校生，深度理解用户需求
• 执行力强：曾共同完成多个项目，配合默契
• 学习能力：持续学习行业知识，快速迭代优化

8.3 顾问团队
• 李教授 - 创业导师，电子商务领域专家
• 王总 - 天使投资人，连续创业者
• 刘经理 - 物流行业资深从业者

8.4 未来规划
随着业务发展，计划招募技术开发、市场推广、客服运营等岗位，打造20人规模的专业团队。`;

    setEditorContent(generatedContent);

    // 更新所有章节为已完成
    setPlanSections(prev => prev.map(section => ({
      ...section,
      progress: 100,
      status: 'completed'
    })));

    await new Promise(resolve => setTimeout(resolve, 500));
    setIsGenerating(false);
    setShowGenerateOptions(true);
  };

  const handleKeepContent = () => {
    setShowGenerateOptions(false);
  };

  const handleRegenerate = () => {
    setShowGenerateOptions(false);
    handleAIGenerate();
  };

  // 版本控制状态
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);

  // 保存当前版本
  const handleSaveVersion = (summary: string) => {
    const newVersion: Version = {
      id: `version-${Date.now()}`,
      versionNumber: versions.length + 1,
      timestamp: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
      summary,
      data: {
        editorContent,
        planSections,
        activeTab,
      },
    };
    setVersions([...versions, newVersion]);
    setCurrentVersion(newVersion.versionNumber);
  };

  // 回撤到指定版本
  const handleRestore = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    
    const data = version.data;
    setEditorContent(data.editorContent || '');
    setPlanSections(data.planSections || []);
    setActiveTab(data.activeTab || 'plan');
    setCurrentVersion(version.versionNumber);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFile) return;
    
    setIsAnalyzing(true);
    
    // 模拟AI分析过程
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const result = `AI分析报告 - ${uploadedFile.name}

一、整体评价
本商业计划书结构完整，逻辑清晰，内容详实。整体质量评分：85/100

二、优点分析
1. 市场分析深入：对目标市场进行了详细的调研和分析，数据支撑充分
2. 商业模式清晰：收入来源和成本结构描述明确，盈利模式可行
3. 团队介绍完善：核心成员背景和分工明确，团队能力互补

三、改进建议
1. 竞争分析不足：建议补充主要竞争对手的详细对比分析
2. 风险评估缺失：需要增加市场风险、运营风险等风险分析章节
3. 财务预测过于乐观：建议提供保守、中性、乐观三种情景的财务预测
4. 营销策略细节不够：需要补充具体的营销渠道、预算分配和时间节点

四、关键指标评估
- 市场分析：★★★★☆ (4/5)
- 产品服务：★★★★☆ (4/5)
- 商业模式：★★★★☆ (4/5)
- 营销策略：★★★☆☆ (3/5)
- 财务规划：★★★☆☆ (3/5)
- 团队介绍：★★★★★ (5/5)

五、下一步行动建议
1. 优先补充竞争分析和风险评估章节
2. 完善财务预测模型，提供多种情景分析
3. 细化营销策略的执行计划和预算分配
4. 增加附录材料，如市场调研原始数据、用户访谈记录等`;

    setAnalysisResult(result);
    
    // 保存到历史记录
    const newRecord = {
      id: `analysis-${Date.now()}`,
      fileName: uploadedFile.name,
      uploadTime: new Date().toLocaleString('zh-CN'),
      result,
    };
    setAnalysisHistory([newRecord, ...analysisHistory]);
    
    setIsAnalyzing(false);
  };

  return (
    <div className="space-y-8">
      {/* 版本控制工具栏 */}
      <VersionControl
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="商业计划书"
      />

      {/* AI生成进度弹窗 */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-sparkling-line text-3xl text-white"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">AI正在生成商业计划书</h3>
              <p className="text-sm text-gray-600">正在整合各模块数据，生成完整计划书草稿...</p>
            </div>

            <div className="space-y-3 mb-6">
              {generatingSteps.map((step, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    index < generatingStep ? 'bg-green-50' :
                    index === generatingStep ? 'bg-violet-50' :
                    'bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index < generatingStep ? 'bg-green-500' :
                    index === generatingStep ? 'bg-violet-500' :
                    'bg-gray-300'
                  }`}>
                    {index < generatingStep ? (
                      <i className="ri-check-line text-white"></i>
                    ) : index === generatingStep ? (
                      <i className={`${step.icon} text-white animate-pulse`}></i>
                    ) : (
                      <i className={`${step.icon} text-white`}></i>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${
                      index <= generatingStep ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </div>
                  </div>
                  {index === generatingStep && (
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                style={{ width: `${((generatingStep + 1) / generatingSteps.length) * 100}%` }}
              ></div>
            </div>
            <div className="text-center mt-2 text-sm text-gray-600">
              {Math.round(((generatingStep + 1) / generatingSteps.length) * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* 生成完成选项弹窗 */}
      {showGenerateOptions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-line text-3xl text-white"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">生成完成！</h3>
              <p className="text-sm text-gray-600">商业计划书草稿已生成，您可以在编辑器中查看和修改</p>
            </div>

            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <i className="ri-information-line text-violet-600 text-xl mt-0.5"></i>
                <div className="flex-1 text-sm text-violet-700">
                  <p className="font-medium mb-1">AI已整合以下内容：</p>
                  <ul className="space-y-1 text-xs">
                    <li>• 市场调研数据和用户画像</li>
                    <li>• 商业模式画布和SWOT分析</li>
                    <li>• 产品设计原型和功能规划</li>
                    <li>• 团队成员信息和角色分工</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRegenerate}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-refresh-line mr-2"></i>
                重新生成
              </button>
              <button
                onClick={handleKeepContent}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium rounded-xl hover:from-violet-600 hover:to-purple-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-check-line mr-2"></i>
                保留内容
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'plan' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <i className="ri-file-text-line mr-2"></i>
            商业计划书要点
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'analysis' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <i className="ri-ai-generate mr-2"></i>
            AI分析
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'plan' && (
            <div className="space-y-8">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-violet-900 mb-3">商业计划书撰写指南</h3>
                <p className="text-sm text-violet-700 mb-3">
                  平台将自动提取前期各模块核心内容，填充到计划书对应章节，你可以在此基础上修改完善
                </p>
                <ul className="text-sm text-violet-700 space-y-1">
                  <li>• 内容完整：涵盖项目背景、市场分析、产品服务、商业模式等</li>
                  <li>• 逻辑清晰：章节结构合理，论述层次分明</li>
                  <li>• 数据支撑：用调研数据和财务预测支撑观点</li>
                  <li>• 团队协作：成员按角色分工撰写对应章节</li>
                </ul>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">总进度</span>
                    <i className="ri-file-chart-line text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {Math.round(planSections.reduce((sum, s) => sum + s.progress, 0) / planSections.length)}%
                  </div>
                  <div className="text-xs text-white/80">
                    8个章节中已完成{planSections.filter(s => s.status === 'completed').length}个
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">字数统计</span>
                    <i className="ri-text text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">{editorContent.length}</div>
                  <div className="text-xs text-white/80">目标10,000字</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">协作成员</span>
                    <i className="ri-team-line text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">4人</div>
                  <div className="text-xs text-white/80">全员参与编辑</div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">章节列表</h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={handleAIGenerate}
                      className="px-5 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium rounded-lg hover:from-violet-600 hover:to-purple-600 transition-all shadow-lg shadow-violet-500/30 whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-sparkling-line mr-2"></i>
                      AI一键生成商业计划书
                    </button>
                    <button className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                      <i className="ri-add-line mr-2"></i>
                      添加章节
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {planSections.map((section, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                          <h4 className="text-base font-bold text-gray-900">{section.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                            section.status === 'completed' ? 'bg-green-100 text-green-700' :
                            section.status === 'editing' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {section.status === 'completed' ? '已完成' :
                             section.status === 'editing' ? '编辑中' : '待编辑'}
                          </span>
                          <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                            <i className="ri-edit-line"></i>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                            style={{ width: `${section.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{section.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">在线编辑器</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
                    <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                      <i className="ri-bold"></i>
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                      <i className="ri-italic"></i>
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                      <i className="ri-underline"></i>
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-2"></div>
                    <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                      <i className="ri-list-unordered"></i>
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                      <i className="ri-list-ordered"></i>
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-2"></div>
                    <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                      <i className="ri-image-line"></i>
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                      <i className="ri-table-line"></i>
                    </button>
                  </div>
                  <textarea
                    rows={12}
                    className="w-full px-6 py-4 text-sm text-gray-700 focus:outline-none resize-none"
                    placeholder="开始撰写商业计划书内容..."
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    <span>最后编辑：张明 · 2分钟前</span>
                    <span>当前章节：执行摘要</span>
                  </div>
                  <button className="px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-save-line mr-2"></i>
                    保存
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <button className="flex-1 px-6 py-3 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">
                  <i className="ri-file-download-line mr-2"></i>
                  导出Word
                </button>
                <button className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                  <i className="ri-file-pdf-line mr-2"></i>
                  导出PDF
                </button>
                <button className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                  <i className="ri-history-line mr-2"></i>
                  版本历史
                </button>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-8">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-violet-900 mb-3">AI智能分析</h3>
                <p className="text-sm text-violet-700 mb-3">
                  上传你的商业计划书文档，AI将自动分析内容质量、提供改进建议，并保存分析记录
                </p>
                <ul className="text-sm text-violet-700 space-y-1">
                  <li>• 支持格式：Word (.docx)、PDF (.pdf)、文本 (.txt)</li>
                  <li>• 分析维度：市场分析、商业模式、财务规划、团队介绍等</li>
                  <li>• 智能评分：提供各章节质量评分和整体建议</li>
                  <li>• 历史记录：自动保存所有分析记录，方便对比查看</li>
                </ul>
              </div>

              {/* 上传区域 */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">上传商业计划书</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-violet-400 transition-all">
                  <input
                    type="file"
                    id="file-upload"
                    accept=".docx,.pdf,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-upload-cloud-line text-3xl text-violet-600"></i>
                    </div>
                    <p className="text-base font-semibold text-gray-900 mb-2">
                      点击上传或拖拽文件到此处
                    </p>
                    <p className="text-sm text-gray-500">
                      支持 Word、PDF、TXT 格式，文件大小不超过 10MB
                    </p>
                  </label>
                </div>

                {uploadedFile && (
                  <div className="mt-4 flex items-center justify-between p-4 bg-violet-50 border border-violet-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-500 rounded-lg flex items-center justify-center">
                        <i className="ri-file-text-line text-white text-lg"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{uploadedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(uploadedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setUploadedFile(null)}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="ri-close-line text-lg"></i>
                    </button>
                  </div>
                )}

                {uploadedFile && (
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium rounded-xl hover:from-violet-600 hover:to-purple-600 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? (
                      <>
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        AI分析中...
                      </>
                    ) : (
                      <>
                        <i className="ri-sparkling-line mr-2"></i>
                        开始AI分析
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 分析结果 */}
              {analysisResult && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <i className="ri-ai-generate text-violet-600"></i>
                      分析结果
                    </h3>
                    <button
                      onClick={() => {
                        const blob = new Blob([analysisResult], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `AI分析报告-${new Date().toLocaleDateString()}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-download-line mr-1.5"></i>
                      导出报告
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {analysisResult}
                    </pre>
                  </div>
                </div>
              )}

              {/* 分析历史记录 */}
              {analysisHistory.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <i className="ri-history-line text-violet-600"></i>
                    分析历史记录
                  </h3>
                  <div className="space-y-3">
                    {analysisHistory.map((record) => (
                      <div
                        key={record.id}
                        className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => setAnalysisResult(record.result)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                              <i className="ri-file-text-line text-violet-600"></i>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {record.fileName}
                              </p>
                              <p className="text-xs text-gray-500">
                                <i className="ri-time-line mr-1"></i>
                                {record.uploadTime}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAnalysisResult(record.result);
                            }}
                            className="px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                          >
                            查看报告
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
