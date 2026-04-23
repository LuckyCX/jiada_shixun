import { useState } from 'react';
import { mockClasses, mockStudents, mockTeachers } from './mockData';
import { Class, Student, Teacher } from './types';
import CreateClassModal from './CreateClassModal';
import EditClassModal from './EditClassModal';
import DeleteClassModal from './DeleteClassModal';
import ClassDetailModal from './ClassDetailModal';

export default function ClassManagement() {
  const [classes, setClasses] = useState<Class[]>(mockClasses);
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [teachers] = useState<Teacher[]>(mockTeachers);
  
  const [searchKeyword, setSearchKeyword] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 筛选班级
  const filteredClasses = classes.filter(cls => {
    const matchSearch = cls.name.includes(searchKeyword) || cls.teacher.name.includes(searchKeyword);
    const matchDepartment = !departmentFilter || cls.department === departmentFilter;
    const matchStatus = !statusFilter || cls.status === statusFilter;
    return matchSearch && matchDepartment && matchStatus;
  });

  // 统计数据
  const totalClasses = classes.length;
  const activeClasses = classes.filter(c => c.status === 'active').length;
  const totalStudents = students.filter(s => s.classId).length;
  const totalTeachers = new Set(classes.map(c => c.teacher.id)).size;

  const departments = Array.from(new Set(classes.map(c => c.department)));

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
    const teacher = teachers.find(t => t.id === data.teacherId);
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

  const handleEditClass = (data: {
    name: string;
    department: string;
    academicYear: string;
    semester: string;
    teacherId: string;
  }) => {
    if (!selectedClass) return;

    const teacher = teachers.find(t => t.id === data.teacherId);
    if (!teacher) return;

    setClasses(classes.map(cls => 
      cls.id === selectedClass.id
        ? {
            ...cls,
            name: data.name,
            department: data.department,
            academicYear: data.academicYear,
            semester: data.semester,
            teacher: {
              id: teacher.id,
              name: teacher.name,
              email: teacher.email
            }
          }
        : cls
    ));

    setShowEditModal(false);
    setSelectedClass(null);
    showNotification('班级信息已更新');
  };

  const handleDeleteClass = () => {
    if (!selectedClass) return;

    // 移除该班级的所有学生关联
    setStudents(students.map(s => 
      s.classId === selectedClass.id ? { ...s, classId: undefined } : s
    ));

    setClasses(classes.filter(cls => cls.id !== selectedClass.id));
    setShowDeleteModal(false);
    setSelectedClass(null);
    showNotification('班级已删除');
  };

  const handleAddStudent = (studentId: string) => {
    if (!selectedClass) return;

    setStudents(students.map(s => 
      s.id === studentId ? { ...s, classId: selectedClass.id } : s
    ));

    setClasses(classes.map(cls => 
      cls.id === selectedClass.id
        ? { ...cls, studentCount: cls.studentCount + 1 }
        : cls
    ));

    showNotification('学生已添加到班级');
  };

  const handleRemoveStudent = (studentId: string) => {
    if (!selectedClass) return;

    setStudents(students.map(s => 
      s.id === studentId ? { ...s, classId: undefined } : s
    ));

    setClasses(classes.map(cls => 
      cls.id === selectedClass.id
        ? { ...cls, studentCount: Math.max(0, cls.studentCount - 1) }
        : cls
    ));

    showNotification('学生已从班级中移除');
  };

  const handleChangeTeacher = (teacherId: string) => {
    if (!selectedClass) return;

    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    setClasses(classes.map(cls => 
      cls.id === selectedClass.id
        ? {
            ...cls,
            teacher: {
              id: teacher.id,
              name: teacher.name,
              email: teacher.email
            }
          }
        : cls
    ));

    setSelectedClass({
      ...selectedClass,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email
      }
    });

    showNotification('教师已更换');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">班级总数</div>
              <div className="text-3xl font-bold text-gray-900">{totalClasses}</div>
            </div>
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
              <i className="ri-team-line text-2xl text-teal-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">进行中班级</div>
              <div className="text-3xl font-bold text-gray-900">{activeClasses}</div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <i className="ri-play-circle-line text-2xl text-green-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">学生总人数</div>
              <div className="text-3xl font-bold text-gray-900">{totalStudents}</div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <i className="ri-user-line text-2xl text-blue-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">教师总人数</div>
              <div className="text-3xl font-bold text-gray-900">{totalTeachers}</div>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <i className="ri-user-star-line text-2xl text-orange-600"></i>
            </div>
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索班级名称或教师姓名"
              className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">全部院系</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">全部状态</option>
            <option value="active">进行中</option>
            <option value="ended">已结束</option>
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 whitespace-nowrap"
          >
            <i className="ri-add-line mr-1"></i>
            创建班级
          </button>
        </div>
      </div>

      {/* 班级列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">班级名称</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">所属院系</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">指派教师</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">学生人数</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">创建时间</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">状态</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredClasses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  暂无班级数据
                </td>
              </tr>
            ) : (
              filteredClasses.map(cls => (
                <tr key={cls.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{cls.name}</div>
                    <div className="text-sm text-gray-600">{cls.academicYear} {cls.semester}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{cls.department}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{cls.teacher.name}</div>
                    <div className="text-sm text-gray-600">{cls.teacher.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-teal-600 font-semibold">{cls.studentCount}</span>
                    <span className="text-gray-600"> 人</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{cls.createdAt}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      cls.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {cls.status === 'active' ? '进行中' : '已结束'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedClass(cls);
                          setShowDetailModal(true);
                        }}
                        className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg"
                        title="查看详情"
                      >
                        <i className="ri-eye-line text-lg"></i>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedClass(cls);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="编辑"
                      >
                        <i className="ri-edit-line text-lg"></i>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedClass(cls);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="删除"
                      >
                        <i className="ri-delete-bin-line text-lg"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 弹窗 */}
      <CreateClassModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateClass}
        teachers={teachers}
      />

      <EditClassModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedClass(null);
        }}
        onConfirm={handleEditClass}
        classData={selectedClass}
        teachers={teachers}
      />

      <DeleteClassModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedClass(null);
        }}
        onConfirm={handleDeleteClass}
        classData={selectedClass}
      />

      <ClassDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedClass(null);
        }}
        classData={selectedClass}
        students={students}
        allStudents={students}
        teachers={teachers}
        onAddStudent={handleAddStudent}
        onRemoveStudent={handleRemoveStudent}
        onChangeTeacher={handleChangeTeacher}
      />

      {/* 通知提示 */}
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