import { useCallback, useEffect, useState } from 'react';
import { Modal, Spin, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePublicDictOptions } from '../../../admin-dashboard/components/classManagement/usePublicDictOptions';
import CreateClassModal from './CreateClassModal';
import AddStudentsTransferModal from './AddStudentsTransferModal';
import {
  type TeacherPersonalClassRow,
  type TeacherProfile,
  deleteTeacherPersonalClass,
  getTeacherProfile,
  listTeacherPersonalClasses,
} from '../../teacherPortalApi';

type ClassManagementProps = {
  onOpenClassStudents: (cls: TeacherPersonalClassRow) => void;
};

export default function ClassManagement({ onOpenClassStudents }: ClassManagementProps) {
  const { t } = useTranslation();
  const { labelByValue: semesterLabel } = usePublicDictOptions('semester', true);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [classes, setClasses] = useState<TeacherPersonalClassRow[]>([]);
  const [addStudentsClass, setAddStudentsClass] = useState<TeacherPersonalClassRow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, list] = await Promise.all([getTeacherProfile(), listTeacherPersonalClasses()]);
      setProfile(p);
      setClasses(list);
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('teacher_class.page.load_fail'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleDeleteClass = (cls: TeacherPersonalClassRow) => {
    Modal.confirm({
      title: t('teacher_class.confirm_delete_group_title'),
      content: t('teacher_class.confirm_delete_group_content'),
      okText: t('teacher_class.confirm_delete_ok'),
      okType: 'danger',
      cancelText: t('teacher_class.confirm_cancel'),
      onOk: async () => {
        try {
          await deleteTeacherPersonalClass(cls.id);
          message.success(t('teacher_class.delete_success'));
          if (addStudentsClass?.id === cls.id) {
            setAddStudentsClass(null);
            setShowAddStudentsModal(false);
          }
          await loadAll();
        } catch (e) {
          message.error(e instanceof Error ? e.message : t('teacher_class.delete_fail'));
        }
      },
    });
  };

  const totalStudentsInGroups = classes.reduce((acc, c) => acc + c.studentCount, 0);
  const avgPerClass =
    classes.length > 0 ? Math.round(totalStudentsInGroups / classes.length) : 0;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-4 gap-5">
        {[
          { label: t('teacher_class.page.stat_group_total'), value: classes.length, icon: 'ri-team-line', color: 'from-teal-500 to-cyan-500' },
          {
            label: t('teacher_class.page.stat_active'),
            value: classes.length,
            icon: 'ri-play-circle-line',
            color: 'from-green-500 to-emerald-500',
          },
          { label: t('teacher_class.page.stat_students'), value: totalStudentsInGroups, icon: 'ri-user-line', color: 'from-blue-500 to-indigo-500' },
          { label: t('teacher_class.page.stat_avg'), value: avgPerClass, icon: 'ri-group-line', color: 'from-orange-500 to-amber-500' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}
              >
                <i className={`${card.icon} text-white text-base`}></i>
              </div>
              <span className="text-3xl font-bold text-gray-900">{card.value}</span>
            </div>
            <div className="text-sm font-medium text-gray-700">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('teacher_class.page.panel_title')}</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            {t('teacher_class.page.create_group')}
          </button>
        </div>
      </div>

      <Spin spinning={loading}>
        <div className="grid lg:grid-cols-2 gap-5">
          {classes.length === 0 && !loading ? (
            <div className="col-span-2 bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-500 text-sm">
              {t('teacher_class.page.empty')}
            </div>
          ) : (
            classes.map((cls) => (
              <div
                key={cls.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all"
              >
                <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{cls.name}</h3>
                      <p className="text-sm text-teal-100">
                        {cls.academicYear} {semesterLabel(cls.semester)}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                      {t('teacher_class.page.badge')}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t('teacher_class.page.col_my_college')}</span>
                    <span className="font-medium text-gray-900 text-right">
                      {profile?.collegeName?.trim() || t('dash')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t('teacher_class.page.col_creator')}</span>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{profile?.realName?.trim() || t('teacher_class.page.creator_self')}</div>
                      <div className="text-xs text-gray-500">{profile?.email || ''}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t('teacher_class.page.col_students')}</span>
                    <span className="text-lg font-bold text-teal-600">
                      {cls.studentCount}
                      {t('teacher_class.page.suffix_people')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => onOpenClassStudents(cls)}
                      className="flex-1 px-3 py-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-eye-line mr-1"></i>
                      {t('teacher_class.page.view_students')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddStudentsClass(cls);
                        setShowAddStudentsModal(true);
                      }}
                      className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-user-add-line mr-1"></i>
                      {t('teacher_class.page.add_students')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClass(cls)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>


              </div>
            ))
          )}
        </div>
      </Spin>

      <CreateClassModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        profile={profile}
        onCreated={() => void loadAll()}
      />

      {addStudentsClass && (
        <AddStudentsTransferModal
          open={showAddStudentsModal}
          personalClassId={addStudentsClass.id}
          groupName={addStudentsClass.name}
          onClose={() => {
            setShowAddStudentsModal(false);
            setAddStudentsClass(null);
          }}
          onSaved={() => {
            void loadAll();
          }}
        />
      )}
    </div>
  );
}
