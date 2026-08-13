import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Shop } from "../types";

type ShopCluster = {
  id: string;
  shops: Shop[];
  center: L.LatLng;
  bounds: L.LatLngBounds;
};

type WorkingCluster = ShopCluster & {
  point: L.Point;
  cellKey: string;
};

function MapController({ selected }: { selected: Shop | null }) {
  const map = useMap();

  useEffect(() => {
    if (selected) {
      map.flyTo([selected.latitude, selected.longitude], selected.countryCode === "JP" ? 12 : 10, {
        animate: true,
        duration: 0.7,
      });
    }
  }, [map, selected]);

  return null;
}

function createMarker(shop: Shop, active: boolean) {
  const special = shop.rating.kind === "award";
  const closed = shop.status === "closed";
  return L.divIcon({
    className: "map-pin-wrap",
    html: `<span class="map-pin${active ? " is-active" : ""}${special ? " is-special" : ""}${closed ? " is-closed" : ""}"><i></i></span>`,
    iconSize: [38, 46],
    iconAnchor: [19, 42],
    tooltipAnchor: [0, -38],
  });
}

function createClusterMarker(cluster: ShopCluster) {
  const count = cluster.shops.length;
  const size = count >= 20 ? 56 : count >= 10 ? 50 : 44;
  const hasAward = cluster.shops.some((shop) => shop.rating.kind === "award");

  return L.divIcon({
    className: "map-cluster-wrap",
    html: `<span class="map-cluster${hasAward ? " is-special" : ""}" style="--cluster-size:${size}px"><strong>${count}</strong><small>軒</small></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -(size / 2 + 3)],
  });
}

function cellKey(point: L.Point, radius: number) {
  return `${Math.floor(point.x / radius)}:${Math.floor(point.y / radius)}`;
}

function buildClusters(shops: Shop[], map: L.Map): ShopCluster[] {
  const zoom = map.getZoom();
  const radius = zoom <= 5 ? 72 : zoom <= 8 ? 58 : 46;
  const grid = new Map<string, WorkingCluster[]>();
  const clusters: WorkingCluster[] = [];

  for (const shop of shops) {
    const latLng = L.latLng(shop.latitude, shop.longitude);
    const point = map.project(latLng, zoom);
    const column = Math.floor(point.x / radius);
    const row = Math.floor(point.y / radius);
    let nearest: WorkingCluster | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let x = column - 1; x <= column + 1; x += 1) {
      for (let y = row - 1; y <= row + 1; y += 1) {
        for (const candidate of grid.get(`${x}:${y}`) ?? []) {
          const distance = point.distanceTo(candidate.point);
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
        center: latLng,
        bounds: L.latLngBounds(latLng, latLng),
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
    nearest.bounds.extend(latLng);
    nearest.point = L.point(
      (nearest.point.x * count + point.x) / (count + 1),
      (nearest.point.y * count + point.y) / (count + 1),
    );
    nearest.center = map.unproject(nearest.point, zoom);
    nearest.cellKey = cellKey(nearest.point, radius);

    if (nearest.cellKey !== previousKey) {
      grid.set(previousKey, (grid.get(previousKey) ?? []).filter((cluster) => cluster !== nearest));
      grid.set(nearest.cellKey, [...(grid.get(nearest.cellKey) ?? []), nearest]);
    }
  }

  return clusters;
}

function ClusteredMarkers({ shops, selected, onSelect }: MapViewProps) {
  const map = useMap();
  const [viewRevision, setViewRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setViewRevision((revision) => revision + 1);
    map.on("zoomend moveend resize", refresh);
    return () => {
      map.off("zoomend moveend resize", refresh);
    };
  }, [map]);

  const clusters = useMemo(
    () => buildClusters(shops, map),
    [map, shops, viewRevision],
  );

  const zoomToCluster = (cluster: ShopCluster) => {
    const northEast = cluster.bounds.getNorthEast();
    const southWest = cluster.bounds.getSouthWest();

    if (northEast.equals(southWest)) {
      map.flyTo(cluster.center, Math.min(map.getZoom() + 2, map.getMaxZoom()), {
        animate: true,
        duration: 0.65,
      });
      return;
    }

    map.fitBounds(cluster.bounds, {
      animate: true,
      duration: 0.65,
      maxZoom: Math.min(15, map.getZoom() + 5),
      padding: [64, 64],
    });
  };

  return clusters.map((cluster) => {
    if (cluster.shops.length === 1) {
      const shop = cluster.shops[0];
      return (
        <Marker
          key={shop.id}
          position={[shop.latitude, shop.longitude]}
          icon={createMarker(shop, selected?.id === shop.id)}
          alt={shop.name}
          title={shop.name}
          eventHandlers={{ click: () => onSelect(shop) }}
        >
          <Tooltip direction="top" opacity={1} className="map-tooltip">
            <b>{shop.name}</b><span>{shop.genre} · {shop.region}</span>
          </Tooltip>
        </Marker>
      );
    }

    return (
      <Marker
        key={`${cluster.id}-${cluster.shops.length}`}
        position={cluster.center}
        icon={createClusterMarker(cluster)}
        alt={`${cluster.shops.length}軒の店舗。クリックして拡大`}
        title={`${cluster.shops.length}軒の店舗。クリックして拡大`}
        eventHandlers={{ click: () => zoomToCluster(cluster) }}
        riseOnHover
      >
        <Tooltip direction="top" opacity={1} className="map-tooltip map-tooltip--cluster">
          <b>{cluster.shops.length}軒の店舗</b><span>クリックして拡大</span>
        </Tooltip>
      </Marker>
    );
  });
}

type MapViewProps = {
  shops: Shop[];
  selected: Shop | null;
  onSelect: (shop: Shop) => void;
};

export function MapView({ shops, selected, onSelect }: MapViewProps) {
  const [tilesReady, setTilesReady] = useState(false);

  return (
    <div className={`map-shell${tilesReady ? " is-tiles-ready" : ""}`}>
      <MapContainer center={[36.2, 138]} zoom={5} minZoom={2} maxZoom={18} scrollWheelZoom className="map" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          className="map-tile"
          eventHandlers={{ load: () => setTilesReady(true) }}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController selected={selected} />
        <ClusteredMarkers shops={shops} selected={selected} onSelect={onSelect} />
      </MapContainer>
      <div className="map-legend" aria-label="地図の凡例">
        <span><i className="legend-dot legend-dot--award" />大賞</span>
        <span><i className="legend-dot" />通常</span>
        <span><i className="legend-dot legend-dot--closed" />閉店</span>
      </div>
      <div className="map-stamp" aria-hidden="true">SOURCE<br />DATA</div>
    </div>
  );
}
