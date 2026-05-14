import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createAdminCollege, deleteAdminCollege, fetchAdminColleges, type AdminCollegeRow } from '../collegeApi';

export default function CollegeManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<AdminCollegeRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm<{ name: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminColleges();
      setList(data);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    try {
      const { name } = await createForm.validateFields();
      await createAdminCollege(name.trim());
      message.success('学院已创建');
      setCreateOpen(false);
      createForm.resetFields();
      await load();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : '创建失败');
    }
  };

  const columns: ColumnsType<AdminCollegeRow> = [
    { title: '学院名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '学院 ID', dataIndex: 'id', key: 'id', width: 100, render: (v: string) => <span className="font-mono text-gray-700">{v}</span> },
    {
      title: '班级数量',
      dataIndex: 'classCount',
      key: 'classCount',
      width: 120,
      render: (n: number) => <span className="text-teal-600 font-medium">{n}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) =>
        s === 'active' ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, row) => (
        <Space>
          <Button
            type="link"
            className="!text-teal-600 !p-0"
            onClick={() => navigate(`/admin-dashboard?tab=class-management&collegeId=${row.id}`)}
          >
            查看班级
          </Button>
          <Popconfirm title="确定删除该院系？" description="该院系下不能有班级" onConfirm={() => void handleDelete(row.id)}>
            <Button type="link" danger className="!p-0">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleDelete = async (id: string) => {
    try {
      await deleteAdminCollege(id);
      message.success('已删除');
      await load();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <div className="min-h-0 bg-gray-50">
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">学院管理</h2>
          <p className="text-sm text-gray-500 mt-1">在此维护学院；学院不再从「字典管理」中配置。</p>
        </div>
        <Button type="primary" className="!bg-teal-600" onClick={() => setCreateOpen(true)}>
          新建学院
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table<AdminCollegeRow>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={list}
          pagination={false}
        />
      </div>

      <Modal
        title="新建学院"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={() => void handleCreate()}
        okText="创建"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" className="mt-2">
          <Form.Item name="name" label="学院名称" rules={[{ required: true, message: '请输入学院名称' }]}>
            <Input placeholder="例如：计算机科学与技术学院" maxLength={128} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
