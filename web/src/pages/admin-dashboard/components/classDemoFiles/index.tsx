import { useEffect, useState } from 'react';
import { Button, DatePicker, Input, Modal, Select, Table, message } from 'antd';
import dayjs from 'dayjs';
import { adminFetch } from '../dictionary/adminDictApi';
import { fetchAdminColleges, type AdminCollegeRow } from '../collegeApi';

type DemoFileRow = {
  id: string;
  teacherName: string;
  teacherUsername: string;
  collegeName: string;
  majorName: string;
  className: string;
  originName: string;
  url: string;
  createdAt: string;
};

type MajorOption = { id: string; name: string; collegeId: string };

type ListPayload = { list: DemoFileRow[]; total: number; page: number; pageSize: number };

export default function ClassDemoFiles() {
  const [colleges, setColleges] = useState<AdminCollegeRow[]>([]);
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [collegeId, setCollegeId] = useState<string>();
  const [majorId, setMajorId] = useState<string>();
  const [teacher, setTeacher] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<DemoFileRow[]>([]);
  const [loading, setLoading] = useState(false);

  const query = {
    collegeId: collegeId || '',
    majorId: majorId || '',
    teacher: teacher.trim(),
    from,
    to,
  };

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ ...query, page: String(nextPage), pageSize: '20' });
      const data = (await adminFetch(`/api/admin/class-demo-files?${q}`)) as ListPayload;
      setRows(data.list || []);
      setTotal(Number(data.total || 0));
      setPage(nextPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminColleges().then(setColleges).catch((e) => message.error(e instanceof Error ? e.message : '学院加载失败'));
    void load(1);
    // 首次进入拉一次列表
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = collegeId ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
    adminFetch(`/api/public/majors${q}`)
      .then((data) => setMajors(Array.isArray(data) ? (data as MajorOption[]) : []))
      .catch(() => setMajors([]));
  }, [collegeId]);

  const columns = [
    { title: '教师', dataIndex: 'teacherName', render: (_, row) => `${row.teacherName || '—'}${row.teacherUsername ? `（${row.teacherUsername}）` : ''}` },
    { title: '学院', dataIndex: 'collegeName', render: (v) => v || '—' },
    { title: '专业', dataIndex: 'majorName', render: (v) => v || '—' },
    { title: '教学班', dataIndex: 'className', render: (v) => v || '—' },
    { title: '文件', dataIndex: 'originName', render: (_, row) => <a href={row.url} target="_blank" rel="noreferrer">{row.originName}</a> },
    { title: '上传时间', dataIndex: 'createdAt', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
    {
      title: '操作',
      render: (_, row) => (
        <Button
          danger
          type="link"
          onClick={() => {
            Modal.confirm({
              title: '删除这条演示文件？',
              content: '只删除演示目录中的该文件，不会动学生作业。',
              okText: '删除',
              okButtonProps: { danger: true },
              onOk: async () => {
                await adminFetch(`/api/admin/class-demo-files/${row.id}`, { method: 'DELETE' });
                message.success('已删除');
                await load(page);
              },
            });
          }}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">演示记录</h2>
        <p className="text-sm text-gray-500 mt-1">这里只列出教学演示上传的文件。删除时只清理演示目录，不会碰到学生业务文件。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select
          allowClear
          placeholder="学院"
          className="min-w-40"
          value={collegeId}
          options={colleges.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => {
            setCollegeId(value);
            setMajorId(undefined);
          }}
        />
        <Select
          allowClear
          placeholder="专业"
          className="min-w-40"
          value={majorId}
          options={majors.map((item) => ({ value: item.id, label: item.name }))}
          onChange={setMajorId}
        />
        <Input placeholder="教师姓名或账号" value={teacher} onChange={(e) => setTeacher(e.target.value)} className="w-44" />
        <DatePicker placeholder="开始日期" value={from ? dayjs(from) : null} onChange={(_, text) => setFrom(typeof text === 'string' ? text : '')} />
        <DatePicker placeholder="结束日期" value={to ? dayjs(to) : null} onChange={(_, text) => setTo(typeof text === 'string' ? text : '')} />
        <Button type="primary" onClick={() => void load(1)}>查询</Button>
        <Button
          danger
          onClick={() => {
            Modal.confirm({
              title: '清空当前筛选下的演示文件？',
              content: teacher || collegeId || majorId || from || to
                ? '将删除符合当前筛选的演示文件。学生作业、原型和计划书附件不会被删除。'
                : '没有筛选条件，将删除全部演示文件。学生作业不会被删除。',
              okText: '清空',
              okButtonProps: { danger: true },
              onOk: async () => {
                const data = (await adminFetch('/api/admin/class-demo-files/purge', {
                  method: 'POST',
                  body: JSON.stringify(query),
                })) as { deleted?: number };
                message.success(`已删除 ${data?.deleted || 0} 个文件`);
                await load(1);
              },
            });
          }}
        >
          清空当前筛选
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ current: page, pageSize: 20, total, onChange: (next) => void load(next) }}
      />
    </div>
  );
}
