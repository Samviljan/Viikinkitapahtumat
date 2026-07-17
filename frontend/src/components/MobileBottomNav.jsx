/**
 * MobileBottomNav — fixed bottom navigation for phone-width viewports.
 *
 * Shown on <md screens only (hidden md:block on parent). Renders 4 primary
 * destinations: Events / Articles / Favorites / Account. Each item is a
 * ~90-px-wide thumb target with an icon + short label.
 *
 * Design notes:
 *   - Backdrop-blur + semi-transparent bg so the underlying page shows
 *     faintly through — feels lighter than an opaque bar.
 *   - "Favorites" and "Profile" links redirect to login when the user is
 *     anonymous, matching the behaviour of the existing header links.
 *   - Uses env(safe-area-inset-bottom) so it clears the iPhone home
 *     indicator area when the site is running as a PWA on iOS.
 *   - Active route is highlighted with the gold accent + subtle top
 *     border so the current tab is instantly recognisable.
 *
 * The Layout adds `pb-16 md:pb-0` to the main content wrapper so this
 * bar never covers page content when it's visible.
 */
import React from "react";
import { NavLink } from "react-router-dom";
import { Calendar, BookOpen, Heart, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

function BottomNavItem({ to, icon: Icon, labelKey, testid, requireAuth = false, user }) {
  const { t } = useI18n();
  // Route resolution — anonymous users get bounced to login for
  // auth-only destinations (matches the site's other CTAs).
  const target = requireAuth && !user
    ? `/login?next=${encodeURIComponent(to)}`
    : to;
  return (
    <NavLink
      to={target}
      data-testid={testid}
      className={({ isActive }) => {
        // Active only when the current route matches the DESIRED destination,
        // not the auth-redirected route (so /favorites is highlighted even
        // when we actually route the anon user to /login).
        const activeMatch = window.location.pathname.startsWith(to);
        const highlighted = isActive || activeMatch;
        return [
          "relative flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px]",
          "text-[10px] tracking-[0.12em] uppercase font-rune",
          "transition-colors",
          highlighted
            ? "text-viking-gold"
            : "text-viking-stone hover:text-viking-bone",
        ].join(" ");
      }}
    >
      {({ isActive }) => {
        const activeMatch = window.location.pathname.startsWith(to);
        const highlighted = isActive || activeMatch;
        return (
          <>
            {highlighted && (
              <span
                aria-hidden
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-viking-gold"
              />
            )}
            <Icon size={20} />
            <span>{t(labelKey)}</span>
          </>
        );
      }}
    </NavLink>
  );
}

export default function MobileBottomNav() {
  const { user } = useAuth();
  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-viking-surface/95 backdrop-blur border-t border-viking-edge"
      // Safe-area inset for iPhone home indicator when installed as PWA
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <div className="flex items-stretch max-w-lg mx-auto">
        <BottomNavItem
          to="/events"
          icon={Calendar}
          labelKey="nav.events"
          testid="bottom-nav-events"
          user={user}
        />
        <BottomNavItem
          to="/articles"
          icon={BookOpen}
          labelKey="nav.articles"
          testid="bottom-nav-articles"
          user={user}
        />
        <BottomNavItem
          to="/favorites"
          icon={Heart}
          labelKey="nav.favorites"
          testid="bottom-nav-favorites"
          user={user}
          requireAuth
        />
        <BottomNavItem
          to={user ? "/profile" : "/login"}
          icon={User}
          labelKey={user ? "nav.my_events" : "account.sign_in"}
          testid="bottom-nav-profile"
          user={user}
        />
      </div>
    </nav>
  );
}
