import type { Config } from "tailwindcss";

/**
 * Palette is taken from the legacy "Monthly Branch Wise Report" screen the
 * client asked the whole system to match: a forest-green title bar with pale
 * yellow lettering, a sage-green form panel, and a maroon action bar.
 *
 * Everything is themed through these three scales rather than per page:
 *   primary — the green (title bars, active nav, primary buttons)
 *   accent  — the maroon (destructive / Close-style actions)
 *   sage    — the panel + app background greens
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Forest green. 800 is the brand tone (the screenshot's title bar);
        // 700 sits just above it so `hover:bg-primary-700` still lifts.
        primary: {
          DEFAULT: "#1e7a1e",
          50: "#eff8ee",
          100: "#d7eed5",
          200: "#b0dcac",
          300: "#82c67c",
          400: "#54ad4e",
          500: "#37992f",
          600: "#2c8b27",
          700: "#248722",
          800: "#1e7a1e",
          900: "#145214",
        },
        // Maroon — the screenshot's bottom action bar and its Close button.
        accent: {
          DEFAULT: "#7a1416",
          50: "#fbeded",
          100: "#f4d3d3",
          200: "#e5a5a5",
          300: "#d17070",
          400: "#b94040",
          500: "#9d2225",
          600: "#8a191c",
          700: "#7a1416",
          800: "#630f11",
          900: "#4a0b0d",
        },
        // Sage — the pale panel the legacy form sits on, plus the softer green
        // the app background washes with.
        sage: {
          50: "#f4f9f2",
          100: "#e7f1e2",
          200: "#d3e5cb",
          300: "#bcd6b1",
          400: "#a3c497",
          500: "#8bb17e",
          600: "#6f9563",
          700: "#57764d",
          800: "#3f5738",
          900: "#2b3c26",
        },
        // Pale yellow lettering used on the green title bars.
        titlebar: "#ffe680",
      },
    },
  },
  plugins: [],
};
export default config;
