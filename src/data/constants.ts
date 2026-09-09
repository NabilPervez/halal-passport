// DFW metroplex bounding box and map center — kept in sync with
// tools/geocode/*.mjs, which use the same bbox to constrain geocoding
// results. If you change one, change the other.
export const DFW_CENTER = { lat: 32.8998, lng: -96.9 };

export const DFW_BBOX = {
  minLng: -97.7,
  minLat: 32.4,
  maxLng: -96.4,
  maxLat: 33.4,
};
