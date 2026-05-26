import DOMPurify from 'dompurify';

export function sanitizeRichText(html: string) {
  return DOMPurify.sanitize(html || '', {
    ADD_ATTR: ['style', 'target'],
  });
}
