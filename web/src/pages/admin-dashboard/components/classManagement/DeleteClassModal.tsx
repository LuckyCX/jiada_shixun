import { Class } from './types';
import AppModalPortal from '../../../../components/AppModalPortal';

interface DeleteClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  classData: Class | null;
}

export default function DeleteClassModal({ isOpen, onClose, onConfirm, classData }: DeleteClassModalProps) {
  if (!isOpen || !classData) return null;

  const hasStudents = (classData.studentCount ?? 0) > 0;

  return (
    <AppModalPortal open onMaskClick={onClose} zIndex={1100}>
      <div
        className="bg-white rounded-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
          <i className="ri-error-warning-line text-2xl text-red-600"></i>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
          {hasStudents ? '无法删除班级' : '确认删除班级'}
        </h3>
        {hasStudents ? (
          <p className="text-gray-600 text-center mb-6">
            班级 <span className="font-semibold text-gray-900">"{classData.name}"</span> 仍有{' '}
            <span className="font-semibold text-red-600">{classData.studentCount}</span> 名学生。
            <br />
            请先移除学生，或直接修改班级名称；删除班级不会删除学生账号，重建后再导入会冲突。
          </p>
        ) : (
          <p className="text-gray-600 text-center mb-6">
            确定要删除班级 <span className="font-semibold text-gray-900">"{classData.name}"</span> 吗？
            <br />
            删除后无法恢复。
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
          >
            {hasStudents ? '知道了' : '取消'}
          </button>
          {!hasStudents && (
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap"
            >
              确认删除
            </button>
          )}
        </div>
      </div>
    </AppModalPortal>
  );
}