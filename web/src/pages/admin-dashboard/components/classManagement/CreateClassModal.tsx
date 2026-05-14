import { useEffect, useState } from 'react';
import { Form, Input, Modal, Select } from 'antd';
import { useCollegeDictOptions } from '../userManagement/useCollegeDictOptions';
import { usePublicDictOptions } from './usePublicDictOptions';

export type CreateClassFormValues = {
  name: string;
  collegeId: string;
  academicYear: string;
  semester: string;
};

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CreateClassFormValues) => void | Promise<void>;
}

export default function CreateClassModal({ isOpen, onClose, onConfirm }: CreateClassModalProps) {
  const [form] = Form.useForm<CreateClassFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const { options: collegeOptions, loading: collegeLoading } = useCollegeDictOptions(isOpen);
  const { options: semesterOptions, loading: semesterLoading } = usePublicDictOptions('semester', isOpen);

  useEffect(() => {
    if (isOpen) {
      form.resetFields();
    }
  }, [isOpen, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await Promise.resolve(onConfirm(values));
      form.resetFields();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in (e as object)) return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="创建班级"
      open={isOpen}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
      okText="创建"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      width={520}
      okButtonProps={{ className: '!bg-teal-600' }}
    >
      <Form form={form} layout="vertical" className="mt-2" requiredMark>
        <Form.Item
          name="name"
          label="班级名称"
          rules={[
            { required: true, message: '请输入班级名称' },
            { whitespace: true, message: '班级名称不能为空' },
          ]}
        >
          <Input placeholder="例如：创新创业实践班（2024春）" maxLength={128} />
        </Form.Item>

        <Form.Item name="collegeId" label="所属学院" rules={[{ required: true, message: '请选择学院' }]}>
          <Select
            placeholder="请选择学院"
            loading={collegeLoading}
            options={collegeOptions}
            showSearch
            optionFilterProp="label"
            allowClear={false}
          />
        </Form.Item>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="academicYear"
            label="学年"
            rules={[
              { required: true, message: '请输入学年' },
              { whitespace: true, message: '学年不能为空' },
            ]}
          >
            <Input placeholder="例如：2023-2024" maxLength={32} />
          </Form.Item>

          <Form.Item name="semester" label="学期" rules={[{ required: true, message: '请选择学期' }]}>
            <Select placeholder="请选择学期" loading={semesterLoading} options={semesterOptions} allowClear={false} />
          </Form.Item>
        </div>

      </Form>
    </Modal>
  );
}
