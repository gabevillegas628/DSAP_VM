/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      // Add your custom colors, fonts, etc. here
      colors: {
        // Example: Add your brand colors
        'brand-blue': '#3B82F6',
        'brand-indigo': '#6366F1',
      }
    },
  },
  plugins: [],
}