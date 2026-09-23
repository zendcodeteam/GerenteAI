import type { LucideIcon } from "lucide-react";

const styles = {
  emerald: "border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 text-emerald-600 dark:text-emerald-300",
  cyan: "border-cyan-500/25 bg-gradient-to-br from-cyan-500/15 to-blue-500/10 text-cyan-600 dark:text-cyan-300",
  blue: "border-blue-500/25 bg-gradient-to-br from-blue-500/15 to-indigo-500/10 text-blue-600 dark:text-blue-300",
  amber: "border-amber-500/25 bg-gradient-to-br from-amber-500/15 to-orange-500/10 text-amber-600 dark:text-amber-300",
  violet: "border-violet-500/25 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 text-violet-600 dark:text-violet-300",
} as const;

export function LukaIconBadge({
  icon: Icon,
  tone = "emerald",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: keyof typeof styles;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions = {
    sm: "h-8 w-8 rounded-xl",
    md: "h-10 w-10 rounded-2xl",
    lg: "h-12 w-12 rounded-2xl",
  }[size];

  const iconSize = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }[size];

  return (
    <span className={`inline-flex shrink-0 items-center justify-center border shadow-[0_8px_24px_-14px_currentColor] ${dimensions} ${styles[tone]}`}>
      <Icon className={iconSize} strokeWidth={2.25} />
    </span>
  );
}
