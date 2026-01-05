/**
 * ===========================================
 * VITE CONFIGURATION
 * ===========================================
 * 
 * Vite is a build tool that:
 * - Runs a fast development server
 * - Hot Module Replacement (changes show instantly)
 * - Builds optimized production bundle
 * 
 * This config file tells Vite how to:
 * - Use React plugin (for JSX support)
 * - Set the development server port
 * - Configure the build output
 * ===========================================
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Plugins extend Vite's functionality
  plugins: [react()],
  
  // Development server settings
  server: {
    port: 5173,  // Default Vite port
    open: true,  // Auto-open browser when starting
    hmr: {
      clientPort: 5173,  // Fix WebSocket connection
    },
    
    // Proxy API requests to backend
    // This solves CORS issues during development
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',  // Backend URL (use 127.0.0.1 instead of localhost)
        changeOrigin: true,
        ws: true,  // Enable WebSocket proxying
      }
    }
  },
  
  // Build settings for production
  build: {
    outDir: 'dist',  // Output folder
    sourcemap: false,  // Disable source maps in production to avoid CSP eval errors
    minify: 'esbuild',  // Use esbuild for faster minification
    // Ensure production mode
    define: {
      'import.meta.env.PROD': JSON.stringify(true)
    },
    // Rollup options for better cache busting
    rollupOptions: {
      output: {
        // Add hash to filenames for cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})

