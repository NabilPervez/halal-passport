import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Restaurant } from "../types";
import { DFW_CENTER } from "../data/mockRestaurants";

const JEWEL_HEX: Record<string, string> = {
  emerald: "#12A66B",
  ruby: "#C23B5B",
  sapphire: "#3564D9",
  amethyst: "#8B5FBF",
  topaz: "#D89A2C",
};

const GEOAPIFY_KEY = "c86880aef45241869ec0b977c4126356";
const MAP_STYLE = `https://maps.geoapify.com/v1/styles/dark-matter/style.json?apiKey=${GEOAPIFY_KEY}`;

interface MapViewProps {
  restaurants: Restaurant[];
  onOpen: (id: string) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export function MapView({ restaurants, onOpen, userLocation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [DFW_CENTER.lng, DFW_CENTER.lat],
        zoom: 10,
        attributionControl: false,
      });
      mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    }
    const map = mapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = restaurants.map((r) => {
      const el = document.createElement("div");
      el.style.width = "18px";
      el.style.height = "18px";
      if (r.isMosque) {
        el.style.backgroundColor = "#FBBF24"; // distinct gold/yellow color for mosques
        el.style.borderRadius = "4px"; // make them square to stand out even more
      } else {
        el.style.backgroundColor = JEWEL_HEX[r.heroColor] || JEWEL_HEX.emerald;
        el.style.borderRadius = "50%";
      }
      el.style.border = "2px solid #0E0E12";
      el.style.cursor = "pointer";

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([r.lng, r.lat])
        .addTo(map);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setActiveInfo(r.id);
      });

      return marker;
    });

    const handleMapClick = () => setActiveInfo(null);
    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [restaurants]);

  // Handle user location: add/move marker and fly to it
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) return;

    // Build pulsing dot element
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = "20px";
    wrapper.style.height = "20px";

    // Outer pulse ring
    const ring = document.createElement("div");
    ring.style.cssText = `
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      background: rgba(59,130,246,0.25);
      animation: user-ping 1.6s ease-out infinite;
    `;

    // Inner solid dot
    const dot = document.createElement("div");
    dot.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #3B82F6;
      border: 3px solid #fff;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.4);
    `;

    wrapper.appendChild(ring);
    wrapper.appendChild(dot);

    // Inject keyframes once
    if (!document.getElementById("user-ping-style")) {
      const style = document.createElement("style");
      style.id = "user-ping-style";
      style.textContent = `
        @keyframes user-ping {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    userMarkerRef.current = new maplibregl.Marker({ element: wrapper, anchor: "center" })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);

    // Fly to user location
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 12,
      speed: 1.4,
      curve: 1.4,
    });
  }, [userLocation]);

  const active = restaurants.find((r) => r.id === activeInfo);

  return (
    <div className="relative rounded-xl2 overflow-hidden border border-base-border h-[52vh] min-h-[320px]">
      <div ref={containerRef} className="w-full h-full" role="application" aria-label="Map of halal restaurants in DFW" />
      {active && (
        <div className="absolute bottom-3 left-3 right-3 rounded-xl2 bg-base-elevated2/95 backdrop-blur-md border border-base-border p-4 shadow-card z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-cream">{active.name}</h3>
              <p className="text-xs text-muted font-body">
                {active.cuisine} · {active.neighborhood} · {active.pricePoint}
              </p>
            </div>
            <button
              onClick={() => onOpen(active.id)}
              className="shrink-0 rounded-full bg-emerald text-base px-3.5 py-1.5 text-xs font-semibold font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream"
            >
              View
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
