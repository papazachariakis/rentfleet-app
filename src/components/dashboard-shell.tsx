"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  CalendarDays,
  CalendarRange,
  Users,
  FileText,
  CreditCard,
  MapPin,
  TrendingUp,
  Wrench,
  BarChart3,
  ListChecks,
  BookOpen,
  UserCog,
  Shield,
  Palette,
  Radio,
  MapPinned,
  Cpu,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Εργασία",
    items: [
      { href: "/dashboard", label: "Επισκόπηση", icon: LayoutDashboard },
      { href: "/calendar", label: "Ημερολόγιο", icon: CalendarRange },
      { href: "/bookings", label: "Κρατήσεις", icon: CalendarDays },
    ],
  },
  {
    label: "Στόλος",
    items: [
      { href: "/fleet", label: "Στόλος", icon: Car },
      { href: "/map", label: "Χάρτης", icon: MapPinned },
      { href: "/telematics", label: "Trackers", icon: Cpu },
      { href: "/maintenance", label: "Συντήρηση", icon: Wrench },
    ],
  },
  {
    label: "Πελάτες & δίκτυο",
    items: [
      { href: "/customers", label: "Πελάτες", icon: Users },
      { href: "/branches", label: "Καταστήματα", icon: MapPin },
      { href: "/channels", label: "Κανάλια / OTA", icon: Radio },
    ],
  },
  {
    label: "Οικονομικά",
    items: [
      { href: "/pricing", label: "Τιμολόγηση", icon: TrendingUp },
      { href: "/payments", label: "Πληρωμές", icon: CreditCard },
      { href: "/tax", label: "ΑΑΔΕ & myDATA", icon: FileText },
      { href: "/reports", label: "Αναφορές", icon: BarChart3 },
    ],
  },
  {
    label: "Ρυθμίσεις",
    items: [
      { href: "/setup", label: "Στήσιμο", icon: ListChecks },
      { href: "/guide", label: "Οδηγός", icon: BookOpen },
      { href: "/team", label: "Ομάδα", icon: UserCog },
      { href: "/branding", label: "White-label", icon: Palette },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({
  children,
  userName,
  orgName,
  platformAdmin = false,
  impersonating = false,
}: {
  children: React.ReactNode;
  userName: string;
  orgName: string;
  platformAdmin?: boolean;
  impersonating?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const adminItem: NavItem = {
    href: "/admin",
    label: "Platform Admin",
    icon: Shield,
  };

  const visibleGroups: NavGroup[] = (() => {
    if (impersonating) return navGroups;
    if (
      platformAdmin &&
      (!orgName || orgName === "RentFleet Platform")
    ) {
      return [{ label: "Platform", items: [adminItem] }];
    }
    if (platformAdmin) {
      return [{ label: "Platform", items: [adminItem] }, ...navGroups];
    }
    return navGroups;
  })();

  const SideNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/80">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-muted hover:bg-slate-100/80 hover:text-foreground"
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                  ) : null}
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[96rem]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-surface px-3 py-5 lg:flex">
          <Link href="/dashboard" className="px-3">
            <span className="font-display text-xl tracking-tight text-accent">
              RentFleet
            </span>
            <p className="mt-1 truncate text-xs text-muted">{orgName}</p>
          </Link>
          <div className="mt-7 flex flex-1 flex-col">
            <SideNav />
          </div>
          <div className="mx-1 mt-3 rounded-xl border border-border/70 bg-slate-50/60 px-3 py-3">
            <p className="truncate text-sm font-medium text-ink">{userName}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-2 flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Έξοδος
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border/60 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
            <Link href="/dashboard" className="font-display text-lg text-accent">
              RentFleet
            </Link>
            <button
              type="button"
              aria-label="Μενού"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-muted hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
          </header>

          {drawerOpen ? (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-ink/40"
                aria-label="Κλείσιμο"
                onClick={() => setDrawerOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface p-4 shadow-lg animate-fade-in">
                <div className="mb-5 flex items-center justify-between px-1">
                  <span className="font-display text-lg text-accent">
                    RentFleet
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-lg p-2 text-muted hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <SideNav onNavigate={() => setDrawerOpen(false)} />
                <div className="mt-4 border-t border-border/70 pt-3">
                  <p className="truncate px-1 text-sm font-medium">{userName}</p>
                  <button
                    type="button"
                    onClick={logout}
                    className="mt-2 flex items-center gap-2 px-1 text-sm text-muted"
                  >
                    <LogOut className="h-4 w-4" />
                    Έξοδος
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <main className="page-shell animate-fade-in flex-1 py-6 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
