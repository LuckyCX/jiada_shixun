import { useEffect } from 'react';
import { Form, Input, message, Modal, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { createTeacherPersonalClass } from '../../teacherPortalApi';
import type { TeacherPersonalClassRow, TeacherProfile } from '../../teacherPortalApi';

interface CreateClassModalProps {
  open: boolean;
  onClose: () => void;
  profile: TeacherProfile | null;
  onCreated: (created: TeacherPersonalClassRow) => void;
}

export default function CreateClassModal({ open, onClose, profile, onCreated }: CreateClassModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ name: string }>();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ name: '' });
  }, [open, form]);

  const collegeLabel = profile?.collegeName?.trim() ? profile.collegeName.trim() : t('teacher_class.create.collegeunset');
  const majorLabel = profile?.majorName?.trim() ? profile.majorName.trim() : t('teacher_class.create.majorunset');

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      const created = await createTeacherPersonalClass({
        name: v.name.trim(),
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
      destroyOnHidden
      width={480}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            {t('teacher_class.create.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleOk()}
            className="px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer"
          >
            {t('teacher_class.create.ok')}
          </button>
        </div>
      }
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          label={t('teacher_class.create.name_label')}
          name="name"
          rules={[{ required: true, message: t('teacher_class.create.name_required') }]}
        >
          <Input placeholder={t('teacher_class.create.name_placeholder')} maxLength={128} showCount />
        </Form.Item>

        <Form.Item label={t('teacher_class.create.college_label')} required={false}>
          <Typography.Text type={profile?.collegeName?.trim() ? undefined : 'secondary'}>{collegeLabel}</Typography.Text>
        </Form.Item>

        {/* <Form.Item label={t('teacher_class.create.major_label')} required={false}>
          <Typography.Text type={profile?.majorName?.trim() ? undefined : 'secondary'}>{majorLabel}</Typography.Text>
        </Form.Item> */}
      </Form>
    </Modal>
  );
}
