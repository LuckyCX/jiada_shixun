import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Input, Select, Space, message } from 'antd';
import { Class, Student } from './types';
import type { User } from '../userManagement/types';
import { useCollegeDictOptions } from '../userManagement/useCollegeDictOptions';
import { usePublicDictOptions } from './usePublicDictOptions';
import {
  createAdminClass,
  deleteAdminClass,
  fetchClassesList,
  updateAdminClass,
  type AdminClassListRow,
} from './classesApi';
import { fetchAdminUsers } from '../userManagement/adminUsersApi';
import CreateClassModal from './CreateClassModal';
import type { CreateClassFormValues } from './CreateClassModal';
import EditClassModal from './EditClassModal';
import DeleteClassModal from './DeleteClassModal';
import ClassDetailModal from './ClassDetailModal';

function mapClassRow(r: AdminClassListRow): Class {
  const cid = r.collegeId || '';
  const st = r.status === '0' || r.status === '1' || r.status === '2' ? r.status : '1';
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    collegeId: cid,
    department: cid,
    academicYear: r.academicYear,
    semester: r.semester,
    studentCount: r.studentCount,
    status: st,
    createdAt: r.createdAt,
  };
}

function userToStudent(u: User): Student {
  return {
    id: u.id,
    name: u.name,
    studentId: u.studentId || u.username || '',
    email: u.email || '',
    status: u.status,
    classId: u.classId,
  };
}

