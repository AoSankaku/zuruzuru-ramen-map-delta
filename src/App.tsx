import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { House, List, Map as MapIcon, Moon, Sun } from "lucide-react";
import { BrandMark } from "./components/BrandMark";
import { FilterBar, type Filters } from "./components/FilterBar";
import { HomeMode } from "./components/HomeMode";
import { LocationControl } from "./components/LocationControl";
import { MapView } from "./components/MapView";
import { ShopDetail } from "./components/ShopDetail";
import { ShopList } from "./components/ShopList";
import generatedData from "./data/shops.generated.json";
import type { UserLocation } from "./location";
import { applyTheme, getStoredTheme, getSystemTheme, isTheme, storeTheme, THEME_STORAGE_KEY, type Theme } from "./theme";
import type { Shop } from "./types";

const sourceShops = generatedData.shops as Shop[];

const defaultFilters: Filters = {
  query: "",
  stationQuery: "",
  maxWalkMinutes: "all",
  genre: "all",
  area: "all",
  business: "open",
  awardsOnly: false,
  sort: "visits",
};

export default function App() {
  const [filters, setFilters] = useState(defaultFilters);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<Theme | "system">(() => getStoredTheme() ?? "system");
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [mode, setMode] = useState<"shops" | "home">("shops");
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [pickingLocation, setPickingLocation] = useState(false);
  const theme = themePreference === "system" ? systemTheme : themePreference;

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");

    colorScheme.addEventListener("change", updateSystemTheme);
    return () => colorScheme.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setThemePreference(isTheme(event.newValue) ? event.newValue : "system");
      }
    };

    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  useLayoutEffect(() => {
    applyTheme(theme);
    if (themePreference !== "system") storeTheme(themePreference);
  }, [theme, themePreference]);

  const genres = useMemo(() => [...new Set(sourceShops.map((shop) => shop.genre))], []);

  const shops = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("ja");
    const stationQuery = filters.stationQuery.trim().replace(/駅$/u, "").toLocaleLowerCase("ja");
    const result = sourceShops.filter((shop) => {
      if (query && !`${shop.name} ${shop.address} ${shop.region} ${shop.locality} ${shop.countryName} ${shop.nearestStation?.name ?? ""} ${shop.nearestStation?.line ?? ""}`.toLocaleLowerCase("ja").includes(query)) return false;
      if (stationQuery && !`${shop.nearestStation?.name ?? ""} ${shop.nearestStation?.line ?? ""}`.toLocaleLowerCase("ja").includes(stationQuery)) return false;
      if (filters.maxWalkMinutes !== "all" && (!shop.nearestStation || shop.nearestStation.walkMinutes > filters.maxWalkMinutes)) return false;
      if (filters.genre !== "all" && shop.genre !== filters.genre) return false;
      if (filters.area === "japan" && shop.countryCode !== "JP") return false;
      if (filters.area === "overseas" && shop.countryCode === "JP") return false;
      if (filters.business === "open" && ["closed", "moved"].includes(shop.status)) return false;
      if (filters.business === "closed" && shop.status !== "closed" && shop.status !== "moved") return false;
      if (filters.awardsOnly && shop.rating.kind !== "award") return false;
      return true;
    });

    return result.sort((a, b) => {
      if (filters.sort === "visits") return b.visits - a.visits || b.latestVideoPublishedAt.localeCompare(a.latestVideoPublishedAt);
      if (filters.sort === "views") return b.viewCount - a.viewCount || b.latestVideoPublishedAt.localeCompare(a.latestVideoPublishedAt);
      if (filters.sort === "station") return (a.nearestStation?.walkMinutes ?? Number.POSITIVE_INFINITY) - (b.nearestStation?.walkMinutes ?? Number.POSITIVE_INFINITY);
      return 0;
    });
  }, [filters]);

  return (
    <div className={`app theme-${theme}`}>
      <header className="topbar">
        <BrandMark />
        <div className="topbar__right">
          <button
            className={`mode-switch ${mode === "home" ? "is-home" : ""}`}
            onClick={() => {
              setMode(mode === "home" ? "shops" : "home");
              setSelected(null);
              setFilterOpen(false);
              setLocationOpen(false);
              setPickingLocation(false);
            }}
            aria-pressed={mode === "home"}
          >
            {mode === "home" ? <MapIcon size={16} /> : <House size={16} />}
            <span>{mode === "home" ? "お店モード" : "おうちモード"}</span>
          </button>
          <button className="icon-button" onClick={() => setThemePreference(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "ダークテーマにする" : "ライトテーマにする"}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {mode === "home" && <HomeMode />}

      <main hidden={mode === "home"} className={`workspace mobile-${mobileView} ${mode === "home" ? "is-hidden" : ""}`}>
        <section className="map-pane" aria-label="店舗地図">
          <MapView
            shops={shops}
            selected={selected}
            location={location}
            pickingLocation={pickingLocation}
            showLegend={filters.business !== "open"}
            onSelect={setSelected}
            onLocationPick={(nextLocation) => {
              setLocation(nextLocation);
              setPickingLocation(false);
            }}
          />
          <LocationControl
            location={location}
            open={locationOpen}
            picking={pickingLocation}
            onOpenChange={setLocationOpen}
            onPickingChange={setPickingLocation}
            onLocationChange={setLocation}
          />
        </section>

        <section className="list-pane" aria-label="店舗一覧">
          <FilterBar
            filters={filters}
            genres={genres}
            resultCount={shops.length}
            open={filterOpen}
            onOpenChange={setFilterOpen}
            onChange={setFilters}
            onReset={() => setFilters(defaultFilters)}
          />
          <div className="results-head">
            <div><span className="results-head__count">{shops.length}</span><span>軒の記録</span></div>
            <label>
              <span>並び順</span>
              <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as Filters["sort"] })}>
                <option value="visits">登場回数順</option>
                <option value="views">視聴回数順</option>
                <option value="station">駅徒歩順</option>
              </select>
            </label>
          </div>
          <ShopList shops={shops} selected={selected} onSelect={setSelected} />
          <footer className="disclaimer">
            <b>UNOFFICIAL FAN PROJECT</b>
            <p>本サイトはSUSURU TV.および関係者とは一切関係ありません。掲載情報は動画概要欄などをもとに自動生成しています。最寄り駅データ: <a href="https://express.heartrails.com/" target="_blank" rel="noreferrer">HeartRails Express</a></p>
          </footer>
        </section>
      </main>

      {mode === "shops" && selected && <ShopDetail shop={selected} onClose={() => setSelected(null)} />}
      {filterOpen && <button className="scrim" onClick={() => setFilterOpen(false)} aria-label="絞り込みを閉じる" />}

      <nav className="mobile-nav" aria-label="表示切り替え">
        <button className={mobileView === "map" ? "is-active" : ""} onClick={() => setMobileView("map")}><MapIcon size={19} />地図</button>
        <button className={mobileView === "list" ? "is-active" : ""} onClick={() => setMobileView("list")}><List size={19} />一覧 <span>{shops.length}</span></button>
      </nav>
    </div>
  );
}
