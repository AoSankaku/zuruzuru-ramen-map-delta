import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type LngLat,
  type LngLatBounds,
  type Map as MapLibreMap,
  type Marker as MapLibreMarker,
  type Popup as MapLibrePopup,
  type StyleSpecification,
} from "maplibre-gl";
import type { UserLocation } from "../location";
import { getClusterClickAction } from "../map-cluster-action";
import type { Shop } from "../types";

const MAP_STYLE_URL = "https://tile.openstreetmap.jp/styles/maptiler-basic-ja/style.json";
const JAPANESE_LABEL_LAYERS = [
  "poi_label",
  "airport-label",
  "road_major_label",
  "place_label_other",
  "place_label_city",
  "country_label-other",
  "country_label",
];
const JAPANESE_NAME = [
  "case",
  [
    "any",
    ["==", ["slice", ["coalesce", ["get", "name:ja"], ""], 0, 2], "独島"],
    ["==", ["slice", ["coalesce", ["get", "name"], ""], 0, 2], "독도"],
  ],
  "",
  ["coalesce", ["get", "name:ja"], ["get", "name"]],
] as const;

type ProjectedPoint = ReturnType<MapLibreMap["project"]>;

type ShopCluster = {
  id: string;
  shops: Shop[];
  center: LngLat;
  bounds: LngLatBounds;
};

type WorkingCluster = ShopCluster & {
  point: ProjectedPoint;
  cellKey: string;
};

type MarkerHandle = {
  remove: () => void;
};

type TooltipHandle = {
  hide: () => void;
  remove: () => void;
};

type MapViewProps = {
  shops: Shop[];
  selected: Shop | null;
  location: UserLocation | null;
  pickingLocation: boolean;
  showLegend: boolean;
  onSelect: (shop: Shop) => void;
  onLocationPick: (location: UserLocation) => void;
};

function applyJapaneseTerritoryStyle(map: MapLibreMap) {
  for (const layerId of JAPANESE_LABEL_LAYERS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "text-field", JAPANESE_NAME);
    }
  }

  // The custom source already supplies Japanese names. Its opaque fill is what
  // produced the conspicuous white mesh over the Northern Territories.
  if (map.getLayer("island-hoppo")) {
    map.setLayoutProperty("island-hoppo", "visibility", "none");
  }

  // Keep the Takeshima island/name overlay, but suppress disputed POI labels
  // such as names prefixed with "独島" that remain inside the custom source.
  if (map.getLayer("island-takeshima-poi")) {
    map.setLayoutProperty("island-takeshima-poi", "visibility", "none");
  }

}

function cellKey(point: ProjectedPoint, radius: number) {
  return `${Math.floor(point.x / radius)}:${Math.floor(point.y / radius)}`;
}

function buildClusters(shops: Shop[], map: MapLibreMap): ShopCluster[] {
  const zoom = map.getZoom();
  const radius = zoom <= 5 ? 72 : zoom <= 8 ? 58 : 46;
  const grid = new Map<string, WorkingCluster[]>();
  const clusters: WorkingCluster[] = [];

  for (const shop of shops) {
    const lngLat = new maplibregl.LngLat(shop.longitude, shop.latitude);
    const point = map.project(lngLat);
    const column = Math.floor(point.x / radius);
    const row = Math.floor(point.y / radius);
    let nearest: WorkingCluster | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let x = column - 1; x <= column + 1; x += 1) {
      for (let y = row - 1; y <= row + 1; y += 1) {
        for (const candidate of grid.get(`${x}:${y}`) ?? []) {
          const distance = point.dist(candidate.point);
          if (distance <= radius && distance < nearestDistance) {
            nearest = candidate;
            nearestDistance = distance;
          }
        }
      }
    }

    if (!nearest) {
      const key = cellKey(point, radius);
      const cluster: WorkingCluster = {
        id: `cluster-${shop.id}`,
        shops: [shop],
        center: lngLat,
        bounds: new maplibregl.LngLatBounds(lngLat, lngLat),
        point,
        cellKey: key,
      };
      clusters.push(cluster);
      grid.set(key, [...(grid.get(key) ?? []), cluster]);
      continue;
    }

    const previousKey = nearest.cellKey;
    const count = nearest.shops.length;
    nearest.shops.push(shop);
    nearest.bounds.extend(lngLat);
    nearest.point.x = (nearest.point.x * count + point.x) / (count + 1);
    nearest.point.y = (nearest.point.y * count + point.y) / (count + 1);
    nearest.center = map.unproject(nearest.point);
    nearest.cellKey = cellKey(nearest.point, radius);

    if (nearest.cellKey !== previousKey) {
      grid.set(previousKey, (grid.get(previousKey) ?? []).filter((cluster) => cluster !== nearest));
      grid.set(nearest.cellKey, [...(grid.get(nearest.cellKey) ?? []), nearest]);
    }
  }

  return clusters;
}

