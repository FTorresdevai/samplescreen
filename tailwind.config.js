/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;

export default {
  content: [
    "./app.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Tokens live in src/index.css (design-system-review.md §3.1)
      colors: {
        bg: v('bg'), 'surface-1': v('surface-1'), 'surface-2': v('surface-2'), well: v('well'),
        line: v('line'), 'line-strong': v('line-strong'), text: v('text'), muted: v('text-muted'),
        subtle: v('text-subtle'), accent: v('accent'), 'accent-ink': v('accent-ink'),
        success: v('success'), error: v('error'), info: v('info'),
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [],
}
