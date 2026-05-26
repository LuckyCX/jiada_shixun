import { useRef, useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface DocumentReaderProps {
  title: string;
  pageCount?: number;
  resourceId: string; // 新增：课件ID，用于保存进度
  previewUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
  initialPage?: number;
  initialStudySeconds?: number;
  initialCompleted?: boolean;
  onProgress?: (percent: number) => void;
  onSaveProgress?: (percent: number, lastPosition: { page?: number; scrollTop?: number; studySeconds?: number }, completed: boolean) => void;
  onComplete?: () => void;
}

export default function DocumentReader({
  title,
  pageCount = 12,
  resourceId,
  previewUrl,
  mimeType,
  initialPage = 1,
  initialStudySeconds = 0,
  initialCompleted = false,
  onProgress,
  onSaveProgress,
  onComplete,
}: DocumentReaderProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [realPageCount, setRealPageCount] = useState(pageCount);
  const [zoom, setZoom] = useState(100);
  const [completed, setCompleted] = useState(initialCompleted);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pageStartedAtRef = useRef(Date.now());
  const studySecondsRef = useRef(initialStudySeconds);
  const bottomSavedPageRef = useRef<number | null>(null);
  const [contentWidth, setContentWidth] = useState(720);
  const [showContinueTip, setShowContinueTip] = useState(false);

  const docPages = [
    {
      title: '第一章：概述与背景',
      content: `头脑风暴法（Brainstorming）由美国创意思维专家亚历克斯·奥斯本（Alex Osborn）于1939年首次提出，并在其1953年出版的《应用想象力》一书中系统阐述。

头脑风暴法是一种通过集体讨论，激发创意、产生大量想法的思维方法。其核心理念是：在特定的时间内，通过自由联想和集体讨论，尽可能多地产生创意，暂时搁置批判性思维，以数量带动质量。

**核心原则：**
1. 延迟判断：在创意生成阶段，禁止任何批评和评价
2. 自由联想：鼓励天马行空的想法，越奇特越好
3. 数量优先：追求创意数量，质量在后期筛选
4. 借鉴组合：鼓励在他人想法基础上进行延伸和组合`,
    },
    {
      title: '第二章：实施步骤',
      content: `**标准头脑风暴流程（5步法）：**

**Step 1：准备阶段（10分钟）**
- 明确问题陈述，确保所有参与者理解目标
- 组建多元化团队（5-8人为佳）
- 准备白板、便利贴等工具
- 营造轻松、无压力的氛围

**Step 2：热身阶段（5分钟）**
- 进行简短的创意热身练习
- 打破思维定势，激活创造力

**Step 3：发散阶段（20-30分钟）**
- 主持人宣布规则：不批评、不评价
- 参与者自由发言，记录所有想法
- 鼓励在他人想法上进行延伸

**Step 4：整理阶段（15分钟）**
- 对所有创意进行分类整理
- 合并相似想法，消除重复

**Step 5：评估阶段（20分钟）**
- 建立评估标准（可行性、创新性、价值）
- 投票或打分筛选最优创意`,
    },
    {
      title: '第三章：在创业中的应用',
      content: `**创业场景下的头脑风暴应用：**

头脑风暴在创业实践中有广泛应用，尤其适用于以下场景：

**1. 商业模式创新**
当团队面临商业模式设计时，可以围绕"如何为目标用户创造价值"展开头脑风暴，从收入来源、渠道通路、客户关系等多个维度发散思维。

**2. 产品功能设计**
在产品设计阶段，针对用户痛点进行头脑风暴，可以快速生成大量解决方案，再通过用户验证筛选最优方案。

**3. 营销策略制定**
面对目标市场，通过头脑风暴探索多元化的推广渠道和营销方式，往往能发现意想不到的低成本高效方案。

**案例：某校园外卖创业团队的头脑风暴实践**
该团队在30分钟内生成了47个创意，最终筛选出"15分钟极速配送+社交拼单"的核心模式，成功在校园市场占据领先地位。`,
    },
    {
      title: '第四章：常见误区与改进',
      content: `**头脑风暴的常见误区：**

**误区一：沉默效应**
问题：部分成员因顾虑他人评价而不敢发言
解决：采用"书面头脑风暴"（Brainwriting），每人先独立写下想法再分享

**误区二：从众效应**
问题：后发言者倾向于附和先发言者的观点
解决：采用匿名投票，或让每人先独立思考5分钟再开始讨论

**误区三：主题偏离**
问题：讨论逐渐偏离核心问题
解决：主持人需持续引导，将问题陈述保持可见

**误区四：评价过早**
问题：有人在创意生成阶段就开始批评
解决：明确规则，设立"创意保护期"

**改进版本：SCAMPER法**
在传统头脑风暴基础上，结合SCAMPER七个维度（替代、组合、调整、修改、其他用途、消除、重组），可以更系统地激发创意，避免思维盲区。`,
    },
  ];

  useEffect(() => {
    setCurrentPage(initialPage);
    setCompleted(initialCompleted);
    setShowContinueTip(initialPage > 1 && initialPage < pageCount);
    pageStartedAtRef.current = Date.now();
    studySecondsRef.current = initialStudySeconds;
    bottomSavedPageRef.current = null;
  }, [resourceId, initialPage, initialStudySeconds, initialCompleted, pageCount]);

  useEffect(() => {
    if (!showContinueTip) return;
    const timer = window.setTimeout(() => setShowContinueTip(false), 3000);
    return () => window.clearTimeout(timer);
  }, [showContinueTip]);

  useEffect(() => {
    if (!contentRef.current) return;
    const updateWidth = () => {
      const width = contentRef.current?.clientWidth || 720;
      setContentWidth(Math.max(320, width - 48));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const commitStudyTime = () => {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - pageStartedAtRef.current) / 1000);
    if (elapsedSeconds > 0) {
      studySecondsRef.current += elapsedSeconds;
    }
    pageStartedAtRef.current = now;
    return studySecondsRef.current;
  };

  const handlePageChange = (page: number) => {
    const totalPages = realPageCount || pageCount;
    const newPage = Math.max(1, Math.min(totalPages, page));
    setShowContinueTip(false);
    setCurrentPage(newPage);
    bottomSavedPageRef.current = null;
    const percent = Math.round((newPage / totalPages) * 100);
    const studySeconds = commitStudyTime();
    onProgress?.(percent);
    onSaveProgress?.(percent, { page: newPage, studySeconds }, percent >= 100);
    
    if (newPage === totalPages && !completed) {
      setCompleted(true);
      onComplete?.();
    }
  };

  const currentContent = docPages[Math.min(currentPage - 1, docPages.length - 1)];
  const totalPages = realPageCount || pageCount;
  const progressPercent = Math.round((currentPage / totalPages) * 100);
  const isImage = String(mimeType || '').startsWith('image/');
  const isPdf = String(mimeType || '').toLowerCase() === 'application/pdf' || String(previewUrl || '').toLowerCase().includes('.pdf');
  const pageWidth = Math.max(320, Math.round(contentWidth * (zoom / 100)));

  return (
    <div className="bg-gray-100 rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-190px)] min-h-[560px]">
      {/* 文档工具栏 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 flex items-center justify-center bg-red-100 rounded-lg">
            <i className="ri-file-pdf-line text-red-600 text-lg"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 truncate max-w-xs">{title}</p>
            <p className="text-xs text-gray-500">PDF 文档 · {pageCount} 页</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* 缩放控制 */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg px-2 py-1">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <i className="ri-subtract-line text-sm"></i>
            </button>
            <span className="text-xs font-medium text-gray-700 w-10 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 10))}
              className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <i className="ri-add-line text-sm"></i>
            </button>
          </div>
          <button
            onClick={() => setZoom(100)}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors whitespace-nowrap"
          >
            适应宽度
          </button>
          {/* <button
            onClick={() => {
              if (downloadUrl) window.open(downloadUrl, '_blank', 'noopener,noreferrer');
            }}
            className="w-8 h-8 flex items-center justify-center bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-lg transition-colors"
          >
            <i className="ri-download-line text-sm"></i>
          </button> */}
        </div>
      </div>

      {/* 文档内容区 */}
      <div
        ref={contentRef}
        className="p-6 overflow-auto flex-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
            const percent = Math.round((currentPage / totalPages) * 100);
            const studySeconds = bottomSavedPageRef.current === currentPage
              ? studySecondsRef.current
              : commitStudyTime();
            bottomSavedPageRef.current = currentPage;
            onSaveProgress?.(percent, { page: currentPage, scrollTop: el.scrollTop, studySeconds }, percent >= 100);
            if (percent >= 100 && !completed) {
              setCompleted(true);
              onComplete?.();
            }
          }
        }}
      >
        {previewUrl ? (
          <div className="bg-white rounded-xl shadow-md mx-auto overflow-hidden w-fit max-w-full">
            {isImage ? (
              <img
                src={previewUrl}
                alt={title}
                className="w-full object-contain bg-gray-50"
                onLoad={() => {
                  setCompleted(true);
                  onProgress?.(100);
                  onSaveProgress?.(100, { page: 1 }, true);
                  onComplete?.();
                }}
              />
            ) : isPdf ? (
              <Document
                file={previewUrl}
                onLoadSuccess={({ numPages }) => {
                  setRealPageCount(numPages);
                  setCurrentPage((prev) => Math.max(1, Math.min(prev, numPages)));
                }}
                loading={<div className="py-12 text-center text-sm text-gray-400">文档加载中...</div>}
                error={<div className="py-12 text-center text-sm text-red-500">文档加载失败</div>}
              >
                <Page pageNumber={currentPage} width={pageWidth} />
              </Document>
            ) : (
              <iframe src={previewUrl} title={title} className="w-full h-[340px] bg-white" />
            )}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">资源预览</span>
              {completed && <span className="text-xs text-green-600 font-medium"><i className="ri-checkbox-circle-fill mr-1"></i>已完成阅读</span>}
            </div>
          </div>
        ) : (
          <div
            className="bg-white rounded-xl shadow-md mx-auto p-8 transition-all duration-200"
            style={{ width: `${pageWidth}px`, maxWidth: '100%' }}
          >
          {/* 页眉 */}
          <div className="border-b border-gray-200 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">嘉兴大学创业实训平台 · 知识点学习资料</span>
              <span className="text-xs text-gray-400">
                第 {currentPage} 页 / 共 {totalPages} 页
              </span>
            </div>
          </div>

          {/* 章节标题 */}
          <h2 className="text-xl font-bold text-gray-900 mb-4">{currentContent.title}</h2>

          {/* 正文内容 */}
          <div className="prose prose-sm max-w-none">
            {currentContent.content.split('\n').map((line, idx) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return (
                  <p key={idx} className="font-bold text-gray-900 mt-4 mb-2">
                    {line.replace(/\*\*/g, '')}
                  </p>
                );
              }
              if (line.startsWith('- ')) {
                return (
                  <li key={idx} className="text-gray-700 text-sm leading-relaxed ml-4 list-disc">
                    {line.substring(2)}
                  </li>
                );
              }
              if (line === '') return <br key={idx} />;
              return (
                <p key={idx} className="text-gray-700 text-sm leading-relaxed mb-2">
                  {line}
                </p>
              );
            })}
          </div>

          {/* 页脚 */}
          <div className="border-t border-gray-200 pt-4 mt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">创新创业实训课程配套教材</span>
              {completed && (
                <span className="text-xs text-green-600 font-medium flex items-center">
                  <i className="ri-checkbox-circle-fill mr-1"></i>已完成阅读
                </span>
              )}
            </div>
          </div>
          </div>
        )}
      </div>

      {/* 翻页控制栏 */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 rounded-lg text-sm transition-all whitespace-nowrap"
        >
          <i className="ri-arrow-left-line"></i>
          <span>上一页</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">第 {currentPage} 页 / 共 {totalPages} 页</span>

          {/* 阅读进度 */}
          <div className="ml-4 flex items-center space-x-2">
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="text-xs text-teal-600 font-medium">{progressPercent}%</span>
          </div>
        </div>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center space-x-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-all whitespace-nowrap"
        >
          <span>下一页</span>
          <i className="ri-arrow-right-line"></i>
        </button>
      </div>
      
      {/* 继续阅读提示 */}
      {showContinueTip && currentPage > 1 && currentPage < totalPages && (
        <div className="absolute top-20 right-6 bg-teal-500/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg shadow-lg">
          <i className="ri-bookmark-line mr-1"></i>
          上次阅读到第 {currentPage} 页
        </div>
      )}
    </div>
  );
}