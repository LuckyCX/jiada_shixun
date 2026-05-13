
import { useState } from 'react';
import KnowledgePointLibrary from './KnowledgePointLibrary';
import CaseLibrary from './CaseLibrary';
import CourseManagement from './CourseManagement';

export default function CourseResourceManagement() {
  type SubTabKey = 'course' | 'knowledge' | 'cases';

  const [subTab, setSubTab] = useState<SubTabKey>('course');

  const subTabs = [
    { key: 'course', label: '课程管理', icon: 'ri-book-2-line' },
    { key: 'knowledge', label: '公共知识点库', icon: 'ri-lightbulb-line' },
    { key: 'cases', label: '公共案例库', icon: 'ri-folder-open-line' },
  ];

  const handleTabClick = (key: string) => {
    if (subTabs.some(tab => tab.key === key)) {
      setSubTab(key as SubTabKey);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">课程与资源</h2>
        <p className="text-sm text-gray-500">
          管理课程章节内容、公共知识点库与案例库
        </p>
      </div>

      {/* 子Tab切换 */}
      <div className="flex gap-2 mb-6 bg-white rounded-xl p-2 shadow-sm border border-gray-100">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap text-sm flex items-center justify-center gap-2 ${
              subTab === tab.key
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <i className={tab.icon}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'course' && <CourseManagement />}
      {subTab === 'knowledge' && <KnowledgePointLibrary />}
      {subTab === 'cases' && <CaseLibrary />}
    </div>
  );
}
