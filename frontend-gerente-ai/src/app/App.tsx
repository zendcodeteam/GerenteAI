import { BrowserRouter } from "react-router";
import { AppRoutes } from "@/routes";
import { ScrollToTop } from "@/shared/components/layout/ScrollToTop";
import { CookieConsentBanner } from "@/shared/components/layout/CookieConsentBanner";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppRoutes />
      <CookieConsentBanner />
    </BrowserRouter>
  );
}
