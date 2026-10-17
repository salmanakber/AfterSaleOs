/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/(marketing)/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};
