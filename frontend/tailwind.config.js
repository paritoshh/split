/**
 * ===========================================
 * TAILWIND CSS CONFIGURATION
 * ===========================================
 * 
 * Tailwind CSS is a "utility-first" CSS framework.
 * Instead of writing CSS, you use predefined classes:
 * 
 * Traditional CSS:
 *   .button { background: blue; padding: 10px 20px; border-radius: 5px; }
 * 
 * Tailwind:
 *   <button class="bg-blue-500 px-5 py-2 rounded">Click</button>
 * 
 * Benefits:
 * - No need to switch between HTML and CSS files
 * - Consistent spacing/colors (design system built-in)
 * - Smaller production CSS (only used classes included)
 * ===========================================
 */

/** @type {import('tailwindcss').Config} */
export default {
  // Which files to scan for Tailwind classes
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  
  // Customizations to default Tailwind theme
  theme: {
    extend: {
      // Custom colors for our app
      colors: {
        // Primary brand color (vibrant coral/orange)
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',  // Main primary
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Secondary color (teal)
        secondary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',  // Main secondary
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // Dark background
        dark: {
          100: '#1e293b',
          200: '#0f172a',
          300: '#020617',
        }
      },
      // Custom fonts
      fontFamily: {
        'display': ['Outfit', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
      },
      // Custom animations
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'bounce-subtle': 'bounceSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
}

