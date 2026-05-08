"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  ClipboardList,
  Brain,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",      href: "/dashboard",      icon: LayoutDashboard },
  { label: "Queue",          href: "/queue",           icon: ClipboardList },
  { label: "Discover",       href: "/discover",        icon: Search },
  { label: "Career Context", href: "/career-context",  icon: Brain },
  { label: "Settings",       href: "/settings",        icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-52 flex-col border-r border-white/[0.06] bg-background">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.06]">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold tracking-tighter text-primary-foreground select-none">
          SS
        </div>
        <div>
          <span className="block text-[13px] font-semibold tracking-tight text-foreground">
            StealthScan
          </span>
          <span className="block text-[10px] text-muted-foreground leading-none mt-0.5">
            Precision job bot
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-px px-2 py-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <p className="text-[9px] font-medium tracking-widest uppercase text-muted-foreground/50">
          v2.0 beta
        </p>
      </div>
    </aside>
  );
}
