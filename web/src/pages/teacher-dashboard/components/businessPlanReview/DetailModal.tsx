import { useState } from 'react';
import { BusinessPlan } from './types';

interface DetailModalProps {
  plan: BusinessPlan;
  onClose: () => void;
  onReview: () => void;
}

export default function DetailModal({ plan, onClose, onReview }: DetailModalProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'attachments'>('content');

  const sections = [
    { key: 'executiveSummary', label: '执行摘要', content: plan.executiveSummary },
    { key: 'marketAnalysis', label: '市场分析', content: plan.marketAnalysis },
    { key: 'productService', label: '产品与服务', content: plan.productService },
    { key: 'marketingStrategy', label: '营销策略', content: plan.marketingStrategy },
    { key: 'operationPlan', label: '运营计划', content: plan.operationPlan },
    { key: 'financialPlan', label: '财务计划', content: plan.financialPlan },
    { key: 'teamIntroduction', label: '团队介绍', content: plan.teamIntroduction },
    { key: 'riskAnalysis', label: '风险分析', content: plan.riskAnalysis }
  ];

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-rose-100 text-rose-700'
    };
    const labels = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已退回'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{plan.projectName}</h2>
              <div className="flex items-center gap-4 text-indigo-100">
                <span className="flex items-center gap-2">
                  <i className="ri-team-line"></i>
                  {plan.teamName}
                </span>
                <span className="flex items-center gap-2">
                  <i className="ri-time-line"></i>
                  提交时间：{plan.submitTime}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
          <div className="flex items-center justify-between">
            {getStatusBadge(plan.status)}
            {plan.status === 'pending' && (
              <button
                onClick={onReview}
                className="px-6 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors whitespace-nowrap"
              >
                开始审核
              </button>
            )}
            {plan.status === 'rejected' && (
              <button
                onClick={onReview}
                className="px-6 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors whitespace-nowrap"
              >
                重新审核
              </button>
            )}
          </div>
        </div>

        {/* 标签页 */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('content')}
              className={`py-3 px-4 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'content'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-file-text-line mr-2"></i>
              计划书内容
            </button>
            <button
              onClick={() => setActiveTab('attachments')}
              className={`py-3 px-4 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'attachments'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-attachment-2 mr-2"></i>
              附件资料
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'content' && (
            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.key} className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <div className="w-1 h-5 bg-indigo-600 rounded-full"></div>
                    {section.label}
                  </h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {section.content}
                  </p>
                </div>
              ))}

              {/* 审核记录 */}
              {plan.status !== 'pending' && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-indigo-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <i className="ri-chat-check-line text-indigo-600"></i>
                    审核意见
                  </h3>
                  <div className="bg-white rounded-lg p-4 mb-3">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {plan.reviewComment}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <i className="ri-user-line"></i>
                      审核人：{plan.reviewer}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-time-line"></i>
                      审核时间：{plan.reviewTime}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-4">
              {plan.pptUrl && (
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white">
                      <i className="ri-file-ppt-2-line text-2xl"></i>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">商业计划书演示文稿</h4>
                      <p className="text-sm text-gray-600">PPT格式</p>
                    </div>
                    <a
                      href={plan.pptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:shadow-lg transition-all whitespace-nowrap"
                    >
                      <i className="ri-download-line mr-2"></i>
                      下载查看
                    </a>
                  </div>
                </div>
              )}

              {plan.attachments && plan.attachments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <i className="ri-folder-line text-indigo-600"></i>
                    其他附件
                  </h3>
                  {plan.attachments.map((file, index) => (
                    <div
                      key={index}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center">
                          <i className="ri-file-line text-xl text-indigo-600"></i>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{file.name}</h4>
                          <p className="text-sm text-gray-500">{file.size}</p>
                        </div>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
                        >
                          <i className="ri-download-line mr-1"></i>
                          下载
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!plan.pptUrl && (!plan.attachments || plan.attachments.length === 0) && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="ri-folder-open-line text-4xl text-gray-400"></i>
                  </div>
                  <p className="text-gray-500">暂无附件</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}