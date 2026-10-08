import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type AppModalPortalProps = {
  open: boolean;
  children: ReactNode;
  /**
   * @deprecated 全局策略：点击遮罩一律不关闭弹窗；保留参数仅为兼容旧调用，不会触发
   */
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
 * 点击遮罩不关闭（需点按钮 / 关闭图标）。
 */
export default function AppModalPortal({
  open,
  children,
  onMaskClick: _onMaskClick,
  className = '',
  zIndex = 1000,
  placement = 'center',
  mask = true,
  style,
}: AppModalPortalProps) {
  void _onMaskClick;
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
    >
      {children}
    </div>,
    document.body
  );
}