export default function ClassManagement() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [detailStudents, setDetailStudents] = useState<Student[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const { options: collegeOptions, loading: collegeLoading, labelByValue: deptLabel } = useCollegeDictOptions(true);
  const { options: classStatusOptions, loading: classStatusLoading, labelByValue: classStatusLabel } =
    usePublicDictOptions('class_status', true);
  const { labelByValue: semesterLabel } = usePublicDictOptions('semester', true);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [collegeIdFilter, setCollegeIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const cid = searchParams.get('collegeId');
    setCollegeIdFilter(cid && /^\d+$/.test(cid) ? cid : '');
  }, [searchParams]);

  const loadClasses = useCallback(async () => {
    setListLoading(true);
    try {
      const rows = await fetchClassesList(collegeIdFilter || undefined);
      setClasses(rows.map(mapClassRow));
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '加载班级失败');
      setClasses([]);
    } finally {
      setListLoading(false);
    }
  }, [collegeIdFilter]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const loadDetailStudents = useCallback(async (classId: string) => {
    try {
      const data = await fetchAdminUsers({
        page: 1,
        pageSize: 500,
        role: 'student',
        status: 'all',
        classId,
      });
      setDetailStudents(data.list.map(userToStudent));
    } catch {
      setDetailStudents([]);
    }
  }, []);

  const filteredClasses = classes.filter((cls) => {
    const matchSearch =
      cls.name.includes(searchKeyword) || cls.code.includes(searchKeyword);
    const matchCollege = !collegeIdFilter || cls.collegeId === collegeIdFilter;
    const matchStatus = !statusFilter || cls.status === statusFilter;
    return matchSearch && matchCollege && matchStatus;
  });

  const totalClasses = classes.length;
  const activeClasses = classes.filter((c) => c.status === '1').length;
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreateClass = async (data: CreateClassFormValues) => {
    try {
      await createAdminClass({
        collegeId: data.collegeId,
        name: data.name,
        academicYear: data.academicYear,
        semester: data.semester,
        status: '1',
      });
      setShowCreateModal(false);
      showNotification('班级创建成功');
      await loadClasses();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '创建失败');
      throw e;
    }
  };

  const handleEditClass = async (data: {
    name: string;
    code: string;
    collegeId: string;
    academicYear: string;
    semester: string;
  }) => {
    if (!selectedClass) return;
    try {
      await updateAdminClass(selectedClass.id, {
        name: data.name,
        code: data.code,
        collegeId: data.collegeId,
        academicYear: data.academicYear,
        semester: data.semester,
      });
      setShowEditModal(false);
      setSelectedClass(null);
      showNotification('班级信息已更新');
      await loadClasses();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '更新失败');
    }
  };

  const handleDeleteClass = async () => {
    if (!selectedClass) return;
    try {
      await deleteAdminClass(selectedClass.id);
      setShowDeleteModal(false);
      setSelectedClass(null);
      showNotification('班级已删除');
      await loadClasses();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const collegeNameForClass = (cls: Class | null) => {
    if (!cls) return '';
    return deptLabel(cls.collegeId);
  };

  return (
    <div className="min-h-0 bg-gray-50">
      <div className="grid grid-cols-3 gap-6 mb-6">
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
              <div className="text-sm text-gray-600 mb-1">在班学生（汇总）</div>
              <div className="text-3xl font-bold text-gray-900">{totalStudents}</div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <i className="ri-user-line text-2xl text-blue-600"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <Input
            allowClear
            className="flex-1 min-w-[200px] max-w-xl"
            prefix={<i className="ri-search-line text-gray-400" />}
            placeholder="搜索班级名称或编码"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <Space wrap>
            <Select
              allowClear
              placeholder="全部学院"
              className="min-w-[200px]"
              loading={collegeLoading}
              options={collegeOptions}
              value={collegeIdFilter || undefined}
              onChange={(v) => setCollegeIdFilter(v ?? '')}
              showSearch
              optionFilterProp="label"
            />
            <Select
              allowClear
              placeholder="全部状态"
              className="min-w-[180px]"
              loading={classStatusLoading}
              options={classStatusOptions}
              value={statusFilter || undefined}
              onChange={(v) => setStatusFilter(v ?? '')}
            />
          </Space>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 whitespace-nowrap ml-auto"
          >
            <i className="ri-add-line mr-1"></i>
            创建班级
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">班级名称</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">所属学院</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">学生人数</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">创建时间</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">状态</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {listLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  加载中…
                </td>
              </tr>
            ) : filteredClasses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  暂无班级数据
                </td>
              </tr>
            ) : (
              filteredClasses.map((cls) => (
                <tr key={cls.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{cls.name}</div>
                    <div className="text-sm text-gray-600">
                      {cls.academicYear} {semesterLabel(cls.semester)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-mono text-sm">{deptLabel(cls.collegeId)}</td>
                  <td className="px-6 py-4">
                    <span className="text-teal-600 font-semibold">{cls.studentCount}</span>
                    <span className="text-gray-600"> 人</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{cls.createdAt}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        cls.status === '0'
                          ? 'bg-amber-100 text-amber-800'
                          : cls.status === '1'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {classStatusLabel(cls.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Space size="small" wrap>
                      <Button
                        type="link"
                        className="!px-0"
                        onClick={() => {
                          const q = new URLSearchParams();
                          q.set('tab', 'class-students');
                          q.set('classId', cls.id);
                          q.set('collegeId', cls.collegeId);
                          q.set('className', encodeURIComponent(cls.name));
                          navigate(`/admin-dashboard?${q.toString()}`);
                        }}
                      >
                        学生管理
                      </Button>
                      <Button
                        type="link"
                        className="!px-0"
                        onClick={() => {
                          setSelectedClass(cls);
                          setShowEditModal(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        type="link"
                        danger
                        className="!px-0"
                        onClick={() => {
                          setSelectedClass(cls);
                          setShowDeleteModal(true);
                        }}
                      >
                        删除
                      </Button>
                    </Space>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateClassModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={(d) => void handleCreateClass(d)}
      />

      <EditClassModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedClass(null);
        }}
        onConfirm={(d) => void handleEditClass(d)}
        classData={selectedClass}
      />

      <DeleteClassModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedClass(null);
        }}
        onConfirm={() => void handleDeleteClass()}
        classData={selectedClass}
      />

      <ClassDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedClass(null);
        }}
        classData={selectedClass}
        collegeName={collegeNameForClass(selectedClass)}
        enrolledStudents={detailStudents}
      />

      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div
            className={`px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            } text-white`}
          >
            <i
              className={`${notification.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} text-xl`}
            ></i>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
