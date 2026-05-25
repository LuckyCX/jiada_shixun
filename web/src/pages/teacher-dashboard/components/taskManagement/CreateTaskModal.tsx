import { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Radio,
  Checkbox,
  Upload,
  message,
  Spin,
} from 'antd';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import type { TaskFormValues } from './types';
import {
  TASK_MODULES,
  TASK_PRIORITY_OPTIONS,
  type PersonalClassTask,
  type TeamForTask,
  createPersonalClassTask,
  updatePersonalClassTask,
  getPersonalClassTask,
  listTeamsForTask,
  uploadTaskAttachment,
  deleteTaskAttachment,
} from '../../../../lib/personalClassTaskApi';

type Props = {
  open: boolean;
  classId: string;
  taskId?: string;
  onClose: () => void;
  onSuccess: () => void;
};

const MAX_ATTACH = 5;
const MAX_BYTES = 100 * 1024 * 1024;

export default function CreateTaskModal({ open, classId, taskId, onClose, onSuccess }: Props) {
  const [form] = Form.useForm<TaskFormValues>();
  const [teams, setTeams] = useState<TeamForTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<PersonalClassTask['attachments']>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const editMode = Boolean(taskId);

  const attachmentsEnabled = Form.useWatch('attachmentsEnabled', form);
  const scope = Form.useWatch('scope', form);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPendingFiles([]);
    Promise.all([
      listTeamsForTask(classId),
      editMode && taskId ? getPersonalClassTask(classId, taskId) : Promise.resolve(null),
    ])
      .then(([teamRes, task]) => {
        if (cancelled) return;
        setTeams(teamRes.teams);
        if (task) {
          setExistingAttachments(task.attachments);
          form.setFieldsValue({
            title: task.title,
            description: task.description,
            module: task.module,
            priority: task.priority,
            deadline: task.deadline ? dayjs(task.deadline) : undefined,
            attachmentsEnabled: task.attachmentsEnabled,
            scope: task.scope,
            teamIds: task.targetTeamIds,
          });
        } else {
          setExistingAttachments([]);
          form.setFieldsValue({
            title: '',
            description: '',
            module: TASK_MODULES[0],
            priority: 'normal',
            deadline: '',
            attachmentsEnabled: false,
            scope: 'all',
            teamIds: [],
          });
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, classId, taskId, editMode, form]);

  const buildBody = (values: TaskFormValues, status: 'draft' | 'published') => ({
    title: values.title.trim(),
    description: values.description.trim(),
    module: values.module,
    priority: values.priority,
    deadline: values.deadline,
    scope: values.scope,
    teamIds: values.scope === 'specific' ? values.teamIds : [],
    attachmentsEnabled: values.attachmentsEnabled,
    status,
  });

  const uploadPending = async (resolvedTaskId: string, enabled: boolean) => {
    if (!enabled || !pendingFiles.length) return;
    for (const file of pendingFiles) {
      await uploadTaskAttachment(classId, resolvedTaskId, file);
    }
    setPendingFiles([]);
  };

  const submit = async (asDraft: boolean) => {
    try {
      const values = await form.validateFields();
      if (values.scope === 'specific' && !values.teamIds?.length) {
        message.warning('请选择目标团队');
        return;
      }
      const dl = values.deadline;
      const deadline =
        typeof dl === 'string' ? dl : dayjs.isDayjs(dl) ? dl.format('YYYY-MM-DD') : '';
      if (!deadline) {
        message.warning('请选择截止时间');
        return;
      }
      const payload = buildBody({ ...values, deadline }, asDraft ? 'draft' : 'published');
      setSaving(true);
      let saved: PersonalClassTask;
      if (editMode && taskId) {
        saved = await updatePersonalClassTask(classId, taskId, payload);
      } else {
        saved = await createPersonalClassTask(classId, payload);
      }
      await uploadPending(saved.id, values.attachmentsEnabled);
      message.success(asDraft ? '草稿已保存' : '任务已发布');
      onSuccess();
      onClose();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const beforeUpload = (file: File) => {
    if (file.size > MAX_BYTES) {
      message.error('单文件不能超过 100MB');
      return Upload.LIST_IGNORE;
    }
    const total = existingAttachments.length + pendingFiles.length;
    if (total >= MAX_ATTACH) {
      message.error(`最多 ${MAX_ATTACH} 个附件`);
      return Upload.LIST_IGNORE;
    }
    setPendingFiles((prev) => [...prev, file]);
    return false;
  };

  const fileList: UploadFile[] = [
    ...existingAttachments.map((a) => ({
      uid: `saved-${a.id}`,
      name: a.fileName,
      status: 'done' as const,
    })),
    ...pendingFiles.map((f, i) => ({
      uid: `pending-${i}`,
      name: f.name,
      status: 'done' as const,
    })),
  ];

  return (
    <Modal
      open={open}
      title={editMode ? '编辑任务' : '发布新任务'}
      onCancel={onClose}
      width={720}
      destroyOnClose
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit(true)}
            className="px-4 py-2 text-sm text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 cursor-pointer disabled:opacity-50"
          >
            保存草稿
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit(false)}
            className="px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer disabled:opacity-50"
          >
            立即发布
          </button>
        </div>
      }
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" className="mt-2">
          <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：完成市场调研报告" maxLength={256} />
          </Form.Item>
          <Form.Item name="module" label="实训模块" rules={[{ required: true }]}>
            <Select options={TASK_MODULES.map((m) => ({ value: m, label: m }))} />
          </Form.Item>
          <Form.Item name="description" label="任务描述" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={4} placeholder="说明任务要求与交付物" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="deadline" label="截止时间" rules={[{ required: true, message: '请选择日期' }]}>
              <DatePicker className="w-full" format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="priority" label="紧急程度" rules={[{ required: true }]}>
              <Select
                options={TASK_PRIORITY_OPTIONS.map((o) => ({
                  value: o.value,
                  label: (
                    <span>
                      {o.label}
                      <span className="text-gray-400 text-xs ml-2">{o.hint}</span>
                    </span>
                  ),
                }))}
              />
            </Form.Item>
          </div>
          <Form.Item name="attachmentsEnabled" label="允许学生查看附件" valuePropName="checked">
            <Switch />
          </Form.Item>
          {attachmentsEnabled && (
            <Form.Item label="附件（最多 5 个，单文件 ≤100MB）">
              <Upload
                beforeUpload={beforeUpload}
                fileList={fileList}
                onRemove={async (file) => {
                  if (file.uid.startsWith('saved-') && taskId) {
                    const id = file.uid.replace('saved-', '');
                    try {
                      await deleteTaskAttachment(classId, taskId, id);
                      setExistingAttachments((prev) => prev.filter((a) => a.id !== id));
                    } catch (e) {
                      message.error(e instanceof Error ? e.message : '删除失败');
                      return false;
                    }
                  } else if (file.uid.startsWith('pending-')) {
                    const idx = Number(file.uid.replace('pending-', ''));
                    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
                  }
                  return true;
                }}
              >
                <button type="button" className="text-sm text-teal-600 cursor-pointer">
                  选择文件
                </button>
              </Upload>
              {!editMode && pendingFiles.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">新附件将在保存任务后上传</p>
              )}
            </Form.Item>
          )}
          <Form.Item name="scope" label="发布范围" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="all">全班</Radio>
              <Radio value="specific">指定团队</Radio>
            </Radio.Group>
          </Form.Item>
          {scope === 'specific' && (
            <Form.Item name="teamIds" label="目标团队">
              <Checkbox.Group className="flex flex-col gap-2">
                {teams.map((t) => (
                  <Checkbox key={t.id} value={t.id}>
                    {t.name}（{t.memberCount} 人）
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
          )}
        </Form>
      </Spin>
    </Modal>
  );
}
