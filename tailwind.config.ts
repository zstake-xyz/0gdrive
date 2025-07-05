import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': {
          light: '#f0abfc', // fuchsia-400
          DEFAULT: '#d946ef', // fuchsia-500
          dark: '#c026d3',  // fuchsia-600
        },
        'brand-secondary': {
          light: '#e9d5ff', // purple-200
          DEFAULT: '#d8b4fe', // purple-300
          dark: '#c084fc',   // purple-400
        },
        'brand-text': {
          DEFAULT: '#1f2937', // gray-800
          secondary: '#4b5563', // gray-600
        },
        'brand-background': {
          light: '#faf5ff', // purple-50
          DEFAULT: '#f3e8ff', // purple-100
        },
        'brand-surface': '#ffffff',
        'brand-border': '#e9d5ff', // purple-200
      },
      // screens 확장
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        '2.5xl': '2048px',
        '3xl': '2560px',
        // 추가 세분화된 브레이크포인트
        '1440': '1440px',
        '1600': '1600px',
        '1920': '1920px',
        '2048': '2048px',
        '2560': '2560px',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
