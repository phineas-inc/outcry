import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import { I18nProvider } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store";
import Explore from "@/pages/Explore";
import Landing from "@/pages/Landing";
import Profile from "@/pages/Profile";
import { Accessibility, Method, Privacy } from "@/pages/Content";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <I18nProvider>
        <StoreProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Landing />} />
              <Route path="app" element={<Explore />} />
              <Route path="app/p/:id" element={<Explore />} />
              <Route path="app/me" element={<Profile />} />
              <Route path="method" element={<Method />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="accessibility" element={<Accessibility />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </StoreProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
