/**
 * 将 AI 返回的 Markdown/纯文本转为可入库的简易 HTML，避免编辑器露出 ** / ### 等符号。
 * 不引入额外依赖；覆盖计划书常见排版即可。
 */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFormat(text) {
  let s = escapeHtml(text);
  // 先处理加粗，再处理斜体，避免 * 交叉误伤
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

function looksLikeHtml(s) {
  return /<\/?(?:p|div|ul|ol|li|h[1-6]|br|strong|em|table|thead|tbody|tr|td|th|blockquote|pre|code)\b/i.test(
    String(s || '')
  );
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function planMarkdownToHtml(raw) {
  const src = String(raw || '').trim();
  if (!src) return '';
  if (looksLikeHtml(src)) return src;

  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let listType = null; // 'ul' | 'ol'
  let listBuf = [];

  const flushList = () => {
    if (!listType || !listBuf.length) {
      listType = null;
      listBuf = [];
      return;
    }
    const tag = listType;
    out.push(`<${tag}>${listBuf.map((t) => `<li>${inlineFormat(t)}</li>`).join('')}</${tag}>`);
    listType = null;
    listBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      i += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushList();
      const level = Math.min(4, heading[1].length);
      out.push(`<h${level}>${inlineFormat(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    const ul = /^[-*•]\s+(.+)$/.exec(trimmed);
    if (ul) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listBuf.push(ul[1]);
      i += 1;
      continue;
    }

    const ol = /^\d+[.)、]\s+(.+)$/.exec(trimmed);
    if (ol) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listBuf.push(ol[1]);
      i += 1;
      continue;
    }

    flushList();
    // 合并连续非空段落行
    const para = [trimmed];
    i += 1;
    while (i < lines.length) {
      const n = lines[i].trim();
      if (!n || /^(#{1,4})\s+/.test(n) || /^[-*•]\s+/.test(n) || /^\d+[.)、]\s+/.test(n)) break;
      para.push(n);
      i += 1;
    }
    out.push(`<p>${para.map((p) => inlineFormat(p)).join('<br/>')}</p>`);
  }
  flushList();
  return out.join('') || `<p>${inlineFormat(src)}</p>`;
}
