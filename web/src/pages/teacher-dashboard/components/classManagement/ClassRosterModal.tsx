import { Modal, Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import type { TeacherPersonalClassRow, TeacherRosterStudent } from '../../teacherPortalApi';

interface ClassRosterModalProps {
  open: boolean;
  classRow: TeacherPersonalClassRow | null;
  roster: TeacherRosterStudent[];
  loading: boolean;
  onClose: () => void;
  onRemove: (studentId: string, classId: string) => void;
}

export default function ClassRosterModal({
  open,
  classRow,
  roster,
  loading,
  onClose,
  onRemove,
}: ClassRosterModalProps) {
  const { t } = useTranslation();

  const columns: ColumnsType<TeacherRosterStudent> = [
    {
      title: t('teacher_class.page.th_name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {name?.[0] ?? '?'}
          </div>
          <span className="font-medium text-gray-900">{name}</span>
        </div>
      ),
    },
    {
      title: t('teacher_class.page.th_student_no'),
      dataIndex: 'studentNo',
      key: 'studentNo',
      render: (v: string) => v || t('dash'),
    },
    {
      title: t('teacher_class.page.th_email'),
      dataIndex: 'email',
      key: 'email',
      render: (v: string) => v || t('dash'),
    },
    {
      title: t('teacher_class.page.th_action'),
      key: 'action',
      width: 88,
      align: 'center',
      render: (_, row) =>
        classRow ? (
          <button
            type="button"
            onClick={() => onRemove(row.id, classRow.id)}
            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs cursor-pointer whitespace-nowrap"
          >
            {t('teacher_class.page.remove')}
          </button>
        ) : null,
    },
  ];

  const title =
    classRow != null
      ? `${t('teacher_class.page.roster_title')} — ${classRow.name}`
      : t('teacher_class.page.roster_title');

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={roster}
          pagination={roster.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
          locale={{ emptyText: t('teacher_class.page.roster_empty') }}
          size="middle"
        />
      </Spin>
    </Modal>
  );
}
