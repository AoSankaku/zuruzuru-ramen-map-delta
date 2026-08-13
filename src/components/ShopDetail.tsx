import { CalendarDays, ExternalLink, MapPin, Play, Share2, Soup, TrainFront, Users, X } from "lucide-react";
import { RatingBadge } from "./RatingBadge";
import type { Shop } from "../types";

const formatViews = (value: number) => new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export function ShopDetail({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const isUnavailable = shop.videoAvailability !== "public";

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${shop.id}`;
    if (navigator.share) {
      await navigator.share({ title: shop.name, text: `${shop.name}をチェック`, url });
      return;
    }
    await navigator.clipboard?.writeText(url);
  };

  return (
    <aside className="detail" aria-label={`${shop.name}の詳細`}>
      <div className="detail__accent" />
      <button className="icon-button detail__close" onClick={onClose} aria-label="詳細を閉じる"><X size={20} /></button>
      <div className="detail__content">
        <div className="detail__kicker">RAMEN FILE / {shop.id.toUpperCase()}</div>
        <div className="detail__title-row">
          <div>
            <span className="detail__genre">{shop.genre}</span>
            <h2>{shop.name}</h2>
          </div>
          <RatingBadge rating={shop.rating} />
        </div>

        <div className="detail__location">
          <MapPin size={17} />
          <div><b>{shop.region} {shop.locality}</b><span>{shop.address}</span></div>
        </div>

        {shop.nearestStation && (
          <div className="detail__station">
            <TrainFront size={17} />
            <div>
              <span>最寄り駅・徒歩は概算</span>
              <b>{shop.nearestStation.name}駅から徒歩約{shop.nearestStation.walkMinutes}分</b>
              <small>{shop.nearestStation.line} · 駅座標まで約{shop.nearestStation.distanceMeters.toLocaleString("ja-JP")}m</small>
            </div>
          </div>
        )}

        {(shop.status === "closed" || shop.status === "temporarily_closed") && (
          <div className="notice">
            <b>{shop.status === "closed" ? "閉店情報があります" : "休業情報があります"}</b>
            <span>最終確認 {shop.statusVerifiedAt}。訪問前に公式情報をご確認ください。</span>
          </div>
        )}

        <p className="detail__summary">{shop.summary}</p>

        <div className="detail__facts">
          <div><Play size={16} /><span>登場回数</span><b>{shop.visits}回</b></div>
          <div><Soup size={16} /><span>完まくり</span><b>{shop.completeSoup === null ? "不明" : shop.completeSoup ? "あり" : "—"}</b></div>
          <div><Users size={16} /><span>同伴者</span><b>{shop.companion === null ? "不明" : shop.companion ? "あり" : "—"}</b></div>
        </div>

        <div className="video-card">
          <div className="video-card__art"><Play size={22} fill="currentColor" /></div>
          <div>
            <span><CalendarDays size={12} />{shop.latestVideoPublishedAt} · {formatViews(shop.viewCount)} 回視聴</span>
            <b>{shop.latestVideoTitle}</b>
          </div>
        </div>

        <div className="detail__actions">
          <a
            className={`primary-action ${isUnavailable ? "is-disabled" : ""}`}
            href={isUnavailable ? undefined : `https://www.youtube.com/watch?v=${shop.latestVideoId}`}
            target="_blank"
            rel="noreferrer"
            aria-disabled={isUnavailable}
          >
            {isUnavailable ? "動画は公開終了" : "YouTubeで見る"}<ExternalLink size={16} />
          </a>
          <button className="secondary-action" onClick={() => void share()} aria-label="店舗情報を共有"><Share2 size={17} /></button>
        </div>

        <p className="detail__source">
          店舗名・住所は動画概要欄から抽出し、座標は住所検索結果を利用しています。営業状況は訪問前にご確認ください。
          {shop.shopUrl && <> <a href={shop.shopUrl} target="_blank" rel="noreferrer">店舗掲載元を確認</a></>}
        </p>
      </div>
    </aside>
  );
}
