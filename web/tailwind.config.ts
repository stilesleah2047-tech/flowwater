import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        depth: { 950: "#04211F", 900: "#0A302D", 800: "#0F4441", 700: "#155753", 600: "#1C6D68" },
        flow: { 400: "#5EE7D0", 500: "#2FD3B8", 600: "#1AAF97" },
        cash: { 400: "#F2B558", 500: "#E39A2C", 600: "#B87A1C" },
        confirm: { 500: "#22B36B", 600: "#178A52" },
        alert: { 500: "#D9603B", 600: "#B34A29" },
        sand: { 50: "#F6FAF9", 100: "#EDF4F2", 200: "#DCE8E5" },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: { soft: "0 4px 20px -4px rgba(10,48,45,0.15)" },
      keyframes: {
        ripple: { "0%": { transform: "scale(0.8)", opacity: "0.6" }, "100%": { transform: "scale(2.4)", opacity: "0" } },
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: { ripple: "ripple 1.6s ease-out infinite", "fade-up": "fade-up 0.35s ease-out" },
    },
  },
  plugins: [],
};
export default config;
