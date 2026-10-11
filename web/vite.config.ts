import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import AutoImport from "unplugin-auto-import/vite";
import { codeInspectorPlugin } from 'code-inspector-plugin';

const base = process.env.BASE_PATH || "/";
const isPreview = process.env.IS_PREVIEW ? true : false;

/** 与后端 securityHardening 对齐的假路径（不含本系统真实 /admin、/api） */
const HONEYPOT_EXACT = new Set(
  [
    "/wp-admin",
    "/wp-login.php",
    "/phpmyadmin",
    "/actuator",
    "/swagger-ui",
    "/swagger-ui.html",
    "/druid",
    "/.env",
    "/.git",
    "/.git/config",
    "/server-status",
    "/xmlrpc.php",
    "/manager/html",
    "/console",
    "/solr",
    "/jenkins",
  ].map((p) => p.toLowerCase())
);
const HONEYPOT_PREFIX = ["/wp-admin/", "/phpmyadmin/", "/actuator/", "/.git/", "/druid/", "/swagger/"];

function isHoneypotPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (HONEYPOT_EXACT.has(lower)) return true;
  return HONEYPOT_PREFIX.some((pre) => lower.startsWith(pre));
}

/** 开发服务器蜜罐：命中假路径 302 `/`，不暴露规则名 */
function honeypotPlugin(): Plugin {
  return {
    name: "security-honeypot",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = String(req.url || "/");
        const pathOnly = raw.split("?")[0] || "/";
        let decoded = pathOnly;
        try {
          decoded = decodeURIComponent(pathOnly);
        } catch {
          res.statusCode = 302;
          res.setHeader("Location", "/");
          res.end();
          return;
        }
        const normalized = decoded.replace(/\/{2,}/g, "/");
        if (
          normalized.includes("\0") ||
          normalized.includes("%00") ||
          normalized.includes("\\") ||
          normalized.includes("..") ||
          normalized.length > 512 ||
          isHoneypotPath(normalized)
        ) {
          console.warn(
            `[security] ${JSON.stringify({
              kind: "honeypot",
              path: normalized,
              ua: String(req.headers["user-agent"] || "").slice(0, 300),
              at: new Date().toISOString(),
            })}`
          );
          res.statusCode = 302;
          res.setHeader("Location", "/");
          res.end();
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  return {
  define: {
    __BASE_PATH__: JSON.stringify(base),
    __IS_PREVIEW__: JSON.stringify(isPreview),
    __READDY_PROJECT_ID__: JSON.stringify(process.env.PROJECT_ID || ""),
    __READDY_VERSION_ID__: JSON.stringify(process.env.VERSION_ID || ""),
    __READDY_AI_DOMAIN__: JSON.stringify(process.env.READDY_AI_DOMAIN || ""),
  },
  plugins: [
    honeypotPlugin(),
    react(),
    ...(isProd
      ? []
      : [
          codeInspectorPlugin({
            bundler: "vite",
          }),
        ]),
    AutoImport({
      imports: [
        {
          react: [
            "React",
            "useState",
            "useEffect",
            "useContext",
            "useReducer",
            "useCallback",
            "useMemo",
            "useRef",
            "useImperativeHandle",
            "useLayoutEffect",
            "useDebugValue",
            "useDeferredValue",
            "useId",
            "useInsertionEffect",
            "useSyncExternalStore",
            "useTransition",
            "startTransition",
            "lazy",
            "memo",
            "forwardRef",
            "createContext",
            "createElement",
            "cloneElement",
            "isValidElement",
          ],
        },
        {
          "react-router-dom": [
            "useNavigate",
            "useLocation",
            "useParams",
            "useSearchParams",
            "Link",
            "NavLink",
            "Navigate",
            "Outlet",
          ],
        },
        // React i18n
        {
          "react-i18next": ["useTranslation", "Trans"],
        },
      ],
      dts: true,
    }),
  ],
  base,
  build: {
    sourcemap: false,
    reportCompressedSize: false,
    outDir: "out",
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const base = assetInfo.names?.[0] ?? assetInfo.name ?? "";
          if (base.includes("pdf.worker")) {
            return "assets/pdf.worker-[hash].js";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      // AI 生成类接口可能数分钟才返回，需拉长代理超时，避免浏览器一直 pending
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
      "/uploads": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
};
});
