/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        page: "var(--bg)",
        sidebar: "var(--bg-sidebar)",
        header: "var(--bg-header)",
        card: "var(--bg-card)",
        elevated: "var(--bg-elevated)",
        muted: "var(--bg-muted)",
        line: "var(--border)",
        ink: "var(--text)",
        subtle: "var(--text-secondary)",
        faint: "var(--text-muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-soft": "var(--accent-soft)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--error)",
        info: "var(--info)",
      },
      boxShadow: {
        card: "var(--shadow)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        input: "var(--radius-input)",
        btn: "var(--radius-btn)",
      },
      spacing: {
        sidebar: "var(--sidebar-w)",
        header: "var(--header-h)",
      },
      width: {
        sidebar: "var(--sidebar-w)",
      },
      height: {
        header: "var(--header-h)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
