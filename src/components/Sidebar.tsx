"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Sparkles,
  X,
} from "lucide-react";
import { cx, initials } from "@/lib/format";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/meetings", label: "Meetings", icon: Mic },
  { href: "/docs", label: "Writing", icon: FileText },
  { href: "/chat", label: "Assistant", icon: MessageSquare },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({
  user,
}: {
  user: { name?: string | null; email?: string | null };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating on mobile should dismiss the drawer.
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent/12 text-ink ring-1 ring-accent/25"
                : "text-ink-dim hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon size={17} className={active ? "text-accent-soft" : ""} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        {/* Email sign-in carries no avatar, so initials are the only identity mark. */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent-soft">
          {initials(user.name ?? user.email)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{user.name ?? "Signed in"}</p>
          <p className="truncate text-xs text-ink-faint">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ redirectTo: "/login" })}
          title="Sign out"
          aria-label="Sign out"
          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-2.5 border-b border-line px-5 py-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
        <Sparkles size={16} className="text-accent-soft" />
      </span>
      <span className="font-semibold tracking-tight text-ink">Project Hub</span>
    </Link>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Menu size={20} />
        </button>
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <Sparkles size={16} className="text-accent-soft" />
          Project Hub
        </span>
      </header>

      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:sticky md:top-0 md:flex md:h-dvh">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="animate-in absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pr-2">
              <div className="flex-1">{brand}</div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-ink-faint hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
