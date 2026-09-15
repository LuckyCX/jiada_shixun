import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type AppModalPortalProps = {
  open: boolean;
  children: ReactNode;
  /** 点击遮罩关闭；未传则点击遮罩不关闭 */
  onMaskClick?: () => void;
  /** 遮罩额外 class */
  className?: string;
  zIndex?: number;
  /** center：居中对话框；right：右侧抽屉；fullscreen：全屏层（无半透明底也可） */
  placement?: 'center' | 'right' | 'fullscreen';
  /** 是否显示半透明遮罩，默认 true */
  mask?: boolean;
  style?: CSSProperties;
};

/**
 * 自建弹层统一入口：挂到 document.body，避免被父级 transform/overflow 裁剪；
 * 遮罩使用 top/right/bottom/left + 经典 rgba，兼容教室功能机 / 旧版 360。
 */
export default function AppModalPortal({
  open,
  children,
  onMaskClick,
  className = '',
  zIndex = 1000,
  placement = 'center',
  mask = true,
  style,
}: AppModalPortalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const placementClass =
    placement === 'right'
      ? 'app-modal-mask app-modal-mask--right'
      : placement === 'fullscreen'
        ? 'app-modal-mask app-modal-mask--fullscreen'
        : 'app-modal-mask';

  const maskClass = mask ? '' : ' app-modal-mask--no-mask';

  return createPortal(
    <div
      className={`${placementClass}${maskClass} ${className}`.trim()}
      style={{ zIndex, ...style }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onMaskClick?.();
      }}
    >
      {children}
    </div>,
    document.body
  );
}
