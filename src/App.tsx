import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { RestaurantWithSaveState, Review } from "./types";
import {
  syncCatalog,
  getAllRestaurantsWithState,
  setUserPlaceState,
  getAllReviews,
  putReview,
} from "./lib/db";
import { MapView } from "./components/MapView";
import { BentoGrid } from "./components/BentoGrid";
import { DiscoverFeed } from "./components/DiscoverFeed";
import { RestaurantDetail } from "./components/RestaurantDetail";
import { BottomNav, type Tab } from "./components/BottomNav";
import { MeetupsView } from "./components/MeetupsView";

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
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

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

  async function handleSaveReview(review: Review) {
    setReviews((prev) => ({ ...prev, [review.restaurantId]: review }));
    await putReview(review);
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
  
  const categories = useMemo(() => {
    const cats = new Set(restaurants.map(r => r.cuisine || "Uncategorized"));
    return ["All", ...Array.from(cats).sort()];
  }, [restaurants]);

  const discoverRestaurants = useMemo(() => {
    let filtered = restaurants;
    
    if (selectedCategory !== "All") {
      filtered = filtered.filter(r => (r.cuisine || "Uncategorized") === selectedCategory);
    }

    if (userLocation) {
      // Annotate with distance for sorting/filtering
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

      // Sort nearest to farthest
      filtered = [...filtered].sort((a, b) => (a as any)._distance - (b as any)._distance);
    }

    return filtered;
  }, [restaurants, selectedCategory, selectedDistance, userLocation]);

  // "Available" spots means places to eat — mosques are on the map but
  // aren't a dining option, so they're excluded from this count.
  const totalSpotCount = useMemo(
    () => restaurants.filter((r) => !r.isMosque).length,
    [restaurants]
  );
  const filteredSpotCount = useMemo(
    () => discoverRestaurants.filter((r) => !r.isMosque).length,
    [discoverRestaurants]
  );
  const isFiltered = selectedCategory !== "All" || selectedDistance !== "All";

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
          <p className="text-[10px] text-muted/70 font-body shrink-0 pt-0.5" title={`Commit ${__APP_COMMIT__}`}>
            v{__APP_VERSION__} · {__APP_COMMIT__}
          </p>
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
            <MapView restaurants={discoverRestaurants} onOpen={setActiveId} userLocation={userLocation} />
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-cream">Filters</h2>
                <button onClick={handleUseLocation} className="text-xs font-body font-medium bg-emerald/10 text-emerald px-3 py-1.5 rounded-full border border-emerald/20 hover:bg-emerald/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald">
                  {userLocation ? "📍 Location Active" : "📍 Use My Location"}
                </button>
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

              <div className="mt-2">
                {selectedCategory === "All" ? (
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
                    emptyTitle="No spots found"
                    emptyBody="Try changing your filters to see more spots."
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

      <AnimatePresence>
        {active && (
          <RestaurantDetail
            restaurant={active}
            review={reviews[active.id]}
            onClose={() => setActiveId(null)}
            onSaveReview={handleSaveReview}
            onSetSaveState={handleToggleSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
