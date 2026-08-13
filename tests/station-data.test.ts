import { describe, expect, test } from "bun:test";
import { estimateWalkMinutes, normalizeNearestStation, parseDistanceMeters } from "../scripts/lib/station-data.mjs";

describe("最寄り駅データ", () => {
  test("APIの距離表記をメートルへ変換する", () => {
    expect(parseDistanceMeters("990m")).toBe(990);
    expect(parseDistanceMeters("1.25km")).toBe(1250);
    expect(parseDistanceMeters("unknown")).toBeNull();
  });

  test("迂回係数を含む概算徒歩分数を算出する", () => {
    expect(estimateWalkMinutes(80)).toBe(2);
    expect(estimateWalkMinutes(990)).toBe(15);
  });

  test("返却順に依存せず最も近い駅を選択する", () => {
    const nearest = normalizeNearestStation({
      response: {
        station: [
          { name: "遠い駅", line: "A線", x: 139, y: 35, distance: "2.1km" },
          { name: "狭山市", line: "西武新宿線", x: 139.413015, y: 35.856936, distance: "990m" },
        ],
      },
    });
    expect(nearest).toMatchObject({
      name: "狭山市",
      line: "西武新宿線",
      distanceMeters: 990,
      walkMinutes: 15,
      source: "HeartRails Express",
    });
  });
});
