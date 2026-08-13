export type UserLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

const coordinatePattern = /^\s*(-?\d+(?:\.\d+)?)\s*(?:,|，|、|\s)\s*(-?\d+(?:\.\d+)?)\s*$/u;
const geocodingCache = new Map<string, UserLocation>();
let lastGeocodingRequestAt = 0;

export function parseCoordinateInput(input: string): UserLocation | null {
  const match = input.match(coordinatePattern);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -85.05112878 || latitude > 85.05112878 || longitude < -180 || longitude > 180) return null;

  return {
    latitude,
    longitude,
    label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
  };
}

function getGeocodingEndpoint() {
  return document.querySelector<HTMLMetaElement>('meta[name="geocoding-endpoint"]')?.content
    || "https://nominatim.openstreetmap.org/search";
}

export async function searchLocation(input: string, signal?: AbortSignal): Promise<UserLocation> {
  const query = input.trim();
  const coordinates = parseCoordinateInput(query);
  if (coordinates) return coordinates;
  if (!query) throw new Error("住所・駅名または緯度,経度を入力してください。");

  const cacheKey = query.toLocaleLowerCase("ja");
  const cached = geocodingCache.get(cacheKey);
  if (cached) return cached;

  const waitMilliseconds = Math.max(0, 1000 - (Date.now() - lastGeocodingRequestAt));
  if (waitMilliseconds > 0) {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        window.clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timeoutId = window.setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, waitMilliseconds);

      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  const url = new URL(getGeocodingEndpoint());
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "ja");
  lastGeocodingRequestAt = Date.now();

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("場所を検索できませんでした。時間をおいて再度お試しください。");

  const [result] = await response.json() as NominatimResult[];
  if (!result) throw new Error("該当する場所が見つかりませんでした。住所を詳しく入力してください。");

  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("検索結果の位置情報を読み取れませんでした。");
  }

  const location = { latitude, longitude, label: result.display_name };
  geocodingCache.set(cacheKey, location);
  return location;
}
