import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { I18nProvider } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store";
import About from "@/pages/About";
import Explore from "@/pages/Explore";
import Profile from "@/pages/Profile";
import { Accessibility, Privacy } from "@/pages/Content";

/** Old /app/... links keep working. */
function LegacyApp() {
  const { search } = useLocation();
  return <Navigate to={new URLSearchParams(search).get("view") === "map" ? "/" : "/feed"} replace />;
}
function LegacyDetail() {
  const { id } = useParams();
  return <Navigate to={`/feed/p/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <I18nProvider>
        <StoreProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Explore view="map" />} />
              <Route path="p/:id" element={<Explore view="map" />} />
              <Route path="feed" element={<Explore view="list" />} />
              <Route path="feed/p/:id" element={<Explore view="list" />} />
              <Route path="me" element={<Profile />} />
              <Route path="about" element={<About />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="accessibility" element={<Accessibility />} />
              <Route path="app" element={<LegacyApp />} />
              <Route path="app/p/:id" element={<LegacyDetail />} />
              <Route path="app/me" element={<Navigate to="/me" replace />} />
              <Route path="method" element={<Navigate to="/about" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </StoreProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
