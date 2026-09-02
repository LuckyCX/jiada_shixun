import { useEffect } from 'react';
import { Form, Input, Modal, Select, message } from 'antd';
import { createAdminMajor } from '../collegeApi';
import { useCollegeDictOptions } from '../userManagement/useCollegeDictOptions';

export type CreateMajorQuickResult = {
  id: string;
  name: string;
  collegeId: string;
};

interface CreateMajorQuickModalProps {
  open: boolean;
  /** 创建班级弹窗里已选的学院，作为默认值 */
  defaultCollegeId?: string;
  onClose: () => void;
  onCreated: (major: CreateMajorQuickResult) => void;
}

/** 班级管理内快捷新建专业（不离开创建班级流程） */
export default function CreateMajorQuickModal({
  open,
  defaultCollegeId,
  onClose,
  onCreated,
}: CreateMajorQuickModalProps) {
  const [form] = Form.useForm<{ collegeId: string; name: string }>();
  const { options: collegeOptions, loading: collegeLoading } = useCollegeDictOptions(open);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        collegeId: defaultCollegeId || undefined,
        name: '',
      });
    }
  }, [open, defaultCollegeId, form]);

  const handleOk = async () => {
    try {
      const { collegeId, name } = await form.validateFields();
      const row = await createAdminMajor(collegeId, name.trim());
      message.success('专业已创建');
      onCreated({ id: row.id, name: row.name, collegeId: row.collegeId });
      onClose();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in (e as object)) return;
      message.error(e instanceof Error ? e.message : '创建失败');
    }
  };

  return (
    <Modal
      title="新建专业"
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={480}
      okButtonProps={{ className: '!bg-teal-600' }}
      zIndex={1100}
    >
      <Form form={form} layout="vertical" className="mt-2" requiredMark>
        <Form.Item name="collegeId" label="所属学院" rules={[{ required: true, message: '请选择学院' }]}>
          <Select
            placeholder="请选择学院"
            loading={collegeLoading}
            options={collegeOptions}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          name="name"
          label="专业名称"
          rules={[
            { required: true, message: '请输入专业名称' },
            { whitespace: true, message: '专业名称不能为空' },
          ]}
        >
          <Input placeholder="例如：日语、学前教育" maxLength={128} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
