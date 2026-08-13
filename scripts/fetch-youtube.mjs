import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API_ROOT = "https://www.googleapis.com/youtube/v3";
const DEFAULT_CHANNEL_ID = "UCXcjvt8cOfwtcqaMeE7-hqA";
const requestedCount = Number.parseInt(process.env.YOUTUBE_MAX_RESULTS ?? "300", 10);
const MAX_RESULTS = Number.isFinite(requestedCount) ? Math.max(1, Math.min(requestedCount, 500)) : 300;
const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? DEFAULT_CHANNEL_ID;
const OUTPUT = resolve(process.env.YOUTUBE_OUTPUT ?? "src/data/youtube-videos.generated.json");

if (!API_KEY) {
  console.error("YOUTUBE_API_KEY が必要です。Google CloudでYouTube Data API v3を有効化し、環境変数に設定してください。");
  process.exit(1);
}

async function youtube(endpoint, params) {
  const url = new URL(`${API_ROOT}/${endpoint}`);
  for (const [key, value] of Object.entries({ ...params, key: API_KEY })) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`YouTube API ${response.status}: ${await response.text()}`);
  return response.json();
}

const channel = await youtube("channels", { part: "contentDetails", id: CHANNEL_ID });
const uploadsId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
if (!uploadsId) throw new Error(`Uploadsプレイリストが見つかりません: ${CHANNEL_ID}`);

const playlistItems = [];
let pageToken;
while (playlistItems.length < MAX_RESULTS) {
  const page = await youtube("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsId,
    maxResults: Math.min(50, MAX_RESULTS - playlistItems.length),
    pageToken,
  });
  playlistItems.push(...(page.items ?? []));
  pageToken = page.nextPageToken;
  if (!pageToken || page.items?.length === 0) break;
}

const ids = playlistItems
  .map((item) => item.contentDetails?.videoId)
  .filter(Boolean)
  .slice(0, MAX_RESULTS);

const detailItems = [];
for (let offset = 0; offset < ids.length; offset += 50) {
  const chunk = ids.slice(offset, offset + 50);
  const details = await youtube("videos", {
    part: "snippet,contentDetails,statistics,status",
    id: chunk.join(","),
  });
  detailItems.push(...(details.items ?? []));
}

const byId = new Map(detailItems.map((video) => [video.id, video]));
const fetchedAt = new Date().toISOString();
const videos = ids.map((id) => {
  const video = byId.get(id);
  return {
    videoId: id,
    title: video?.snippet?.title ?? null,
    description: video?.snippet?.description ?? null,
    publishedAt: video?.snippet?.publishedAt ?? null,
    thumbnailUrl: video?.snippet?.thumbnails?.high?.url ?? null,
    duration: video?.contentDetails?.duration ?? null,
    viewCount: video?.statistics?.viewCount ?? null,
    commentCount: video?.statistics?.commentCount ?? null,
    privacyStatus: video?.status?.privacyStatus ?? "unavailable",
    availability: video ? "public" : "unavailable",
    availabilityCheckedAt: fetchedAt,
    fetchedAt,
  };
});

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ channelId: CHANNEL_ID, fetchedAt, requestedCount: MAX_RESULTS, count: videos.length, videos }, null, 2)}\n`, "utf8");
console.log(`${videos.length}件を ${OUTPUT} に保存しました。`);
