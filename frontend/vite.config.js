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
    
    // Proxy API requests to backend
    // This solves CORS issues during development
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',  // Backend URL (use 127.0.0.1 instead of localhost)
        changeOrigin: true,
      }
    }
  },
  
  // Build settings for production
  build: {
    outDir: 'dist',  // Output folder
    sourcemap: true  // Generate source maps for debugging
  }
})

