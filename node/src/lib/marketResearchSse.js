export function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

export function extractJsonFromLlmText(text) {
  const t = String(text || '').trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* ignore */
    }
  }
  const balanced = extractBalancedJsonObject(t);
  if (balanced && objectHasAnalysisScore(balanced)) return balanced;

  const all = findAllBalancedJsonObjects(t);
  const best = pickBestAnalysisObject(all);
  if (best) return best;
  if (balanced) return balanced;

  const scoreMatch = t.match(/"score"\s*:\s*(\d{1,3})/i);
  if (scoreMatch) {
    const stub = extractBalancedJsonObjectAt(t, t.lastIndexOf('{', Number(scoreMatch.index)));
    if (stub) return stub;
  }

  const start = t.lastIndexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      /* ignore */
    }
  }
  const arrStart = t.lastIndexOf('[');
  const arrEnd = t.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    try {
      return JSON.parse(t.slice(arrStart, arrEnd + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

function extractBalancedJsonObjectAt(text, fromIndex = 0) {
  const t = String(text || '');
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = fromIndex; i < t.length; i++) {
    const ch = t[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(t.slice(start, i + 1));
        } catch {
          start = -1;
        }
      }
    }
  }
  return null;
}

function extractBalancedJsonObject(text) {
  return extractBalancedJsonObjectAt(text, 0);
}

export function findAllBalancedJsonObjects(text) {
  const t = String(text || '');
  const out = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== '{') continue;
    const obj = extractBalancedJsonObjectAt(t, i);
    if (obj && typeof obj === 'object') {
      out.push(obj);
      i = t.indexOf('}', i);
      if (i < 0) break;
    }
  }
  return out;
}

function objectHasAnalysisScore(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const score = obj.score ?? obj.Score;
  const n = Number(score);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

function pickBestAnalysisObject(candidates) {
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (objectHasAnalysisScore(candidates[i])) return candidates[i];
  }
  for (let i = candidates.length - 1; i >= 0; i--) {
    const o = candidates[i];
    if (o?.result && objectHasAnalysisScore(o.result)) return o.result;
    if (o?.data && objectHasAnalysisScore(o.data)) return o.data;
  }
  return candidates[candidates.length - 1] || null;
}

export function setupSseResponse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

export function onStreamEventForSse(res) {
  let inThinkingTag = false;
  const thinkOpen = ['<', 'think', '>'].join('');
  const thinkClose = ['<', '/', 'think', '>'].join('');
  return ({ kind, text }) => {
    if (!text) return;
    if (kind === 'thinking') {
      sseWrite(res, 'thinking', { text });
      return;
    }
    let chunk = text;
    if (chunk.includes(thinkOpen)) {
      inThinkingTag = true;
      chunk = chunk.split(thinkOpen).join('');
    }
    if (chunk.includes(thinkClose)) {
      inThinkingTag = false;
      const parts = chunk.split(thinkClose);
      if (parts[0]) sseWrite(res, 'thinking', { text: parts[0] });
      chunk = parts.slice(1).join(thinkClose);
    }
    if (inThinkingTag) {
      sseWrite(res, 'thinking', { text: chunk });
    } else if (chunk) {
      sseWrite(res, 'content', { text: chunk });
    }
  };
}

/** 转发 SSE 并累积全部流式文本（含 reasoning），供 JSON 解析 */
export function createMarketResearchStreamHandler(res, { emitSse = true } = {}) {
  let streamForParse = '';
  const emit = emitSse ? onStreamEventForSse(res) : () => {};
  const onEvent = ({ kind, text }) => {
    if (text) streamForParse += text;
    emit({ kind, text });
  };
  return {
    onEvent,
    getParseText: (fullTextFallback = '') => streamForParse || fullTextFallback,
  };
}
