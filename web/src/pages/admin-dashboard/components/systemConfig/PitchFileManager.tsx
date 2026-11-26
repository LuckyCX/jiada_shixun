import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dropdown,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Tree,
  message,
  type TableColumnsType,
  type TreeDataNode,
} from 'antd';
import { portalAuthenticatedFetch, refreshPortalAccessToken } from '../../../../lib/authApi';
import { downloadPitchFilesBatch, uploadFileToOss } from '../../../../lib/pitchTemplatesApi';

/** OSS 目录树返回的文件节点 */
type PitchFileNode = {
  id: string;
  name: string;
  relPath: string;
  ext?: string;
  size?: number;
  sizeText?: string;
};

/** OSS 目录树返回的目录节点（relPath='' 表示根目录） */
type PitchTreeNode = {
  id: string;
  name: string;
  relPath: string;
  children?: PitchTreeNode[];
  files?: PitchFileNode[];
  fileCount?: number;
};

type SignedUpload = {
  url: string;
  key: string;
  objectRel: string;
  finalName: string;
  contentType: string;
  expiresAt: number;
};

async function adminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const data = await portalAuthenticatedFetch('admin', path, init);
  return data as T;
}

/** 申请签名 PUT URL（带一次 token 刷新重试） */
async function requestUploadUrl(path: string, name: string, contentType: string): Promise<SignedUpload> {
  const runOnce = async () => {
    try {
      const data = await adminJson<SignedUpload>('/api/admin/pitch-templates/upload-url', {
        method: 'POST',
        body: JSON.stringify({ path, name, contentType }),
      });
      return { ok: true as const, data };
    } catch (e) {
      return { ok: false as const, error: e as Error };
    }
  };
  let res = await runOnce();
  if (!res.ok && /token|登录|401/i.test(res.error.message) && (await refreshPortalAccessToken('admin'))) {
    res = await runOnce();
  }
  if (!res.ok) throw res.error;
  return res.data;
}

/** 在树中按 relPath 找节点 */
function findNode(root: PitchTreeNode | null, relPath: string): PitchTreeNode | null {
  if (!root) return null;
  if ((root.relPath || '') === relPath) return root;
  for (const child of root.children || []) {
    const hit = findNode(child, relPath);
    if (hit) return hit;
  }
  return null;
}

/** 转成 antd Tree 数据；title 里包一层右键菜单由渲染阶段处理 */
function toTreeData(node: PitchTreeNode, onDelete: (n: PitchTreeNode) => void, onMkdir: (n: PitchTreeNode) => void): TreeDataNode {
  const isRoot = !(node.relPath || '');
  const title = (
    <Dropdown
      trigger={['contextMenu']}
      menu={{
        items: [
          { key: 'mkdir', label: '新建子目录' },
          ...(isRoot
            ? []
            : [{ key: 'delete', label: '删除目录', danger: true }]),
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === 'delete') onDelete(node);
          if (key === 'mkdir') onMkdir(node);
        },
      }}
    >
      <span className="inline-block max-w-[240px] truncate select-none" title={node.name}>
        {node.name}
        {typeof node.fileCount === 'number' ? (
          <span className="ml-1 text-xs text-gray-400">{node.fileCount}</span>
        ) : null}
      </span>
    </Dropdown>
  );
  return {
    key: node.relPath || '',
    title,
    children: (node.children || []).map((c) => toTreeData(c, onDelete, onMkdir)),
  };
}

type Props = {
  /** 变更（上传/建删目录/删文件）后通知父级刷新索引状态 */
  onChanged?: () => void;
};

