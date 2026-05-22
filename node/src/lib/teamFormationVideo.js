import fs from 'fs';
import path from 'path';
import { chatCompletion } from './llmGateway.js';
import { logError } from './logError.js';

/** 内联提交给多模态 API 的最大体积（避免请求过大） */
export const MAX_INLINE_VIDEO_BYTES = 18 * 1024 * 1024;

export function resolveTeamVideoAbsPath(nodeRoot, storageKey) {
  const key = String(storageKey || '').trim();
  if (!key) return null;
  if (path.isAbsolute(key)) return key;
  return path.join(nodeRoot, key);
}

export async function readVideoAsDataUrl(absPath) {
  const stat = await fs.promises.stat(absPath);
  if (stat.size > MAX_INLINE_VIDEO_BYTES) {
    return { dataUrl: null, tooLarge: true, sizeBytes: stat.size };
  }
  const buf = await fs.promises.readFile(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mime =
    ext === '.mov' ? 'video/quicktime' : ext === '.webm' ? 'video/webm' : 'video/mp4';
  return {
    dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
    tooLarge: false,
    sizeBytes: stat.size,
  };
}

/** OpenAI 兼容多模态 user content（部分网关支持 video_url + data URL） */
export function buildVideoUserContent(text, dataUrl) {
  return [
    { type: 'text', text },
    { type: 'video_url', video_url: { url: dataUrl } },
  ];
}

/**
 * 将自我介绍视频提交至多模态模型转写（非流式）
 */
export async function transcribeIntroductionVideo(provider, absPath, systemPrompt) {
  if (!provider) throw new Error('未配置 LLM');
  if (!absPath || !fs.existsSync(absPath)) {
    return { transcript: '', skipped: true, reason: 'FILE_NOT_FOUND' };
  }

  const { dataUrl, tooLarge, sizeBytes } = await readVideoAsDataUrl(absPath);
  if (!dataUrl) {
    return {
      transcript: '',
      skipped: true,
      reason: tooLarge ? 'VIDEO_TOO_LARGE' : 'READ_FAILED',
      sizeBytes,
    };
  }

  const system =
    systemPrompt ||
    '你是语音转写助手。根据用户提供的自我介绍视频，输出中文口语书面转写稿，保留能力与经历表述，勿编造未出现的信息。';
  const userText =
    '请转写该视频中学生的自我介绍内容，输出完整、连贯的中文书面稿（可多段）。只输出转写正文，不要 JSON。';

  const attempts = [
    () => buildVideoUserContent(userText, dataUrl),
    () => [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  ];

  let lastErr;
  for (const build of attempts) {
    try {
      const text = await chatCompletion({
        provider,
        system,
        user: build(),
      });
      const transcript = String(text || '').trim();
      if (transcript.length > 10) {
        return { transcript, skipped: false, sizeBytes };
      }
    } catch (e) {
      lastErr = e;
      logError('transcribeIntroductionVideo attempt', e);
    }
  }

  throw lastErr || new Error('视频转写未返回有效内容');
}
