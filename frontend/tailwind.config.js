/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#6B4FD3",
        secondary: "#8BACD8",
        accent: "#6B4FD3",
        accentSoft: "#EEE8FC",
        accentInk: "#3A2789",
        ink: "#14121A",
        ink2: "#2E2A38",
        ink3: "#57545F",
        ink4: "#8A8590",
        line: "#E8E4EE",
        line2: "#F1EEF5",
        bg: "#FAF8FC",
        surface: "#FFFFFF",
        heroTop: "#1A1425",
        heroAccent: "#8B6FE8",
        pos: "#1B8A5A",
        neg: "#D93C3C",
        dark: "#1A1A2E",
      },
      fontFamily: {
        gmarket: ["GmarketSans", "sans-serif"],
        pretendard: ["Pretendard Variable", "Pretendard", "sans-serif"],
        kicker: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "confetti-burst": {
          "0%": {
            opacity: "1",
            transform: "translate(0, 0) rotate(0deg) scale(1)",
          },
          "70%": {
            opacity: "1",
          },
          "100%": {
            opacity: "0",
            transform:
              "translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.4)",
          },
        },
      },
    },
  },
  plugins: [],
};
