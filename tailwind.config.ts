import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sf': ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        'medium-bold': '600', // Apple's medium-bold weight
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        'mano-bg': 'hsl(41 100% 97.9%)', // Your custom Alice Blue background
        'mano-blue': {
          50: '#F0F8FF',   // Your background color
          100: '#E0F0FF',
          500: '#3B82F6',  // Default blue for buttons/links
          600: '#2563EB',  // Darker blue for hover states
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      typography: (theme: any) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: theme('colors.gray.900'),
            h1: {
              color: theme('colors.gray.900'),
              fontWeight: '600',
              fontSize: theme('fontSize.xl'),
            },
            h2: {
              color: theme('colors.gray.900'),
              fontWeight: '600',
              fontSize: theme('fontSize.lg'),
            },
            h3: {
              color: theme('colors.gray.900'),
              fontWeight: '600',
            },
            strong: {
              color: theme('colors.gray.900'),
              fontWeight: '600',
            },
            code: {
              color: theme('colors.gray.800'),
              backgroundColor: theme('colors.gray.100'),
              padding: '0.25rem 0.375rem',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: '500',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: theme('colors.gray.100'),
              color: theme('colors.gray.800'),
              borderRadius: '0.375rem',
              padding: '1rem',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: '0',
            },
            a: {
              color: theme('colors.blue.600'),
              textDecoration: 'underline',
              '&:hover': {
                color: theme('colors.blue.500'),
              },
            },
            ul: {
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
            ol: {
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
            li: {
              marginTop: '0.25rem',
              marginBottom: '0.25rem',
            },
            p: {
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
          },
        },
        // Custom variant for user messages
        'user-message': {
          css: {
            '--tw-prose-body': theme('colors.white'),
            '--tw-prose-headings': theme('colors.white'),
            '--tw-prose-lead': theme('colors.white'),
            '--tw-prose-links': theme('colors.blue.200'),
            '--tw-prose-bold': theme('colors.white'),
            '--tw-prose-counters': theme('colors.blue.200'),
            '--tw-prose-bullets': theme('colors.blue.200'),
            '--tw-prose-hr': theme('colors.blue.300'),
            '--tw-prose-quotes': theme('colors.blue.100'),
            '--tw-prose-quote-borders': theme('colors.blue.300'),
            '--tw-prose-captions': theme('colors.blue.200'),
            '--tw-prose-code': theme('colors.blue.200'),
            '--tw-prose-pre-code': theme('colors.blue.200'),
            '--tw-prose-pre-bg': 'rgb(59 130 246 / 0.2)',
            '--tw-prose-th-borders': theme('colors.blue.300'),
            '--tw-prose-td-borders': theme('colors.blue.300'),
            color: theme('colors.white'),
            p: { color: theme('colors.white') },
            strong: { color: theme('colors.white') },
            em: { color: theme('colors.blue.100') },
            h1: { color: theme('colors.white') },
            h2: { color: theme('colors.white') },
            h3: { color: theme('colors.white') },
            h4: { color: theme('colors.white') },
            h5: { color: theme('colors.white') },
            h6: { color: theme('colors.white') },
            code: {
              color: theme('colors.blue.200'),
              backgroundColor: 'rgb(59 130 246 / 0.2)',
            },
            a: {
              color: theme('colors.blue.200'),
              '&:hover': {
                color: theme('colors.blue.100'),
              },
            },
          },
        },
        // Future dark mode support
        invert: {
          css: {
            '--tw-prose-body': theme('colors.white'),
            '--tw-prose-headings': theme('colors.white'),
            '--tw-prose-lead': theme('colors.blue.100'),
            '--tw-prose-links': theme('colors.blue.200'),
            '--tw-prose-bold': theme('colors.white'),
            '--tw-prose-counters': theme('colors.blue.200'),
            '--tw-prose-bullets': theme('colors.blue.300'),
            '--tw-prose-hr': theme('colors.blue.400'),
            '--tw-prose-quotes': theme('colors.blue.100'),
            '--tw-prose-quote-borders': theme('colors.blue.400'),
            '--tw-prose-captions': theme('colors.blue.200'),
            '--tw-prose-code': theme('colors.blue.100'),
            '--tw-prose-pre-code': theme('colors.blue.100'),
            '--tw-prose-pre-bg': 'rgb(59 130 246 / 0.2)',
            '--tw-prose-th-borders': theme('colors.blue.400'),
            '--tw-prose-td-borders': theme('colors.blue.500'),
          },
        },
      }),
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
} satisfies Config;