function createTooltipContent(title: string, detail: string, centered = false) {
  const content = document.createElement("div");
  content.className = `map-tooltip${centered ? " map-tooltip--cluster" : ""}`;

  const heading = document.createElement("b");
  heading.textContent = title;
  const description = document.createElement("span");
  description.textContent = detail;
  content.append(heading, description);
  return content;
}

function attachTooltip(
  map: MapLibreMap,
  element: HTMLElement,
  position: [number, number],
  title: string,
  detail: string,
  offset: number,
  centered = false,
): TooltipHandle {
  let popup: MapLibrePopup | null = null;
  const show = () => {
    popup?.remove();
    popup = new maplibregl.Popup({
      anchor: "bottom",
      className: "map-tooltip-popup",
      closeButton: false,
      closeOnClick: false,
      offset: [0, -offset],
    })
      .setLngLat(position)
      .setDOMContent(createTooltipContent(title, detail, centered))
      .addTo(map);
  };
  const hide = () => {
    popup?.remove();
    popup = null;
  };

  element.addEventListener("mouseenter", show);
  element.addEventListener("mouseleave", hide);
  element.addEventListener("focus", show);
  element.addEventListener("blur", hide);

  return {
    hide,
    remove: () => {
      hide();
      element.removeEventListener("mouseenter", show);
      element.removeEventListener("mouseleave", hide);
      element.removeEventListener("focus", show);
      element.removeEventListener("blur", hide);
    },
  };
}

function createShopMarker(
  map: MapLibreMap,
  shop: Shop,
  active: boolean,
  pickingLocation: boolean,
  onSelect: (shop: Shop) => void,
): MarkerHandle {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "map-pin-wrap";
  element.setAttribute("aria-label", shop.name);
  element.title = shop.name;
  element.style.pointerEvents = pickingLocation ? "none" : "auto";
  if (active) element.style.zIndex = "2";

  const pin = document.createElement("span");
  const special = shop.rating.kind === "award";
  const closed = shop.status === "closed";
  pin.className = `map-pin${active ? " is-active" : ""}${special ? " is-special" : ""}${closed ? " is-closed" : ""}`;
  pin.append(document.createElement("i"));
  element.append(pin);

  const position: [number, number] = [shop.longitude, shop.latitude];
  const marker = new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat(position).addTo(map);
  const tooltip = attachTooltip(map, element, position, shop.name, `${shop.genre} · ${shop.region}`, 40);
  const select = (event: MouseEvent) => {
    event.stopPropagation();
    onSelect(shop);
  };
  element.addEventListener("click", select);

  return {
    remove: () => {
      tooltip.remove();
      element.removeEventListener("click", select);
      marker.remove();
    },
  };
}

function zoomToCluster(map: MapLibreMap, cluster: ShopCluster) {
  map.fitBounds(cluster.bounds, {
    duration: 650,
    maxZoom: Math.min(map.getMaxZoom(), map.getZoom() + 5),
    padding: 64,
  });
}

