
import { useMemo, useState } from 'react';
import AppModalPortal from '../AppModalPortal';

export interface Version {
  id: string;
  versionNumber: number;
  timestamp: string;
  operator: string;
  summary: string;
  data: any;
}

interface VersionControlProps {
  versions: Version[];
  currentVersion: number;
  onRestore: (versionId: string) => void;
  onSaveVersion: (summary: string) => void;
  moduleName: string;
  /** 默认 v1，与 versions（v2+ 保存记录）一并展示并支持回撤 */
  initialVersion?: Version | null;
  /** 为 false 时不渲染版本 UI（业务仍走服务端持久化） */
  enabled?: boolean;
}

export default function VersionControl({
  versions,
  currentVersion,
  onRestore,
  onSaveVersion,
  moduleName,
  initialVersion = null,
  enabled = true,
}: VersionControlProps) {
  const historyVersions = useMemo(() => {
    const saved = versions.filter((v) => v.versionNumber !== 1);
    if (initialVersion) {
      return [initialVersion, ...saved].sort((a, b) => a.versionNumber - b.versionNumber);
    }
    return versions;
  }, [initialVersion, versions]);

  const [isOpen, setIsOpen] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSummary, setSaveSummary] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);
  const [hoveredVersionId, setHoveredVersionId] = useState<string | null>(null);

  const handleSave = () => {
    if (!saveSummary.trim()) return;
    onSaveVersion(saveSummary);
    setSaveSummary('');
    setShowSaveModal(false);
  };

  const handleRestore = (versionId: string) => {
    onRestore(versionId);
    setShowRestoreConfirm(null);
    setIsOpen(false);
  };

  const restoreTargetVersion = historyVersions.find(v => v.id === showRestoreConfirm);

  if (!enabled) return null;

  return (
    <>
      {/* 版本控制工具栏 */}
      {/* <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <i className="ri-git-branch-line text-white text-sm"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">当前版本</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                  v{currentVersion}
                </span>
              </div>
              <p className="text-xs text-gray-500">{moduleName}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200"></div>
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-history-line"></i>
            历史版本 ({historyVersions.length})
          </button>
        </div>
        <button
          onClick={() => setShowSaveModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
        >
          <i className="ri-save-line"></i>
          保存当前版本
        </button>
      </div> */}

      {/* 历史版本侧边抽屉 */}
      {isOpen && (
        <AppModalPortal open={true} onMaskClick={() => setIsOpen(false)} zIndex={50} placement="right">
          <div
            className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900">版本历史</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
              <p className="text-sm text-gray-500">共 {historyVersions.length} 个历史版本，点击版本卡片可回撤</p>
            </div>

            <div className="flex-1 overflow-y-auto py-1 px-6">
              {historyVersions.length === 0 ? (
                <div className="text-center py-12">
                  <i className="ri-history-line text-4xl text-gray-300 block mb-3"></i>
                  <p className="text-sm text-gray-500">暂无历史版本</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyVersions.map((version) => {
                    const isCurrent = version.versionNumber === currentVersion;
                    const isHovered = hoveredVersionId === version.id;
                    return (
                      <div
                        key={version.id}
                        onClick={() => !isCurrent && setShowRestoreConfirm(version.id)}
                        onMouseEnter={() => setHoveredVersionId(version.id)}
                        onMouseLeave={() => setHoveredVersionId(null)}
                        className={`border-2 rounded-xl p-4 transition-all select-none ${
                          isCurrent
                            ? 'border-indigo-300 bg-indigo-50 cursor-default'
                            : isHovered
                            ? 'border-indigo-400 bg-indigo-50 shadow-md cursor-pointer scale-[1.01]'
                            : 'border-gray-200 bg-white hover:border-indigo-200 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg">
                              v{version.versionNumber}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                当前版本
                              </span>
                            )}
                          </div>
                          {!isCurrent && (
                            <div className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                              isHovered
                                ? 'bg-indigo-500 text-white'
                                : 'bg-indigo-100 text-indigo-600'
                            }`}>
                              <i className="ri-arrow-go-back-line"></i>
                              点击回撤
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 font-medium mb-2">{version.summary}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <i className="ri-user-line"></i>
                            {version.operator}
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="ri-time-line"></i>
                            {version.timestamp}
                          </span>
                        </div>
                        {!isCurrent && isHovered && (
                          <div className="mt-2 pt-2 border-t border-indigo-100">
                            <p className="text-xs text-indigo-500 flex items-center gap-1">
                              <i className="ri-information-line"></i>
                              点击此卡片将回撤到该版本
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </AppModalPortal>
      )}

      {/* 保存版本弹窗 */}
      {showSaveModal && (
        <AppModalPortal open={true} onMaskClick={() => setShowSaveModal(false)} zIndex={50}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">保存当前版本</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                版本说明 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={saveSummary}
                onChange={(e) => setSaveSummary(e.target.value)}
                placeholder="简要描述本次修改的内容..."
                rows={3}
                maxLength={200}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{saveSummary.length}/200</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!saveSummary.trim()}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-xl hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <i className="ri-save-line mr-1.5"></i>
                保存版本
              </button>
            </div>
          </div>
        </AppModalPortal>
      )}

      {/* 回撤确认弹窗 */}
      {showRestoreConfirm && (
        <AppModalPortal open={true} onMaskClick={() => setShowRestoreConfirm(null)} zIndex={60}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-error-warning-line text-amber-600 text-2xl"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">确认回撤版本</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  回撤到 <span className="font-bold text-indigo-600">v{restoreTargetVersion?.versionNumber}</span>
                  {restoreTargetVersion && <span className="text-gray-400"> · {restoreTargetVersion.summary}</span>}
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <p className="text-sm text-amber-800">
                回撤后，当前版本的内容将被替换为所选历史版本的内容。此操作不可撤销，是否继续？
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRestoreConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                取消
              </button>
              <button
                onClick={() => handleRestore(showRestoreConfirm)}
                className="flex-1 px-4 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-arrow-go-back-line mr-1.5"></i>
                确认回撤
              </button>
            </div>
          </div>
        </AppModalPortal>
      )}
    </>
  );
}
