import { useEffect, useState } from 'react';
import { Form, Input, Modal, Select } from 'antd';
import { useCollegeDictOptions } from '../userManagement/useCollegeDictOptions';
import { useMajorOptions } from '../userManagement/useMajorOptions';
import CreateMajorQuickModal from './CreateMajorQuickModal';

export type CreateClassFormValues = {
  name: string;
  collegeId: string;
  majorId: string;
};

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CreateClassFormValues) => void | Promise<void>;
}

export default function CreateClassModal({ isOpen, onClose, onConfirm }: CreateClassModalProps) {
  const [form] = Form.useForm<CreateClassFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [createMajorOpen, setCreateMajorOpen] = useState(false);
  const collegeId = Form.useWatch('collegeId', form);

  const { options: collegeOptions, loading: collegeLoading } = useCollegeDictOptions(isOpen);
  const { options: majorOptions, loading: majorLoading, reload: reloadMajors } = useMajorOptions(isOpen, collegeId);

  useEffect(() => {
    if (isOpen) {
      form.resetFields();
      setCreateMajorOpen(false);
    }
  }, [isOpen, form]);

  useEffect(() => {
    form.setFieldValue('majorId', undefined);
  }, [collegeId, form]);

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
    <>
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
        zIndex={1000}
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
            <Input placeholder="例如：2024级金融学1班" maxLength={128} />
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

          <Form.Item
            name="majorId"
            label={
              <span className="inline-flex flex-wrap items-center gap-x-2">
                <span>所属专业</span>
                <button
                  type="button"
                  className="text-teal-600 text-sm font-normal hover:text-teal-700 cursor-pointer border-0 bg-transparent p-0"
                  onClick={() => setCreateMajorOpen(true)}
                >
                  没有专业？点我创建
                </button>
              </span>
            }
            rules={[{ required: true, message: '请选择专业' }]}
          >
            <Select
              placeholder={collegeId ? '请选择专业' : '请先选择学院'}
              loading={majorLoading}
              options={majorOptions}
              showSearch
              optionFilterProp="label"
              disabled={!collegeId}
              allowClear={false}
            />
          </Form.Item>
        </Form>
      </Modal>

      <CreateMajorQuickModal
        open={createMajorOpen}
        defaultCollegeId={collegeId}
        onClose={() => setCreateMajorOpen(false)}
        onCreated={async (major) => {
          form.setFieldValue('collegeId', major.collegeId);
          await reloadMajors(major.collegeId);
          form.setFieldValue('majorId', major.id);
        }}
      />
    </>
  );
}
