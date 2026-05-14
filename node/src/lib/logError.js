/**
 * 将路由/服务中的异常完整打到 stderr，便于本地与服务器排查。
 * @param {string} scope
 * @param {unknown} err
 */
export function logError(scope, err) {
  if (err instanceof Error) {
    console.error(`[${scope}]`, err.message);
    if (err.stack) console.error(err.stack);
  } else {
    console.error(`[${scope}]`, err);
  }
  const any = err && typeof err === 'object' ? err : {};
  if (any.response != null) console.error(`[${scope}] response:`, any.response);
  if (any.responseCode != null) console.error(`[${scope}] responseCode:`, any.responseCode);
  if (any.command != null) console.error(`[${scope}] command:`, any.command);
  if (any.code != null && any.message != null && !(err instanceof Error && String(any.message) === err.message)) {
    console.error(`[${scope}] extra:`, any.code, any.message);
  }
}
