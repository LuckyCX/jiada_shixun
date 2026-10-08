import { useEffect, useMemo, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import { useTranslation } from 'react-i18next';

/** 全局禁止点击遮罩关闭弹窗 / 抽屉（antd 6 用 mask.closable） */
const NO_MASK_CLOSE = { mask: { closable: false } } as const;

/**
 * antd 默认英文；用 ConfigProvider.locale 切换内置文案（Transfer、Modal、分页等）。
 * DatePicker / TimePicker 等还依赖 dayjs 的 locale，需与文档一致单独注册：
 * https://ant.design/docs/react/i18n-cn
 *
 * getPopupContainer 挂到 body，避免教室旧浏览器下父级 stacking / overflow 导致弹层不可见。
 */
export default function AntdAppProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();

  const locale = useMemo(() => {
    const lng = (i18n.language || 'zh').toLowerCase();
    return lng.startsWith('zh') ? zhCN : enUS;
  }, [i18n.language]);

  useEffect(() => {
    const lng = (i18n.language || 'zh').toLowerCase();
    dayjs.locale(lng.startsWith('zh') ? 'zh-cn' : 'en');
  }, [i18n.language]);

  // Modal.confirm / info 等静态方法无 React 树上下文，需 holderRender 注入相同配置
  useEffect(() => {
    ConfigProvider.config({
      holderRender: (holderChildren) => (
        <ConfigProvider
          locale={locale}
          modal={NO_MASK_CLOSE}
          drawer={NO_MASK_CLOSE}
          theme={{ token: { zIndexPopupBase: 2000 } }}
        >
          {holderChildren}
        </ConfigProvider>
      ),
    });
  }, [locale]);

  return (
    <ConfigProvider
      locale={locale}
      getPopupContainer={() => document.body}
      // AppModalPortal 常用 1100；antd 默认弹层基准 1000，会被自建弹窗盖住
      theme={{ token: { zIndexPopupBase: 2000 } }}
      modal={NO_MASK_CLOSE}
      drawer={NO_MASK_CLOSE}
    >
      {children}
    </ConfigProvider>
  );
}
