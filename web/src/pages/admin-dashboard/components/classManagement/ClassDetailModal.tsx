import { Class, Student } from './types';
import { usePublicDictOptions } from './usePublicDictOptions';

interface ClassDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  classData: Class | null;
  collegeName: string;
  enrolledStudents: Student[];
}

export default function ClassDetailModal({
  isOpen,
  onClose,
  classData,
  collegeName,
  enrolledStudents,
}: ClassDetailModalProps) {
  const { labelByValue: statusLabel } = usePublicDictOptions('class_status', isOpen);
  const { labelByValue: semesterLabel } = usePublicDictOptions('semester', isOpen);

  if (!isOpen || !classData) return null;

  const statusBadgeClass =
    classData.status === '0'
      ? 'bg-amber-100 text-amber-800'
      : classData.status === '1'
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-700';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">班级详情</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">班级名称</div>
                <div className="text-lg font-semibold text-gray-900">{classData.name}</div>
                <div className="text-sm text-gray-500 mt-1 font-mono">编码 {classData.code}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">所属学院</div>
                <div className="text-lg font-semibold text-gray-900">{collegeName}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">学年学期</div>
                <div className="text-lg font-semibold text-gray-900">
                  {classData.academicYear} {semesterLabel(classData.semester)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">班级状态</div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass}`}>
                  {statusLabel(classData.status)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              班级学生 <span className="text-teal-600">({enrolledStudents.length})</span>
            </h4>
            <p className="text-sm text-gray-500 mb-4">学生名单来自系统用户；入班可通过用户管理分配或批量导入。</p>
            <div className="space-y-2">
              {enrolledStudents.length === 0 ? (
                <div className="text-center text-gray-500 py-8">该班级暂无学生</div>
              ) : (
                enrolledStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                        <i className="ri-user-line text-lg text-teal-600"></i>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{student.name}</div>
                        <div className="text-sm text-gray-600">
                          {student.studentId} · {student.email}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {student.status === 'active' ? '正常' : '停用'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 whitespace-nowrap"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
