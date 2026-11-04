/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b0f19",
        card: "rgba(22, 30, 49, 0.75)",
        cardborder: "rgba(255, 255, 255, 0.08)",
      }
    },
  },
  plugins: [],
}
