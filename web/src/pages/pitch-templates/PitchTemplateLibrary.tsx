/**
 * 创业路演模板库：分类检索 + 目录树 + 文件列表（多选下载）+ 精简预览（无进度/笔记）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message, Pagination } from 'antd';
import * as XLSX from 'xlsx';
import DocumentReader, {
  type DocumentReaderChromeState,
  type DocumentReaderHandle,
} from '../knowledge-system/components/DocumentReader';
import {
  downloadPitchFile,
  downloadPitchFilesBatch,
  fetchPitchAllTree,
  fetchFileBlob,
  pitchFileUrl,
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

/** 文件类型分组 key（供快捷筛选 tag 使用） */
function typeTagOf(f: PitchFileItem): string {
  const ext = f.ext || '';
  if (f.kind === 'image') return 'image';
  if (f.kind === 'video') return 'video';
  if (f.kind === 'audio') return 'audio';
  if (f.kind === 'archive') return 'archive';
  if (f.kind === 'pdf') return 'pdf';
  if (f.kind === 'office') {
    if (ext.startsWith('ppt')) return 'ppt';
    if (ext.startsWith('xls')) return 'excel';
    return 'word';
  }
  if (f.kind === 'text') return 'text';
  return 'other';
}

const TYPE_TAG_LABEL: Record<string, { label: string; icon: string }> = {
  word: { label: 'Word', icon: 'ri-file-word-2-line' },
  ppt: { label: 'PPT', icon: 'ri-slideshow-2-line' },
  excel: { label: 'Excel', icon: 'ri-file-excel-2-line' },
  pdf: { label: 'PDF', icon: 'ri-file-pdf-2-line' },
  image: { label: '图片', icon: 'ri-image-line' },
  video: { label: '视频', icon: 'ri-video-line' },
  audio: { label: '音频', icon: 'ri-music-2-line' },
  archive: { label: '压缩包', icon: 'ri-file-zip-line' },
  text: { label: '文本', icon: 'ri-file-text-line' },
  other: { label: '其他', icon: 'ri-file-text-line' },
};

