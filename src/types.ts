export type BusinessStatus =
  | "open"
  | "temporarily_closed"
  | "closed"
  | "moved"
  | "unknown";

export type VideoAvailability = "public" | "unavailable" | "unknown";

export type Rating =
  | { kind: "calculated"; score: number; scoreVersion: string }
  | {
      kind: "award";
      awardType: "monthly" | "annual";
      awardYear: number;
      awardMonth?: number;
    }
  | { kind: "unrated" };

export type Shop = {
  id: string;
  name: string;
  genre: string;
  tags: string[];
  countryCode: string;
  countryName: string;
  region: string;
  locality: string;
  address: string;
  latitude: number;
  longitude: number;
  status: BusinessStatus;
  statusVerifiedAt: string;
  visits: number;
  rating: Rating;
  completeSoup: boolean | null;
  companion: boolean | null;
  isShort: boolean;
  latestVideoId: string;
  latestVideoTitle: string;
  latestVideoPublishedAt: string;
  videoAvailability: VideoAvailability;
  viewCount: number;
  summary: string;
  shopUrl?: string;
  sourceVideoIds?: string[];
  geocodingSource?: string;
  nearestStation?: {
    name: string;
    line: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
    walkMinutes: number;
    source: string;
  };
};
