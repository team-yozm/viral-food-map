/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#FF6B35",
        secondary: "#F7C59F",
        accent: "#FF4444",
        dark: "#1A1A2E",
      },
    },
  },
  plugins: [],
};
