/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Nền gaming tối
        base: '#070b16',
        panel: '#0d1426',
        panel2: '#121b33',
        // Neon
        neon: {
          cyan: '#22f5e0',
          blue: '#3a86ff',
          purple: '#a855f7',
          pink: '#ff2d92',
          green: '#39ff8b',
        },
        aqua: {
          50: '#0d1426',
          100: '#102a3a',
          200: '#164e63',
          400: '#22f5e0',
          600: '#22d3ee',
          800: '#67e8f9',
          900: '#a5f3fc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Orbitron', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(34,245,224,0.35)',
        'neon-pink': '0 0 20px rgba(255,45,146,0.35)',
      },
    },
  },
  plugins: [],
};
