"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LogOut, Bell, FlaskConical, Search, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PatientResult = { id: string; full_name: string; patient_code: string; phone: string };

export default function Topbar({ title }: { title?: string }) {
  const router = useRouter();
  const [email, setEmail]   = useState("");
  const [initials, setInitials] = useState("U");
  const [query, setQuery]   = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setInitials(session.user.email.slice(0, 2).toUpperCase());
      }
    });

    // "/" keyboard shortcut to focus search
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === "Escape") { setShowSearch(false); setQuery(""); setResults([]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from("lis_patients")
        .select("id, full_name, patient_code, phone")
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,patient_code.ilike.%${query}%`)
        .limit(6);
      setResults(data || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6 shrink-0">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 md:hidden shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
          <FlaskConical className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-slate-800 text-sm">LIS</span>
      </div>

      {title && <h1 className="hidden md:block text-base font-semibold text-slate-800 shrink-0">{title}</h1>}

      {/* Global search */}
      <div className="flex-1 max-w-sm relative ml-0 md:ml-4">
        {showSearch ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search patients..."
              autoFocus
              className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
            <button onClick={() => { setShowSearch(false); setQuery(""); setResults([]); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
            {/* Results dropdown */}
            {(results.length > 0 || searching) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {searching ? (
                  <div className="px-4 py-3 text-xs text-slate-400">Searching...</div>
                ) : (
                  results.map(p => (
                    <button key={p.id} onClick={() => { router.push(`/patients/${p.id}`); setShowSearch(false); setQuery(""); setResults([]); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors">
                      <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-blue-700 text-xs font-bold">{p.full_name[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{p.full_name}</p>
                        <p className="text-xs text-slate-400">{p.patient_code} · {p.phone}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); }}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 hover:bg-white transition-colors w-full">
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search patients</span>
            <kbd className="hidden sm:inline ml-auto text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-mono">/</kbd>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        {/* Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors outline-none">
            <Bell className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs font-semibold text-slate-500">Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-4 py-6 text-center text-xs text-slate-400">No notifications yet</div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-2 h-9 rounded-lg hover:bg-slate-100 transition-colors outline-none">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-700 max-w-[120px] truncate">{email.split("@")[0]}</p>
              <p className="text-[10px] text-slate-400">Admin</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-slate-500 font-normal truncate">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
