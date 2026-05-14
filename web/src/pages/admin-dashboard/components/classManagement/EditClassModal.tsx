import { useState, useEffect } from 'react';
import { Select } from 'antd';
import { Class } from './types';
import { useCollegeDictOptions } from '../userManagement/useCollegeDictOptions';
import { usePublicDictOptions } from './usePublicDictOptions';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    code: string;
    collegeId: string;
    academicYear: string;
    semester: string;
  }) => void | Promise<void>;
  classData: Class | null;
}

export default function EditClassModal({ isOpen, onClose, onConfirm, classData }: EditClassModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    collegeId: '',
    academicYear: '',
    semester: '',
  });

  const { options: collegeOptions, loading: collegeLoading } = useCollegeDictOptions(isOpen && !!classData);
  const { options: semesterOptions, loading: semesterLoading } = usePublicDictOptions('semester', isOpen && !!classData);

  useEffect(() => {
    if (classData) {
      setFormData({
        name: classData.name,
        code: classData.code,
        collegeId: classData.collegeId,
        academicYear: classData.academicYear,
        semester: classData.semester,
      });
    }
  }, [classData]);

  if (!isOpen || !classData) return null;

  const handleSubmit = () => {
    if (!formData.name || !formData.code || !formData.collegeId || !formData.academicYear || !formData.semester) {
      alert('请填写完整信息');
      return;
    }
    void onConfirm(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">编辑班级</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">班级名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：创新创业实践班（2024春）"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">所属学院</label>
            <Select
              className="w-full"
              placeholder="请选择学院"
              loading={collegeLoading}
              options={collegeOptions}
              value={formData.collegeId || undefined}
              onChange={(v) => setFormData({ ...formData, collegeId: v ?? '' })}
              showSearch
              optionFilterProp="label"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">学年</label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                placeholder="例如：2023-2024"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">学期</label>
              <Select
                className="w-full"
                placeholder="请选择学期"
                loading={semesterLoading}
                options={semesterOptions}
                value={formData.semester || undefined}
                onChange={(v) => setFormData({ ...formData, semester: v ?? '' })}
              />
            </div>
          </div>

          <p className="text-sm text-gray-500">任课教师请在列表中点击「指派教师」修改。</p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 whitespace-nowrap"
          >
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}
