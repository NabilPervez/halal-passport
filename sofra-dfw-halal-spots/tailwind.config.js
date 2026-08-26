/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: "#0E0E12",
          elevated: "#17171D",
          elevated2: "#1F1F27",
          border: "#2A2A33",
        },
        cream: "#F4F1E8",
        muted: "#9A9AA6",
        emerald: {
          DEFAULT: "#12A66B",
          deep: "#0B6E4C",
          soft: "#173A2C",
        },
        ruby: {
          DEFAULT: "#C23B5B",
          deep: "#8E2540",
          soft: "#3A1B23",
        },
        sapphire: {
          DEFAULT: "#3564D9",
          deep: "#22407F",
          soft: "#1A2440",
        },
        amethyst: {
          DEFAULT: "#8B5FBF",
          deep: "#5C3B85",
          soft: "#2A2038",
        },
        topaz: {
          DEFAULT: "#D89A2C",
          deep: "#96691C",
          soft: "#332711",
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
