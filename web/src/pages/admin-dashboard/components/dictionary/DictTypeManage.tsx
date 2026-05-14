import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ConfigProvider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createDictType,
  deleteDictType,
  fetchDictTypes,
  updateDictType,
  type DictTypeRow,
} from './adminDictApi';

const adminTheme = {
  token: { colorPrimary: '#0d9488', borderRadius: 8 },
};

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '禁用', value: '0' },
];

export default function DictTypeManage() {
  const navigate = useNavigate();
  const [messageApi, holder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<DictTypeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({ name: '', code: '', status: 'all' as string });
  const [searchForm] = Form.useForm();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DictTypeRow | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDictTypes({
        name: filters.name || undefined,
        code: filters.code || undefined,
        status: filters.status === 'all' ? '' : filters.status,
        page,
        pageSize,
      });
      setList(data.list);
      setTotal(data.total);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, messageApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 1, remark: '' });
    setModalOpen(true);
  };

  const openEdit = (row: DictTypeRow) => {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      code: row.code,
      status: row.status,
      remark: row.remark ?? '',
    });
    setModalOpen(true);
  };

  const submitModal = async () => {
    try {
      const v = await form.validateFields();
      if (editing) {
        await updateDictType(editing.id, v);
        messageApi.success('已保存');
      } else {
        await createDictType(v);
        messageApi.success('已创建');
      }
      setModalOpen(false);
      void load();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in (e as object)) return;
      messageApi.error((e as Error).message);
    }
  };

  const onDelete = (row: DictTypeRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除字典类型「${row.name}」后不可恢复（需先清空子项）。`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteDictType(row.id);
          messageApi.success('已删除');
          void load();
        } catch (e) {
          messageApi.error((e as Error).message);
        }
      },
    });
  };

  const goItems = (row: DictTypeRow) => {
    navigate(`/admin-dashboard?tab=dictionary-items&typeId=${row.id}`);
  };

  const columns: ColumnsType<DictTypeRow> = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: '字典名称', dataIndex: 'name', ellipsis: true },
    { title: '字典 value（code）', dataIndex: 'code', width: 160, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 88,
      render: (s: number) => (s === 1 ? '启用' : '禁用'),
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true, render: (t) => t || '—' },
    {
      title: '操作',
      key: 'op',
      width: 220,
      fixed: 'right',
      render: (_, row) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            修改
          </Button>
          <Button type="link" size="small" danger onClick={() => onDelete(row)}>
            删除
          </Button>
          <Button type="link" size="small" onClick={() => goItems(row)}>
            数据管理
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider theme={adminTheme}>
      {holder}
      <div className="min-h-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">字典管理</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <Form
            layout="inline"
            form={searchForm}
            initialValues={filters}
            onFinish={(v) => {
              setFilters({
                name: String(v.name || '').trim(),
                code: String(v.code || '').trim(),
                status: (v.status as string) ?? 'all',
              });
              setPage(1);
            }}
            className="flex flex-wrap gap-y-3"
          >
            <Form.Item name="name" label="字典名称">
              <Input allowClear placeholder="模糊搜索" style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="code" label="字典类型">
              <Input allowClear placeholder="code 模糊搜索" style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={statusOptions} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  搜索
                </Button>
                <Button
                  onClick={() => {
                    searchForm.resetFields();
                    setFilters({ name: '', code: '', status: 'all' });
                    setPage(1);
                  }}
                >
                  重置
                </Button>
                <Button type="primary" onClick={openCreate}>
                  新增
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <Table<DictTypeRow>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={list}
            scroll={{ x: 900 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
          />
        </div>
      </div>

      <Modal
        title={editing ? '修改字典类型' : '新增字典类型'}
        open={modalOpen}
        onOk={submitModal}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="字典名称" rules={[{ required: true, message: '请输入字典名称' }]}>
            <Input placeholder="如：学院" />
          </Form.Item>
          <Form.Item
            name="code"
            label="字典 value（英文 code）"
            rules={[{ required: true, message: '请输入 code' }]}
            extra="小写字母开头，仅含小写字母、数字、下划线"
          >
            <Input placeholder="如：college" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '启用', value: 1 },
                { label: '禁用', value: 0 },
              ]}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}
