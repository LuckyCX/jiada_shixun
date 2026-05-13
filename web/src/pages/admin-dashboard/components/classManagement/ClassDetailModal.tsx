import { useState } from 'react';
import { Class, Student, Teacher } from './types';

interface ClassDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  classData: Class | null;
  students: Student[];
  allStudents: Student[];
  teachers: Teacher[];
  onAddStudent: (studentId: string) => void;
  onRemoveStudent: (studentId: string) => void;
  onChangeTeacher: (teacherId: string) => void;
}

export default function ClassDetailModal({
  isOpen,
  onClose,
  classData,
  students,
  allStudents,
  teachers,
  onAddStudent,
  onRemoveStudent,
  onChangeTeacher
}: ClassDetailModalProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showChangeTeacher, setShowChangeTeacher] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  if (!isOpen || !classData) return null;

  const classStudents = students.filter(s => s.classId === classData.id);
  const availableStudents = allStudents.filter(s => !s.classId);
  const filteredAvailableStudents = availableStudents.filter(s =>
    s.name.includes(searchKeyword) || s.studentId.includes(searchKeyword)
  );

  const handleChangeTeacher = () => {
    if (!selectedTeacherId) {
      alert('请选择教师');
      return;
    }
    onChangeTeacher(selectedTeacherId);
    setShowChangeTeacher(false);
    setSelectedTeacherId('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">班级详情</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* 班级基本信息 */}
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">班级名称</div>
                <div className="text-lg font-semibold text-gray-900">{classData.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">所属院系</div>
                <div className="text-lg font-semibold text-gray-900">{classData.department}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">学年学期</div>
                <div className="text-lg font-semibold text-gray-900">{classData.academicYear} {classData.semester}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">班级状态</div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  classData.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {classData.status === 'active' ? '进行中' : '已结束'}
                </span>
              </div>
            </div>
          </div>

          {/* 指派教师 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">指派教师</h4>
              <button
                onClick={() => {
                  setShowChangeTeacher(true);
                  setSelectedTeacherId(classData.teacher.id);
                }}
                className="px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg whitespace-nowrap"
              >
                <i className="ri-refresh-line mr-1"></i>
                更换教师
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                <i className="ri-user-line text-xl text-teal-600"></i>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{classData.teacher.name}</div>
                <div className="text-sm text-gray-600">{classData.teacher.email}</div>
              </div>
            </div>

            {showChangeTeacher && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">选择新教师</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 mb-3"
                >
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.department}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowChangeTeacher(false)}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleChangeTeacher}
                    className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 whitespace-nowrap"
                  >
                    确认更换
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 学生列表 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">
                班级学生 <span className="text-teal-600">({classStudents.length})</span>
              </h4>
              <button
                onClick={() => setShowAddStudent(!showAddStudent)}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 whitespace-nowrap"
              >
                <i className="ri-user-add-line mr-1"></i>
                添加学生
              </button>
            </div>

            {showAddStudent && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="搜索学生姓名或学号"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 mb-3"
                />
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {filteredAvailableStudents.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">暂无可添加的学生</div>
                  ) : (
                    filteredAvailableStudents.map(student => (
                      <div key={student.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                        <div>
                          <div className="font-medium text-gray-900">{student.name}</div>
                          <div className="text-sm text-gray-600">{student.studentId}</div>
                        </div>
                        <button
                          onClick={() => {
                            onAddStudent(student.id);
                            setSearchKeyword('');
                          }}
                          className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 whitespace-nowrap"
                        >
                          添加
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {classStudents.length === 0 ? (
                <div className="text-center text-gray-500 py-8">该班级暂无学生</div>
              ) : (
                classStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                        <i className="ri-user-line text-lg text-teal-600"></i>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{student.name}</div>
                        <div className="text-sm text-gray-600">{student.studentId} · {student.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {student.status === 'active' ? '正常' : '停用'}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`确定要将 ${student.name} 从班级中移除吗？`)) {
                            onRemoveStudent(student.id);
                          }
                        }}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg whitespace-nowrap"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          <button
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