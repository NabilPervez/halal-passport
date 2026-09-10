/** @type {import('tailwindcss').Config} */

// Colors are CSS custom properties (RGB triplets, so Tailwind's
// `<alpha-value>` still works) defined in src/index.css for the dark
// theme on bare :root and overridden for light under
// [data-theme="light"]. See src/lib/theme.ts for how the attribute is set.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: v("base"),
          elevated: v("base-elevated"),
          elevated2: v("base-elevated2"),
          border: v("base-border"),
        },
        cream: v("cream"),
        muted: v("muted"),
        emerald: {
          DEFAULT: v("emerald"),
          deep: v("emerald-deep"),
          soft: v("emerald-soft"),
        },
        ruby: {
          DEFAULT: v("ruby"),
          deep: v("ruby-deep"),
          soft: v("ruby-soft"),
        },
        sapphire: {
          DEFAULT: v("sapphire"),
          deep: v("sapphire-deep"),
          soft: v("sapphire-soft"),
        },
        amethyst: {
          DEFAULT: v("amethyst"),
          deep: v("amethyst-deep"),
          soft: v("amethyst-soft"),
        },
        topaz: {
          DEFAULT: v("topaz"),
          deep: v("topaz-deep"),
          soft: v("topaz-soft"),
        },
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
}
