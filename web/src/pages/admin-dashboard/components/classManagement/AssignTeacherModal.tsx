import { useEffect, useState } from 'react';
import { Form, Modal, Select } from 'antd';
import type { Class, Teacher } from './types';
import { useCollegeDictOptions } from '../userManagement/useCollegeDictOptions';

interface AssignTeacherModalProps {
  open: boolean;
  classData: Class | null;
  teachers: Teacher[];
  teachersLoading: boolean;
  onClose: () => void;
  onSubmit: (teacherId: string) => void | Promise<void>;
}

export default function AssignTeacherModal({
  open,
  classData,
  teachers,
  teachersLoading,
  onClose,
  onSubmit,
}: AssignTeacherModalProps) {
  const [form] = Form.useForm<{ teacherId: string }>();
  const [submitting, setSubmitting] = useState(false);
  const { labelByValue: deptLabel } = useCollegeDictOptions(open);

  useEffect(() => {
    if (open && classData) {
      form.setFieldsValue({
        teacherId: classData.teacher.id && classData.teacher.id !== '' ? classData.teacher.id : undefined,
      });
    }
  }, [open, classData, form]);

  const handleOk = async () => {
    try {
      const { teacherId } = await form.validateFields();
      setSubmitting(true);
      await Promise.resolve(onSubmit(teacherId));
      form.resetFields();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in (e as object)) return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={classData ? `指派教师 · ${classData.name}` : '指派教师'}
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      width={480}
      okButtonProps={{ className: '!bg-teal-600' }}
    >
      <Form form={form} layout="vertical" className="mt-2" requiredMark>
        <Form.Item name="teacherId" label="任课教师" rules={[{ required: true, message: '请选择教师' }]}>
          <Select
            placeholder="请选择教师"
            loading={teachersLoading}
            showSearch
            optionFilterProp="label"
            options={teachers.map((t) => ({
              value: t.id,
              label: `${t.name} · ${deptLabel(t.department)}${t.email ? ` · ${t.email}` : ''}`,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
