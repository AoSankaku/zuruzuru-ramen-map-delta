export function parseDistanceMeters(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(km|m)$/);
  if (!match) return null;
  return Math.round(Number(match[1]) * (match[2] === "km" ? 1000 : 1));
}

export function estimateWalkMinutes(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  return Math.max(1, Math.ceil((distanceMeters * 1.2) / 80));
}

export function normalizeNearestStation(apiResponse) {
  const stations = apiResponse?.response?.station;
  if (!Array.isArray(stations) || stations.length === 0) return null;
  const candidates = stations
    .map((station) => ({ station, distanceMeters: parseDistanceMeters(station.distance) }))
    .filter((candidate) => candidate.station?.name && candidate.distanceMeters !== null)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  const nearest = candidates[0];
  if (!nearest) return null;
  return {
    name: nearest.station.name,
    line: nearest.station.line ?? "路線不明",
    latitude: Number(nearest.station.y),
    longitude: Number(nearest.station.x),
    distanceMeters: nearest.distanceMeters,
    walkMinutes: estimateWalkMinutes(nearest.distanceMeters),
    source: "HeartRails Express",
  };
}
