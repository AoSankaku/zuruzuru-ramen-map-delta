import { Play } from "lucide-react";

export function AppearanceBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  const label = count >= 2 ? "複数回登場" : "登場回数";

  return (
    <span
      className={`appearance-badge ${compact ? "appearance-badge--compact" : ""}`}
      aria-label={`登場回数 ${count}回`}
    >
      <Play size={compact ? 11 : 14} fill="currentColor" aria-hidden="true" />
      <b>{count}</b>
      <small>回登場</small>
      {!compact && <em>{label}</em>}
    </span>
  );
}
