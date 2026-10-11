/**
 * 产品设计演示接口。建议和原型只记在 session，文件走演示目录。
 */
import { generateDemoAi, uploadDemoFile } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, nowIso, parseLooseJson, patchFlow, readFlow } from './demoFlow';
import type { ProductSuggestionPayload, ProductSuggestionRecord } from '../../../../lib/studentProductDesignApi';

export type {
  ProductSuggestionPayload,
  ProductSuggestionRecord,
  UploadProductPrototypeError,
} from '../../../../lib/studentProductDesignApi';

type ProductBag = {
  contextText: string;
  updatedAt: string;
  updatedBy: string;
  suggestions: ProductSuggestionRecord[];
  prototype: {
    uploaded: boolean;
    originName: string;
    uploadedAt: string;
    uploadedBy: string;
    sizeBytes: number;
    url: string;
  };
};

function emptyBag(): ProductBag {
  return {
    contextText: '',
    updatedAt: '',
    updatedBy: '',
    suggestions: [],
    prototype: { uploaded: false, originName: '', uploadedAt: '', uploadedBy: '', sizeBytes: 0, url: '' },
  };
}

function read(classId: string) {
  return readFlow(classId, 'product', emptyBag());
}

/** 去掉模型偶尔带上的 Markdown 装饰，避免塞进卡片纯文本 */
function stripMdDecor(text: string) {
  return String(text || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]{3,}\s*$/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .trim();
}

function asStringList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const list = value.map((item) => stripMdDecor(String(item || ''))).filter(Boolean);
    if (list.length) return list;
  }
  return fallback;
}

function mapCoreFeature(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const name = stripMdDecor(String(item.name || item.title || '')).slice(0, 40);
  if (!name) return null;
  const priorityRaw = String(item.priority || '中').trim();
  const priority = priorityRaw === '高' || priorityRaw === '低' ? priorityRaw : '中';
  return {
    name,
    description: stripMdDecor(String(item.description || item.desc || '')),
    priority,
    reason: stripMdDecor(String(item.reason || '课堂演示生成')),
    implementation: stripMdDecor(String(item.implementation || item.how || '')),
  };
}

/**
 * 把演示 AI 文本解析成与学生端一致的结构化 payload。
 * 优先 JSON；失败则按行拆分，且绝不把整段 Markdown 塞进单个 description。
 */
