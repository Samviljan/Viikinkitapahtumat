import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Menu, X, Globe2, Shield, LogOut, CalendarCheck, User, UserCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import NewsletterSignup from "@/components/NewsletterSignup";
import OfflineBanner from "@/components/OfflineBanner";
import InstallPWAButton from "@/components/InstallPWAButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { to: "/events", key: "nav.events" },
  { to: "/swordfighting", key: "nav.swordfighting" },
  { to: "/courses", key: "nav.courses" },
  { to: "/guilds", key: "nav.guilds" },
  { to: "/shops", key: "nav.shops" },
  { to: "/articles", key: "nav.articles" },
  { to: "/contact", key: "nav.contact" },
];

const LANGS = [
  { code: "fi", label: "Suomi" },
  { code: "en", label: "English" },
  { code: "sv", label: "Svenska" },
  { code: "da", label: "Dansk" },
  { code: "de", label: "Deutsch" },
  { code: "et", label: "Eesti" },
  { code: "pl", label: "Polski" },
];

function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="lang-switcher"
          className="flex items-center gap-2 px-3 py-2 rounded-sm border border-viking-edge text-viking-bone hover:border-viking-gold hover:text-viking-gold transition-colors"
        >
          <Globe2 size={16} />
          <span className="font-rune text-xs">{lang.toUpperCase()}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-viking-surface border-viking-edge text-viking-bone min-w-[140px]"
      >
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            data-testid={`lang-option-${l.code}`}
            onClick={() => setLang(l.code)}
            className={`cursor-pointer focus:bg-viking-surface2 focus:text-viking-gold ${
              lang === l.code ? "text-viking-gold" : ""
            }`}
          >
            <span className="font-rune text-[10px] mr-2 w-6">{l.code.toUpperCase()}</span>
            <span>{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <Link to="/" data-testid="brand-link" className="flex items-center gap-3 group">
      <span
        aria-hidden
        className="inline-flex h-9 w-9 items-center justify-center border border-viking-gold/60 text-viking-gold font-accent text-lg rounded-sm group-hover:border-viking-ember group-hover:text-viking-ember transition-colors"
      >
        ᚠ
      </span>
      <div className="flex flex-col leading-none">
        <span className="font-accent text-sm sm:text-base text-viking-bone tracking-[0.2em]">
          {t("site.name").toUpperCase()}
        </span>
        <span className="hidden sm:block text-[10px] text-viking-stone tracking-wider mt-1">
          {t("site.tagline")}
        </span>
      </div>
    </Link>
  );
}

function FavoritesNavLink() {
  const { t } = useI18n();
  const { user } = useAuth();
  // Hide nav link entirely for anonymous visitors — RSVPs require login.
  if (!user) return null;
  return (
    <NavLink
      to="/favorites"
      data-testid="nav-favorites"
      title={t("nav.my_events") || "Tapahtumani"}
      aria-label={t("nav.my_events") || "Tapahtumani"}
      className={({ isActive }) =>
        `relative inline-flex h-9 w-9 items-center justify-center rounded-sm border transition-colors ${
          isActive
            ? "border-viking-gold text-viking-gold"
            : "border-viking-edge text-viking-bone hover:border-viking-gold hover:text-viking-gold"
        }`
      }
    >
      <CalendarCheck size={16} />
    </NavLink>
  );
}

