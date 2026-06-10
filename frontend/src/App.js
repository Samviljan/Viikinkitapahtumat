import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import Layout from "@/components/Layout";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { initAnalytics } from "@/lib/analytics";

// Initialise GA + Consent Mode at module import time, before React renders.
// Doing this in App's useEffect was racy: child useEffects (CookieConsentBanner)
// run BEFORE the parent's useEffect, so trackPageView could fire while
// window.dataLayer was still undefined.
initAnalytics();

import Home from "@/pages/Home";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import Submit from "@/pages/Submit";import Courses from "@/pages/Courses";
import Favorites from "@/pages/Favorites";
import Guilds from "@/pages/Guilds";
import Shops from "@/pages/Shops";
import MerchantDetail from "@/pages/MerchantDetail";
import MerchantCardPage from "@/pages/MerchantCardPage";
import Swordfighting from "@/pages/Swordfighting";
import Articles from "@/pages/Articles";
import ArticleDetail from "@/pages/ArticleDetail";
import Contact from "@/pages/Contact";
import Privacy from "@/pages/Privacy";
import Unsubscribe from "@/pages/Unsubscribe";
import AdminLogin from "@/pages/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminEvents from "@/pages/admin/AdminEvents";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminMessages from "@/pages/admin/AdminMessages";
import AdminNewsletter from "@/pages/admin/AdminNewsletter";
import AdminContent from "@/pages/admin/AdminContent";
import AdminMerchantRequests from "@/pages/admin/AdminMerchantRequests";
import AdminEventOrganizerRequests from "@/pages/admin/AdminEventOrganizerRequests";
import AdminSystem from "@/pages/admin/AdminSystem";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Profile from "@/pages/Profile";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import SendMessage from "@/pages/SendMessage";
import Messages from "@/pages/Messages";
import UserGuide from "@/pages/UserGuide";

function App() {
  return (
    <AuthProvider>
      <I18nProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/submit" element={<Submit />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/guilds" element={<Guilds />} />
              <Route path="/shops" element={<Shops />} />
              <Route path="/shops/:id" element={<MerchantDetail />} />
              <Route path="/swordfighting" element={<Swordfighting />} />
              <Route path="/articles" element={<Articles />} />
              <Route path="/articles/:slug" element={<ArticleDetail />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="events" element={<AdminEvents />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="newsletter" element={<AdminNewsletter />} />
                <Route path="content" element={<AdminContent />} />
                <Route path="merchant-requests" element={<AdminMerchantRequests />} />
                <Route path="event-organizer-requests" element={<AdminEventOrganizerRequests />} />
                <Route path="system" element={<AdminSystem />} />
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/merchant-card" element={<MerchantCardPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/compose" element={<SendMessage />} />
              <Route path="/guide" element={<UserGuide />} />
              <Route
                path="*"
                element={
                  <div className="text-center py-32 text-viking-stone">404</div>
                }
              />
            </Routes>
          </Layout>
          <CookieConsentBanner />
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: "#1E1815",
                border: "1px solid #352A23",
                color: "#E6D5B8",
                fontFamily: "Outfit, sans-serif",
                borderRadius: "4px",
              },
            }}
          />
        </BrowserRouter>
      </I18nProvider>
    </AuthProvider>
  );
}

export default App;
