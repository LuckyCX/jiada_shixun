import { getConfigValue } from './systemConfig.js';
import { logError } from './logError.js';

function parseProviders(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const arr = raw.providers;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x === 'object')
    .map((o) => ({
      id: String(o.id || '').trim(),
      name: String(o.name || '').trim(),
      category: o.category === 'file_processing' ? 'file_processing' : 'multimodal',
      vendor: String(o.vendor || '').trim(),
      baseUrl: String(o.baseUrl || '').trim().replace(/\/$/, ''),
      modelId: String(o.modelId || o.model_name || '').trim(),
      apiKey: String(o.apiKey || '').trim(),
      timeoutMs: Math.min(600_000, Math.max(5_000, Number(o.timeoutMs ?? 120_000) || 120_000)),
      enabled: o.enabled === true || o.is_enabled === true,
    }))
    .filter((p) => p.enabled && p.baseUrl && p.modelId && p.apiKey);
}

export async function getEnabledProvider(category = 'multimodal') {
  const raw = await getConfigValue('llm_gateway_config', false);
  const list = parseProviders(raw);
  return list.find((p) => p.category === category) || list.find((p) => p.category === 'multimodal') || null;
}

/** 解析全部配置（含未启用），供管理端连通性测试按 id / 类型取用 */
function parseProvidersAll(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const arr = raw.providers;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x === 'object')
    .map((o) => ({
      id: String(o.id || '').trim(),
      name: String(o.name || '').trim(),
      category: o.category === 'file_processing' ? 'file_processing' : 'multimodal',
      vendor: String(o.vendor || '').trim(),
      baseUrl: String(o.baseUrl || '').trim().replace(/\/$/, ''),
      modelId: String(o.modelId || o.model_name || '').trim(),
      apiKey: String(o.apiKey || '').trim(),
      timeoutMs: Math.min(600_000, Math.max(5_000, Number(o.timeoutMs ?? 120_000) || 120_000)),
      enabled: o.enabled === true || o.is_enabled === true,
    }))
    .filter((p) => p.id && p.baseUrl && p.modelId && p.apiKey);
}

/**
 * 管理端连通性测试：优先指定 providerId，否则取该类型当前启用项。
 * @param {'multimodal'|'file_processing'} category
 * @param {string} [providerId]
 */
export async function resolveProviderForTest(category = 'multimodal', providerId = '') {
  const raw = await getConfigValue('llm_gateway_config', false);
  const all = parseProvidersAll(raw);
  const id = String(providerId || '').trim();
  if (id) {
    const hit = all.find((p) => p.id === id);
    if (!hit) throw new Error('未找到该模型配置，请确认已保存且填写了 Base URL / 模型 ID / API Key');
    return hit;
  }
  const cat = category === 'file_processing' ? 'file_processing' : 'multimodal';
  const enabled = all.find((p) => p.category === cat && p.enabled);
  if (enabled) return enabled;
  const any = all.find((p) => p.category === cat);
  if (any) return any;
  throw new Error(
    cat === 'file_processing'
      ? '未配置文件处理模型，请先在「模型配置」中新增并保存'
      : '未配置多模态模型，请先在「模型配置」中新增并保存'
  );
}

/**
 * 向目标模型发一条最短对话，验证鉴权与链路是否可用。
 * @returns {{ providerId: string, providerName: string, modelId: string, replyPreview: string, latencyMs: number }}
 */
export async function testLlmConnectivity(category = 'multimodal', providerId = '') {
  const provider = await resolveProviderForTest(category, providerId);
  const started = Date.now();
  // 测试用短超时，避免管理端长时间卡住
  const testProvider = { ...provider, timeoutMs: Math.min(Number(provider.timeoutMs) || 60_000, 45_000) };
  const reply = await chatCompletion({
    provider: testProvider,
    system: '你是连通性测试助手，只做极短回复。',
    user: '请只回复两个字：成功',
  });
  return {
    providerId: provider.id,
    providerName: provider.name || provider.id,
    modelId: provider.modelId,
    category: provider.category,
    replyPreview: String(reply || '').slice(0, 200),
    latencyMs: Date.now() - started,
  };
}

/**
 * 拼 chat/completions 地址。
 * - OpenAI 类：https://api.openai.com 或 …/v1 → …/v1/chat/completions
 * - 火山方舟等：https://ark…/api/v3 → …/api/v3/chat/completions（勿再拼 /v1）
 */
