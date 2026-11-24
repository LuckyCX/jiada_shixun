/**
 * 创业路演模板库：分类检索 + 目录树 + 文件列表（多选下载）+ 精简预览（无进度/笔记）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import DocumentReader, {
  type DocumentReaderChromeState,
  type DocumentReaderHandle,
} from '../knowledge-system/components/DocumentReader';
import {
  downloadPitchFile,
  downloadPitchFilesBatch,
  fetchPitchCatalogIndex,
  fetchPitchCategory,
  pitchFileUrl,
  type PitchCatalogIndex,
  type PitchCategoryDetail,
  type PitchDirNode,
  type PitchFileItem,
} from '../../lib/pitchTemplatesApi';

function fileIcon(kind: string, ext: string) {
  if (kind === 'pdf' || ext === 'pdf') return 'ri-file-pdf-2-line text-red-500';
  if (kind === 'office') {
    if (ext.startsWith('ppt')) return 'ri-slideshow-2-line text-orange-500';
    if (ext.startsWith('xls')) return 'ri-file-excel-2-line text-emerald-600';
    return 'ri-file-word-2-line text-blue-500';
  }
  if (kind === 'image') return 'ri-image-line text-purple-500';
  if (kind === 'video') return 'ri-video-line text-pink-500';
  if (kind === 'audio') return 'ri-music-2-line text-teal-500';
  if (kind === 'archive') return 'ri-file-zip-line text-amber-600';
  return 'ri-file-text-line text-gray-500';
}

function findNodeByPath(root: PitchDirNode, relPath: string): PitchDirNode | null {
  if (!relPath || relPath === root.relPath) return root;
  const queue: PitchDirNode[] = [root];
  while (queue.length) {
    const n = queue.shift()!;
    if (n.relPath === relPath) return n;
    queue.push(...(n.children || []));
  }
  return null;
}

function collectFiles(node: PitchDirNode, acc: PitchFileItem[] = []): PitchFileItem[] {
  for (const f of node.files || []) acc.push(f);
  for (const c of node.children || []) collectFiles(c, acc);
  return acc;
}

function DirTree({
  node,
  depth,
  activePath,
  onSelect,
}: {
  node: PitchDirNode;
  depth: number;
  activePath: string;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = (node.children || []).length > 0;
  const active = activePath === node.relPath;
  const indent = 6 + depth * 16;

  return (
    <div>
      <div className="relative">
        {/* 缩进参考线：每层一条竖线，层级一目了然 */}
        {Array.from({ length: depth }).map((_, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 w-px bg-gray-200"
            style={{ left: 6 + i * 16 + 7 }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            onSelect(node.relPath);
            if (hasChildren) setOpen((v) => !v);
          }}
          className={`relative w-full flex items-center gap-1.5 pr-2 py-1.5 rounded-lg text-left text-sm cursor-pointer ${
            active ? 'bg-teal-50 text-teal-800 font-medium' : 'text-gray-700 hover:bg-gray-50'
          }`}
          style={{ paddingLeft: indent + 8 }}
        >
          {hasChildren ? (
            <i
              className={`${
                open ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'
              } text-gray-400 w-3.5 shrink-0`}
            />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <i
            className={`${
              hasChildren && open ? 'ri-folder-open-line' : 'ri-folder-line'
            } shrink-0 ${active ? 'text-teal-600' : 'text-amber-500'}`}
          />
          <span className="truncate flex-1">{node.name}</span>
          <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{node.fileCount}</span>
        </button>
      </div>
      {open &&
        (node.children || []).map((c) => (
          <DirTree key={c.id} node={c} depth={depth + 1} activePath={activePath} onSelect={onSelect} />
        ))}
    </div>
  );
}

function PreviewPane({ file, onBack }: { file: PitchFileItem; onBack: () => void }) {
  const previewUrl = pitchFileUrl('preview', file.relPath);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState('');
  const docRef = useRef<DocumentReaderHandle>(null);
  const [chrome, setChrome] = useState<DocumentReaderChromeState>({ page: 1, pageCount: 1, zoom: 100 });
  const [jumpPage, setJumpPage] = useState('');
  const isDocPreview = file.kind === 'pdf' || file.kind === 'office';
  const docProgress =
    isDocPreview && chrome.pageCount > 0 ? Math.round((chrome.page / chrome.pageCount) * 100) : 0;

  // 页码变化时同步跳页输入框
  useEffect(() => {
    setJumpPage('');
  }, [chrome.page, file.id]);

  useEffect(() => {
    setTextContent(null);
    setTextError('');
    if (file.kind !== 'text') return;
    let cancelled = false;
    fetch(previewUrl)
      .then((r) => {
        if (!r.ok) throw new Error('无法加载文本');
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setTextContent(t);
      })
      .catch((e) => {
        if (!cancelled) setTextError(e instanceof Error ? e.message : '加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [file.relPath, file.kind, previewUrl]);

  const onDownload = async () => {
    try {
      await downloadPitchFile(file.relPath, file.name);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '下载失败');
    }
  };

  const jumpToPage = () => {
    const p = parseInt(jumpPage, 10);
    if (!Number.isFinite(p) || p < 1 || p > chrome.pageCount) {
      message.warning(`请输入 1 ~ ${chrome.pageCount} 之间的页码`);
      return;
    }
    docRef.current?.goToPage(p);
    setJumpPage('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* 单一顶部 titleHeader：左侧=返回+标题；右侧=缩放/翻页/下载等操作按钮（统一 h-8） */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white rounded-t-2xl">
        {/* 左侧：返回 + 文件信息 */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            title="返回列表"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 cursor-pointer shrink-0"
          >
            <i className="ri-arrow-left-line text-lg" />
          </button>
          <i className={`${fileIcon(file.kind, file.ext)} text-xl shrink-0`} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate max-w-[260px] lg:max-w-[360px]">
              {file.name}
            </div>
            <div className="text-[11px] text-gray-400 truncate">
              {file.sizeText} · {file.ext || '文件'}
              {isDocPreview ? ` · 第 ${chrome.page} / ${chrome.pageCount} 页` : ''}
            </div>
          </div>
        </div>

        {/* 右侧：操作按钮区（统一高度 h-8 / 32px） */}
        {isDocPreview && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center h-8 rounded-lg bg-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => docRef.current?.zoomOut()}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-200 cursor-pointer"
                title="缩小"
              >
                <i className="ri-subtract-line text-sm" />
              </button>
              <span className="text-xs font-medium text-gray-700 w-10 text-center tabular-nums">{chrome.zoom}%</span>
              <button
                type="button"
                onClick={() => docRef.current?.zoomIn()}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-200 cursor-pointer"
                title="放大"
              >
                <i className="ri-add-line text-sm" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => docRef.current?.resetZoom()}
              className="h-8 px-3 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg cursor-pointer whitespace-nowrap"
            >
              适应宽度
            </button>
            <div className="flex items-center h-8 rounded-lg bg-gray-100 overflow-hidden">
              <button
                type="button"
                disabled={chrome.page <= 1}
                onClick={() => docRef.current?.prevPage()}
                title="上一页"
                className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <i className="ri-arrow-left-s-line text-base" />
              </button>
              <span className="text-xs font-medium text-gray-700 w-12 text-center tabular-nums">
                {chrome.page} / {chrome.pageCount}
              </span>
              <button
                type="button"
                disabled={chrome.page >= chrome.pageCount}
                onClick={() => docRef.current?.nextPage()}
                title="下一页"
                className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <i className="ri-arrow-right-s-line text-base" />
              </button>
            </div>
            <div className="flex items-center h-8 rounded-lg bg-gray-100 overflow-hidden">
              <input
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') jumpToPage();
                }}
                placeholder={`1 ~ ${chrome.pageCount}`}
                title={`跳转至页码（1 ~ ${chrome.pageCount}）`}
                className="w-14 h-8 pl-2 pr-1 border-0 bg-transparent text-center text-xs font-medium text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-teal-400 placeholder:text-gray-400 placeholder:font-normal"
              />
              <button
                type="button"
                onClick={jumpToPage}
                title="跳转到输入的页码"
                className="h-8 px-2.5 flex items-center text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 cursor-pointer whitespace-nowrap"
              >
                跳转
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void onDownload()}
          className="h-8 px-3.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-cyan-600 shadow-sm hover:shadow cursor-pointer whitespace-nowrap shrink-0"
        >
          <i className="ri-download-line mr-1" />
          下载
        </button>
      </div>

      {/* 进度条：紧贴 header 下方通栏 */}
      {isDocPreview && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-gray-100">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-300"
              style={{ width: `${docProgress}%` }}
            />
          </div>
          <span className="text-xs text-teal-600 font-medium tabular-nums shrink-0">{docProgress}%</span>
        </div>
      )}

      <div
        className={`flex-1 min-h-0 bg-slate-50 rounded-b-2xl border border-t-0 border-gray-100 ${
          file.kind === 'pdf' || file.kind === 'office' ? 'overflow-hidden' : 'overflow-auto p-4'
        }`}
      >
        {!file.previewable ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3 py-16">
            <i className="ri-file-forbid-line text-4xl text-gray-300" />
            <p className="text-sm">该格式暂不支持在线预览，请下载后查看</p>
            <button
              type="button"
              onClick={() => void onDownload()}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm cursor-pointer"
            >
              下载文件
            </button>
          </div>
        ) : file.kind === 'image' ? (
          <div className="flex justify-center pt-4">
            <img src={previewUrl} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg shadow" />
          </div>
        ) : file.kind === 'video' ? (
          <div className="flex items-center justify-center h-full p-4">
            <video src={previewUrl} controls className="w-full max-h-full rounded-lg bg-black" />
          </div>
        ) : file.kind === 'audio' ? (
          <div className="flex justify-center py-20">
            <audio src={previewUrl} controls className="w-full max-w-xl" />
          </div>
        ) : file.kind === 'text' ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-white border border-gray-100 rounded-xl p-4 min-h-[40vh]">
            {textError || textContent || '加载中…'}
          </pre>
        ) : file.kind === 'pdf' || file.kind === 'office' ? (
          <DocumentReader
            key={file.id}
            ref={docRef}
            hideChrome
            fillHeight
            initialZoom={50}
            title={file.name}
            resourceId={file.id}
            previewUrl={previewUrl}
            downloadUrl={pitchFileUrl('download', file.relPath)}
            mimeType="application/pdf"
            pageCount={1}
            onChromeState={setChrome}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3 py-16">
            <p className="text-sm">请下载后使用本地软件打开</p>
            <button
              type="button"
              onClick={() => void onDownload()}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm cursor-pointer"
            >
              下载文件
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PitchTemplateLibrary() {
  const [index, setIndex] = useState<PitchCatalogIndex | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [catId, setCatId] = useState<string>('');
  const [detail, setDetail] = useState<PitchCategoryDetail | null>(null);
  const [loadingCat, setLoadingCat] = useState(false);
  const [dirPath, setDirPath] = useState('');
  const [keyword, setKeyword] = useState('');
  const [previewFile, setPreviewFile] = useState<PitchFileItem | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchDownloading, setBatchDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingIndex(true);
    fetchPitchCatalogIndex()
      .then((data) => {
        if (cancelled) return;
        setIndex(data);
        if (data.categories?.[0]) setCatId(data.categories[0].id);
      })
      .catch((e) => {
        if (!cancelled) message.error(e instanceof Error ? e.message : '加载目录失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingIndex(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!catId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingCat(true);
    setPreviewFile(null);
    fetchPitchCategory(catId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setDirPath(data.tree?.relPath || '');
      })
      .catch((e) => {
        if (!cancelled) message.error(e instanceof Error ? e.message : '加载分类失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingCat(false);
      });
    return () => {
      cancelled = true;
    };
  }, [catId]);

  const currentNode = useMemo(() => {
    if (!detail?.tree) return null;
    return findNodeByPath(detail.tree, dirPath) || detail.tree;
  }, [detail, dirPath]);

  const searchHits = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q || !detail?.tree) return null;
    return collectFiles(detail.tree).filter((f) => f.name.toLowerCase().includes(q));
  }, [keyword, detail]);

  const listFiles = searchHits || currentNode?.files || [];

  // 列表变化（切目录/切分类/搜索）时清空多选
  useEffect(() => {
    setSelectedKeys(new Set());
  }, [dirPath, catId, keyword]);

  const allSelected = listFiles.length > 0 && listFiles.every((f) => selectedKeys.has(f.relPath));
  const selectedFiles = useMemo(
    () => listFiles.filter((f) => selectedKeys.has(f.relPath)),
    [listFiles, selectedKeys]
  );

  const toggleSelect = (f: PitchFileItem) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(f.relPath)) next.delete(f.relPath);
      else next.add(f.relPath);
      return next;
    });
  };

  const invertSelect = () => {
    setSelectedKeys((prev) => {
      const next = new Set<string>();
      for (const f of listFiles) if (!prev.has(f.relPath)) next.add(f.relPath);
      return next;
    });
  };

  const clearSelect = () => setSelectedKeys(new Set());

  const selectAll = () => setSelectedKeys(new Set(listFiles.map((f) => f.relPath)));

  const downloadSelected = async () => {
    if (!selectedFiles.length) {
      message.warning('请先勾选要下载的文件');
      return;
    }
    setBatchDownloading(true);
    try {
      const { ok, failed } = await downloadPitchFilesBatch(selectedFiles, (done, total) => {
        message.loading({ content: `正在下载 ${done}/${total}…`, key: 'pitch-batch', duration: 0 });
      });
      message.destroy('pitch-batch');
      if (failed.length) {
        message.warning(
          `已下载 ${ok} 个，失败 ${failed.length} 个：${failed
            .slice(0, 2)
            .map((f) => f.name)
            .join('、')}${failed.length > 2 ? ' 等' : ''}`
        );
      } else {
        message.success(`已下载 ${ok} 个文件`);
      }
      setSelectedKeys(new Set());
    } catch (e) {
      message.destroy('pitch-batch');
      message.error(e instanceof Error ? e.message : '下载失败');
    } finally {
      setBatchDownloading(false);
    }
  };

  const onPickFile = useCallback((f: PitchFileItem) => {
    setPreviewFile(f);
  }, []);

  if (previewFile) {
    return (
      <div className="h-full">
        <PreviewPane file={previewFile} onBack={() => setPreviewFile(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">创业路演模板库</h2>
        <p className="text-sm text-gray-500">
          比赛路演 PPT / 商业计划书参考样板，支持检索、预览与下载
          {index ? ` · 共 ${index.totalFiles} 个文件` : ''}
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="快捷搜索当前分类下的文件名…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(index?.categories || []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setKeyword('');
              setCatId(c.id);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-all ${
              catId === c.id
                ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c.name}
            <span className="ml-1 opacity-70">({c.fileCount})</span>
          </button>
        ))}
      </div>

      {loadingIndex || loadingCat ? (
        <div className="py-16 text-center text-sm text-gray-400">加载中…</div>
      ) : !index?.categories?.length ? (
        <div className="py-16 text-center text-sm text-gray-500">
          暂无模板。请将文件放到项目 <code className="text-teal-700">resource/pitch-templates/</code> 后执行扫描脚本。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[55vh]">
          <aside className="md:col-span-4 lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-3 overflow-y-auto max-h-[70vh]">
            <div className="text-xs font-semibold text-gray-400 px-2 py-1 mb-1">目录</div>
            {detail?.tree ? (
              <DirTree node={detail.tree} depth={0} activePath={dirPath} onSelect={setDirPath} />
            ) : (
              <p className="text-xs text-gray-400 px-2">无目录</p>
            )}
          </aside>

          <section className="md:col-span-8 lg:col-span-9 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[70vh]">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {searchHits ? `搜索「${keyword.trim()}」` : currentNode?.name || '文件'}
                </div>
                <div className="text-xs text-gray-400 shrink-0">{listFiles.length} 个文件</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={allSelected ? clearSelect : selectAll}
                  className="px-2.5 py-1 rounded-lg text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer"
                >
                  {allSelected ? '取消全选' : '全选'}
                </button>
                <button
                  type="button"
                  onClick={invertSelect}
                  className="px-2.5 py-1 rounded-lg text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer"
                >
                  反选
                </button>
                <button
                  type="button"
                  disabled={!selectedKeys.size || batchDownloading}
                  onClick={() => void downloadSelected()}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <i className="ri-download-2-line mr-1" />
                  下载所选{selectedKeys.size ? `(${selectedKeys.size})` : ''}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {!listFiles.length ? (
                <div className="py-16 text-center text-sm text-gray-400">当前目录暂无文件</div>
              ) : (
                listFiles.map((f) => {
                  const checked = selectedKeys.has(f.relPath);
                  return (
                    <div
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onPickFile(f)}
                      onKeyDown={(e) => e.key === 'Enter' && onPickFile(f)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors ${
                        checked ? 'bg-teal-50/70' : 'hover:bg-teal-50/50'
                      }`}
                    >
                      <span
                        role="checkbox"
                        aria-checked={checked}
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(f);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.stopPropagation();
                            e.preventDefault();
                            toggleSelect(f);
                          }
                        }}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                          checked
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-gray-300 bg-white hover:border-teal-500'
                        }`}
                      >
                        {checked && <i className="ri-check-line text-[11px] leading-none" />}
                      </span>
                      <i className={`${fileIcon(f.kind, f.ext)} text-xl shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{f.name}</div>
                        <div className="text-xs text-gray-400 truncate">
                          {f.sizeText}
                          {!f.previewable ? ' · 仅下载' : ''}
                          {searchHits ? ` · ${f.relPath}` : ''}
                        </div>
                      </div>
                      <i className="ri-arrow-right-s-line text-gray-300" />
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
