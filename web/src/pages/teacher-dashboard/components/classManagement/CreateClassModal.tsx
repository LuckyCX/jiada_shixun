import { useEffect } from 'react';
import { Form, Input, message, Modal, Select, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePublicDictOptions } from '../../../admin-dashboard/components/classManagement/usePublicDictOptions';
import { createTeacherPersonalClass } from '../../teacherPortalApi';
import type { TeacherPersonalClassRow, TeacherProfile } from '../../teacherPortalApi';

interface CreateClassModalProps {
  open: boolean;
  onClose: () => void;
  profile: TeacherProfile | null;
  onCreated: (created: TeacherPersonalClassRow) => void;
}

const ACADEMIC_YEARS = [
  { label: '2025-2026', value: '2025-2026' },
  { label: '2026-2027', value: '2026-2027' },
  { label: '2027-2028', value: '2027-2028' },
];

export default function CreateClassModal({ open, onClose, profile, onCreated }: CreateClassModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ name: string; academicYear: string; semester: string }>();
  const { options: semesterOptions, loading: semesterLoading } = usePublicDictOptions('semester', open);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: '',
      academicYear: ACADEMIC_YEARS[0]?.value ?? '',
    });
  }, [open, form]);

  useEffect(() => {
    if (!open || semesterOptions.length === 0) return;
    const cur = form.getFieldValue('semester');
    if (!cur || !semesterOptions.some((o) => o.value === cur)) {
      form.setFieldValue('semester', semesterOptions[0].value);
    }
  }, [open, semesterOptions, form]);

  const collegeLabel = profile?.collegeName?.trim() ? profile.collegeName.trim() : t('teacher_class.create.collegeunset');

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      const created = await createTeacherPersonalClass({
        name: v.name.trim(),
        academicYear: v.academicYear,
        semester: v.semester,
      });
      message.success(t('teacher_class.create.success'));
      onCreated(created);
      onClose();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : t('teacher_class.create.fail'));
    }
  };

  return (
    <Modal
      title={t('teacher_class.create.title')}
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      okText={t('teacher_class.create.ok')}
      cancelText={t('teacher_class.create.cancel')}
      destroyOnHidden
      width={480}
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          label={t('teacher_class.create.name_label')}
          name="name"
          rules={[{ required: true, message: t('teacher_class.create.name_required') }]}
        >
          <Input placeholder={t('teacher_class.create.name_placeholder')} maxLength={128} showCount />
        </Form.Item>

        <Form.Item label={t('teacher_class.create.college_label')}>
          <Typography.Text type={profile?.collegeName?.trim() ? undefined : 'secondary'}>{collegeLabel}</Typography.Text>
        </Form.Item>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item label={t('teacher_class.create.academic_year_label')} name="academicYear" rules={[{ required: true }]}>
            <Select options={ACADEMIC_YEARS} placeholder={t('teacher_class.create.academic_year_placeholder')} />
          </Form.Item>
          <Form.Item
            label={t('teacher_class.create.semester_label')}
            name="semester"
            rules={[{ required: true, message: t('teacher_class.create.semester_required') }]}
          >
            <Select
              placeholder={t('teacher_class.create.semester_placeholder')}
              loading={semesterLoading}
              options={semesterOptions}
              allowClear={false}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
