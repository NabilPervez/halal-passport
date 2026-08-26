import type { JewelTone } from "../types";

const TONE_CLASSES: Record<JewelTone, string> = {
  emerald: "bg-emerald-soft text-emerald border border-emerald-deep/60",
  ruby: "bg-ruby-soft text-ruby border border-ruby-deep/60",
  sapphire: "bg-sapphire-soft text-sapphire border border-sapphire-deep/60",
  amethyst: "bg-amethyst-soft text-amethyst border border-amethyst-deep/60",
  topaz: "bg-topaz-soft text-topaz border border-topaz-deep/60",
};

export function Badge({ tone, children }: { tone: JewelTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide font-body ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
