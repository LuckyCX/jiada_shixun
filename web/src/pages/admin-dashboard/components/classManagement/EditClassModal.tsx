import { useEffect, useState } from 'react';
import { Button, Form, Input, Select } from 'antd';
import AppModalPortal from '../../../../components/AppModalPortal';
import { Class } from './types';
import { useCollegeDictOptions } from '../userManagement/useCollegeDictOptions';
import { useMajorOptions } from '../userManagement/useMajorOptions';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { name: string; code: string; collegeId: string; majorId: string }) => void | Promise<void>;
  classData: Class | null;
}

export default function EditClassModal({ isOpen, onClose, onConfirm, classData }: EditClassModalProps) {
  const [form] = Form.useForm<{ name: string; code: string; collegeId: string; majorId: string }>();
  const [submitting, setSubmitting] = useState(false);
  const collegeId = Form.useWatch('collegeId', form);

  const { options: collegeOptions, loading: collegeLoading } = useCollegeDictOptions(isOpen && !!classData);
  const { options: majorOptions, loading: majorLoading } = useMajorOptions(isOpen && !!classData, collegeId);

  useEffect(() => {
    if (classData) {
      form.setFieldsValue({
        name: classData.name,
        code: classData.code,
        collegeId: classData.collegeId,
        majorId: classData.majorId || undefined,
      });
    }
  }, [classData, form]);

  useEffect(() => {
    if (!classData || !collegeId || collegeId === classData.collegeId) return;
    form.setFieldValue('majorId', undefined);
  }, [collegeId, classData, form]);

  if (!isOpen || !classData) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await Promise.resolve(onConfirm(values));
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in (e as object)) return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModalPortal open onMaskClick={onClose} zIndex={1100}>
      <div
        className="bg-white rounded-xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">编辑班级</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        <Form form={form} layout="vertical" className="space-y-1" requiredMark>
          <Form.Item name="name" label="班级名称" rules={[{ required: true, message: '请输入班级名称' }]}>
            <Input placeholder="班级名称" />
          </Form.Item>
          <Form.Item name="collegeId" label="所属学院" rules={[{ required: true, message: '请选择学院' }]}>
            <Select loading={collegeLoading} options={collegeOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="majorId" label="所属专业" rules={[{ required: true, message: '请选择专业' }]}>
            <Select
              loading={majorLoading} 
              options={majorOptions}
              showSearch
              optionFilterProp="label"
              disabled={!collegeId}
              placeholder={collegeId ? '请选择专业' : '请先选择学院'}
            />
          </Form.Item>
        </Form>

        <div className="flex gap-3 mt-6">
          <Button block size="large" onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            block
            size="large"
            className="!bg-teal-600"
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            保存
          </Button>
        </div>
      </div>
    </AppModalPortal>
  );
}
