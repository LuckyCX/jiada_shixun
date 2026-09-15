/**
 * 纠正 multipart 上传文件名乱码（multer/busboy 常把 UTF-8 中文按 latin1 解析）。
 * 对已正确的中文名保持不变；对历史入库的乱码在读取时也可修复。
 */
export function normalizeUploadFileName(name, fallback = 'file') {
  let raw = String(name || '').trim() || fallback;

  // URL 编码文件名（少见）
  if (/%[0-9A-Fa-f]{2}/.test(raw)) {
    try {
      const once = decodeURIComponent(raw);
      if (once && !once.includes('\uFFFD')) raw = once;
    } catch {
      /* ignore */
    }
  }

  // UTF-8 被当成 latin1：ä¸‹è½½ → 下载
  const decoded = Buffer.from(raw, 'latin1').toString('utf8');
  const looksLatin1Mojibake = /[\u0080-\u00ff]/.test(raw);
  const decodedLooksValid =
    Boolean(decoded) &&
    decoded !== raw &&
    !decoded.includes('\uFFFD') &&
    /[^\u0000-\u00ff]/.test(decoded);
  if (looksLatin1Mojibake && decodedLooksValid) {
    raw = decoded;
  }

  return raw.replace(/[\\/]/g, '_') || fallback;
}