function normalizeProductPayload(text: string): ProductSuggestionPayload {
  const parsed = parseLooseJson<Record<string, unknown> | null>(text, null);
  const root =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? ((parsed.coreFeatures || parsed.core_features
          ? parsed
          : (parsed.data || parsed.result || parsed.payload || parsed.suggestion) &&
              typeof (parsed.data || parsed.result || parsed.payload || parsed.suggestion) === 'object'
            ? ((parsed.data || parsed.result || parsed.payload || parsed.suggestion) as Record<string, unknown>)
            : parsed) as Record<string, unknown>)
      : null;

  let coreFeatures =
    root && Array.isArray(root.coreFeatures || root.core_features)
      ? ((root.coreFeatures || root.core_features) as unknown[])
          .map((item) => mapCoreFeature(item))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [];

  while (coreFeatures.length < 3) {
    coreFeatures.push({
      name: `待明确功能${coreFeatures.length + 1}`,
      description: '材料不足，建议补充后再细化',
      priority: '中',
      reason: '占位补齐',
      implementation: '后续迭代',
    });
  }
  coreFeatures = coreFeatures.slice(0, 3);

  let userExperience = asStringList(root?.userExperience ?? root?.user_experience, []);
  let technicalArchitecture = asStringList(
    root?.technicalArchitecture ?? root?.technical_architecture,
    []
  );
  let iterationPlan =
    root && Array.isArray(root.iterationPlan || root.iteration_plan)
      ? ((root.iterationPlan || root.iteration_plan) as unknown[])
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const row = item as Record<string, unknown>;
            const phase = stripMdDecor(String(row.phase || row.name || ''));
            if (!phase) return null;
            return {
              phase,
              duration: stripMdDecor(String(row.duration || '')) || '2-4周',
              focus: stripMdDecor(String(row.focus || '')) || '核心验证',
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [];

  // JSON 不完整时，用去装饰后的行文本补齐，避免整段原文进卡片
  if (!root || !userExperience.length || !technicalArchitecture.length || !iterationPlan.length) {
    const lines = stripMdDecor(text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!userExperience.length) {
      userExperience = lines.slice(0, 3);
      if (!userExperience.length) userExperience = ['降低上手门槛', '缩短关键路径', '提供失败可恢复反馈'];
    }
    if (!technicalArchitecture.length) {
      technicalArchitecture = lines.slice(3, 6);
      if (!technicalArchitecture.length) {
        technicalArchitecture = ['前后端分离', '异步任务处理', '对象存储与 CDN'];
      }
    }
    if (!iterationPlan.length) {
      iterationPlan = [
        { phase: 'MVP', duration: '4周', focus: lines[0] || '核心链路' },
        { phase: '增强', duration: '4周', focus: lines[1] || '体验与增长' },
      ];
    }
  }

  while (userExperience.length < 3) userExperience.push('补充体验细节');
  while (technicalArchitecture.length < 3) technicalArchitecture.push('补充技术选型');
  while (iterationPlan.length < 2) {
    iterationPlan.push({
      phase: iterationPlan.length === 0 ? 'MVP' : '增强',
      duration: '4周',
      focus: iterationPlan.length === 0 ? '核心链路' : '体验与增长',
    });
  }

  return {
    coreFeatures,
    userExperience: userExperience.slice(0, 3),
    technicalArchitecture: technicalArchitecture.slice(0, 3),
    iterationPlan: iterationPlan.slice(0, 2),
  };
}

export async function fetchProductDesignContext(classId: string) {
  const bag = read(classId);
  return { contextText: bag.contextText, updatedAt: bag.updatedAt, updatedBy: bag.updatedBy };
}

export async function saveProductDesignContext(classId: string, contextText: string) {
  patchFlow(classId, 'product', emptyBag(), (prev) => ({
    ...prev,
    contextText,
    updatedAt: nowIso(),
    updatedBy: DEMO_STUDENT_NAME,
  }));
}

export async function fetchMyLatestProductSuggestion(classId: string) {
  const latest = read(classId).suggestions[0] || null;
  return { latest: latest ? { id: latest.id, payload: latest.payload, createdAt: latest.createdAt } : null };
}

export async function fetchAllProductSuggestions(classId: string) {
  return read(classId).suggestions;
}

export async function streamProductDesignSuggestion(
  classId: string,
  contextText: string,
  handlers: {
    onStatus?: (message: string) => void;
    onThinking?: (text: string) => void;
    onContent?: (text: string) => void;
    onError?: (message: string) => void;
    onDone?: (data: { id: string; payload: ProductSuggestionPayload; createdAt: string }) => void;
  }
) {
  try {
    handlers.onStatus?.('正在生成产品建议…');
    const text = await generateDemoAi(
      classId,
      'product',
      contextText || '请给出一份课堂用的产品设计建议：面向校园用户的轻量工具型产品'
    );
    handlers.onContent?.(text);
    const payload = normalizeProductPayload(text);
    const createdAt = nowIso();
    const record: ProductSuggestionRecord = {
      id: demoId(),
      studentId: DEMO_STUDENT_ID,
      studentName: DEMO_STUDENT_NAME,
      payload,
      createdAt,
    };
    patchFlow(classId, 'product', emptyBag(), (prev) => ({
      ...prev,
      contextText: contextText || prev.contextText,
      suggestions: [record, ...prev.suggestions],
    }));
    handlers.onDone?.({ id: record.id, payload, createdAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成失败';
    handlers.onError?.(message);
    throw e;
  }
}

export async function fetchProductPrototypeParticipation(_classId: string) {
  return { missingMembers: [] as { id: string; name: string }[] };
}

export async function fetchTeamProductPrototypeStatus(classId: string) {
  const item = read(classId).prototype;
  return {
    uploaded: item.uploaded,
    originName: item.originName,
    uploadedAt: item.uploadedAt,
    uploadedBy: item.uploadedBy,
    sizeBytes: item.sizeBytes,
  };
}

export async function uploadTeamProductPrototype(classId: string, file: File) {
  const saved = await uploadDemoFile(classId, file);
  patchFlow(classId, 'product', emptyBag(), (prev) => ({
    ...prev,
    prototype: {
      uploaded: true,
      originName: saved.name || file.name,
      uploadedAt: nowIso(),
      uploadedBy: DEMO_STUDENT_NAME,
      sizeBytes: file.size,
      url: saved.url,
    },
  }));
  return { uploaded: true, originName: saved.name || file.name };
}
