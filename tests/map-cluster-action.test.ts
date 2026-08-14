import { describe, expect, test } from "bun:test";
import { getClusterClickAction } from "../src/map-cluster-action";

describe("地図クラスタのクリック動作", () => {
  test("異なる座標で最大ズーム未満なら拡大する", () => {
    expect(getClusterClickAction([
      { longitude: 139.7, latitude: 35.6 },
      { longitude: 139.7001, latitude: 35.6001 },
    ], 15, 18)).toBe("zoom");
  });

  test("同一座標ならズームせず店舗選択を表示する", () => {
    expect(getClusterClickAction([
      { longitude: 139.7, latitude: 35.6 },
      { longitude: 139.7, latitude: 35.6 },
    ], 10, 18)).toBe("select");
  });

  test("最大ズームでも分離しない場合は店舗選択を表示する", () => {
    expect(getClusterClickAction([
      { longitude: 139.7, latitude: 35.6 },
      { longitude: 139.7001, latitude: 35.6001 },
    ], 18, 18)).toBe("select");
  });
});
