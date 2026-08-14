export type ClusterCoordinate = {
  longitude: number;
  latitude: number;
};

export function getClusterClickAction(
  coordinates: ClusterCoordinate[],
  currentZoom: number,
  maxZoom: number,
): "zoom" | "select" {
  const first = coordinates[0];
  const hasDistinctCoordinates = first != null && coordinates.some((coordinate) => (
    coordinate.longitude !== first.longitude || coordinate.latitude !== first.latitude
  ));

  return hasDistinctCoordinates && currentZoom < maxZoom - 0.01 ? "zoom" : "select";
}