function createClusterPickerContent(cluster: ShopCluster, onSelect: (shop: Shop) => void, close: () => void) {
  const content = document.createElement("div");
  content.className = "map-cluster-picker";
  content.setAttribute("role", "dialog");
  content.setAttribute("aria-label", `${cluster.shops.length}軒の店舗から選択`);

  const heading = document.createElement("b");
  heading.className = "map-cluster-picker__heading";
  heading.textContent = `${cluster.shops.length}軒の店舗があります`;

  const list = document.createElement("div");
  list.className = "map-cluster-picker__list";
  for (const shop of cluster.shops) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-cluster-picker__shop";

    const name = document.createElement("strong");
    name.textContent = shop.name;
    const detail = document.createElement("small");
    detail.textContent = `${shop.genre} · ${shop.address} · 最新動画 ${shop.latestVideoPublishedAt}`;
    button.append(name, detail);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      close();
      onSelect(shop);
    });
    list.append(button);
  }

  content.append(heading, list);
  return content;
}

function createClusterMarker(
  map: MapLibreMap,
  cluster: ShopCluster,
  pickingLocation: boolean,
  onSelect: (shop: Shop) => void,
): MarkerHandle {
  const count = cluster.shops.length;
  const size = count >= 20 ? 56 : count >= 10 ? 50 : 44;
  const hasAward = cluster.shops.some((shop) => shop.rating.kind === "award");
  const clickAction = getClusterClickAction(cluster.shops, map.getZoom(), map.getMaxZoom());
  const actionLabel = clickAction === "zoom" ? "クリックして拡大" : "クリックして店舗を選択";
  const element = document.createElement("button");
  element.type = "button";
  element.className = "map-cluster-wrap";
  element.setAttribute("aria-label", `${count}軒の店舗。${actionLabel}`);
  element.title = `${count}軒の店舗。${actionLabel}`;
  element.style.pointerEvents = pickingLocation ? "none" : "auto";

  const clusterBody = document.createElement("span");
  clusterBody.className = `map-cluster${hasAward ? " is-special" : ""}`;
  clusterBody.style.setProperty("--cluster-size", `${size}px`);
  const number = document.createElement("strong");
  number.textContent = String(count);
  const unit = document.createElement("small");
  unit.textContent = "軒";
  clusterBody.append(number, unit);
  element.append(clusterBody);

  const position: [number, number] = [cluster.center.lng, cluster.center.lat];
  const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(position).addTo(map);
  const tooltip = attachTooltip(map, element, position, `${count}軒の店舗`, actionLabel, size / 2 + 7, true);
  let picker: MapLibrePopup | null = null;
  const closePicker = () => {
    picker?.remove();
    picker = null;
  };
  const zoom = (event: MouseEvent) => {
    event.stopPropagation();
    if (clickAction === "zoom") {
      closePicker();
      zoomToCluster(map, cluster);
      return;
    }

    tooltip.hide();
    closePicker();
    picker = new maplibregl.Popup({
      anchor: "bottom",
      className: "map-cluster-picker-popup",
      closeButton: true,
      closeOnClick: true,
      focusAfterOpen: true,
      maxWidth: "320px",
      offset: [0, -(size / 2 + 8)],
    })
      .setLngLat(position)
      .setDOMContent(createClusterPickerContent(cluster, onSelect, closePicker))
      .addTo(map);
  };
  element.addEventListener("click", zoom);

  return {
    remove: () => {
      closePicker();
      tooltip.remove();
      element.removeEventListener("click", zoom);
      marker.remove();
    },
  };
}

function createLocationMarker(map: MapLibreMap, location: UserLocation): MarkerHandle {
  const element = document.createElement("div");
  element.className = "user-location-marker-wrap";
  element.setAttribute("aria-label", "設定した現在地");
  element.title = "設定した現在地";
  element.tabIndex = 0;

  const body = document.createElement("span");
  body.className = "user-location-marker";
  body.append(document.createElement("i"));
  element.append(body);

  const position: [number, number] = [location.longitude, location.latitude];
  const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(position).addTo(map);
  const tooltip = attachTooltip(map, element, position, "設定した現在地", location.label, 20);

  return {
    remove: () => {
      tooltip.remove();
      marker.remove();
    },
  };
}

