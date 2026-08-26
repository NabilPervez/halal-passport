import { useState } from "react";
import type { Restaurant, Review } from "../types";
import { formatShareText, shareReview, smsHref, whatsappHref } from "../lib/share";

export function ShareSheet({ restaurant, review }: { restaurant: Restaurant; review: Review }) {
  const [copied, setCopied] = useState(false);
  const text = formatShareText(restaurant, review);

  async function handleNativeShare() {
    const result = await shareReview(restaurant, review);
    if (result.method === "clipboard") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select a textarea
    }
  }

  return (
    <div className="rounded-xl2 border border-base-border bg-base-elevated2 p-4">
      <p className="text-xs uppercase tracking-wider text-muted font-body mb-3">Share this review</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-2 rounded-full bg-emerald text-base px-4 py-2 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream"
        >
          Share
        </button>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream transition-colors ${
            copied
              ? "bg-emerald-soft border-emerald-deep text-emerald"
              : "bg-base-elevated2 border-base-border text-muted hover:border-cream hover:text-cream"
          }`}
        >
          {copied ? (
            <>
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,8 6,12 14,4" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="5" width="9" height="9" rx="1.5" />
                <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
              </svg>
              Copy
            </>
          )}
        </button>
        <a
          href={smsHref(text)}
          className="flex items-center gap-2 rounded-full bg-sapphire-soft border border-sapphire-deep text-sapphire px-4 py-2 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream"
        >
          SMS
        </a>
        <a
          href={whatsappHref(text)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-full bg-emerald-soft border border-emerald-deep text-emerald px-4 py-2 text-sm font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cream"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}

