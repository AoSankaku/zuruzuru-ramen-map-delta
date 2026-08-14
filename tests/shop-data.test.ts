import { describe, expect, test } from "bun:test";
import {
  extractShopCandidates,
  mergeShopCandidates,
  parseIsoDurationSeconds,
  toShopRecord,
} from "../scripts/lib/shop-data.mjs";

const video = (overrides: Record<string, unknown> = {}) => ({
  videoId: "video-1",
  title: "訪問動画",
  description: "",
  publishedAt: "2026-08-01T00:00:00Z",
  duration: "PT12M30S",
  viewCount: "120000",
  privacyStatus: "public",
  availability: "public",
  ...overrides,
});

describe("店舗データ抽出", () => {
  test("本日のお店ブロックから実店舗を抽出する", () => {
    const candidates = extractShopCandidates(video({
      description: "【本日のお店】\n油そば屋 大友食堂\n埼玉県狭山市中央4-24-8\nhttps://tabelog.com/saitama/A1106/A110602/example/",
    }));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: "油そば屋 大友食堂",
      address: "埼玉県狭山市中央4-24-8",
      countryCode: "JP",
    });
  });

  test("1つの動画に複数店舗があってもすべて抽出する", () => {
    const candidates = extractShopCandidates(video({
      description: [
        "【本日のお店】",
        "豚骨ラーメン 開王", "東京都八王子市東町1-18", "https://tabelog.com/tokyo/example1/",
        "らーめん まつや", "神奈川県茅ヶ崎市堤73-5", "https://tabelog.com/kanagawa/example2/",
      ].join("\n"),
    }));
    expect(candidates.map((candidate) => candidate.name)).toEqual(["豚骨ラーメン 開王", "らーめん まつや"]);
  });

  test("同一掲載URLの複数訪問を1店舗に統合し、非公開動画は除外する", () => {
    const description = "【本日のお店】\nますや本店 台新店\n福島県郡山市台新1-176-4\nhttps://tabelog.com/fukushima/example/";
    const candidates = [
      ...extractShopCandidates(video({ description })),
      ...extractShopCandidates(video({ videoId: "video-2", description, publishedAt: "2026-07-01T00:00:00Z" })),
      ...extractShopCandidates(video({ videoId: "deleted", description, availability: "unavailable" })),
    ];
    const shops = mergeShopCandidates(candidates);
    expect(shops).toHaveLength(1);
    expect(shops[0].videos.map((item) => item.videoId)).toEqual(["video-1", "video-2"]);
  });

  test("登場回数を保持し、視聴回数から独自評価を生成しない", () => {
    const description = "【本日のお店】\nますや本店 台新店\n福島県郡山市台新1-176-4\nhttps://tabelog.com/fukushima/example/";
    const [shop] = mergeShopCandidates([
      ...extractShopCandidates(video({ description })),
      ...extractShopCandidates(video({ videoId: "video-2", description })),
    ]);
    const record = toShopRecord(shop, {
      latitude: 37.4,
      longitude: 140.3,
      source: "test",
    }, "2026-08-14T00:00:00.000Z");

    expect(record.visits).toBe(2);
    expect(record.rating).toEqual({ kind: "unrated" });
  });

  test("店舗URLがない動画は店舗として扱わない", () => {
    expect(extractShopCandidates(video({ description: "コンビニのカップ麺を食べました" }))).toEqual([]);
  });

  test("海外住所とGoogle Mapsの店舗URLも候補に含める", () => {
    const candidates = extractShopCandidates(video({
      description: "【本日のお店】\nExample Ramen\n135 Pilkington Avenue, Birmingham\nhttps://maps.app.goo.gl/example",
    }));
    expect(candidates[0]).toMatchObject({
      name: "Example Ramen",
      countryCode: "ZZ",
      countryName: "海外",
    });
  });
});

test("ISO 8601の動画時間を秒へ変換する", () => {
  expect(parseIsoDurationSeconds("PT1H2M3S")).toBe(3723);
  expect(parseIsoDurationSeconds("PT48S")).toBe(48);
});
