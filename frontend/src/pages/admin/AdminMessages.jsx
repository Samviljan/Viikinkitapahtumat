/**
 * Admin messages sub-page: composes site-wide announcements (admin uses the
 * same /messages/send endpoint, which now bypasses the paid_messaging gate
 * for role=admin) AND shows the audit log + push delivery stats.
 */
import React from "react";
import { Link } from "react-router-dom";
import { Megaphone, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AdminStatsPanel from "@/components/admin/AdminStatsPanel";
import AdminPushHealthCard from "@/components/admin/AdminPushHealthCard";
import AdminMessagingQuotaPanel from "@/components/admin/AdminMessagingQuotaPanel";
import EmailTemplatesPanel from "@/components/admin/EmailTemplatesPanel";

export default function AdminMessages() {
  const { t } = useI18n();
  return (
    <div className="space-y-8" data-testid="admin-messages-page">
      <AdminPushHealthCard />
      <AdminMessagingQuotaPanel />
      <Link
        to="/messages"
        data-testid="admin-compose-link"
        className="carved-card rounded-sm p-5 flex items-center gap-4 hover:border-viking-gold/60 transition-colors group"
      >
        <div className="h-12 w-12 rounded-sm border border-viking-gold/50 flex items-center justify-center text-viking-gold shrink-0">
          <Megaphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-rune text-xs uppercase tracking-wider text-viking-bone mb-1">
            {t("admin.messages.compose_title")}
          </div>
          <p className="text-xs text-viking-stone leading-relaxed">
            {t("admin.messages.compose_help")}
          </p>
        </div>
        <ArrowRight
          size={16}
          className="text-viking-stone group-hover:text-viking-gold shrink-0 transition-colors"
        />
      </Link>

      <EmailTemplatesPanel />

      <AdminStatsPanel />
    </div>
  );
}
