import { cn } from "@/lib/utils";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
};

const base = "inline-flex items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all select-none";
const variants = {
  default: "bg-blue-600 text-white hover:bg-blue-700 px-3 h-8",
  outline: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-3 h-8",
  ghost:   "text-slate-600 hover:bg-slate-100 px-3 h-8",
};
const sizes = {
  default: "px-3 h-8",
  sm:      "px-2.5 h-7 text-[0.8rem]",
  icon:    "size-8 px-0",
};

export function LinkButton({ href, children, className, variant = "default", size = "default" }: Props) {
  return (
    <a href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </a>
  );
}
