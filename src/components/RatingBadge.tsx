import { Award, Star } from "lucide-react";
import type { Rating } from "../types";

export function RatingBadge({ rating, compact = false }: { rating: Rating; compact?: boolean }) {
  if (rating.kind === "award") {
    const label = rating.awardType === "annual"
      ? `${rating.awardYear} 年間大賞`
      : `${rating.awardYear}.${rating.awardMonth} 月間大賞`;
    return (
      <span className={`rating rating--award ${compact ? "rating--compact" : ""}`}>
        <Award size={compact ? 13 : 15} aria-hidden="true" />
        {label}
      </span>
    );
  }

  if (rating.kind === "unrated") {
    return <span className="rating rating--muted">評価なし</span>;
  }

  return (
    <span className="rating rating--score" aria-label={`注目度 ${rating.score}`}>
      <Star size={compact ? 12 : 14} fill="currentColor" aria-hidden="true" />
      <b>{rating.score.toFixed(1)}</b>
      {!compact && <small>注目度</small>}
    </span>
  );
}
