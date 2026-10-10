/**
 * 产品设计演示接口。建议和原型只记在 session，文件走演示目录。
 */
import { generateDemoAi, uploadDemoFile } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, nowIso, patchFlow, readFlow } from './demoFlow';
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

function payloadFromText(text: string): ProductSuggestionPayload {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return {
    coreFeatures: [
      {
        name: lines[0]?.slice(0, 24) || '核心功能',
        description: text.slice(0, 400),
        priority: '高',
        reason: '课堂演示生成',
        implementation: lines[1] || '',
      },
    ],
    userExperience: lines.slice(0, 4),
    technicalArchitecture: lines.slice(4, 7),
    iterationPlan: [{ phase: '课堂演示', duration: '1 周', focus: lines[0] || text.slice(0, 80) }],
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
    const text = await generateDemoAi(classId, 'product', contextText || '请给出一份课堂用的产品设计建议');
    handlers.onContent?.(text);
    const payload = payloadFromText(text);
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
