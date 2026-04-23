import { useState, useEffect } from 'react';
import { Class, Teacher } from './types';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    department: string;
    academicYear: string;
    semester: string;
    teacherId: string;
  }) => void;
  classData: Class | null;
  teachers: Teacher[];
}

export default function EditClassModal({ isOpen, onClose, onConfirm, classData, teachers }: EditClassModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    academicYear: '',
    semester: '',
    teacherId: ''
  });

  useEffect(() => {
    if (classData) {
      setFormData({
        name: classData.name,
        department: classData.department,
        academicYear: classData.academicYear,
        semester: classData.semester,
        teacherId: classData.teacher.id
      });
    }
  }, [classData]);

  if (!isOpen || !classData) return null;

  const handleSubmit = () => {
    if (!formData.name || !formData.department || !formData.academicYear || !formData.semester || !formData.teacherId) {
      alert('请填写完整信息');
      return;
    }
    onConfirm(formData);
  };

  const departments = ['计算机学院', '经济管理学院', '设计学院', '软件学院', '信息学院', '商学院'];
  const semesters = ['春季学期', '秋季学期'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">编辑班级</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">所属院系</label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">请选择院系</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
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
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">请选择学期</option>
                {semesters.map(sem => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">指派教师</label>
            <select
              value={formData.teacherId}
              onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">请选择教师</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} - {teacher.department}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
          >
            取消
          </button>
          <button
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