export default function PitchFileManager({ onChanged }: Props) {
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const [tree, setTree] = useState<PitchTreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [selectedDir, setSelectedDir] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; percent: number }[]>([]);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirParent, setMkdirParent] = useState('');
  const [mkdirName, setMkdirName] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTree = useCallback(async (keepDir = true) => {
    setLoading(true);
    try {
      const data = await adminJson<PitchTreeNode>('/api/admin/pitch-templates/tree');
      setTree(data);
      if (!keepDir) setSelectedDir('');
      else if (data && (data.relPath || '') !== selectedDir && !findNode(data, selectedDir)) {
        setSelectedDir('');
      }
    } catch (e) {
      messageApi.error((e as Error).message || '读取目录树失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageApi]);

  useEffect(() => {
    void loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentNode = useMemo(() => findNode(tree, selectedDir), [tree, selectedDir]);
  const selectedDirLabel = selectedDir || '根目录（pitch-templates）';

  // 切换目录时清空多选
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [selectedDir]);

  const selectedFiles = useMemo(
    () => (currentNode?.files || []).filter((f) => selectedRowKeys.includes(f.relPath)),
    [currentNode, selectedRowKeys]
  );

  const downloadSelected = async () => {
    if (!selectedFiles.length) {
      messageApi.warning('请先勾选要下载的文件');
      return;
    }
    setBatchDownloading(true);
    try {
      const { ok, failed } = await downloadPitchFilesBatch(selectedFiles, (done, total) => {
        messageApi.loading({ content: `正在下载 ${done}/${total}…`, key: 'pitch-admin-batch', duration: 0 });
      });
      messageApi.destroy('pitch-admin-batch');
      if (failed.length) {
        messageApi.warning(
          `已下载 ${ok} 个，失败 ${failed.length} 个：${failed
            .slice(0, 2)
            .map((f) => f.name)
            .join('、')}${failed.length > 2 ? ' 等' : ''}`
        );
      } else {
        messageApi.success(`已下载 ${ok} 个文件`);
      }
      setSelectedRowKeys([]);
    } catch (e) {
      messageApi.destroy('pitch-admin-batch');
      messageApi.error((e as Error).message || '下载失败');
    } finally {
      setBatchDownloading(false);
    }
  };

  const afterChange = useCallback(
    (msg: string) => {
      messageApi.success(msg);
      void loadTree();
      onChanged?.();
    },
    [loadTree, messageApi, onChanged]
  );

  const openMkdir = (node: PitchTreeNode) => {
    setMkdirParent(node.relPath || '');
    setMkdirName('');
    setMkdirOpen(true);
  };

  const submitMkdir = async () => {
    const name = mkdirName.trim();
    if (!name) {
      messageApi.warning('请输入目录名');
      return;
    }
    setMutating(true);
    try {
      const rel = mkdirParent ? `${mkdirParent}/${name}` : name;
      await adminJson('/api/admin/pitch-templates/mkdir', {
        method: 'POST',
        body: JSON.stringify({ path: rel }),
      });
      setMkdirOpen(false);
      setSelectedDir(rel);
      afterChange(`目录「${name}」已创建`);
    } catch (e) {
      messageApi.error((e as Error).message || '创建目录失败');
    } finally {
      setMutating(false);
    }
  };

  const confirmDeleteDir = (node: PitchTreeNode) => {
    modalApi.confirm({
      title: `删除目录「${node.name}」？`,
      content: '目录内全部文件与子目录将一并删除，且不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setMutating(true);
        try {
          await adminJson('/api/admin/pitch-templates/delete-dir', {
            method: 'POST',
            body: JSON.stringify({ path: node.relPath || '' }),
          });
          if (selectedDir === (node.relPath || '') || selectedDir.startsWith(`${node.relPath}/`)) {
            setSelectedDir('');
          }
          afterChange(`目录「${node.name}」已删除`);
        } catch (e) {
          messageApi.error((e as Error).message || '删除目录失败');
        } finally {
          setMutating(false);
        }
      },
    });
  };

  const deleteFile = (f: PitchFileNode) => {
    modalApi.confirm({
      title: `删除文件「${f.name}」？`,
      content: '删除后不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setMutating(true);
        try {
          await adminJson('/api/admin/pitch-templates/delete-file', {
            method: 'POST',
            body: JSON.stringify({ path: f.relPath }),
          });
          afterChange(`文件「${f.name}」已删除`);
        } catch (e) {
          messageApi.error((e as Error).message || '删除文件失败');
        } finally {
          setMutating(false);
        }
      },
    });
  };

  /** OSS 签名 PUT 直传：申请签名 → 浏览器 XHR PUT 到 OSS → 完成回调刷新目录 */
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (!list.length) return;
    setUploading(true);
    setUploadProgress(list.map((f) => ({ name: f.name, percent: 0 })));
    let ok = 0;
    const failed: { name: string; reason: string }[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        try {
          const signed = await requestUploadUrl(selectedDir, f.name, f.type || '');
          await uploadFileToOss(f, signed, (percent) => {
            setUploadProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, percent } : p)));
          });
          await adminJson('/api/admin/pitch-templates/upload-complete', {
            method: 'POST',
            body: JSON.stringify({ path: signed.objectRel }),
          });
          ok += 1;
        } catch (err) {
          failed.push({ name: f.name, reason: (err as Error).message || '上传失败' });
        }
        setUploadProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, percent: 100 } : p)));
      }
      const failText = failed.length
        ? `，失败 ${failed.length} 个（${failed
            .slice(0, 2)
            .map((s) => s.name)
            .join('、')}${failed.length > 2 ? ' 等' : ''}）`
        : '';
      if (ok > 0) {
        afterChange(`已上传 ${ok} 个文件到「${selectedDirLabel}」${failText}`);
      } else if (failed.length) {
        messageApi.error(failed[0].reason || '上传失败');
        void loadTree();
      }
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress([]), 1200);
    }
  };

  const treeData = useMemo(() => {
    if (!tree) return [];
    return [toTreeData(tree, confirmDeleteDir, openMkdir)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const fileColumns: TableColumnsType<PitchFileNode> = [
    { title: '文件名', dataIndex: 'name', ellipsis: true },
    { title: '类型', dataIndex: 'ext', width: 80, render: (v: string) => (v ? <Tag>{v.toUpperCase()}</Tag> : '—') },
    { title: '大小', dataIndex: 'sizeText', width: 100 },
    {
      title: '操作',
      key: 'act',
      width: 90,
      render: (_: unknown, row: PitchFileNode) => (
        <Button type="link" size="small" danger className="!px-0" onClick={() => deleteFile(row)}>
          删除
        </Button>
      ),
    },
  ];

  return (
    <div className="mt-2">
      {contextHolder}
      {modalContextHolder}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          当前目录：<span className="font-medium text-gray-900">{selectedDirLabel}</span>
          <span className="ml-2 text-xs text-gray-400">（{currentNode?.fileCount ?? 0} 个文件 · 右键目录名可新建/删除目录）</span>
        </div>
        <Space wrap>
          <Button
            disabled={!selectedRowKeys.length || batchDownloading}
            loading={batchDownloading}
            onClick={() => void downloadSelected()}
          >
            下载所选{selectedRowKeys.length ? `(${selectedRowKeys.length})` : ''}
          </Button>
          <Button loading={loading} onClick={() => void loadTree()}>
            刷新目录
          </Button>
        </Space>
      </div>

      {/* 桌面端：面板高度撑满视口剩余空间（扣除顶部 header/tabs/状态条/工具行），左右等高、各自内部滚动 */}
      <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-stretch min-[900px]:h-[calc(100dvh-12.5rem)] min-[900px]:min-h-[440px]">
        <div className="w-full min-[900px]:w-[320px] flex-shrink-0 rounded-lg border border-gray-100 bg-white p-2 max-h-[440px] overflow-auto min-[900px]:max-h-none min-[900px]:h-full">
          <Spin spinning={loading && !tree}>
            {treeData.length ? (
              <Tree
                blockNode
                showLine
                switcherIcon={({ expanded }: { expanded?: boolean }) => (
                  <i
                    className={`${
                      expanded ? 'ri-folder-open-line' : 'ri-folder-line'
                    } text-amber-500 text-sm leading-none`}
                  />
                )}
                treeData={treeData}
                selectedKeys={[selectedDir]}
                onSelect={(keys) => {
                  const key = keys.length ? String(keys[0]) : '';
                  setSelectedDir(key);
                }}
              />
            ) : (
              <div className="p-4 text-sm text-gray-400">暂无目录</div>
            )}
          </Spin>
        </div>
        <div className="flex-1 min-w-0 rounded-lg border border-gray-100 bg-white p-3 flex flex-col min-[900px]:h-full">
          {/* 文件列表右上角：上传到当前目录 */}
          <div className="mb-2 flex items-center justify-between gap-2 shrink-0">
            <div className="text-sm font-medium text-gray-700">文件</div>
            <Space size="small">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                tabIndex={-1}
                aria-hidden
                style={{ display: 'none' }}
                onChange={handleUploadFiles}
              />
              <Button
                size="small"
                type="primary"
                loading={uploading}
                disabled={mutating}
                onClick={() => fileInputRef.current?.click()}
              >
                上传到当前目录
              </Button>
            </Space>
          </div>
          {uploadProgress.length > 0 && (
            <div className="mb-2 shrink-0 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 space-y-1">
              {uploadProgress.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-xs">
                  <span className="w-48 truncate text-gray-600" title={p.name}>{p.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all"
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                  <span className="text-gray-400 tabular-nums w-8 text-right">{p.percent}%</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-auto">
            <Table<PitchFileNode>
              rowKey="relPath"
              size="small"
              loading={loading}
              pagination={false}
              columns={fileColumns}
              dataSource={currentNode?.files || []}
              locale={{ emptyText: '当前目录没有文件（根目录的索引文件不在此显示）' }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys.map(String)),
              }}
            />
          </div>
        </div>
      </div>

      <Modal
        title="新建子目录"
        open={mkdirOpen}
        onCancel={() => setMkdirOpen(false)}
        onOk={() => void submitMkdir()}
        confirmLoading={mutating}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <div className="text-xs text-gray-500 mb-2">
          上级目录：{mkdirParent || '根目录（pitch-templates）'}
        </div>
        <Input
          value={mkdirName}
          onChange={(e) => setMkdirName(e.target.value)}
          placeholder="目录名，支持中文；可用 / 创建多级，如 05 新行业/01 方案"
          onPressEnter={() => void submitMkdir()}
        />
      </Modal>
    </div>
  );
}
