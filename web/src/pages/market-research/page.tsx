import { useState } from 'react';
import { Link } from 'react-router-dom';
import ResearchPlanTab from './components/ResearchPlanTab';
import SurveyTab from './components/SurveyTab';
import AnalysisTab from './components/AnalysisTab';
import PersonaTab from './components/PersonaTab';
import ChallengeTab from './components/ChallengeTab';
import VersionControl from '../../components/feature/VersionControl';
import { ResearchPlan, Survey, AnalysisData, UserPersona } from './types';
import { defaultPlan, defaultSurveys, defaultAnalysisData, defaultPersonas } from './mockData';

type TabKey = 'plan' | 'survey' | 'analysis' | 'persona' | 'challenge';

interface Version {
  id: number;
  versionNumber: number;
  description: string;
  timestamp: string;
  author: string;
  data: any;
}

export default function MarketResearch() {
  const [activeTab, setActiveTab] = useState<TabKey>('plan');
  const [plan, setPlan] = useState<ResearchPlan>(defaultPlan);
  const [surveys, setSurveys] = useState<Survey[]>(defaultSurveys);
  const [analysisData] = useState<AnalysisData>(defaultAnalysisData);
  const [personas, setPersonas] = useState<UserPersona[]>(defaultPersonas);

  // 版本控制状态 - 调研计划
  const [planVersions, setPlanVersions] = useState<Version[]>([
    {
      id: 1,
      versionNumber: 1,
      description: '初始版本 - 创建调研计划',
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { plan: defaultPlan }
    }
  ]);
  const [planCurrentVersion, setPlanCurrentVersion] = useState(1);

  // 版本控制状态 - 问卷调查
  const [surveyVersions, setSurveyVersions] = useState<Version[]>([
    {
      id: 1,
      versionNumber: 1,
      description: '初始版本 - 问卷调查',
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { surveys: defaultSurveys }
    }
  ]);
  const [surveyCurrentVersion, setSurveyCurrentVersion] = useState(1);

  // 版本控制状态 - 用户画像
  const [personaVersions, setPersonaVersions] = useState<Version[]>([
    {
      id: 1,
      versionNumber: 1,
      description: '初始版本 - 用户画像',
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { personas: defaultPersonas }
    }
  ]);
  const [personaCurrentVersion, setPersonaCurrentVersion] = useState(1);

  // 版本控制处理函数 - 调研计划
  const handleSavePlanVersion = (description: string) => {
    const newVersion: Version = {
      id: planVersions.length + 1,
      versionNumber: planVersions.length + 1,
      description,
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { plan }
    };
    setPlanVersions([...planVersions, newVersion]);
    setPlanCurrentVersion(newVersion.versionNumber);
  };

  const handleRestorePlanVersion = (versionNumber: number) => {
    const version = planVersions.find(v => v.versionNumber === versionNumber);
    if (version && version.data) {
      setPlan(version.data.plan);
      setPlanCurrentVersion(versionNumber);
    }
  };

  // 版本控制处理函数 - 问卷调查
  const handleSaveSurveyVersion = (description: string) => {
    const newVersion: Version = {
      id: surveyVersions.length + 1,
      versionNumber: surveyVersions.length + 1,
      description,
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { surveys }
    };
    setSurveyVersions([...surveyVersions, newVersion]);
    setSurveyCurrentVersion(newVersion.versionNumber);
  };

  const handleRestoreSurveyVersion = (versionNumber: number) => {
    const version = surveyVersions.find(v => v.versionNumber === versionNumber);
    if (version && version.data) {
      setSurveys(version.data.surveys);
      setSurveyCurrentVersion(versionNumber);
    }
  };

  // 版本控制处理函数 - 用户画像
  const handleSavePersonaVersion = (description: string) => {
    const newVersion: Version = {
      id: personaVersions.length + 1,
      versionNumber: personaVersions.length + 1,
      description,
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { personas }
    };
    setPersonaVersions([...personaVersions, newVersion]);
    setPersonaCurrentVersion(newVersion.versionNumber);
  };

  const handleRestorePersonaVersion = (versionNumber: number) => {
    const version = personaVersions.find(v => v.versionNumber === versionNumber);
    if (version && version.data) {
      setPersonas(version.data.personas);
      setPersonaCurrentVersion(versionNumber);
    }
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'plan', label: '调研计划', icon: 'ri-file-list-3-line' },
    { key: 'survey', label: '问卷调查', icon: 'ri-questionnaire-line' },
    { key: 'analysis', label: '数据分析', icon: 'ri-bar-chart-box-line' },
    { key: 'persona', label: '用户画像', icon: 'ri-user-heart-line' },
    { key: 'challenge', label: '人机对抗', icon: 'ri-sword-line' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 cursor-pointer">
              <img
                src="https://public.readdy.ai/ai/img_res/a45fb981-255c-43bf-a2cd-2de142ce7a9c.png"
                alt="Logo"
                className="h-10 w-10 object-contain"
              />
              <span className="text-xl font-bold text-gray-900">嘉兴大学创业实训平台</span>
            </Link>
            <i className="ri-arrow-right-s-line text-gray-400"></i>
            <span className="text-sm text-gray-600">市场调研与用户画像</span>
          </div>
          <button className="px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-full hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-question-line mr-2"></i>AI助手
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">市场调研与用户画像</h1>
          <p className="text-lg text-gray-600">通过真实调研验证用户需求，构建典型用户画像</p>
        </div>

        {/* Data flow hint */}
        <div className="mb-6 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <i className="ri-links-line text-purple-400 text-base"></i>
          <span>数据流向：</span>
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">调研计划</span>
          <i className="ri-arrow-right-line"></i>
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">AI生成问卷</span>
          <i className="ri-arrow-right-line"></i>
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">数据分析图表</span>
          <i className="ri-arrow-right-line"></i>
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">用户画像</span>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex border-b border-gray-100">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className={`${tab.icon} mr-2`}></i>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-8">
            {activeTab === 'plan' && (
              <div className="space-y-6">
                {/* 版本控制工具栏 */}
                <VersionControl
                  moduleName="调研计划"
                  currentVersion={planCurrentVersion}
                  versions={planVersions}
                  onSaveVersion={handleSavePlanVersion}
                  onRestoreVersion={handleRestorePlanVersion}
                />
                
                <ResearchPlanTab plan={plan} onChange={setPlan} />
              </div>
            )}
            {activeTab === 'survey' && (
              <div className="space-y-6">
                {/* 版本控制工具栏 */}
                <VersionControl
                  moduleName="问卷调查"
                  currentVersion={surveyCurrentVersion}
                  versions={surveyVersions}
                  onSaveVersion={handleSaveSurveyVersion}
                  onRestoreVersion={handleRestoreSurveyVersion}
                />
                
                <SurveyTab surveys={surveys} plan={plan} onSurveysChange={setSurveys} />
              </div>
            )}
            {activeTab === 'analysis' && (
              <AnalysisTab data={analysisData} surveys={surveys} />
            )}
            {activeTab === 'persona' && (
              <div className="space-y-6">
                {/* 版本控制工具栏 */}
                <VersionControl
                  moduleName="用户画像"
                  currentVersion={personaCurrentVersion}
                  versions={personaVersions}
                  onSaveVersion={handleSavePersonaVersion}
                  onRestoreVersion={handleRestorePersonaVersion}
                />
                
                <PersonaTab personas={personas} onPersonasChange={setPersonas} />
              </div>
            )}
            {activeTab === 'challenge' && (
              <ChallengeTab />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}