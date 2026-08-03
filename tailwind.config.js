import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // GT Ultra Median everywhere text renders (Preflight applies this
        // sans stack to <html> by default, so it cascades app-wide). Falls
        // back to system fonts until the licensed font files are added —
        // see public/fonts/README.md.
        sans: ['"GT Ultra Median"', ...defaultTheme.fontFamily.sans],
        amount: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Brand palette: Cobalt Blue (primary), Teal (positive/success), Rose
      // Gold (caution/deviation), Poppy Red (danger/error). Neutrals stay
      // Tailwind's default slate scale.
      colors: {
        cobalt: {
          50: '#E9F1FB',
          100: '#D3E3F7',
          200: '#A6C6EF',
          300: '#6E9FE0',
          400: '#3070C8',
          500: '#0047AB', // base
          600: '#003F99',
          700: '#00337A',
          800: '#00265C',
          900: '#001F4D',
        },
        rosegold: {
          50: '#FBF1F0',
          100: '#F3DEDD',
          200: '#E9C4C4',
          300: '#DDA8A9',
          400: '#CB8B8F',
          500: '#B76E79', // base
          600: '#9E5A65',
          700: '#8C4A54',
          800: '#6E3840',
          900: '#4F282E',
        },
        poppy: {
          50: '#FDECEC',
          100: '#FAD1D0',
          200: '#F5AEAB',
          300: '#F08683',
          400: '#EA5A54',
          500: '#E4312B', // base
          600: '#C81E19',
          700: '#A81713',
          800: '#82110E',
          900: '#5C0B09',
        },
      },
    },
  },
  plugins: [],
};
