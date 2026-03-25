/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        gmarket: ["GmarketSans", "sans-serif"],
        pretendard: ["Pretendard Variable", "Pretendard", "sans-serif"],
      },
      colors: {
        primary: "#9B7DD4",
        secondary: "#8BACD8",
        accent: "#C084FC",
        dark: "#1A1A2E",
      },
    },
  },
  plugins: [],
};
