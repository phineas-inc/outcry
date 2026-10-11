import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import { StoreProvider } from "@/lib/store";
import Explore from "@/pages/Explore";
import Landing from "@/pages/Landing";
import Profile from "@/pages/Profile";
import { Method, Privacy } from "@/pages/Content";

export default function App() {
  const routes = (
    <StoreProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="app" element={<Explore />} />
          <Route path="app/p/:id" element={<Explore />} />
          <Route path="app/me" element={<Profile />} />
          <Route path="method" element={<Method />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </StoreProvider>
  );
  return <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>{routes}</BrowserRouter>;
}
