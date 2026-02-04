/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["\"Geist Sans\"", ...defaultTheme.fontFamily.sans],
        mono: ["\"Geist Mono\"", ...defaultTheme.fontFamily.mono],
      },
      colors: {
        bg: "rgb(var(--p-bg) / <alpha-value>)",
        panel: "rgb(var(--p-panel) / <alpha-value>)",
        panel2: "rgb(var(--p-panel2) / <alpha-value>)",
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
