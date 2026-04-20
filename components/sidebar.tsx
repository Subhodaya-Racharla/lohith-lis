"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Receipt, FlaskConical,
  UserRound, Settings, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard, enabled: true  },
  { href: "/patients",  label: "Patients",   icon: Users,           enabled: true  },
  { href: "/billing",   label: "Billing",    icon: Receipt,         enabled: true  },
  { href: "/tests",     label: "Tests",      icon: FlaskConical,    enabled: false },
  { href: "/doctors",   label: "Doctors",    icon: UserRound,       enabled: false },
  { href: "/settings",  label: "Settings",   icon: Settings,        enabled: false },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-slate-900 border-r border-slate-800 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center shrink-0">
            <FlaskConical className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Lohith Path Labs</p>
            <p className="text-blue-400 text-xs">LIS — Lab System</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, enabled }) => {
          const active = enabled && (pathname === href || pathname.startsWith(href + "/"));
          return (
            <div key={href}>
              {enabled ? (
                <Link href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="w-3 h-3 opacity-60" />}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 cursor-not-allowed select-none">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-700 text-slate-500">
                    Soon
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-600">v1.0 · Demo Build</p>
      </div>
    </aside>
  );
}
