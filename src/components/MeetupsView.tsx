import { useState, useEffect } from "react";
import type { Meetup, RestaurantWithSaveState } from "../types";
import { getAllMeetups, getAllRestaurantsWithState, getAllRsvps, setRsvp } from "../lib/db";
import { Badge } from "./Badge";

export function MeetupsView() {
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, RestaurantWithSaveState>>({});
  const [rsvped, setRsvped] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, r, rsvps] = await Promise.all([
        getAllMeetups(),
        getAllRestaurantsWithState(),
        getAllRsvps(),
      ]);
      setMeetups(m);
      setRestaurants(Object.fromEntries(r.map((x) => [x.id, x])));
      setRsvped(new Set(rsvps.map((x) => x.meetupId)));
      setLoading(false);
    })();
  }, []);

  async function handleToggleRsvp(meetupId: string) {
    const wasAttending = rsvped.has(meetupId);
    setRsvped((prev) => {
      const next = new Set(prev);
      if (wasAttending) next.delete(meetupId);
      else next.add(meetupId);
      return next;
    });
    await setRsvp(meetupId, !wasAttending);
  }

  if (loading) return <p className="text-muted font-body text-sm py-8 text-center">Loading meetups…</p>;

  if (meetups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="font-display font-semibold text-cream mb-2">No meetups yet</h3>
        <p className="text-muted font-body text-sm max-w-[250px]">
          Check back later for community dinners and events.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {meetups.map((meetup) => {
        const restaurant = restaurants[meetup.restaurantId];
        const isAttending = rsvped.has(meetup.id);
        // This device's own RSVP, added on top of the seeded/organizer
        // count — see the note on setRsvp() in src/lib/db.ts. Not a synced
        // headcount other attendees would see; there's no backend for that.
        const displayedAttendees = meetup.attendees + (isAttending ? 1 : 0);
        return (
          <div key={meetup.id} className="bg-base-elevated border border-base-border rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <Badge tone="amethyst">{new Date(meetup.date).toLocaleDateString()}</Badge>
            </div>

            <h3 className="font-display font-semibold text-lg text-cream pr-24 leading-tight">{meetup.title}</h3>

            <div className="flex flex-col gap-1 text-sm font-body text-muted">
              {restaurant && (
                <p className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {restaurant.name}
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                </svg>
                {meetup.organizer} + {displayedAttendees} attending
              </p>
            </div>

            <button
              onClick={() => handleToggleRsvp(meetup.id)}
              aria-pressed={isAttending}
              className={`mt-2 w-full py-2.5 rounded-lg font-display font-semibold text-sm border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald ${
                isAttending
                  ? "bg-emerald text-base border-emerald hover:bg-emerald/90"
                  : "bg-emerald/10 text-emerald border-emerald/20 hover:bg-emerald/20"
              }`}
            >
              {isAttending ? "✓ You're going" : "RSVP to Join"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
