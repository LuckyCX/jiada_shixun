import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createDictItem,
  deleteDictItem,
  fetchDictItems,
  fetchDictTypeOne,
  updateDictItem,
  type DictItemRow,
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

type Props = { typeId: number };

export default function DictItemManage({ typeId }: Props) {
  const navigate = useNavigate();
  const [messageApi, holder] = message.useMessage();
  const [typeMeta, setTypeMeta] = useState<DictTypeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<DictItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({ name: '', status: 'all' as string });
  const [searchForm] = Form.useForm();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DictItemRow | null>(null);
  const [form] = Form.useForm();

  const loadType = useCallback(async () => {
    setTypeMeta(null);
    try {
      const t = await fetchDictTypeOne(typeId);
      if (t.code === 'college') {
        messageApi.warning('学院请在「学院管理」中维护');
        navigate('/admin-dashboard?tab=dictionary', { replace: true });
        return;
      }
      setTypeMeta(t);
    } catch (e) {
      messageApi.error((e as Error).message);
      setTypeMeta(null);
    }
  }, [typeId, messageApi, navigate]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDictItems(typeId, {
        name: filters.name || undefined,
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
  }, [typeId, filters, page, pageSize, messageApi]);

  useEffect(() => {
    void loadType();
  }, [loadType]);

  useEffect(() => {
    if (!typeMeta) return;
    void loadItems();
  }, [loadItems, typeMeta]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      status: 1,
      sortOrder: 0,
      remark: '',
      parentLabel: typeMeta ? `${typeMeta.name}（${typeMeta.code}）` : '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: DictItemRow) => {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      dataKey: row.dataKey,
      sortOrder: row.sortOrder,
      status: row.status,
      remark: row.remark ?? '',
      parentLabel: typeMeta ? `${typeMeta.name}（${typeMeta.code}）` : '',
    });
    setModalOpen(true);
  };

  const submitModal = async () => {
    try {
      const v = await form.validateFields();
      const rest = { ...v };
      delete rest.parentLabel;
      if (editing) {
        await updateDictItem(editing.id, rest);
        messageApi.success('已保存');
      } else {
        await createDictItem(typeId, rest);
        messageApi.success('已创建');
      }
      setModalOpen(false);
      void loadItems();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in (e as object)) return;
      messageApi.error((e as Error).message);
    }
  };

  const onDelete = (row: DictItemRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除字典项「${row.name}」？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteDictItem(row.id);
          messageApi.success('已删除');
          void loadItems();
        } catch (e) {
          messageApi.error((e as Error).message);
        }
      },
    });
  };

  const parentTypeLabel = typeMeta ? `${typeMeta.name}（${typeMeta.code}）` : '—';

  const columns: ColumnsType<DictItemRow> = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    {
      title: '父级字典类型',
      key: 'ptype',
      width: 200,
      ellipsis: true,
      render: () => parentTypeLabel,
    },
    { title: '字典名称', dataIndex: 'name', ellipsis: true },
    { title: '数据键值', dataIndex: 'dataKey', width: 100 },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
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
      width: 140,
      fixed: 'right',
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            修改
          </Button>
          <Button type="link" size="small" danger onClick={() => onDelete(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider theme={adminTheme}>
      {holder}
      <div className="min-h-0">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={() => navigate('/admin-dashboard?tab=dictionary')}>返回字典类型</Button>
          <h1 className="text-2xl font-bold text-gray-900 m-0">字典数据</h1>
          {typeMeta && (
            <span className="text-sm text-gray-500">
              当前类型：{typeMeta.name}（{typeMeta.code}）
            </span>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <Form
            layout="inline"
            form={searchForm}
            initialValues={filters}
            onFinish={(v) => {
              setFilters({
                name: String(v.name || '').trim(),
                status: (v.status as string) ?? 'all',
              });
              setPage(1);
            }}
            className="flex flex-wrap gap-y-3"
          >
            <Form.Item name="name" label="字典名称">
              <Input allowClear placeholder="模糊搜索" style={{ width: 160 }} />
            </Form.Item>
            <Form.Item label="字典类型">
              <Input readOnly value={parentTypeLabel} style={{ width: 220 }} />
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
                    setFilters({ name: '', status: 'all' });
                    setPage(1);
                  }}
                >
                  重置
                </Button>
                <Button type="primary" onClick={openCreate} disabled={!typeMeta}>
                  新增
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <Table<DictItemRow>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={list}
            scroll={{ x: 1000 }}
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
        title={editing ? '修改字典项' : '新增字典项'}
        open={modalOpen}
        onOk={submitModal}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="父级字典类型（不可修改）" name="parentLabel">
            <Input disabled />
          </Form.Item>
          <Form.Item name="name" label="字典名称" rules={[{ required: true, message: '请输入字典名称' }]}>
            <Input placeholder="展示名称" />
          </Form.Item>
          <Form.Item
            name="dataKey"
            label="数据键值（数字）"
            rules={[{ required: true, message: '请输入数据键值' }]}
          >
            <InputNumber className="w-full" min={0} step={1} disabled={!!editing} placeholder="整数，同类型唯一" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={0} step={1} />
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
