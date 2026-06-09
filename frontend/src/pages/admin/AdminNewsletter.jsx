import React from "react";
import AdminNewsletterPanel from "@/components/admin/AdminNewsletterPanel";
import AdminAnnouncementPanel from "@/components/admin/AdminAnnouncementPanel";
import AdminSubscribersPanel from "@/components/admin/AdminSubscribersPanel";
import AdminWeeklyReportPanel from "@/components/admin/AdminWeeklyReportPanel";

export default function AdminNewsletter() {
  return (
    <div className="space-y-8" data-testid="admin-newsletter-page">
      <AdminNewsletterPanel />
      <AdminAnnouncementPanel />
      <AdminSubscribersPanel />
      <AdminWeeklyReportPanel />
    </div>
  );
}
