export interface PlaceCandidate {
  provider_place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  time_zone: string;
}

export interface Place extends PlaceCandidate {
  id: number;
  provider: "osm";
  refreshed_at: string;
  created_at: string;
  updated_at: string;
}
