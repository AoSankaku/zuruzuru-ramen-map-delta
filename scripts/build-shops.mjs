import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { extractShopCandidates, mergeShopCandidates, toShopRecord } from "./lib/shop-data.mjs";
import { normalizeNearestStation } from "./lib/station-data.mjs";

const INPUT = resolve(process.env.YOUTUBE_INPUT ?? "src/data/youtube-videos.generated.json");
const OUTPUT = resolve(process.env.SHOPS_OUTPUT ?? "src/data/shops.generated.json");
const REPORT = resolve(process.env.SHOPS_REPORT ?? "src/data/shop-import-report.generated.json");
const CACHE = resolve(process.env.GEOCODING_CACHE ?? "src/data/geocoding-cache.json");
const STATION_CACHE = resolve(process.env.STATION_CACHE ?? "src/data/station-cache.json");
const GSI_ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const HEART_RAILS_ENDPOINT = "https://express.heartrails.com/api/json";

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function geocodingQuery(address) {
  return address
    .replace(/[\u3000]/g, " ")
    .replace(/\s+(?:[A-Za-zＡ-Ｚａ-ｚ].*|\d+F.*)$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function geocodeJapan(address) {
  const url = new URL(GSI_ENDPOINT);
  url.searchParams.set("q", geocodingQuery(address));
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "zuruzuru-ramen-map-delta/0.1 (fan-site data build)" },
  });
  if (!response.ok) throw new Error(`国土地理院住所検索API ${response.status}`);
  const features = await response.json();
  const first = Array.isArray(features) ? features[0] : features;
  const coordinates = first?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  return { longitude: Number(coordinates[0]), latitude: Number(coordinates[1]), matchedAddress: first.properties?.title ?? null, source: "GSI Address Search API" };
}

async function geocodeOverseas(name, address) {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("q", `${name}, ${address}`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "ja,en;q=0.8",
      "User-Agent": "zuruzuru-ramen-map-delta/0.1 (unofficial fan-site data build)",
    },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const first = (await response.json())?.[0];
  if (!first || !Number.isFinite(Number(first.lat)) || !Number.isFinite(Number(first.lon))) return null;
  const parts = first.address ?? {};
  return {
    longitude: Number(first.lon),
    latitude: Number(first.lat),
    matchedAddress: first.display_name ?? null,
    source: "OpenStreetMap Nominatim",
    countryCode: String(parts.country_code ?? "ZZ").toUpperCase(),
    countryName: parts.country ?? "海外",
    region: parts.state ?? parts.region ?? parts.city ?? "海外",
    locality: parts.city ?? parts.town ?? parts.village ?? parts.county ?? parts.state ?? "海外",
  };
}

async function findNearestStation(longitude, latitude) {
  const url = new URL(HEART_RAILS_ENDPOINT);
  url.searchParams.set("method", "getStations");
  url.searchParams.set("x", String(longitude));
  url.searchParams.set("y", String(latitude));
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "zuruzuru-ramen-map-delta/0.1 (unofficial fan-site data build)" },
  });
  if (!response.ok) throw new Error(`HeartRails Express ${response.status}`);
  return normalizeNearestStation(await response.json());
}

const input = await readJson(INPUT, null);
if (!input || !Array.isArray(input.videos)) throw new Error(`${INPUT} に有効な動画データがありません。先に bun run fetch:youtube を実行してください。`);

const generatedAt = new Date().toISOString();
const extracted = input.videos.flatMap(extractShopCandidates);
const merged = mergeShopCandidates(extracted);
const cache = await readJson(CACHE, {});
const stationCache = await readJson(STATION_CACHE, {});
const shops = [];
const unresolved = [];
const stationUnresolved = [];

for (const shop of merged) {
  let geocode = cache[shop.address];
  if (!geocode) {
    try {
      geocode = shop.countryCode === "JP"
        ? await geocodeJapan(shop.address)
        : await geocodeOverseas(shop.name, shop.address);
    } catch (error) {
      unresolved.push({ name: shop.name, address: shop.address, reason: error.message, shopUrl: shop.shopUrl });
      continue;
    }
    if (geocode) cache[shop.address] = geocode;
    await sleep(shop.countryCode === "JP" ? 250 : 1100);
  }
  if (!geocode) {
    unresolved.push({ name: shop.name, address: shop.address, reason: "座標候補なし", shopUrl: shop.shopUrl });
    continue;
  }
  const record = toShopRecord(shop, geocode, generatedAt);
  if (record.countryCode === "JP") {
    let nearestStation = stationCache[record.address];
    if (!(record.address in stationCache)) {
      try {
        nearestStation = await findNearestStation(record.longitude, record.latitude);
        stationCache[record.address] = nearestStation;
        await sleep(200);
      } catch (error) {
        stationUnresolved.push({ name: record.name, address: record.address, reason: error.message });
      }
    }
    if (nearestStation) record.nearestStation = nearestStation;
    else if (!stationUnresolved.some((item) => item.address === record.address)) {
      stationUnresolved.push({ name: record.name, address: record.address, reason: "最寄り駅候補なし" });
    }
  }
  shops.push(record);
}

shops.sort((a, b) => b.latestVideoPublishedAt.localeCompare(a.latestVideoPublishedAt));
const report = {
  generatedAt,
  sourceVideoCount: input.videos.length,
  publicSourceVideoCount: input.videos.filter((video) => video.availability === "public" || (video.availability == null && video.privacyStatus === "public")).length,
  extractedCandidateCount: extracted.length,
  uniqueCandidateCount: merged.length,
  generatedShopCount: shops.length,
  unresolvedCount: unresolved.length,
  unresolved,
  stationResolvedCount: shops.filter((shop) => shop.nearestStation).length,
  stationUnresolvedCount: stationUnresolved.length,
  stationUnresolved,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(CACHE, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
await writeFile(STATION_CACHE, `${JSON.stringify(stationCache, null, 2)}\n`, "utf8");
await writeFile(OUTPUT, `${JSON.stringify({ generatedAt, sourceVideoCount: input.videos.length, count: shops.length, shops }, null, 2)}\n`, "utf8");
await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`${input.videos.length}動画から${shops.length}店舗を生成しました。住所未解決: ${unresolved.length}件、最寄り駅未解決: ${stationUnresolved.length}件`);
