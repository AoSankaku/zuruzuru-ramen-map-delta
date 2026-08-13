import { createHash } from "node:crypto";

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const PREFECTURE_PATTERN = new RegExp(`^(${PREFECTURES.join("|")})`);
const SHOP_URL_PATTERN = /^https?:\/\/(?:www\.)?(?:tabelog\.com\/|maps\.app\.goo\.gl\/|google\.[^/]+\/maps)/i;
const SKIP_NAME_PATTERN = /^(?:【?本日のお店】?|\d+軒目(?:のお店)?|[▼★※]|https?:\/\/)/;

export const normalizeWhitespace = (value = "") => value.replace(/[\u3000\t]+/g, " ").replace(/\s+/g, " ").trim();
export const normalizeKey = (value = "") => normalizeWhitespace(value).normalize("NFKC").toLocaleLowerCase("ja").replace(/[\s・･]/g, "");

export function isJapaneseAddress(value = "") {
  return PREFECTURE_PATTERN.test(normalizeWhitespace(value));
}

function looksLikeOverseasAddress(value = "") {
  const line = normalizeWhitespace(value);
  return /\d/.test(line) && (/,/.test(line) || /(?:street|st\.?|road|rd\.?|avenue|ave\.?|district|city|구|동|路|號|号)/i.test(line));
}

function cleanUrl(value) {
  return value.replace(/[)）】\]>,。]+$/g, "");
}

function sourceIdentity(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}

export function extractShopCandidates(video) {
  if (!video?.videoId || typeof video.description !== "string") return [];
  const lines = video.description.split(/\r?\n/).map(normalizeWhitespace).filter(Boolean);
  const candidates = [];

  for (let urlIndex = 0; urlIndex < lines.length; urlIndex += 1) {
    if (!SHOP_URL_PATTERN.test(lines[urlIndex])) continue;
    const shopUrl = cleanUrl(lines[urlIndex]);
    let addressIndex = -1;
    for (let index = urlIndex - 1; index >= Math.max(0, urlIndex - 5); index -= 1) {
      if (isJapaneseAddress(lines[index]) || looksLikeOverseasAddress(lines[index])) {
        addressIndex = index;
        break;
      }
    }
    if (addressIndex < 1) continue;

    let nameIndex = addressIndex - 1;
    while (nameIndex >= 0 && SKIP_NAME_PATTERN.test(lines[nameIndex])) nameIndex -= 1;
    if (nameIndex < 0) continue;
    const name = lines[nameIndex];
    if (!name || name.length > 100) continue;

    const address = lines[addressIndex];
    const prefecture = address.match(PREFECTURE_PATTERN)?.[1] ?? "";
    candidates.push({
      identity: sourceIdentity(shopUrl),
      name,
      address,
      shopUrl,
      countryCode: prefecture ? "JP" : "ZZ",
      countryName: prefecture ? "日本" : "海外",
      region: prefecture || "海外",
      video,
    });
  }
  return candidates;
}

function isPublic(video) {
  return video.availability === "public" || (video.availability == null && video.privacyStatus === "public");
}

export function mergeShopCandidates(candidates) {
  const merged = new Map();
  for (const candidate of candidates) {
    if (!isPublic(candidate.video)) continue;
    const fallbackKey = `${normalizeKey(candidate.name)}|${normalizeKey(candidate.address)}`;
    const key = candidate.identity || fallbackKey;
    const existing = merged.get(key) ?? { ...candidate, videos: [] };
    if (!existing.videos.some((video) => video.videoId === candidate.video.videoId)) existing.videos.push(candidate.video);
    merged.set(key, existing);
  }
  return [...merged.values()].map((shop) => ({
    ...shop,
    videos: shop.videos.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt))),
  }));
}

export function parseIsoDurationSeconds(duration = "") {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function detectGenre(shop) {
  const text = `${shop.name} ${shop.videos.map((video) => video.title).join(" ")}`;
  if (/油そば|まぜそば|汁なし/.test(text)) return "まぜそば・油そば";
  if (/つけ麺/.test(text)) return "つけ麺";
  if (/家系/.test(text)) return "家系";
  if (/味噌|みそ/.test(text)) return "味噌";
  if (/煮干/.test(text)) return "煮干し";
  if (/担々|坦々/.test(text)) return "担々麺";
  if (/豚骨|とんこつ/.test(text)) return "豚骨";
  if (/鶏白湯/.test(text)) return "鶏白湯";
  if (/塩ラーメン|塩らーめん|塩らぁめん/.test(text)) return "塩";
  return "ラーメン";
}

function detectTags(shop) {
  const text = `${shop.name} ${shop.videos.map((video) => video.title).join(" ")}`;
  const tags = [
    ["二郎系", /二郎系|二郎インスパイア/], ["家系", /家系/], ["自家製麺", /自家製麺/],
    ["デカ盛り", /デカ盛り|大食い|爆盛り/], ["濃厚", /濃厚/], ["老舗", /老舗/],
    ["新店", /新店|オープン/], ["行列", /行列/], ["限定", /限定/],
  ];
  return tags.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}

function splitJapaneseLocation(address, region) {
  const remainder = normalizeWhitespace(address).replace(new RegExp(`^${region}`), "");
  const locality = remainder.match(/^(.+?市.+?区|.+?郡.+?[町村]|.+?[市区町村])/u)?.[1] ?? remainder.split(/[0-9０-９]/)[0];
  return locality || region;
}

function calculatedScore(videos) {
  const views = videos.reduce((sum, video) => sum + Number(video.viewCount ?? 0), 0);
  const score = 3 + Math.min(1.25, Math.log10(views + 1) / 5) + Math.min(0.5, (videos.length - 1) * 0.12);
  return Math.round(Math.min(5, score) * 10) / 10;
}

export function toShopRecord(shop, geocode, generatedAt) {
  const latest = shop.videos[0];
  const viewCount = shop.videos.reduce((sum, video) => sum + Number(video.viewCount ?? 0), 0);
  const id = `shop-${createHash("sha1").update(shop.identity || `${shop.name}|${shop.address}`).digest("hex").slice(0, 10)}`;
  const publishedDate = String(latest.publishedAt ?? "").slice(0, 10);
  return {
    id,
    name: shop.name,
    genre: detectGenre(shop),
    tags: detectTags(shop),
    countryCode: geocode.countryCode ?? shop.countryCode,
    countryName: geocode.countryName ?? shop.countryName,
    region: geocode.region ?? shop.region,
    locality: geocode.locality ?? (shop.countryCode === "JP" ? splitJapaneseLocation(shop.address, shop.region) : shop.region),
    address: shop.address,
    latitude: geocode.latitude,
    longitude: geocode.longitude,
    status: "unknown",
    statusVerifiedAt: generatedAt.slice(0, 10),
    visits: shop.videos.length,
    rating: { kind: "calculated", score: calculatedScore(shop.videos), scoreVersion: "video-attention-v1" },
    completeSoup: null,
    companion: null,
    isShort: parseIsoDurationSeconds(latest.duration) <= 60,
    latestVideoId: latest.videoId,
    latestVideoTitle: latest.title ?? shop.name,
    latestVideoPublishedAt: publishedDate,
    videoAvailability: "public",
    viewCount,
    summary: `SUSURU TV.で${shop.videos.length}回紹介。最新の掲載動画は「${latest.title ?? shop.name}」。`,
    shopUrl: shop.shopUrl,
    sourceVideoIds: shop.videos.map((video) => video.videoId),
    geocodingSource: geocode.source,
  };
}
