export type Tab = "discover" | "wishlist" | "eaten" | "meetups";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "discover",
    label: "Discover",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
      </svg>
    ),
  },
  {
    id: "wishlist",
    label: "Wishlist",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" strokeWidth="1.8">
        <path d="M12 21s-7.5-4.6-10-9.2C.5 8.2 2.3 4.5 6 4.5c2 0 3.5 1 4.5 2.5 1-1.5 2.5-2.5 4.5-2.5 3.7 0 5.5 3.7 4 7.3C19.5 16.4 12 21 12 21z" />
      </svg>
    ),
  },
  {
    id: "eaten",
    label: "Passport", // Rebranded for gamification
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" strokeWidth="1.8">
        <path d="M12 2 19,8 22,10 17,22 7,22 2,10 5,8Z" />
      </svg>
    ),
  },
  {
    id: "meetups",
    label: "Meetups",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" strokeWidth="1.8" stroke="currentColor">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
  }
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-base-elevated/95 backdrop-blur-md border-t border-base-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="max-w-md mx-auto grid grid-cols-4">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald ${
                isActive ? "text-emerald" : "text-muted"
              }`}
            >
              <span className={isActive ? "[&>*]:stroke-emerald" : "[&>*]:stroke-muted"}>{tab.icon}</span>
              <span className="text-[11px] font-body font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
