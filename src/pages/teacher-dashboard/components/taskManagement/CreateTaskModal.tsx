import { useState } from 'react';
import { TaskFormData } from './types';
import { moduleOptions, allTeams } from './mockData';

interface CreateTaskModalProps {
  onClose: () => void;
  onSubmit: (data: TaskFormData, isDraft: boolean) => void;
}

export default function CreateTaskModal({ onClose, onSubmit }: CreateTaskModalProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    module: moduleOptions[0],
    deadline: '',
    attachments: [],
    scope: 'all',
    targetTeams: [],
  });

  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachmentFiles([...attachmentFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachmentFiles(attachmentFiles.filter((_, i) => i !== index));
  };

  const handleTeamToggle = (team: string) => {
    if (formData.targetTeams.includes(team)) {
      setFormData({
        ...formData,
        targetTeams: formData.targetTeams.filter(t => t !== team),
      });
    } else {
      setFormData({
        ...formData,
        targetTeams: [...formData.targetTeams, team],
      });
    }
  };

  const handleSubmit = (isDraft: boolean) => {
    if (!formData.title.trim()) {
      alert('请输入任务标题');
      return;
    }
    if (!formData.description.trim()) {
      alert('请输入任务描述');
      return;
    }
    if (!formData.deadline) {
      alert('请选择截止时间');
      return;
    }
    if (formData.scope === 'specific' && formData.targetTeams.length === 0) {
      alert('请选择目标团队');
      return;
    }

    onSubmit({ ...formData, attachments: attachmentFiles }, isDraft);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <i className="ri-file-add-line text-white text-lg"></i>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">发布新任务</h3>
              <p className="text-xs text-gray-400">向班级或指定团队发布实训任务</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer hover:bg-gray-100 rounded-lg"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 任务标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              任务标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例如：完成市场调研报告"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* 所属模块 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              所属模块 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.module}
              onChange={(e) => setFormData({ ...formData, module: e.target.value })}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white cursor-pointer"
            >
              {moduleOptions.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>

          {/* 任务描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              任务描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="详细描述任务要求、提交内容、评分标准等..."
              rows={6}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
          </div>

          {/* 截止时间 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              截止时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            />
          </div>

          {/* 附件上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              附件上传
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-teal-500 transition-colors">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                  <i className="ri-upload-cloud-line text-teal-500 text-2xl"></i>
                </div>
                <div>
                  <span className="text-sm font-medium text-teal-600">点击上传文件</span>
                  <p className="text-xs text-gray-400 mt-1">支持 PDF、Word、Excel、PPT 等格式</p>
                </div>
              </label>
            </div>

            {/* 已上传文件列表 */}
            {attachmentFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachmentFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="ri-file-line text-teal-600 text-sm"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                    >
                      <i className="ri-close-line text-base"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 发布范围 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              发布范围 <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
              <button
                onClick={() => setFormData({ ...formData, scope: 'all', targetTeams: [] })}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  formData.scope === 'all'
                    ? 'bg-white text-teal-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="ri-group-line mr-1.5"></i>全班发布
              </button>
              <button
                onClick={() => setFormData({ ...formData, scope: 'specific' })}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  formData.scope === 'specific'
                    ? 'bg-white text-teal-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="ri-user-star-line mr-1.5"></i>指定团队
              </button>
            </div>

            {/* 指定团队选择 */}
            {formData.scope === 'specific' && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 mb-3">选择目标团队（可多选）</p>
                <div className="grid grid-cols-2 gap-2">
                  {allTeams.map((team) => (
                    <button
                      key={team}
                      onClick={() => handleTeamToggle(team)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all cursor-pointer text-left ${
                        formData.targetTeams.includes(team)
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <i
                        className={`${
                          formData.targetTeams.includes(team)
                            ? 'ri-checkbox-circle-fill text-teal-500'
                            : 'ri-checkbox-blank-circle-line text-gray-400'
                        } mr-2`}
                      ></i>
                      {team}
                    </button>
                  ))}
                </div>
                {formData.targetTeams.length > 0 && (
                  <p className="text-xs text-teal-600 mt-3">
                    已选择 {formData.targetTeams.length} 个团队
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => handleSubmit(true)}
              className="flex-1 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-draft-line mr-1.5"></i>保存草稿
            </button>
            <button
              onClick={() => handleSubmit(false)}
              className="flex-1 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer"
            >
              <i className="ri-send-plane-line mr-1.5"></i>立即发布
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}