/* Campus Placement AI — shared Tailwind theme.
   SYS_0 dark palette: void blacks, plum surfaces, hot-pink accents.
   Token names are stable so every page resolves against them. */
window.tailwind = window.tailwind || {};
window.tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        /* SYS_0 brand (shared with landing) */
        "brand": {
          "void": "#030206",
          "deep": "#0a0413",
          "dark": "#110620",
          "plum": "#380a32",
          "magenta": "#9b105d",
          "hotpink": "#f42588",
          "fuchsia": "#d91b7a",
          "glow": "#ff3b99",
          "cyberViolet": "#6d1377",
          "accentYellow": "#f4ef5b"
        },
        /* Accents (SYS_0 brand) */
        "primary": "#f42588",
        "primary-fixed": "#ff3b99",
        "primary-fixed-dim": "#d91b7a",
        "primary-container": "#f42588",
        "on-primary": "#ffffff",
        "on-primary-container": "#fff0f7",
        "inverse-primary": "#ff60b3",
        "secondary": "#211429",
        "secondary-container": "#2d1b37",
        "secondary-fixed": "#380a32",
        "secondary-fixed-dim": "#9b105d",
        "cyber-lime-glow": "#f425881a",
        "signal-amber": "#f59e0b",
        "error": "#ff4d6d",
        "error-container": "#3d0a1a",
        "on-error": "#ffffff",
        "on-error-container": "#fecdd3",

        /* Page + card surfaces (void → plum) */
        "background": "#030206",
        "obsidian-base": "#030206",
        "surface": "#110620",
        "slate-surface": "#0a0413",
        "surface-bright": "#1a0a24",
        "surface-dim": "#0a0413",
        "surface-variant": "#1a0a24",
        "surface-tint": "#f42588",
        "surface-container-lowest": "#0a0413",
        "surface-container-low": "#150821",
        "surface-container": "#1a0a24",
        "surface-container-high": "#211030",
        "surface-container-highest": "#2a1538",
        "slate-elevated": "#1a0a24",
        "tertiary": "#150821",
        "tertiary-container": "#211030",
        "tertiary-fixed": "#1a0a24",
        "tertiary-fixed-dim": "#110620",

        /* Text */
        "chalk-text": "#ffffff",
        "on-surface": "#ffffff",
        "on-background": "#ffffff",
        "on-surface-variant": "#c4b5c9",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#c4b5c9",
        "on-tertiary-fixed": "#ffffff",
        "on-tertiary-fixed-variant": "#c4b5c9",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#f5d0e2",
        "on-secondary-fixed": "#ffffff",
        "on-secondary-fixed-variant": "#e8d5dd",
        "on-primary-fixed": "#ffffff",
        "on-primary-fixed-variant": "#ffe5f1",
        "titanium-muted": "#9b8aa3",
        "bone-dim": "#9b8aa3",

        /* Borders / outlines */
        "slate-border": "#2d1b37",
        "outline": "#6b5a73",
        "outline-variant": "#2d1b37",

        /* Inverse (tooltips/popovers on dark → flip to light card) */
        "inverse-surface": "#211030",
        "inverse-on-surface": "#ffffff",
        "inverse-surface-region": "#211030",
        "on-surface-overlay": "#ffffff",
        "on-surface-region": "#e8d5dd"
      },
      "borderRadius": {
        "DEFAULT": "0.5rem", "lg": "0.75rem", "xl": "1rem", "full": "9999px", "md": "0.6rem"
      },
      "boxShadow": {
        "card": "0 1px 2px 0 rgb(0 0 0 / 0.4), 0 0 0 1px rgb(244 37 136 / 0.06)",
        "lifted": "0 20px 45px -15px rgb(0 0 0 / 0.75), 0 0 24px -6px rgb(244 37 136 / 0.18)"
      },
      "spacing": {
        "space-md": "0.75rem", "space-xs": "0.25rem", "space-lg": "1.25rem",
        "margin-lg": "2.5rem", "space-xl": "2rem", "gutter-lg": "1.5rem",
        "space-sm": "0.5rem", "space-2xl": "3rem", "margin-md": "1.5rem",
        "margin": "1rem", "gutter": "1rem"
      },
      "fontFamily": {
        "label-lg": ["Inter", "system-ui", "sans-serif"],
        "headline-lg": ["Inter", "system-ui", "sans-serif"],
        "headline-lg-mobile": ["Inter", "system-ui", "sans-serif"],
        "code-telemetry": ["JetBrains Mono", "ui-monospace", "monospace"],
        "headline-sm": ["Inter", "system-ui", "sans-serif"],
        "body-sm": ["Inter", "system-ui", "sans-serif"],
        "label-md": ["Inter", "system-ui", "sans-serif"],
        "body-lg": ["Inter", "system-ui", "sans-serif"],
        "body-md": ["Inter", "system-ui", "sans-serif"],
        "headline-xl-mobile": ["Inter", "system-ui", "sans-serif"],
        "label-sm": ["Inter", "system-ui", "sans-serif"],
        "headline-md": ["Inter", "system-ui", "sans-serif"],
        "headline-xl": ["Inter", "system-ui", "sans-serif"]
      },
      "fontSize": {
        "label-lg": ["13px", { "lineHeight": "18px", "letterSpacing": "0.01em", "fontWeight": "500" }],
        "headline-lg": ["28px", { "lineHeight": "36px", "letterSpacing": "-0.02em", "fontWeight": "600" }],
        "headline-lg-mobile": ["22px", { "lineHeight": "30px", "letterSpacing": "-0.02em", "fontWeight": "600" }],
        "code-telemetry": ["12px", { "lineHeight": "18px", "letterSpacing": "0.01em", "fontWeight": "400" }],
        "headline-sm": ["16px", { "lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "body-sm": ["13px", { "lineHeight": "20px", "letterSpacing": "0.005em", "fontWeight": "400" }],
        "label-md": ["12px", { "lineHeight": "16px", "letterSpacing": "0.03em", "fontWeight": "500" }],
        "body-lg": ["16px", { "lineHeight": "26px", "letterSpacing": "0em", "fontWeight": "400" }],
        "body-md": ["14px", { "lineHeight": "22px", "letterSpacing": "0em", "fontWeight": "400" }],
        "headline-xl-mobile": ["22px", { "lineHeight": "30px", "letterSpacing": "-0.02em", "fontWeight": "600" }],
        "label-sm": ["11px", { "lineHeight": "16px", "letterSpacing": "0.04em", "fontWeight": "600" }],
        "headline-md": ["20px", { "lineHeight": "28px", "letterSpacing": "-0.015em", "fontWeight": "600" }],
        "headline-xl": ["40px", { "lineHeight": "48px", "letterSpacing": "-0.03em", "fontWeight": "600" }]
      }
    }
  }
};