function DirTree({
  node,
  depth,
  activePath,
  expanded,
  onToggle,
  onSelect,
}: {
  node: PitchDirNode;
  depth: number;
  activePath: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const open = expanded.has(node.relPath);
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
            if (hasChildren) onToggle(node.relPath);
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
          <DirTree
            key={c.id}
            node={c}
            depth={depth + 1}
            activePath={activePath}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

const EXCEL_MAX_ROWS = 2000;

/** Excel 预览：SheetJS 解析原始文件，渲染真实表格样式（多 Sheet 切换） */
function ExcelViewer({ relPath }: { relPath: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [truncated, setTruncated] = useState(false);
  const wbRef = useRef<XLSX.WorkBook | null>(null);

  // 加载原始文件并解析工作簿
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setSheetNames([]);
    setActiveSheet('');
    setMatrix([]);
    wbRef.current = null;
    (async () => {
      try {
        const buf = await fetchFileBlob(relPath);
        const wb = XLSX.read(buf, { type: 'array' });
        if (cancelled) return;
        wbRef.current = wb;
        setSheetNames(wb.SheetNames);
        setActiveSheet(wb.SheetNames[0] || '');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '表格解析失败，请下载后查看');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [relPath]);

  // 切换 Sheet 时提取单元格矩阵
  useEffect(() => {
    if (!wbRef.current || !activeSheet) {
      setMatrix([]);
      return;
    }
    const ws = wbRef.current.Sheets[activeSheet];
    if (!ws) {
      setMatrix([]);
      return;
    }
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    }) as string[][];
    const capped = rows.slice(0, EXCEL_MAX_ROWS);
    setMatrix(capped);
    setTruncated(rows.length > EXCEL_MAX_ROWS);
  }, [activeSheet]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-teal-600">
        <i className="ri-loader-4-line text-3xl animate-spin" />
        <p className="text-sm text-gray-500">正在解析表格…</p>
      </div>
    );
  }
  if (error || !matrix.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3 py-16">
        <i className="ri-file-excel-2-line text-4xl text-gray-300" />
        <p className="text-sm">{error || '该表格暂无可显示内容，请下载后查看'}</p>
      </div>
    );
  }
  const colCount = Math.max(...matrix.map((r) => r.length), 1);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sheet 切换栏 */}
      {sheetNames.length > 1 && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 bg-white overflow-x-auto shrink-0">
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheet(name)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                activeSheet === name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {truncated && (
        <div className="px-3 py-1.5 text-xs text-amber-600 bg-amber-50 border-b border-amber-100 shrink-0">
          内容较多，仅显示前 {EXCEL_MAX_ROWS} 行，完整内容请下载后查看
        </div>
      )}
      {/* 表格主体：真实表格样式，表头吸顶，行列可滚动 */}
      <div className="flex-1 min-h-0 overflow-auto bg-white">
        <table className="border-collapse text-[13px] min-w-full">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-slate-100 border border-slate-200 px-2 py-1.5 text-gray-400 font-normal w-10 text-center">
                #
              </th>
              {Array.from({ length: colCount }, (_, i) => (
                <th
                  key={i}
                  className="sticky top-0 z-10 bg-slate-100 border border-slate-200 px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap"
                >
                  {XLSX.utils.encode_col(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'bg-slate-50/60' : ''}>
                <td className="sticky left-0 z-10 bg-slate-50 border border-slate-200 px-2 py-1 text-gray-400 text-xs text-center tabular-nums">
                  {ri + 1}
                </td>
                {Array.from({ length: colCount }, (_, ci) => (
                  <td
                    key={ci}
                    className="border border-slate-200 px-3 py-1 text-gray-800 whitespace-nowrap max-w-[360px] overflow-hidden text-ellipsis"
                  >
                    {row[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const isExcel = file.kind === 'office' && file.ext.startsWith('xls');
  const isDocPreview = (file.kind === 'pdf' || file.kind === 'office') && !isExcel;
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
        ) : isExcel ? (
          <div className="h-full overflow-hidden">
            <ExcelViewer relPath={file.relPath} />
          </div>
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


/**
 * 总分类筛选：按文件类型过滤左侧目录树（仅保留含该类型资源的目录分支）与右侧资源列表
 */
function filterTreeByType(node: PitchDirNode, type: string): PitchDirNode | null {
  const files = (node.files || []).filter((f) => (f.type || typeTagOf(f)) === type);
  const children = (node.children || [])
    .map((c) => filterTreeByType(c, type))
    .filter((c): c is PitchDirNode => c !== null);
  if (!files.length && !children.length) return null;
  return {
    ...node,
    files,
    children,
    fileCount: files.length + children.reduce((s, c) => s + c.fileCount, 0),
  };
}

export default function PitchTemplateLibrary() {
  const [allTree, setAllTree] = useState<PitchDirNode | null>(null);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [loadingTree, setLoadingTree] = useState(true);
  /** 树高亮节点（搜索定位/点击目录时更新） */
  const [highlightPath, setHighlightPath] = useState('');
  /** 右侧列表数据源目录；空 = 全库模式（显示所选类型的全部资源） */
  const [browseDir, setBrowseDir] = useState('');
  // 搜索：searchTerm 为输入框实时值，keyword 为提交后生效的关键词
  const [searchTerm, setSearchTerm] = useState('');
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<PitchFileItem | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchDownloading, setBatchDownloading] = useState(false);

  /** 默认展开：根目录 + 全部一级目录（分类一开始即展示，展开形式） */
  const defaultExpanded = useCallback(
    (tree: PitchDirNode) => new Set([tree.relPath, ...(tree.children || []).map((c) => c.relPath)]),
    []
  );
  const defaultDirPath = useCallback(
    (tree: PitchDirNode) => tree.children?.[0]?.relPath || tree.relPath,
    []
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingTree(true);
    fetchPitchAllTree()
      .then((data) => {
        if (cancelled || !data?.tree) return;
        setAllTree(data.tree);
        setTypeCounts(data.typeCounts || {});
        setExpandedPaths(defaultExpanded(data.tree));
        setBrowseDir(defaultDirPath(data.tree));
        setHighlightPath(defaultDirPath(data.tree));
      })
      .catch((e) => {
        if (!cancelled) message.error(e instanceof Error ? e.message : '加载目录失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingTree(false);
      });
    return () => {
      cancelled = true;
    };
  }, [defaultExpanded, defaultDirPath]);

  // 全目录搜索（跨所有一级目录）
  const searchHits = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q || !allTree) return null;
    return collectFiles(allTree).filter((f) => f.name.toLowerCase().includes(q));
  }, [keyword, allTree]);

  const typeMatch = useCallback(
    (f: PitchFileItem) => typeFilter === 'all' || (f.type || typeTagOf(f)) === typeFilter,
    [typeFilter]
  );

  // 右侧列表：搜索结果 ∩ 类型 > 目录模式 > 全库模式（所选类型全部资源）
  const baseList = useMemo(() => {
    if (!allTree) return [];
    if (searchHits) return searchHits.filter(typeMatch);
    if (browseDir) {
      const node = findNodeByPath(allTree, browseDir);
      return (node?.files || []).filter(typeMatch);
    }
    return collectFiles(allTree).filter(typeMatch);
  }, [allTree, searchHits, browseDir, typeMatch]);

  const listFiles = baseList;
  /** 分页：类型 tag 命中数千文件时全量渲染会卡死浏览器，每页固定条数 */
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pageCount = Math.max(1, Math.ceil(listFiles.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedFiles = useMemo(
    () => listFiles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [listFiles, safePage]
  );
  /** 全库模式（搜索或未选目录）下显示完整路径 */
  const showFullPath = !!searchHits || !browseDir;

  // 类型筛选下的左侧目录树：只保留含该类型资源的目录分支
  const displayTree = useMemo(() => {
    if (!allTree) return null;
    if (typeFilter === 'all') return allTree;
    return filterTreeByType(allTree, typeFilter);
  }, [allTree, typeFilter]);

  /** 点击类型 tag：过滤树 + 自动展开一级目录 + 列表切到全库该类型资源 */
  const selectType = useCallback(
    (k: string) => {
      setTypeFilter(k);
      setSelectedKeys(new Set());
      if (k === 'all') {
        if (allTree) {
          setExpandedPaths(defaultExpanded(allTree));
          const def = defaultDirPath(allTree);
          setBrowseDir(def);
          setHighlightPath(def);
        }
        return;
      }
      if (allTree) {
        const filtered = filterTreeByType(allTree, k);
        setExpandedPaths(filtered ? defaultExpanded(filtered) : new Set());
      }
      setBrowseDir('');
      setHighlightPath('');
    },
    [allTree, defaultExpanded, defaultDirPath]
  );

  /** 展开并高亮定位到文件所在目录（不改变右侧列表数据源）；须包含根路径否则整树会收起 */
  const locateToFileDir = useCallback((relPath: string) => {
    const parts = relPath.split('/');
    const ancestors: string[] = [];
    for (let i = 1; i < parts.length; i++) ancestors.push(parts.slice(0, i).join('/'));
    setExpandedPaths(new Set(['', ...ancestors]));
    setHighlightPath(ancestors[ancestors.length - 1] || '');
  }, []);

  const toggleExpand = useCallback((p: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  /** 提交搜索：全目录匹配，自动展开定位到第一个结果所在目录 */
  const commitSearch = useCallback(() => {
    const q = searchTerm.trim();
    setKeyword(q);
    if (!q) return;
    if (!allTree) {
      message.warning('目录数据尚未加载完成，请稍后再试');
      return;
    }
    const hits = collectFiles(allTree).filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
    if (hits.length) {
      locateToFileDir(hits[0].relPath);
    } else {
      message.info('全部目录中未找到匹配的文件');
    }
  }, [searchTerm, allTree, locateToFileDir]);

  // 列表变化（切目录/切类型/搜索）时清空多选并回到第一页
  useEffect(() => {
    setSelectedKeys(new Set());
    setPage(1);
  }, [browseDir, keyword, typeFilter]);

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

  const browseNode = browseDir && allTree ? findNodeByPath(allTree, browseDir) : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">创业路演模板库</h2>
        <p className="text-sm text-gray-500">
          {allTree ? `  共 ${typeCounts && Object.keys(typeCounts).length ? Object.values(typeCounts).reduce((a, b) => a + b, 0) : allTree.fileCount} 个文件` : ''}
        </p>
      </div>

      {/* 搜索栏 + 确定按钮（全目录搜索） */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value && keyword) setKeyword('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
            placeholder="搜索全部目录中的文件名，回车或点击确定…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setKeyword('');
                if (allTree) {
                  setExpandedPaths(defaultExpanded(allTree));
                  const def = defaultDirPath(allTree);
                  setBrowseDir(def);
                  setHighlightPath(def);
                }
              }}
              title="清除搜索"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <i className="ri-close-circle-fill" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={commitSearch}
          className="h-[42px] px-5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-cyan-600 shadow-sm hover:shadow cursor-pointer shrink-0"
        >
          确定
        </button>
      </div>

      {/* 总分类功能区：全库文件类型统计（目录索引生成时分析），进页面即可见；点击过滤目录与资源 */}
      {!loadingTree && allTree && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectType('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-all ${
              typeFilter === 'all'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部
            <span className="ml-1 opacity-70">
              ({Object.values(typeCounts).reduce((a, b) => a + b, 0) || allTree.fileCount})
            </span>
          </button>
          {Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([k, count]) => {
              const meta = TYPE_TAG_LABEL[k] || TYPE_TAG_LABEL.other;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => selectType(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-all inline-flex items-center gap-1 ${
                    typeFilter === k
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <i className={`${meta.icon} text-[13px]`} />
                  {meta.label}
                  <span className="opacity-70">({count})</span>
                </button>
              );
            })}
        </div>
      )}

      {loadingTree ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-teal-600">
          <i className="ri-loader-4-line text-3xl animate-spin" />
          <p className="text-sm text-gray-500">正在加载资源目录…</p>
        </div>
      ) : !allTree ? (
        <div className="py-16 text-center text-sm text-gray-500">暂无模板</div>
      ) : !displayTree ? (
        <div className="py-16 text-center text-sm text-gray-500">
          该分类下暂无资源，请选择其他分类
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[55vh]">
          <aside className="md:col-span-4 lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-3 overflow-y-auto max-h-[70vh]">
            <div className="text-xs font-semibold text-gray-400 px-2 py-1 mb-1">
              {typeFilter === 'all' ? '资源目录' : `${TYPE_TAG_LABEL[typeFilter]?.label || typeFilter} · 相关目录`}
            </div>
            <DirTree
              node={displayTree}
              depth={0}
              activePath={highlightPath}
              expanded={expandedPaths}
              onToggle={toggleExpand}
              onSelect={(p) => {
                setBrowseDir(p);
                setHighlightPath(p);
              }}
            />
          </aside>

          <section className="md:col-span-8 lg:col-span-9 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[70vh]">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {searchHits
                    ? `全目录搜索「${keyword.trim()}」`
                    : browseNode
                      ? browseNode.name
                      : `${TYPE_TAG_LABEL[typeFilter]?.label || '全部'} · 全部目录`}
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
            <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {!listFiles.length ? (
                <div className="py-16 text-center text-sm text-gray-400">
                  {searchHits
                    ? '未找到匹配的文件'
                    : browseDir
                      ? '当前目录暂无文件'
                      : '该分类下暂无资源'}
                </div>
              ) : (
                pagedFiles.map((f) => {
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
                          {showFullPath ? ` · ${f.relPath}` : ''}
                        </div>
                      </div>
                      {showFullPath && (
                        <button
                          type="button"
                          title="在左侧目录中定位此文件所在目录"
                          onClick={(e) => {
                            e.stopPropagation();
                            locateToFileDir(f.relPath);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-teal-50 cursor-pointer shrink-0"
                        >
                          <i className="ri-focus-3-line text-base" />
                        </button>
                      )}
                      <i className="ri-arrow-right-s-line text-gray-300" />
                    </div>
                  );
                })
              )}
            </div>
            {/* 分页栏：超过一页时展示 */}
            {listFiles.length > PAGE_SIZE && (
              <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between gap-3 bg-white shrink-0">
                <span className="text-xs text-gray-500 shrink-0">
                  共 {listFiles.length} 个文件 · 第 {safePage}/{pageCount} 页
                </span>
                <Pagination
                  size="small"
                  current={safePage}
                  pageSize={PAGE_SIZE}
                  total={listFiles.length}
                  showSizeChanger={false}
                  showQuickJumper={pageCount > 10}
                  onChange={(p) => {
                    setPage(p);
                    listRef.current?.scrollTo({ top: 0 });
                  }}
                />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
