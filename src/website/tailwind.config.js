/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        jarvis: {
          cyan: "#00d4ff",
          "cyan-dim": "#0099cc",
          "cyan-bright": "#22d3ee",
          blue: "#0066ff",
          "blue-dark": "#001a4d",
          glow: "#00e5ff",
          panel: "rgba(0, 20, 40, 0.85)",
          "panel-border": "rgba(0, 212, 255, 0.12)",
          surface: "rgba(0, 10, 25, 0.95)",
          text: "#e0f0ff",
          "text-dim": "#78a9c6",
          gold: "#ffe18c",
          "gold-dim": "#ccaa44",
          error: "#ff4444",
          success: "#00ff88",
          warning: "#ffaa00",
          navy: "#000d1e",
          "navy-light": "#001428",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        "3xs": ["9px", { lineHeight: "12px" }],
      },
      gridTemplateColumns: {
        "dashboard-row1": "280px 1fr 280px",
        "dashboard-row23": "1fr 1fr 1fr",
      },
      animation: {
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "fade-in": "fadeInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "breathe": "breatheGlow 2.5s ease-in-out infinite",
        "float": "subtleFloat 4s ease-in-out infinite",
        "orbit-slow": "orbitRotate 12s linear infinite",
        "orbit-medium": "orbitRotate 8s linear infinite",
        "orbit-fast": "orbitRotate 5s linear infinite",
        "orbit-reverse": "orbitRotateReverse 10s linear infinite",
        "waveform": "waveformPulse 1.2s ease-in-out infinite",
        "live-dot": "liveDot 1s ease-in-out infinite",
        "scan-line": "scanLine 3s linear infinite",
        "constellation-pulse": "constellationPulse 4s ease-in-out infinite",
        "gauge-fill": "gaugeFill 1.5s ease-out forwards",
        "slide-in": "slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        breatheGlow: {
          "0%, 100%": { boxShadow: "0 0 12px rgba(0,212,255,0.15)" },
          "50%": { boxShadow: "0 0 24px rgba(0,212,255,0.3)" },
        },
        subtleFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        orbitRotate: {
          "0%": { transform: "rotateX(70deg) rotateZ(0deg)" },
          "100%": { transform: "rotateX(70deg) rotateZ(360deg)" },
        },
        orbitRotateReverse: {
          "0%": { transform: "rotateX(70deg) rotateZ(0deg)" },
          "100%": { transform: "rotateX(70deg) rotateZ(-360deg)" },
        },
        waveformPulse: {
          "0%, 100%": { scaleY: "0.4" },
          "50%": { scaleY: "1" },
        },
        liveDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)", opacity: "0.6" },
          "100%": { transform: "translateY(200%)", opacity: "0" },
        },
        constellationPulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.9" },
        },
        gaugeFill: {
          "0%": { strokeDashoffset: "226" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backdropBlur: {
        xs: "2px",
        "2xl": "24px",
      },
    },
  },
  plugins: [],
};
