import { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, message } from 'antd';
import {
  deleteAdminAiTutorEntry,
  fetchAdminAiTutorEntries,
  saveAdminAiTutorEntry,
  testAdminAiTutor,
  type AiTutorKbEntry,
} from '../../../../lib/aiTutorApi';

const AUDIENCE_LABEL: Record<string, string> = {
  student: '学生',
  teacher: '教师',
  both: '师生',
};

export default function AiTutorAdmin() {
  const [entries, setEntries] = useState<AiTutorKbEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AiTutorKbEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [testAudience, setTestAudience] = useState<'student' | 'teacher'>('student');
  const [testInput, setTestInput] = useState('');
  const [testHistory, setTestHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [testing, setTesting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return fetchAdminAiTutorEntries()
      .then(setEntries)
      .catch((e) => {
        setEntries([]);
        message.error(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      category: '系统总览',
      audience: 'both',
      question: '',
      answer: '',
      isPreset: false,
      sortOrder: 100,
      enabled: true,
    });
    setModalOpen(true);
  };

  const openEdit = (row: AiTutorKbEntry) => {
    setEditing(row);
    form.setFieldsValue(row);
    setModalOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    try {
      await saveAdminAiTutorEntry(values, editing?.id);
      message.success(editing ? '已保存' : '已新增');
      setModalOpen(false);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const runTest = async () => {
    const q = testInput.trim();
    if (!q || testing) return;
    setTestInput('');
    setTesting(true);
    const history = testHistory;
    setTestHistory((prev) => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    try {
      await testAdminAiTutor(testAudience, q, history, {
        onContent: (chunk) => {
          setTestHistory((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + chunk };
            return next;
          });
        },
        onDone: (reply) => {
          setTestHistory((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: reply };
            return next;
          });
        },
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '测试失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-gray-900">问答测试</h2>
          <Space>
            <Select
              size="small"
              value={testAudience}
              onChange={(v) => {
                setTestAudience(v);
                setTestHistory([]);
              }}
              options={[
                { value: 'student', label: '按学生' },
                { value: 'teacher', label: '按教师' },
              ]}
              style={{ width: 110 }}
            />
            <Button size="small" onClick={() => setTestHistory([])}>
              清空
            </Button>
          </Space>
        </div>
        <p className="text-xs text-gray-400 mb-2">测试不写入师生的历史对话。改完下方问答后，新回复会使用最新知识库。</p>
        <div className="max-h-52 overflow-y-auto space-y-2 mb-2">
          {testHistory.map((m, i) => (
            <div key={i} className={`text-sm whitespace-pre-wrap ${m.role === 'user' ? 'text-teal-800' : 'text-gray-700'}`}>
              <span className="text-[11px] text-gray-400 mr-1">{m.role === 'user' ? '问' : '答'}</span>
              {m.content}
            </div>
          ))}
          {testing ? <div className="text-xs text-gray-400">正在回答…</div> : null}
        </div>
        <div className="flex gap-2">
          <Input.TextArea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="输入要测试的问题"
          />
          <Button type="primary" loading={testing} onClick={() => void runTest()}>
            发送
          </Button>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">问答内容</h2>
          <Button type="primary" size="small" onClick={openCreate}>
            新增
          </Button>
        </div>
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={entries}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          columns={[
            { title: '分类', dataIndex: 'category', width: 100 },
            {
              title: '受众',
              dataIndex: 'audience',
              width: 72,
              render: (v: string) => AUDIENCE_LABEL[v] || v,
            },
            { title: '问题', dataIndex: 'question', ellipsis: true },
            {
              title: '快捷',
              dataIndex: 'isPreset',
              width: 64,
              render: (v: boolean) => (v ? '是' : ''),
            },
            {
              title: '启用',
              dataIndex: 'enabled',
              width: 64,
              render: (v: boolean) => (v ? '是' : '否'),
            },
            {
              title: '操作',
              width: 120,
              render: (_: unknown, row: AiTutorKbEntry) => (
                <Space size={4}>
                  <Button type="link" size="small" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() => {
                      Modal.confirm({
                        title: '删除这条问答？',
                        onOk: async () => {
                          await deleteAdminAiTutorEntry(row.id);
                          message.success('已删除');
                          await load();
                        },
                      });
                    }}
                  >
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </section>

      <Modal
        title={editing ? '编辑问答' : '新增问答'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void submit()}
        okText="保存"
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-2">
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请填写分类' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="audience" label="受众" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'both', label: '师生' },
                { value: 'student', label: '仅学生' },
                { value: 'teacher', label: '仅教师' },
              ]}
            />
          </Form.Item>
          <Form.Item name="question" label="问题" rules={[{ required: true, message: '请填写问题' }]}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item name="answer" label="答案" rules={[{ required: true, message: '请填写答案' }]}>
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
          </Form.Item>
          <div className="grid grid-cols-3 gap-3">
            <Form.Item name="isPreset" label="快捷问题" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="sortOrder" label="排序">
              <InputNumber className="w-full" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
