import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Popconfirm, Table, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { getPortalToken, parseJwtPayload } from '../../../lib/authApi';
import {
  METHOD_FORMAT_GUIDES,
  deleteMarketMethodUpload,
  downloadMarketMethodFile,
  listMarketMethodUploads,
  uploadMarketMethodFile,
  type MethodUploadItem,
} from '../../../lib/studentMarketResearchApi';

type Props = {
  classId: string;
  method: string;
};

export default function MarketResearchMethodUpload({ classId, method }: Props) {
  const [items, setItems] = useState<MethodUploadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentStudentId = useMemo(() => {
    const token = getPortalToken('student');
    return token ? String(parseJwtPayload(token)?.sub || '') : '';
  }, []);

  const guide = METHOD_FORMAT_GUIDES[method];

  const refresh = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const list = await listMarketMethodUploads(classId, method);
      setItems(list);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [classId, method]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const uploadProps: UploadProps = {
    accept: '.txt,.docx',
    showUploadList: false,
    multiple: false,
    beforeUpload: (file) => {
      const name = file.name.toLowerCase();
      if (!name.endsWith('.txt') && !name.endsWith('.docx')) {
        message.warning('仅支持 txt、docx 格式');
        return Upload.LIST_IGNORE;
      }
      void (async () => {
        setUploading(true);
        try {
          await uploadMarketMethodFile(classId, method, file);
          message.success('上传成功');
          await refresh();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '上传失败');
        } finally {
          setUploading(false);
        }
      })();
      return Upload.LIST_IGNORE;
    },
  };

  return (
    <div className="space-y-6">
      {guide && (
        <Alert
          type="info"
          showIcon
          message={guide.title}
          description={
            <div className="space-y-1 mt-1">
              {guide.bullets.map((b, i) => (
                <p key={i} className="text-sm mb-0">
                  {b}
                </p>
              ))}
              <p className="text-sm text-gray-600 mb-0">建议文件名：{guide.exampleName}</p>
            </div>
          }
        />
      )}

      <Upload.Dragger {...uploadProps} disabled={uploading}>
        <p className="ant-upload-drag-icon">
          <i className="ri-upload-cloud-2-line text-3xl text-green-500"></i>
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
        <p className="ant-upload-hint text-gray-500">支持 txt、docx，可多次上传保留历史记录</p>
      </Upload.Dragger>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={false}
        locale={{ emptyText: '暂无上传记录' }}
        columns={[
          { title: '文件名', dataIndex: 'originalFilename', key: 'name' },
          { title: '上传人', dataIndex: 'uploaderName', key: 'uploader' },
          { title: '上传时间', dataIndex: 'createdAt', key: 'time' },
          {
            title: '操作',
            key: 'action',
            render: (_, row) => (
              <div className="flex items-center gap-1">
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    void downloadMarketMethodFile(classId, row.id, row.originalFilename).catch((e) => {
                      message.error(e instanceof Error ? e.message : '下载失败');
                    });
                  }}
                >
                  下载
                </Button>
                {currentStudentId && row.uploadedBy === currentStudentId && (
                  <Popconfirm
                    title="确定删除该文件？"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true, loading: deletingId === row.id }}
                    onConfirm={() => {
                      void (async () => {
                        setDeletingId(row.id);
                        try {
                          await deleteMarketMethodUpload(classId, row.id);
                          message.success('已删除');
                          await refresh();
                        } catch (e) {
                          message.error(e instanceof Error ? e.message : '删除失败');
                        } finally {
                          setDeletingId(null);
                        }
                      })();
                    }}
                  >
                    <Button type="link" size="small" danger disabled={deletingId === row.id}>
                      删除
                    </Button>
                  </Popconfirm>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
