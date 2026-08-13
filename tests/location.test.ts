import { describe, expect, test } from "bun:test";
import { parseCoordinateInput } from "../src/location";

describe("現在地の手入力", () => {
  test("カンマ区切りの緯度経度を読み取る", () => {
    expect(parseCoordinateInput("35.6812, 139.7671")).toEqual({
      latitude: 35.6812,
      longitude: 139.7671,
      label: "35.68120, 139.76710",
    });
  });

  test("空白区切りと全角の読点を読み取る", () => {
    expect(parseCoordinateInput("35.6812 139.7671")?.longitude).toBe(139.7671);
    expect(parseCoordinateInput("35.6812、139.7671")?.latitude).toBe(35.6812);
  });

  test("範囲外の座標と住所は座標として扱わない", () => {
    expect(parseCoordinateInput("90, 139")).toBeNull();
    expect(parseCoordinateInput("東京駅")).toBeNull();
  });
});
