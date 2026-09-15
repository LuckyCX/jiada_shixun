import { createRoot, type Root } from 'react-dom/client';
import AppModalPortal from '../components/AppModalPortal';

type AlertOpts = {
  title?: string;
  content: string;
  okText?: string;
};

type ConfirmOpts = {
  title?: string;
  content: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
};

type DialogRequest =
  | { kind: 'alert'; opts: AlertOpts; resolve: () => void }
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (ok: boolean) => void };

let hostEl: HTMLDivElement | null = null;
let root: Root | null = null;
const queue: DialogRequest[] = [];
let busy = false;

function ensureRoot(): Root {
  if (!hostEl) {
    hostEl = document.createElement('div');
    hostEl.id = 'app-dialog-root';
    document.body.appendChild(hostEl);
  }
  if (!root) root = createRoot(hostEl);
  return root;
}

function pump() {
  if (busy) return;
  const next = queue.shift();
  if (!next) {
    if (root && hostEl) {
      root.render(<></>);
    }
    return;
  }
  busy = true;
  const r = ensureRoot();

  const finishAlert = () => {
    busy = false;
    if (next.kind === 'alert') next.resolve();
    pump();
  };
  const finishConfirm = (ok: boolean) => {
    busy = false;
    if (next.kind === 'confirm') next.resolve(ok);
    pump();
  };

  if (next.kind === 'alert') {
    const { title = '提示', content, okText = '确定' } = next.opts;
    r.render(
      <AppModalPortal open zIndex={2200} onMaskClick={finishAlert}>
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-5 pb-2">
            <h3 className="text-lg font-semibold text-gray-900 m-0">{title}</h3>
          </div>
          <div className="px-6 py-3">
            <p className="text-sm text-gray-700 whitespace-pre-wrap m-0 leading-relaxed">{content}</p>
          </div>
          <div className="px-6 py-4 flex justify-end border-t border-gray-100">
            <button
              type="button"
              className="min-w-[88px] px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 cursor-pointer"
              onClick={finishAlert}
            >
              {okText}
            </button>
          </div>
        </div>
      </AppModalPortal>
    );
    return;
  }

  const { title = '确认', content, okText = '确定', cancelText = '取消', danger } = next.opts;
  r.render(
    <AppModalPortal open zIndex={2200} onMaskClick={() => finishConfirm(false)}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-lg font-semibold text-gray-900 m-0">{title}</h3>
        </div>
        <div className="px-6 py-3">
          <p className="text-sm text-gray-700 whitespace-pre-wrap m-0 leading-relaxed">{content}</p>
        </div>
        <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            type="button"
            className="min-w-[88px] px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 cursor-pointer"
            onClick={() => finishConfirm(false)}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`min-w-[88px] px-4 py-2 rounded-xl text-white text-sm font-medium cursor-pointer ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
            }`}
            onClick={() => finishConfirm(true)}
          >
            {okText}
          </button>
        </div>
      </div>
    </AppModalPortal>
  );
}

/** 替代原生 alert：兼容弹窗对话框 */
export function appAlert(content: string, title = '提示'): Promise<void> {
  return new Promise((resolve) => {
    queue.push({ kind: 'alert', opts: { content, title }, resolve });
    pump();
  });
}

/** 替代原生 confirm：兼容弹窗对话框，返回是否确认 */
export function appConfirm(
  content: string,
  title = '确认',
  opts?: { okText?: string; cancelText?: string; danger?: boolean }
): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({
      kind: 'confirm',
      opts: { content, title, okText: opts?.okText, cancelText: opts?.cancelText, danger: opts?.danger },
      resolve,
    });
    pump();
  });
}
