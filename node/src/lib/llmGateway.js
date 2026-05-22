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

/** baseUrl 可能已带 /v1（如 https://api.example.com/v1），避免拼成 /v1/v1/chat/completions */
function chatCompletionsUrl(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!base) return '/v1/chat/completions';
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/**
 * OpenAI 兼容 Chat Completions
 */
export async function chatCompletion({ provider, system, user, jsonMode = false }) {
  if (!provider) throw new Error('未配置已启用的 LLM 服务，请在管理后台「系统配置」中配置并启用多模态模型');
  const url = chatCompletionsUrl(provider.baseUrl);
  const body = {
    model: provider.modelId,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    temperature: 0.3,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
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
    return text.trim();
  } catch (e) {
    logError('llmGateway.chatCompletion', e);
    throw e;
  } finally {
    clearTimeout(timer);
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
export async function chatCompletionStream({ provider, system, user, onEvent }) {
  if (!provider) throw new Error('未配置已启用的 LLM 服务，请在管理后台「系统配置」中配置并启用多模态模型');
  const url = chatCompletionsUrl(provider.baseUrl);
  logPromptToConsole(provider, system, user);

  const body = {
    model: provider.modelId,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    stream: true,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
  let fullContent = '';

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
        const delta = j?.choices?.[0]?.delta;
        if (!delta) continue;
        const reasoning =
          delta.reasoning_content ??
          delta.reasoning ??
          (typeof delta.reasoning === 'string' ? delta.reasoning : null);
        if (reasoning) {
          onEvent?.({ kind: 'thinking', text: String(reasoning) });
        }
        if (delta.content) {
          fullContent += delta.content;
          onEvent?.({ kind: 'content', text: delta.content });
        }
      }
    }
    return fullContent.trim();
  } catch (e) {
    logError('llmGateway.chatCompletionStream', e);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function getPromptModules() {
  const raw = await getConfigValue('prompt_modules', false);
  if (raw && typeof raw === 'object') return raw;
  return {
    team_formation: {
      match_system:
        '你是创业实训组队顾问。根据问卷客观作答为主、视频转写为辅评估三维度得分并匹配角色；勿因学生自述想当某职务而直接定角。最后一行输出 JSON。',
      video_transcribe:
        '转写自我介绍视频为中文书面稿，保留能力与经历事实；职位愿望表述照录即可，勿在转写中强化或认定某一角色。',
      ai_group_system: '',
      ai_group_user_template: '请为以下待组队学生划分小组（仅输出 JSON）：',
      role_definitions: [],
    },
  };
}
