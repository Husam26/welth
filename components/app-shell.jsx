"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PieChart,
  Sparkles,
  LineChart,
  Bot,
  Plus,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/simulations", label: "Digital Twin", icon: LineChart },
  { href: "/agent", label: "Agent", icon: Bot },
];

function Brand({ onNavigate }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex h-16 shrink-0 items-center gap-2.5 px-5"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
        W
      </span>
      <span className="text-lg font-semibold tracking-tight">Welth</span>
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <Brand onNavigate={onNavigate} />

      <div className="px-3 pb-3">
        <Link href="/transaction/create" onClick={onNavigate}>
          <Button className="w-full justify-start gap-2">
            <Plus className="size-4" /> Add Transaction
          </Button>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <UserButton appearance={{ elements: { avatarBox: "size-8" } }} />
          <span className="text-sm text-muted-foreground">Account</span>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar shadow-xl">
            <button
              className="absolute right-3 top-5 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <span className="font-semibold tracking-tight">Welth</span>
          <ThemeToggle className="ml-auto" />
        </header>
        <main className="mx-auto w-full max-w-6xl p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
