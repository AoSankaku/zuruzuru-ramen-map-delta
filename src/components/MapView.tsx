import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { UserLocation } from "../location";
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

function MapController({ selected, location }: { selected: Shop | null; location: UserLocation | null }) {
  const map = useMap();

  useEffect(() => {
    if (selected) {
      map.flyTo([selected.latitude, selected.longitude], selected.countryCode === "JP" ? 12 : 10, {
        animate: true,
        duration: 0.7,
      });
    }
  }, [map, selected]);

  useEffect(() => {
    if (location) {
      map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 14), {
        animate: true,
        duration: 0.7,
      });
    }
  }, [location, map]);

  return null;
}

function MapClickPicker({ enabled, onPick }: { enabled: boolean; onPick: (location: UserLocation) => void }) {
  const map = useMapEvents({
    click: ({ latlng }) => {
      if (!enabled) return;
      onPick({
        latitude: latlng.lat,
        longitude: latlng.lng,
        label: "地図上で指定した場所",
      });
    },
  });

  useEffect(() => {
    map.getContainer().classList.toggle("is-location-picking", enabled);
    return () => map.getContainer().classList.remove("is-location-picking");
  }, [enabled, map]);

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

const userLocationMarker = L.divIcon({
  className: "user-location-marker-wrap",
  html: '<span class="user-location-marker"><i></i></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  tooltipAnchor: [0, -18],
});

const gsiJapanBounds = L.latLngBounds([20, 122], [47, 154]);
const gsiDetailedBounds = [
  L.latLngBounds([41.2, 139], [46.5, 150.5]),
  L.latLngBounds([34, 135], [41.7, 142.2]),
  L.latLngBounds([30.8, 129.2], [35.5, 136.5]),
  L.latLngBounds([33, 128.9], [34.8, 130.2]),
  L.latLngBounds([23, 122.5], [31.5, 132]),
  L.latLngBounds([20, 135], [28, 143]),
];

class LocalizedTileLayer extends L.TileLayer {
  private usesGsiTile(coords: L.Coords) {
    if (coords.z <= 8) return true;

    const tileSize = this.getTileSize();
    const tileCenter = L.point(
      (coords.x + 0.5) * tileSize.x,
      (coords.y + 0.5) * tileSize.y,
    );
    const center = this._map.unproject(tileCenter, coords.z);
    if (coords.z <= 11) return gsiJapanBounds.contains(center);
    return gsiDetailedBounds.some((bounds) => bounds.contains(center));
  }

  override getTileUrl(coords: L.Coords) {
    if (this.usesGsiTile(coords)) {
      return `https://cyberjapandata.gsi.go.jp/xyz/pale/${coords.z}/${coords.x}/${coords.y}.png`;
    }
    return `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
  }

  override createTile(coords: L.Coords, done: L.DoneCallback) {
    const tile = super.createTile(coords, done);
    tile.classList.add("map-tile", this.usesGsiTile(coords) ? "map-tile--gsi" : "map-tile--osm");
    return tile;
  }
}

function LocalizedBaseMap({ onReady }: { onReady: () => void }) {
  const map = useMap();
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const layer = new LocalizedTileLayer("", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a> / Shoreline data: NIMA VMAP0 (1997)',
      maxZoom: 18,
      minZoom: 2,
    });
    const handleLoad = () => onReadyRef.current();
    layer.on("load", handleLoad);
    layer.addTo(map);

    return () => {
      layer.off("load", handleLoad);
      layer.removeFrom(map);
    };
  }, [map]);

  return null;
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

function ClusteredMarkers({ shops, selected, onSelect, pickingLocation }: Pick<MapViewProps, "shops" | "selected" | "onSelect" | "pickingLocation">) {
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
          interactive={!pickingLocation}
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
        interactive={!pickingLocation}
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
  location: UserLocation | null;
  pickingLocation: boolean;
  onSelect: (shop: Shop) => void;
  onLocationPick: (location: UserLocation) => void;
};

export function MapView({ shops, selected, location, pickingLocation, onSelect, onLocationPick }: MapViewProps) {
  const [tilesReady, setTilesReady] = useState(false);

  return (
    <div className={`map-shell${tilesReady ? " is-tiles-ready" : ""}`}>
      <MapContainer
        center={[36.2, 138]}
        zoom={5}
        minZoom={2}
        maxZoom={18}
        maxBounds={[[-85.05112878, -180], [85.05112878, 180]]}
        maxBoundsViscosity={1}
        scrollWheelZoom
        className={`map${pickingLocation ? " is-location-picking" : ""}`}
        zoomControl={false}
      >
        <LocalizedBaseMap onReady={() => setTilesReady(true)} />
        <MapController selected={selected} location={location} />
        <MapClickPicker enabled={pickingLocation} onPick={onLocationPick} />
        {location && (
          <Marker
            position={[location.latitude, location.longitude]}
            icon={userLocationMarker}
            alt="設定した現在地"
            title="設定した現在地"
            zIndexOffset={1000}
          >
            <Tooltip direction="top" opacity={1} className="map-tooltip">
              <b>設定した現在地</b><span>{location.label}</span>
            </Tooltip>
          </Marker>
        )}
        <ClusteredMarkers shops={shops} selected={selected} onSelect={onSelect} pickingLocation={pickingLocation} />
      </MapContainer>
      <div className="map-legend" aria-label="地図の凡例">
        <span><i className="legend-dot legend-dot--award" />大賞</span>
        <span><i className="legend-dot" />通常</span>
        <span><i className="legend-dot legend-dot--closed" />閉店</span>
        {location && <span><i className="legend-dot legend-dot--location" />現在地</span>}
      </div>
      {pickingLocation && <div className="map-pick-guide" role="status">地図上の現在地にしたい場所をクリック</div>}
    </div>
  );
}
