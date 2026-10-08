import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Radio,
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
  /** 页内嵌表单，不使用 Modal */
  variant?: 'modal' | 'inline';
  /** 可选实训模块标签；缺省为全部 TASK_MODULES */
  availableModules?: readonly string[];
};

const MAX_ATTACH = 5;
const MAX_BYTES = 100 * 1024 * 1024;

export default function CreateTaskModal({
  open,
  classId,
  taskId,
  onClose,
  onSuccess,
  variant = 'modal',
  availableModules,
}: Props) {
  const inline = variant === 'inline';
  const [form] = Form.useForm<TaskFormValues>();
  const [teams, setTeams] = useState<TeamForTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<PersonalClassTask['attachments']>([]);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; file: File }[]>([]);
  const attachSlotRef = useRef(0);
  const editMode = Boolean(taskId);
  const moduleOptions = availableModules?.length ? availableModules : TASK_MODULES;
  const defaultModule = moduleOptions[0] || TASK_MODULES[0];

  useEffect(() => {
    attachSlotRef.current = existingAttachments.length + pendingFiles.length;
  }, [existingAttachments.length, pendingFiles.length]);

  const attachmentsEnabled = Form.useWatch('attachmentsEnabled', form);
  const scope = Form.useWatch('scope', form);

  useEffect(() => {
    if (!open && !inline) return;
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
            deadline: task.deadline
              ? dayjs(task.deadline, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD'])
              : undefined,
            attachmentsEnabled: task.attachmentsEnabled,
            requiresStudentAttachment: task.requiresStudentAttachment,
            scope: task.scope,
            teamIds: task.targetTeamIds,
          });
        } else {
          setExistingAttachments([]);
          form.setFieldsValue({
            title: '',
            description: '',
            module: defaultModule,
            priority: 'normal',
            deadline: '',
            attachmentsEnabled: false,
            requiresStudentAttachment: false,
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
  }, [open, inline, classId, taskId, editMode, form, defaultModule]);

  const buildBody = (values: TaskFormValues) => ({
    title: values.title.trim(),
    description: values.description.trim(),
    module: values.module,
    priority: values.priority,
    deadline: values.deadline,
    scope: values.scope,
    teamIds: values.scope === 'specific' ? values.teamIds : [],
    attachmentsEnabled: values.attachmentsEnabled,
    requiresStudentAttachment: values.requiresStudentAttachment,
    resourceLinkEnabled: false,
    resourceNodeIds: [],
    status: 'published' as const,
  });

  const uploadPending = async (resolvedTaskId: string, enabled: boolean) => {
    if (!enabled || !pendingFiles.length) return;
    for (const { file } of pendingFiles) {
      await uploadTaskAttachment(classId, resolvedTaskId, file);
    }
    setPendingFiles([]);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      if (values.scope === 'specific' && !values.teamIds?.length) {
        message.warning('请选择目标团队');
        return;
      }
      const dl = values.deadline;
      const deadline =
        typeof dl === 'string'
          ? dl
          : dayjs.isDayjs(dl)
            ? dl.format('YYYY-MM-DD HH:mm')
            : '';
      if (!deadline) {
        message.warning('请选择截止时间');
        return;
      }
      const payload = buildBody({ ...values, deadline });
      setSaving(true);
      let saved: PersonalClassTask;
      if (editMode && taskId) {
        saved = await updatePersonalClassTask(classId, taskId, payload);
      } else {
        saved = await createPersonalClassTask(classId, payload);
      }
      await uploadPending(saved.id, values.attachmentsEnabled);
      message.success('任务已发布');
      onSuccess();
      if (!inline) onClose();
      else if (!editMode) {
        setExistingAttachments([]);
        setPendingFiles([]);
        form.setFieldsValue({
          title: '',
          description: '',
          module: defaultModule,
          priority: 'normal',
          deadline: '',
          attachmentsEnabled: false,
          requiresStudentAttachment: false,
          scope: 'all',
          teamIds: [],
        });
      }
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
    if (attachSlotRef.current >= MAX_ATTACH) {
      message.error(`最多 ${MAX_ATTACH} 个附件`);
      return Upload.LIST_IGNORE;
    }
    attachSlotRef.current += 1;
    const id = crypto.randomUUID();
    setPendingFiles((prev) => [...prev, { id, file }]);
    return false;
  };

  const fileList: UploadFile[] = [
    ...existingAttachments.map((a) => ({
      uid: `saved-${a.id}`,
      name: a.fileName,
      status: 'done' as const,
    })),
    ...pendingFiles.map((p) => ({
      uid: `pending-${p.id}`,
      name: p.file.name,
      status: 'done' as const,
    })),
  ];

  const footerButtons = (
    <div className={`flex gap-2 ${inline ? 'pt-2' : 'justify-end'}`}>
      {!inline && (
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
        >
          取消
        </button>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={() => void submit()}
        className={`px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer disabled:opacity-50 ${inline ? 'flex-1' : ''}`}
      >
        {saving ? '提交中…' : '立即发布'}
      </button>
    </div>
  );

  const formBody = (
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" className={inline ? '' : 'mt-2'}>
        <Form.Item name="module" label="实训模块" rules={[{ required: true }]}>
            <Select
              options={moduleOptions.map((m) => ({ value: m, label: m }))}
            />
          </Form.Item>
          <Form.Item name="scope" label="发布对象" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="all">全班</Radio>
              <Radio value="specific">指定团队</Radio>
            </Radio.Group>
          </Form.Item>
          {scope === 'specific' && (
            <Form.Item name="teamIds" label="目标团队">
              <Select
                mode="multiple"
                placeholder="请选择目标团队"
                options={teams.map((t) => ({
                  value: t.id,
                  label: `${t.name}（${t.memberCount} 人）`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：完成市场调研报告" maxLength={256} />
          </Form.Item>
          <Form.Item name="description" label="任务描述" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={4} placeholder="说明任务要求与交付物" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="deadline" label="截止时间" rules={[{ required: true, message: '请选择时间' }]}>
              <DatePicker
                className="w-full"
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
              />
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
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="text-sm font-medium text-gray-700">允许学生查看附件</span>
              <Form.Item name="attachmentsEnabled" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-700">是否要求学生反馈附件</div>
                </div>
                <Form.Item name="requiresStudentAttachment" valuePropName="checked" noStyle>
                  <Switch />
                </Form.Item>
              </div>
            </div>
          </div>
          {attachmentsEnabled && (
            <Form.Item label="附件（最多 5 个，单文件 ≤100MB）">
              <Upload
                multiple
                beforeUpload={beforeUpload}
                fileList={fileList}
                onRemove={async (file) => {
                  if (file.uid.startsWith('saved-') && taskId) {
                    const id = file.uid.replace('saved-', '');
                    try {
                      await deleteTaskAttachment(classId, taskId, id);
                      setExistingAttachments((prev) => prev.filter((a) => a.id !== id));
                      attachSlotRef.current = Math.max(0, attachSlotRef.current - 1);
                    } catch (e) {
                      message.error(e instanceof Error ? e.message : '删除失败');
                      return false;
                    }
                  } else if (file.uid.startsWith('pending-')) {
                    const id = file.uid.replace('pending-', '');
                    setPendingFiles((prev) => prev.filter((p) => p.id !== id));
                    attachSlotRef.current = Math.max(0, attachSlotRef.current - 1);
                  }
                  return true;
                }}
              >
                <button type="button" className="text-sm text-teal-600 cursor-pointer">
                  选择文件（可多选）
                </button>
              </Upload>
              {!editMode && pendingFiles.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">新附件将在保存任务后上传</p>
              )}
            </Form.Item>
          )}
        </Form>
      </Spin>
  );

  if (inline) {
    return (
      <div className="space-y-4">
        {formBody}
        {footerButtons}
      </div>
    );
  }

  return (
    <Modal
      open={open}
      title={editMode ? '编辑任务' : '发布新任务'}
      onCancel={onClose}
      width={720}
      destroyOnClose
      footer={footerButtons}
    >
      {formBody}
    </Modal>
  );
}