function MessagesNavLink() {
  const { t } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user || !user.role) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    api
      .get("/messages/inbox")
      .then((r) => {
        if (cancelled) return;
        const total = (r.data || []).reduce((acc, g) => acc + (g.unread || 0), 0);
        setUnread(total);
      })
      .catch(() => !cancelled && setUnread(0));
    return () => {
      cancelled = true;
    };
    // Re-poll on route change so the badge clears after the user reads messages.
  }, [user, location.pathname]);

  if (!user || !user.role) return null;
  return (
    <NavLink
      to="/messages"
      data-testid="nav-messages"
      title={t("messages.title")}
      aria-label={t("messages.title")}
      className={({ isActive }) =>
        `relative inline-flex h-9 w-9 items-center justify-center rounded-sm border transition-colors ${
          isActive
            ? "border-viking-gold text-viking-gold"
            : "border-viking-edge text-viking-bone hover:border-viking-gold hover:text-viking-gold"
        }`
      }
    >
      <Mail size={16} />
      {unread > 0 && (
        <span
          data-testid="messages-unread-badge"
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-viking-ember text-viking-bone text-[10px] font-rune rounded-full flex items-center justify-center border border-viking-bg"
        >
          {unread}
        </span>
      )}
    </NavLink>
  );
}

function AccountMenu() {
  const { t } = useI18n();
  const { user, logout } = useAuth();

  // Anonymous: show a simple "Sign in" button.
  if (!user || !user.role) {
    return (
      <Link to="/login" data-testid="nav-account">
        <Button
          variant="ghost"
          size="sm"
          className="text-viking-bone hover:text-viking-gold hover:bg-viking-surface2 hidden md:inline-flex"
        >
          <User size={14} className="mr-2" />
          {t("account.sign_in")}
        </Button>
      </Link>
    );
  }

  const initial = (user.nickname || user.name || user.email || "?").charAt(0).toUpperCase();

  // Authenticated: avatar dropdown with profile / admin / sign-out.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="account-menu-trigger"
          aria-label={t("account.my_account")}
          className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-sm border border-viking-edge text-viking-gold hover:border-viking-gold transition-colors font-serif text-sm"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-viking-surface border-viking-edge text-viking-bone min-w-[200px]"
      >
        <div className="px-2 py-2 text-[11px] text-viking-stone border-b border-viking-edge/60">
          <div className="text-viking-bone truncate font-rune">
            {user.nickname || user.name}
          </div>
          <div className="truncate">{user.email}</div>
        </div>
        <DropdownMenuItem asChild>
          <Link
            to="/profile"
            data-testid="account-menu-profile"
            className="cursor-pointer focus:bg-viking-surface2 focus:text-viking-gold"
          >
            <UserCircle2 size={14} className="mr-2" />
            {t("account.profile")}
          </Link>
        </DropdownMenuItem>
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link
              to="/admin"
              data-testid="account-menu-admin"
              className="cursor-pointer focus:bg-viking-surface2 focus:text-viking-gold"
            >
              <Shield size={14} className="mr-2" />
              {t("nav.admin")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-viking-edge/60" />
        <DropdownMenuItem
          data-testid="account-menu-logout"
          onClick={logout}
          className="cursor-pointer text-viking-ember focus:bg-viking-surface2 focus:text-viking-ember"
        >
          <LogOut size={14} className="mr-2" />
          {t("account.sign_out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <OfflineBanner />
      <InstallPWAButton />
      {/* Header */}
      <header className="sticky top-0 z-40 glass-header border-b border-viking-edge">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 h-16 flex items-center justify-between">
          <Brand />

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={`nav-${item.to.slice(1)}`}
                className={({ isActive }) =>
                  `font-rune text-[11px] px-3 py-2 rounded-sm transition-colors ${
                    isActive
                      ? "text-viking-gold"
                      : "text-viking-bone hover:text-viking-gold"
                  }`
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <MessagesNavLink />
            <FavoritesNavLink />
            <LanguageSwitcher />
            <AccountMenu />
            <button
              data-testid="mobile-menu-toggle"
              onClick={() => setOpen((o) => !o)}
              className="lg:hidden p-2 text-viking-bone"
              aria-label="Toggle menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="lg:hidden border-t border-viking-edge bg-viking-bg/95">
            <div className="px-4 py-4 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  data-testid={`mnav-${item.to.slice(1)}`}
                  className={({ isActive }) =>
                    `font-rune text-xs px-3 py-3 rounded-sm border-b border-viking-edge/40 ${
                      isActive
                        ? "text-viking-gold"
                        : "text-viking-bone hover:text-viking-gold"
                    }`
                  }
                >
                  {t(item.key)}
                </NavLink>
              ))}
              {user && user.role ? (
                <NavLink
                  to="/favorites"
                  onClick={() => setOpen(false)}
                  data-testid="mnav-favorites"
                  className={({ isActive }) =>
                    `font-rune text-xs px-3 py-3 rounded-sm border-b border-viking-edge/40 inline-flex items-center gap-2 ${
                      isActive ? "text-viking-gold" : "text-viking-bone hover:text-viking-gold"
                    }`
                  }
                >
                  <CalendarCheck size={14} />
                  {t("nav.my_events") || "Tapahtumani"}
                </NavLink>
              ) : null}
              {user && user.role ? (
                <>
                  <NavLink
                    to="/profile"
                    onClick={() => setOpen(false)}
                    data-testid="mnav-profile"
                    className={({ isActive }) =>
                      `font-rune text-xs px-3 py-3 rounded-sm border-b border-viking-edge/40 inline-flex items-center gap-2 ${
                        isActive ? "text-viking-gold" : "text-viking-bone hover:text-viking-gold"
                      }`
                    }
                  >
                    <User size={14} />
                    {t("account.profile")}
                  </NavLink>
                  {user.role === "admin" && (
                    <NavLink
                      to="/admin"
                      onClick={() => setOpen(false)}
                      data-testid="mnav-admin"
                      className="font-rune text-xs px-3 py-3 text-viking-gold border-b border-viking-edge/40"
                    >
                      {t("nav.admin")}
                    </NavLink>
                  )}
                  <button
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    data-testid="mnav-logout"
                    className="font-rune text-xs px-3 py-3 text-left text-viking-ember"
                  >
                    {t("account.sign_out")}
                  </button>
                </>
              ) : (
                <NavLink
                  to="/login"
                  onClick={() => setOpen(false)}
                  data-testid="mnav-login"
                  className="font-rune text-xs px-3 py-3 rounded-sm border-b border-viking-edge/40 inline-flex items-center gap-2 text-viking-bone hover:text-viking-gold"
                >
                  <User size={14} />
                  {t("account.sign_in")}
                </NavLink>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1" data-testid="page-main" key={location.pathname}>
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-viking-edge mt-20 py-12 bg-viking-surface/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="flex items-start gap-3">
            <span className="text-viking-gold font-accent text-xl">ᚠ</span>
            <div>
              <p className="font-accent tracking-[0.2em] text-sm text-viking-bone">
                {t("site.name").toUpperCase()}
              </p>
              <p className="text-xs text-viking-stone mt-1">{t("site.tagline")}</p>
              <p className="text-xs text-viking-stone mt-2">{t("footer.contact")}</p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <NewsletterSignup variant="footer" />
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-8 mt-10 pt-6 border-t border-viking-edge/60 flex flex-col sm:flex-row justify-between gap-4 text-xs text-viking-stone">
          <span>
            © {new Date().getFullYear()} {t("site.name")} · {t("footer.rights")}
          </span>
          <div className="flex items-center gap-4">
            <Link
              to="/guide"
              data-testid="footer-guide-link"
              className="text-[10px] font-rune hover:text-viking-gold transition-colors uppercase tracking-[0.2em]"
            >
              {t("footer.guide")}
            </Link>
            <Link
              to="/privacy"
              data-testid="footer-privacy-link"
              className="text-[10px] font-rune hover:text-viking-gold transition-colors uppercase tracking-[0.2em]"
            >
              {t("footer.privacy")}
            </Link>
            <Link
              to="/admin/login"
              data-testid="admin-login-link"
              className="text-[10px] font-rune hover:text-viking-gold transition-colors"
            >
              {t("nav.admin")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
