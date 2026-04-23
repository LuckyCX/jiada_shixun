import { useState } from 'react';
import { Teacher } from './types';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    department: string;
    academicYear: string;
    semester: string;
    teacherId: string;
  }) => void;
  teachers: Teacher[];
}

export default function CreateClassModal({ isOpen, onClose, onConfirm, teachers }: CreateClassModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    department: '计算机学院',
    academicYear: '2023-2024',
    semester: '春季学期',
    teacherId: teachers[0]?.id || ''
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('请输入班级名称');
      return;
    }
    onConfirm(formData);
    setFormData({
      name: '',
      department: '计算机学院',
      academicYear: '2023-2024',
      semester: '春季学期',
      teacherId: teachers[0]?.id || ''
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">创建班级</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">班级名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：创新创业实训A班"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">所属院系</label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="计算机学院">计算机学院</option>
              <option value="经济管理学院">经济管理学院</option>
              <option value="设计学院">设计学院</option>
              <option value="软件学院">软件学院</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">学年</label>
              <select
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="2023-2024">2023-2024</option>
                <option value="2024-2025">2024-2025</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">学期</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="春季学期">春季学期</option>
                <option value="秋季学期">秋季学期</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">指派教师</label>
            <select
              value={formData.teacherId}
              onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} - {teacher.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium cursor-pointer whitespace-nowrap"
          >
            创建班级
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium cursor-pointer whitespace-nowrap"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}