import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import SiteBrandHead from "./components/SiteBrandHead";
import AntdAppProvider from "./components/AntdAppProvider";
import MustChangePasswordGate from "./components/MustChangePasswordGate";


function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AntdAppProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          <SiteBrandHead />
          <MustChangePasswordGate />
          <Suspense fallback={<div className="min-h-[30vh] flex items-center justify-center text-gray-500 text-sm">加载中…</div>}>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </AntdAppProvider>
    </I18nextProvider>
  );
}

export default App;
