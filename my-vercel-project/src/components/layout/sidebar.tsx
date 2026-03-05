"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  ClipboardList,
  History,
  FileText,
  Settings,
  Target,
  Zap,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Discover Jobs",
    href: "/discover",
    icon: Search,
  },
  {
    label: "Review Queue",
    href: "/queue",
    icon: ClipboardList,
  },
  {
    label: "History",
    href: "/history",
    icon: History,
  },
  {
    label: "Resumes",
    href: "/resumes",
    icon: FileText,
  },
  {
    label: "Search Profiles",
    href: "/profiles",
    icon: Target,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-5">
        <Zap className="h-6 w-6 text-blue-600" />
        <span className="text-lg font-bold text-gray-900">AutoApply</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
