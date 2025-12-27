/**
 * ===========================================
 * MAIN ENTRY POINT
 * ===========================================
 * This is where React starts.
 * 
 * What happens here:
 * 1. Import React and ReactDOM
 * 2. Import our main App component
 * 3. Import global CSS
 * 4. Render App into the #root div in index.html
 * 
 * StrictMode: A development tool that:
 * - Warns about legacy APIs
 * - Detects potential problems
 * - Does NOT affect production build
 * ===========================================
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Find the root element in index.html
const rootElement = document.getElementById('root')

// Create a React root and render our App
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

