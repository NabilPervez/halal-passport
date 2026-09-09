import { DFW_BBOX } from "../data/constants";

// Same key/pattern as MapView.tsx — see the note there on restricting it
// by origin in the Geoapify dashboard rather than relying on secrecy.
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || "c86880aef45241869ec0b977c4126356";

export interface GeocodeCandidate {
  lat: number;
  lng: number;
  address: string;
  city: string;
  isPoi: boolean;
}

/**
 * Client-side counterpart to tools/geocode/02-resolve.mjs — same API,
 * same DFW bbox constraint, same POI-vs-street distinction, so a
 * user-added restaurant gets held to the same "is this a real, specific
 * location" bar as the bulk-geocoded catalog rather than a looser one.
 */
export async function geocodeAddress(query: string): Promise<GeocodeCandidate[]> {
  const params = new URLSearchParams({
    text: query,
    filter: `rect:${DFW_BBOX.minLng},${DFW_BBOX.minLat},${DFW_BBOX.maxLng},${DFW_BBOX.maxLat}`,
    format: "json",
    apiKey: GEOAPIFY_KEY,
  });

  const res = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`);
  if (!res.ok) {
    throw new Error(`Geocoding failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  const results: any[] = data.results ?? [];

  return results
    .filter((r) => typeof r.lat === "number" && typeof r.lon === "number")
    .map((r) => ({
      lat: r.lat,
      lng: r.lon,
      address: r.formatted ?? query,
      city: r.city ?? "",
      isPoi: r.result_type === "amenity" || r.result_type === "building",
    }))
    .slice(0, 5);
}
