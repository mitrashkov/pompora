/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--p-bg) / <alpha-value>)",
        panel: "rgb(var(--p-panel) / <alpha-value>)",
        text: "rgb(var(--p-text) / <alpha-value>)",
        muted: "rgb(var(--p-muted) / <alpha-value>)",
        border: "rgb(var(--p-border) / <alpha-value>)",
        accent: "rgb(var(--p-accent) / <alpha-value>)",
        accent2: "rgb(var(--p-accent2) / <alpha-value>)",
        danger: "rgb(var(--p-danger) / <alpha-value>)"
      }
    }
  },
  plugins: []
};
