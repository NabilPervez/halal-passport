import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Restaurant, RestaurantWithSaveState, Review, HalalStatus } from "./types";
import {
  syncCatalog,
  getAllRestaurantsWithState,
  setUserPlaceState,
  setHalalStatus,
  getAllReviews,
  putReview,
} from "./lib/db";
import { BentoGrid } from "./components/BentoGrid";
import { DiscoverFeed } from "./components/DiscoverFeed";
import { RestaurantCard } from "./components/RestaurantCard";
import { RestaurantDetail } from "./components/RestaurantDetail";
import { AddRestaurantForm } from "./components/AddRestaurantForm";
import { BottomNav, type Tab } from "./components/BottomNav";
import { MeetupsView } from "./components/MeetupsView";
import { SettingsView } from "./components/SettingsView";
import { Onboarding, hasOnboarded } from "./components/Onboarding";
import { useTheme } from "./lib/theme";

// maplibre-gl is the single heaviest dependency in the bundle (~700KB) and
// is only ever needed on the Discover tab — lazy-load it so Wishlist/
// Passport/Meetups, and Discover's own first paint, don't pay for it upfront.
const MapView = lazy(() =>
  import("./components/MapView").then((m) => ({ default: m.MapView }))
);

// "verified-zabihah" and "self-reported" both mean the whole place is
// halal; "halal-options" means only some menu items are — a real
// distinction users asked to filter on separately rather than lumping
// both under one "verified" bucket.
type HalalFilterLevel = "All" | "fully-halal" | "halal-options" | "unverified";

function matchesHalalFilter(status: HalalStatus, filter: HalalFilterLevel): boolean {
  switch (filter) {
    case "All":
      return true;
    case "fully-halal":
      return status === "verified-zabihah" || status === "self-reported";
    case "halal-options":
      return status === "halal-options";
    case "unverified":
      return status === "unverified";
  }
}

function getDistanceInMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function App() {
  const [restaurants, setRestaurants] = useState<RestaurantWithSaveState[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [tab, setTab] = useState<Tab>("discover");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedDistance, setSelectedDistance] = useState<string>("All");
  const [selectedHalalFilter, setSelectedHalalFilter] = useState<HalalFilterLevel>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasOnboarded());
  const [, , resolvedTheme] = useTheme();

  useEffect(() => {
    (async () => {
      await syncCatalog();
      const [r, rv] = await Promise.all([getAllRestaurantsWithState(), getAllReviews()]);
      setRestaurants(r);
      setReviews(Object.fromEntries(rv.map((x) => [x.restaurantId, x])));
      setReady(true);
    })();
  }, []);

  async function handleToggleSave(id: string, next: RestaurantWithSaveState["saveState"]) {
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, saveState: next, savedAt: Date.now() } : r)));
    await setUserPlaceState(id, next);
  }

  async function handleSetHalalStatus(id: string, next: HalalStatus) {
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, halalStatus: next } : r)));
    await setHalalStatus(id, next);
  }

  async function handleSaveReview(review: Review) {
    setReviews((prev) => ({ ...prev, [review.restaurantId]: review }));
    await putReview(review);
  }

  function handleRestaurantAdded(restaurant: Restaurant) {
    setRestaurants((prev) => [...prev, { ...restaurant, saveState: "none" }]);
  }

  function handleUseLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Location error", err)
      );
    }
  }

  const wishlist = useMemo(
    () => restaurants.filter((r) => r.saveState === "wishlist").sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)),
    [restaurants]
  );
  const eaten = useMemo(
    () => restaurants.filter((r) => r.saveState === "eaten").sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)),
    [restaurants]
  );

  // Closed businesses are excluded from every Discover browsing surface
  // (map, category rows, filtered grid, cuisine dropdown, spot count) but
  // deliberately NOT from Wishlist/Passport — a place someone already ate
  // at and reviewed shouldn't vanish from their own history just because
  // it closed down later.
  const visitableRestaurants = useMemo(
    () => restaurants.filter((r) => r.isMosque || r.businessStatus === "operational"),
    [restaurants]
  );

  // Mosques aren't a dining option — halal verification, cuisine, and price
  // don't apply to them, so they're browsed in their own section (see
  // "Mosques & Islamic Centers" below) rather than mixed into the
  // restaurant catalog under a fake "Uncategorized" cuisine.
  const mosques = useMemo(() => visitableRestaurants.filter((r) => r.isMosque), [visitableRestaurants]);
  const nonMosqueRestaurants = useMemo(
    () => visitableRestaurants.filter((r) => !r.isMosque),
    [visitableRestaurants]
  );

  const categories = useMemo(() => {
    const cats = new Set(nonMosqueRestaurants.map(r => r.cuisine || "Uncategorized"));
    return ["All", ...Array.from(cats).sort()];
  }, [nonMosqueRestaurants]);

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const isSearching = trimmedSearch.length > 0;

  // Shared by both the restaurant list and the mosque row: text search and
  // distance apply to everything on Discover, but cuisine/halal filters
  // only make sense for restaurants and are applied separately below.
  function applySearchAndDistance<T extends RestaurantWithSaveState>(list: T[]): T[] {
    let filtered = list;

    if (trimmedSearch) {
      filtered = filtered.filter((r) =>
        [r.name, r.cuisine, r.city].some((field) => field?.toLowerCase().includes(trimmedSearch))
      );
    }

    if (userLocation) {
      const withDistance = filtered.map(r => ({
        ...r,
        _distance: getDistanceInMiles(userLocation.lat, userLocation.lng, r.lat, r.lng)
      }));

      if (selectedDistance !== "All") {
        const maxDist = parseInt(selectedDistance, 10);
        filtered = withDistance.filter(r => r._distance <= maxDist);
      } else {
        filtered = withDistance;
      }

      filtered = [...filtered].sort((a, b) => (a as any)._distance - (b as any)._distance);
    }

    return filtered;
  }

  const discoverRestaurants = useMemo(() => {
    let filtered = nonMosqueRestaurants;

    if (selectedCategory !== "All") {
      filtered = filtered.filter(r => (r.cuisine || "Uncategorized") === selectedCategory);
    }

    if (selectedHalalFilter !== "All") {
      filtered = filtered.filter((r) => matchesHalalFilter(r.halalStatus, selectedHalalFilter));
    }

    return applySearchAndDistance(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applySearchAndDistance closes over trimmedSearch/userLocation/selectedDistance, listed explicitly below
  }, [nonMosqueRestaurants, selectedCategory, selectedHalalFilter, trimmedSearch, selectedDistance, userLocation]);

  const mosqueResults = useMemo(
    () => applySearchAndDistance(mosques),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mosques, trimmedSearch, selectedDistance, userLocation]
  );

  // What the map shows: filtered restaurants plus filtered mosques —
  // mosques are always on the map regardless of the cuisine/halal filters,
  // which don't apply to them.
  const mapMarkers = useMemo(
    () => [...discoverRestaurants, ...mosqueResults],
    [discoverRestaurants, mosqueResults]
  );

  // "Available" spots means places to eat that are actually open — mosques
  // aren't a dining option and closed businesses aren't available, so both
  // are excluded from this count.
  const totalSpotCount = nonMosqueRestaurants.length;
  const filteredSpotCount = discoverRestaurants.length;
  const isFiltered =
    selectedCategory !== "All" || selectedDistance !== "All" || selectedHalalFilter !== "All" || isSearching;

  const active = restaurants.find((r) => r.id === activeId) ?? null;

  if (!ready) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <p className="text-muted font-body text-sm">Loading Halal Passport…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base pb-24">
      <header className="px-5 pt-6 pb-4 max-w-md mx-auto sm:max-w-3xl">
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-xs uppercase tracking-widest text-emerald font-body font-semibold">Halal Passport · DFW</p>
          <div className="flex items-center gap-2 shrink-0">
            <p className="text-[10px] text-muted/70 font-body pt-0.5" title={`Commit ${__APP_COMMIT__}`}>
              v{__APP_VERSION__} · {__APP_COMMIT__}
            </p>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              className="text-muted hover:text-cream transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald rounded"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
        <h1 className="font-display font-extrabold text-2xl text-cream">
          {tab === "discover" && "Find your next halal spot"}
          {tab === "wishlist" && "Your wishlist"}
          {tab === "eaten" && "Your Halal Passport"}
          {tab === "meetups" && "Community Meetups"}
        </h1>
        {tab === "discover" && (
          <p className="text-sm text-muted font-body mt-1">
            {isFiltered
              ? `${filteredSpotCount} of ${totalSpotCount} spots match your filters`
              : `${totalSpotCount} halal spots in DFW`}
          </p>
        )}
      </header>

      <main className="px-5 max-w-md mx-auto sm:max-w-3xl flex flex-col gap-5">
        {tab === "discover" && (
          <>
            <Suspense
              fallback={
                <div className="rounded-xl2 border border-base-border h-[52vh] min-h-[320px] bg-base-elevated animate-pulse" />
              }
            >
              <MapView restaurants={mapMarkers} onOpen={setActiveId} userLocation={userLocation} theme={resolvedTheme} />
            </Suspense>
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="font-display font-semibold text-cream">Filters</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-xs font-body font-medium bg-base-elevated text-cream px-3 py-1.5 rounded-full border border-base-border hover:border-emerald/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald"
                  >
                    + Add a spot
                  </button>
                  <button onClick={handleUseLocation} className="text-xs font-body font-medium bg-emerald/10 text-emerald px-3 py-1.5 rounded-full border border-emerald/20 hover:bg-emerald/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
                    {userLocation ? "📍 Location Active" : "📍 Use My Location"}
                  </button>
                </div>
              </div>

              <div className="relative">
                <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, cuisine, or city"
                  aria-label="Search restaurants"
                  className="w-full bg-base-elevated border border-base-border text-cream text-sm rounded-lg pl-9 pr-3 py-2.5 placeholder:text-muted/60 focus-visible:outline-emerald"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted font-body font-semibold">Cuisine</label>
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-base-elevated border border-base-border text-cream text-sm rounded-lg px-3 py-2.5 focus-visible:outline-emerald appearance-none"
                  >
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted font-body font-semibold">Distance</label>
                  <select
                    value={selectedDistance}
                    onChange={(e) => {
                      setSelectedDistance(e.target.value);
                      if (e.target.value !== "All" && !userLocation) {
                        handleUseLocation();
                      }
                    }}
                    className="w-full bg-base-elevated border border-base-border text-cream text-sm rounded-lg px-3 py-2.5 focus-visible:outline-emerald appearance-none"
                  >
                    <option value="All">Anywhere</option>
                    <option value="5">Within 5 miles</option>
                    <option value="10">Within 10 miles</option>
                    <option value="25">Within 25 miles</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted font-body font-semibold">Halal level</label>
                <select
                  value={selectedHalalFilter}
                  onChange={(e) => setSelectedHalalFilter(e.target.value as HalalFilterLevel)}
                  className="w-full bg-base-elevated border border-base-border text-cream text-sm rounded-lg px-3 py-2.5 focus-visible:outline-emerald appearance-none"
                >
                  <option value="All">Any halal level</option>
                  <option value="fully-halal">Fully halal (Zabihah)</option>
                  <option value="halal-options">Has halal options</option>
                  <option value="unverified">Unverified</option>
                </select>
              </div>

              {mosqueResults.length > 0 && (
                <div className="flex flex-col gap-2.5 mt-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-display font-semibold text-cream text-sm leading-none">
                      🕌 Mosques &amp; Islamic Centers
                    </h3>
                    <span className="text-[10px] font-body font-semibold text-muted bg-base-elevated border border-base-border px-2 py-0.5 rounded-full leading-none">
                      {mosqueResults.length}
                    </span>
                  </div>
                  <div
                    className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 snap-x snap-mandatory scrollbar-none"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {mosqueResults.map((m) => (
                      <div key={m.id} className="snap-start shrink-0 w-40">
                        <RestaurantCard restaurant={m} onOpen={setActiveId} onToggleSave={handleToggleSave} />
                      </div>
                    ))}
                    <div className="shrink-0 w-1" aria-hidden="true" />
                  </div>
                </div>
              )}

              <div className="mt-2">
                {selectedCategory === "All" && !isSearching ? (
                  <DiscoverFeed
                    restaurants={discoverRestaurants}
                    onOpen={setActiveId}
                    onToggleSave={handleToggleSave}
                    emptyTitle="No spots found"
                    emptyBody="Try changing your filters to see more spots."
                  />
                ) : (
                  <BentoGrid
                    restaurants={discoverRestaurants}
                    onOpen={setActiveId}
                    onToggleSave={handleToggleSave}
                    emptyTitle={isSearching ? `No matches for "${searchQuery.trim()}"` : "No spots found"}
                    emptyBody={
                      isSearching
                        ? "Try a different name, cuisine, or city."
                        : "Try changing your filters to see more spots."
                    }
                  />
                )}
              </div>
            </section>
          </>
        )}
        {tab === "wishlist" && (
          <BentoGrid
            restaurants={wishlist}
            onOpen={setActiveId}
            onToggleSave={handleToggleSave}
            emptyTitle="Nothing saved yet"
            emptyBody="Tap the heart on a spot from Discover to add it to your wishlist."
          />
        )}
        {tab === "eaten" && (
          <div className="flex flex-col gap-5">
            <div className="bg-base-elevated border border-emerald/30 p-5 rounded-xl2 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-emerald/5 opacity-50"></div>
              <h3 className="font-display font-bold text-emerald text-xl relative z-10 mb-1">
                {eaten.length} Stamp{eaten.length !== 1 && "s"} Collected
              </h3>
              <p className="text-sm font-body text-cream relative z-10">
                You've reviewed {eaten.length} {eaten.length === 1 ? "restaurant" : "restaurants"}. Keep exploring to collect more passport stamps!
              </p>
            </div>
            <BentoGrid
              restaurants={eaten}
              onOpen={setActiveId}
              onToggleSave={handleToggleSave}
              emptyTitle="No passport stamps"
              emptyBody="Open a spot and mark it Eaten once you've tried it to earn a stamp."
            />
          </div>
        )}
        {tab === "meetups" && <MeetupsView />}
      </main>

      <BottomNav active={tab} onChange={setTab} />

      {/* Each overlay gets its own AnimatePresence — a single shared one
          with several un-keyed conditional children leaves whichever
          mounts second stuck at its `initial` (invisible) state. */}
      <AnimatePresence>
        {active && (
          <RestaurantDetail
            restaurant={active}
            review={reviews[active.id]}
            onClose={() => setActiveId(null)}
            onSaveReview={handleSaveReview}
            onSetSaveState={handleToggleSave}
            onSetHalalStatus={handleSetHalalStatus}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddForm && (
          <AddRestaurantForm onClose={() => setShowAddForm(false)} onAdded={handleRestaurantAdded} />
        )}
      </AnimatePresence>
      {showSettings && <SettingsView onClose={() => setShowSettings(false)} />}
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
    </div>
  );
}