function chatCompletionsUrl(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!base) return '/v1/chat/completions';
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  if (/\/api\/v\d+$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/**
 * 默认关闭「思考模式」，加快输出；Qwen3 系列默认开思考，必须显式 enable_thinking=false。
 * 文档：https://platform.qianwenai.com/docs/resources/faq-text-generation#思考模式
 * extraBody 可覆盖（仅当你明确要开思考时再传 enable_thinking: true）。
 */
export function buildNoThinkingExtraBody(provider) {
  const modelId = String(provider?.modelId || '').trim();
  const hay = `${String(provider?.vendor || '').toLowerCase()} ${String(provider?.baseUrl || '').toLowerCase()} ${modelId.toLowerCase()}`;
  const out = {};
  // 豆包
  if (/volc|volcano|ark|doubao|豆包|字节/.test(hay)) {
    out.thinking = { type: 'disabled' };
  }
  // 通义/百炼/千问（含 qwen3.8-flash 等混合思考模型，默认会开思考）
  if (/dashscope|aliyun|通义|qwen|bailian|百炼|qianwen/.test(hay) || /^qwen/i.test(modelId)) {
    out.enable_thinking = false;
  }
  // OpenAI 系 reasoning
  if (/openai|gpt|o1|o3|reasoning/.test(hay)) {
    out.reasoning_effort = 'none';
  }
  // 兜底：未识别厂商也尽量关掉（多数网关会忽略未知字段；Qwen 兼容口必需）
  if (out.enable_thinking == null && out.thinking == null) {
    out.enable_thinking = false;
  }
  return out;
}

function mergeChatExtraBody(provider, extraBody) {
  const base = buildNoThinkingExtraBody(provider);
  const extra = extraBody && typeof extraBody === 'object' ? { ...extraBody } : {};
  // 除非调用方显式 enable_thinking:true / thinking.enabled，否则保持关闭
  const forceThinkOn =
    extra.enable_thinking === true ||
    (extra.thinking && typeof extra.thinking === 'object' && extra.thinking.type === 'enabled');
  const merged = { ...base, ...extra };
  if (!forceThinkOn) {
    if ('enable_thinking' in base) merged.enable_thinking = false;
    if (base.thinking) merged.thinking = base.thinking;
  }
  return merged;
}

/**
 * OpenAI 兼容 Chat Completions
 * @param {AbortSignal} [signal] 外部取消（如客户端断开），与 provider.timeoutMs 一并生效
 */
export async function chatCompletion({ provider, system, user, jsonMode = false, extraBody, signal }) {
  if (!provider) throw new Error('未配置已启用的 LLM 服务，请在管理后台「系统配置」中配置并启用多模态模型');
  const url = chatCompletionsUrl(provider.baseUrl);
  const body = {
    model: provider.modelId,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    ...mergeChatExtraBody(provider, extraBody),
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  if (signal?.aborted) {
    const err = new Error('请求已取消');
    err.name = 'AbortError';
    throw err;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onExternalAbort, { once: true });
  const startedAt = Date.now();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j?.error?.message || j?.message || `LLM HTTP ${r.status}`;
      throw new Error(msg);
    }
    const text = j?.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') throw new Error('LLM 返回内容为空');
    const thinkingOff =
      body.enable_thinking === false ||
      (body.thinking && typeof body.thinking === 'object' && body.thinking.type === 'disabled');
    console.log(
      `[llmGateway] chatCompletion ok model=${provider.modelId} jsonMode=${Boolean(jsonMode)} thinkingOff=${thinkingOff} max_tokens=${body.max_tokens ?? '-'} ${Date.now() - startedAt}ms`
    );
    return text.trim();
  } catch (e) {
    logError('llmGateway.chatCompletion', e);
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}

export function logPromptToConsole(provider, system, user) {
  const sep = '─'.repeat(60);
  console.log(`\n[llmGateway] ${sep}`);
  console.log(`[llmGateway] model=${provider.modelId} url=${chatCompletionsUrl(provider.baseUrl)}`);
  if (system) {
    console.log('[llmGateway] --- system ---');
    console.log(system.length > 8000 ? `${system.slice(0, 8000)}…` : system);
  }
  console.log('[llmGateway] --- user ---');
  if (typeof user === 'string') {
    console.log(user.length > 12000 ? `${user.slice(0, 12000)}…` : user);
  } else if (Array.isArray(user)) {
    console.log(
      JSON.stringify(
        user.map((p) =>
          p?.type === 'video_url' || p?.type === 'image_url'
            ? { ...p, video_url: '[media]', image_url: '[media]' }
            : p
        )
      ).slice(0, 12000)
    );
  } else {
    console.log('[non-string user content]');
  }
  console.log(`[llmGateway] ${sep}\n`);
}

/**
 * OpenAI 兼容流式 Chat Completions
 * onEvent: { kind: 'thinking'|'content', text: string }
 */
function aggregateLlmErrorText(err) {
  const parts = [];
  const seen = new Set();
  for (let e = err; e; e = e.cause) {
    for (const piece of [e?.code, e?.message, e?.syscall, e?.hostname]) {
      const s = String(piece || '').trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      parts.push(s);
    }
  }
  return parts.join(' | ');
}

/** 将上游/网关错误转为更易排查的提示 */
export function friendlyLlmErrorMessage(err) {
  const msg = aggregateLlmErrorText(err) || String(err?.message || err || '').trim();
  if (!msg) return '模型调用失败';
  if (/fetch failed|failed to fetch|UND_ERR|ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|certificate|UNABLE_TO_VERIFY|self[- ]signed/i.test(msg)) {
    return '无法连接大模型服务：请检查管理后台「系统配置」中的 API 地址（需可公网/本机访问的 https 地址）、API Key、模型 ID，以及本机网络或代理；连接成功前不会出现流式思考内容。';
  }
  if (/upstream|do request failed|connection/i.test(msg)) {
    return '大模型服务请求失败：请检查管理后台「系统配置」中的 API 地址、API Key、模型 ID 是否正确，账户余额/配额是否充足，或稍后重试。';
  }
  if (/abort|timeout|timed out/i.test(msg)) {
    return '大模型请求超时，请稍后重试，或在系统配置中适当增大超时时间。';
  }
  if (/401|403|unauthorized|invalid.*key/i.test(msg)) {
    return '大模型鉴权失败，请检查 API Key 是否有效。';
  }
  return msg;
}

export async function chatCompletionStream({
  provider,
  system,
  user,
  onEvent,
  jsonMode = false,
  temperature,
  maxTokens,
  streamReasoning = true,
  extraBody,
}) {
  if (!provider) throw new Error('未配置已启用的 LLM 服务，请在管理后台「系统配置」中配置并启用多模态模型');
  const url = chatCompletionsUrl(provider.baseUrl);
  logPromptToConsole(provider, system, user);

  const body = {
    model: provider.modelId,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    temperature: temperature ?? 0.3,
    stream: true,
    ...(maxTokens != null ? { max_tokens: maxTokens } : {}),
    ...mergeChatExtraBody(provider, extraBody),
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
  let fullContent = '';
  let fullReasoning = '';

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const msg = j?.error?.message || j?.message || `LLM HTTP ${r.status}`;
      throw new Error(msg);
    }
    if (!r.body) throw new Error('LLM 流式响应体为空');

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() || '';
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let j;
        try {
          j = JSON.parse(payload);
        } catch {
          continue;
        }
        const choice = j?.choices?.[0];
        const delta = choice?.delta;
        const message = choice?.message;
        if (delta) {
          const reasoning =
            delta.reasoning_content ??
            delta.reasoning ??
            (typeof delta.reasoning === 'string' ? delta.reasoning : null);
          if (reasoning) {
            const r = String(reasoning);
            fullReasoning += r;
            if (streamReasoning) onEvent?.({ kind: 'thinking', text: r });
          }
          if (delta.content) {
            fullContent += delta.content;
            onEvent?.({ kind: 'content', text: delta.content });
          }
        } else if (message) {
          const reasoning =
            message.reasoning_content ??
            message.reasoning ??
            (typeof message.reasoning === 'string' ? message.reasoning : null);
          if (reasoning) {
            const r = String(reasoning);
            fullReasoning += r;
            if (streamReasoning) onEvent?.({ kind: 'thinking', text: r });
          }
          if (message.content) {
            fullContent += message.content;
            onEvent?.({ kind: 'content', text: message.content });
          }
        }
      }
    }
    const merged = `${fullReasoning}${fullContent}`.trim();
    return merged || fullContent.trim() || fullReasoning.trim();
  } catch (e) {
    logError(`llmGateway.chatCompletionStream url=${url}`, e);
    throw new Error(friendlyLlmErrorMessage(e));
  } finally {
    clearTimeout(timer);
  }
}

export async function getPromptModules() {
  const raw = await getConfigValue('prompt_modules', false);
  if (raw && typeof raw === 'object') return raw;
  return {
    team_formation: {
      match_system: `你是创业实训组队顾问。

#Context#
根据问卷客观作答为主、视频转写为辅，评估三维度得分并匹配角色。

#Objective#
输出中文分析正文 + 最后一行 JSON（含 dimensionScores / matchedRole 等）。

#Response#
- 勿因学生自述想当某职务而直接定角。
- 最后一行只输出一个 JSON 对象，禁止 markdown 代码块。`,
      video_transcribe:
        '转写自我介绍视频为中文书面稿，保留能力与经历事实；职位愿望表述照录即可，勿在转写中强化或认定某一角色。仅输出转写正文。',
      ai_group_system: '',
      ai_group_user_template: '请为以下待组队学生划分小组（仅输出 JSON，字段不得增减）：',
      role_definitions: [],
    },
  };
}
