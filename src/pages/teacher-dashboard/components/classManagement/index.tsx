import { useState } from 'react';
import { mockClasses, mockStudents, mockTeachers } from './mockData';
import { Class, Student } from './types';
import CreateClassModal from './CreateClassModal';
import BatchImportModal from './BatchImportModal';

export default function ClassManagement() {
  const [classes, setClasses] = useState<Class[]>(mockClasses);
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreateClass = (data: {
    name: string;
    department: string;
    academicYear: string;
    semester: string;
    teacherId: string;
  }) => {
    const teacher = mockTeachers.find(t => t.id === data.teacherId);
    if (!teacher) return;

    const newClass: Class = {
      id: `class-${Date.now()}`,
      name: data.name,
      department: data.department,
      academicYear: data.academicYear,
      semester: data.semester,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email
      },
      studentCount: 0,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0]
    };

    setClasses([...classes, newClass]);
    setShowCreateModal(false);
    showNotification('班级创建成功');
  };

  const handleBatchImport = async (file: File, classId: string): Promise<{ success: number; failed: number; errors: { row: number; reason: string }[] }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const successCount = Math.floor(Math.random() * 15) + 10;
        const failedCount = Math.floor(Math.random() * 3);

        const errors = Array.from({ length: failedCount }, (_, i) => ({
          row: i + 2,
          reason: ['邮箱格式错误', '学号重复', '必填字段缺失'][Math.floor(Math.random() * 3)],
        }));

        // 更新班级学生数
        setClasses(classes.map(cls => 
          cls.id === classId 
            ? { ...cls, studentCount: cls.studentCount + successCount }
            : cls
        ));

        resolve({
          success: successCount,
          failed: failedCount,
          errors,
        });

        showNotification(`成功导入 ${successCount} 名学生`);
      }, 2000);
    });
  };

  const handleDeleteClass = (classId: string) => {
    if (!confirm('确定要删除这个班级吗？班级内的学生将被移除。')) return;

    setStudents(students.map(s => 
      s.classId === classId ? { ...s, classId: undefined } : s
    ));

    setClasses(classes.filter(cls => cls.id !== classId));
    showNotification('班级已删除');
  };

  const handleRemoveStudent = (studentId: string, classId: string) => {
    if (!confirm('确定要将该学生从班级中移除吗？')) return;

    setStudents(students.map(s => 
      s.id === studentId ? { ...s, classId: undefined } : s
    ));

    setClasses(classes.map(cls => 
      cls.id === classId
        ? { ...cls, studentCount: Math.max(0, cls.studentCount - 1) }
        : cls
    ));

    showNotification('学生已移除');
  };

  const classStudents = selectedClass 
    ? students.filter(s => s.classId === selectedClass.id)
    : [];

  return (
    <div className="space-y-6">
      {/* 顶部统计 */}
      <div className="grid grid-cols-4 gap-5">
        {[
          { label: '班级总数', value: classes.length, icon: 'ri-team-line', color: 'from-teal-500 to-cyan-500' },
          { label: '进行中班级', value: classes.filter(c => c.status === 'active').length, icon: 'ri-play-circle-line', color: 'from-green-500 to-emerald-500' },
          { label: '学生总人数', value: students.filter(s => s.classId).length, icon: 'ri-user-line', color: 'from-blue-500 to-indigo-500' },
          { label: '平均班级人数', value: Math.round(students.filter(s => s.classId).length / classes.length) || 0, icon: 'ri-group-line', color: 'from-orange-500 to-amber-500' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <i className={`${card.icon} text-white text-base`}></i>
              </div>
              <span className="text-3xl font-bold text-gray-900">{card.value}</span>
            </div>
            <div className="text-sm font-medium text-gray-700">{card.label}</div>
          </div>
        ))}
      </div>

      {/* 操作栏 */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">班级管理</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            创建班级
          </button>
        </div>
      </div>

      {/* 班级列表 */}
      <div className="grid lg:grid-cols-2 gap-5">
        {classes.map(cls => (
          <div key={cls.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">{cls.name}</h3>
                  <p className="text-sm text-teal-100">{cls.academicYear} {cls.semester}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  cls.status === 'active' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                }`}>
                  {cls.status === 'active' ? '进行中' : '已结束'}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">所属院系</span>
                <span className="font-medium text-gray-900">{cls.department}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">指派教师</span>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{cls.teacher.name}</div>
                  <div className="text-xs text-gray-500">{cls.teacher.email}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">学生人数</span>
                <span className="text-lg font-bold text-teal-600">{cls.studentCount} 人</span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setSelectedClass(selectedClass?.id === cls.id ? null : cls)}
                  className="flex-1 px-3 py-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-eye-line mr-1"></i>
                  {selectedClass?.id === cls.id ? '收起' : '查看学生'}
                </button>
                <button
                  onClick={() => {
                    setSelectedClass(cls);
                    setShowImportModal(true);
                  }}
                  className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-upload-line mr-1"></i>
                  导入学生
                </button>
                <button
                  onClick={() => handleDeleteClass(cls.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>

            {/* 学生列表 */}
            {selectedClass?.id === cls.id && (
              <div className="border-t border-gray-200 bg-gray-50">
                <div className="px-5 py-3 border-b border-gray-200 bg-white">
                  <h4 className="text-sm font-bold text-gray-900">班级学生名单</h4>
                </div>
                {classStudents.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <i className="ri-user-line text-3xl text-gray-300 mb-2 block"></i>
                    <p className="text-sm text-gray-500">暂无学生，请导入学生名单</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-5 py-2 text-left text-xs font-semibold text-gray-600">姓名</th>
                          <th className="px-5 py-2 text-left text-xs font-semibold text-gray-600">学号</th>
                          <th className="px-5 py-2 text-left text-xs font-semibold text-gray-600">邮箱</th>
                          <th className="px-5 py-2 text-center text-xs font-semibold text-gray-600">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {classStudents.map(student => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                  {student.name.charAt(0)}
                                </div>
                                <span className="font-medium text-gray-900">{student.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-gray-600">{student.studentId}</td>
                            <td className="px-5 py-3 text-gray-600">{student.email}</td>
                            <td className="px-5 py-3 text-center">
                              <button
                                onClick={() => handleRemoveStudent(student.id, cls.id)}
                                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs cursor-pointer whitespace-nowrap"
                              >
                                移除
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 弹窗 */}
      <CreateClassModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateClass}
        teachers={mockTeachers}
      />

      {selectedClass && (
        <BatchImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleBatchImport}
          classId={selectedClass.id}
        />
      )}

      {/* 通知 */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className={`px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 ${
            notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white`}>
            <i className={`${notification.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} text-xl`}></i>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}