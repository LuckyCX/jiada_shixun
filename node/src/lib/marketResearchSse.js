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
