/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7A8B5E",
        accent: "#D4AF37",
        bgDark: "#0A0A0F",
        cardBg: "#111115",
        borderColor: "#1E1E24",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
