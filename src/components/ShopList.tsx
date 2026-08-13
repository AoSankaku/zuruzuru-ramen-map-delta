import { ChevronRight, MapPin, Play, Soup, TrainFront } from "lucide-react";
import { RatingBadge } from "./RatingBadge";
import type { Shop } from "../types";

const statusLabel = (shop: Shop) => {
  if (shop.status === "closed") return "閉店";
  if (shop.status === "temporarily_closed") return "休業情報あり";
  if (shop.status === "moved") return "移転";
  return null;
};

export function ShopList({ shops, selected, onSelect }: { shops: Shop[]; selected: Shop | null; onSelect: (shop: Shop) => void }) {
  return (
    <div className="shop-list" aria-live="polite">
      {shops.length === 0 ? (
        <div className="empty-state">
          <Soup size={36} strokeWidth={1.3} />
          <h2>該当する一杯がありません</h2>
          <p>検索条件を少し広げてみてください。</p>
        </div>
      ) : shops.map((shop) => {
        const status = statusLabel(shop);
        return (
          <article
            key={shop.id}
            className={`shop-card ${selected?.id === shop.id ? "is-selected" : ""}`}
            onClick={() => onSelect(shop)}
          >
            <div className="shop-card__body">
              <div className="shop-card__meta">
                <span>{shop.genre}</span>
                <span><MapPin size={12} />{shop.countryCode === "JP" ? shop.region : shop.countryName}</span>
                {shop.nearestStation && <span className="station-tag"><TrainFront size={12} />{shop.nearestStation.name}駅 約{shop.nearestStation.walkMinutes}分</span>}
                {status && <span className="status-tag">{status}</span>}
              </div>
              <h3>{shop.name}</h3>
              <p>{shop.summary}</p>
              <div className="shop-card__foot">
                <RatingBadge rating={shop.rating} compact />
                <span className="visits"><Play size={12} fill="currentColor" />登場 {shop.visits}回</span>
              </div>
            </div>
            <ChevronRight className="shop-card__arrow" size={20} aria-hidden="true" />
            <button className="shop-card__hit" aria-label={`${shop.name}の詳細を見る`} />
          </article>
        );
      })}
    </div>
  );
}