export function MapView({ shops, selected, location, pickingLocation, showLegend, onSelect, onLocationPick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const shopMarkersRef = useRef<MarkerHandle[]>([]);
  const locationMarkerRef = useRef<MarkerHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const controller = new AbortController();
    let map: MapLibreMap | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    const initializeMap = async () => {
      const response = await fetch(MAP_STYLE_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`地図スタイルを取得できませんでした (${response.status})`);
      const style = await response.json() as StyleSpecification;
      style.projection = { type: "mercator" };
      if (disposed) return;

      map = new maplibregl.Map({
        attributionControl: { compact: true },
        center: [138, 36.2],
        container,
        maxZoom: 18,
        minZoom: 2,
        renderWorldCopies: true,
        style,
        zoom: 5,
      });
      map.getCanvas().setAttribute("aria-label", "店舗地図");
      mapRef.current = map;

      const handleStyleLoad = () => applyJapaneseTerritoryStyle(map!);
      map.on("style.load", handleStyleLoad);
      map.once("idle", () => setMapReady(true));

      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(container);
    };

    void initializeMap().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error(error);
      setMapError(true);
    });

    return () => {
      disposed = true;
      controller.abort();
      resizeObserver?.disconnect();
      shopMarkersRef.current.forEach((marker) => marker.remove());
      shopMarkersRef.current = [];
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const renderMarkers = () => {
      shopMarkersRef.current.forEach((marker) => marker.remove());
      shopMarkersRef.current = buildClusters(shops, map).map((cluster) => {
        if (cluster.shops.length === 1) {
          const shop = cluster.shops[0];
          return createShopMarker(map, shop, selected?.id === shop.id, pickingLocation, onSelect);
        }
        return createClusterMarker(map, cluster, pickingLocation, onSelect);
      });
    };

    renderMarkers();
    map.on("moveend", renderMarkers);
    map.on("resize", renderMarkers);
    return () => {
      map.off("moveend", renderMarkers);
      map.off("resize", renderMarkers);
      shopMarkersRef.current.forEach((marker) => marker.remove());
      shopMarkersRef.current = [];
    };
  }, [mapReady, onSelect, pickingLocation, selected?.id, shops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    locationMarkerRef.current?.remove();
    locationMarkerRef.current = location ? createLocationMarker(map, location) : null;
    return () => {
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = null;
    };
  }, [location, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !selected) return;
    map.flyTo({
      center: [selected.longitude, selected.latitude],
      duration: 700,
      zoom: selected.countryCode === "JP" ? 12 : 10,
    });
  }, [mapReady, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !location) return;
    map.flyTo({
      center: [location.longitude, location.latitude],
      duration: 700,
      zoom: Math.max(map.getZoom(), 14),
    });
  }, [location, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const pickLocation = (event: maplibregl.MapMouseEvent) => {
      if (!pickingLocation) return;
      onLocationPick({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
        label: "地図上で指定した場所",
      });
    };
    map.on("click", pickLocation);
    return () => {
      map.off("click", pickLocation);
    };
  }, [mapReady, onLocationPick, pickingLocation]);

  return (
    <div className={`map-shell${mapReady ? " is-tiles-ready" : ""}`}>
      <div ref={containerRef} className={`map${pickingLocation ? " is-location-picking" : ""}`} />
      {mapError && <div className="map-load-error" role="alert">地図を読み込めませんでした</div>}
      {showLegend && (
        <div className="map-legend" aria-label="地図の凡例">
          <span><i className="legend-dot legend-dot--award" />大賞</span>
          <span><i className="legend-dot" />通常</span>
          <span><i className="legend-dot legend-dot--closed" />閉店</span>
          {location && <span><i className="legend-dot legend-dot--location" />現在地</span>}
        </div>
      )}
      {pickingLocation && <div className="map-pick-guide" role="status">地図上の現在地にしたい場所をクリック</div>}
    </div>
  );
}
