import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const API_ROOT = "https://www.googleapis.com/youtube/v3/videos";
const API_KEY = process.env.YOUTUBE_API_KEY;
const INPUT = resolve(process.env.YOUTUBE_INPUT ?? "src/data/youtube-videos.generated.json");

if (!API_KEY) {
  console.error("YOUTUBE_API_KEY が必要です。");
  process.exit(1);
}

const data = JSON.parse(await readFile(INPUT, "utf8"));
const videos = Array.isArray(data.videos) ? data.videos : [];
const checkedAt = new Date().toISOString();

for (let offset = 0; offset < videos.length; offset += 50) {
  const chunk = videos.slice(offset, offset + 50);
  const url = new URL(API_ROOT);
  url.searchParams.set("part", "status");
  url.searchParams.set("id", chunk.map((video) => video.videoId).join(","));
  url.searchParams.set("key", API_KEY);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`YouTube API ${response.status}: チェックに失敗したため、既存の状態は変更しません。`);
  }

  const result = await response.json();
  const availableIds = new Set(result.items.map((video) => video.id));
  for (const video of chunk) {
    video.availability = availableIds.has(video.videoId) ? "public" : "unavailable";
    video.availabilityCheckedAt = checkedAt;
  }
}

await writeFile(INPUT, `${JSON.stringify({ ...data, availabilityCheckedAt: checkedAt, videos }, null, 2)}\n`, "utf8");
console.log(`${videos.length}件の公開状態を確認しました。取得不能動画は unavailable として評価対象から除外できます。`);
