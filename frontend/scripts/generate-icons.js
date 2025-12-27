/**
 * Icon Generator Script
 * Run this to generate PWA icons
 * 
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// SVG template for the app icon
const createSvgIcon = (size) => {
  const padding = size * 0.15;
  const innerSize = size - (padding * 2);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#grad)"/>
  <g transform="translate(${padding}, ${padding})">
    <path d="M${innerSize * 0.5} ${innerSize * 0.15}
             L${innerSize * 0.85} ${innerSize * 0.5}
             L${innerSize * 0.5} ${innerSize * 0.85}
             L${innerSize * 0.15} ${innerSize * 0.5}Z" 
          fill="none" 
          stroke="white" 
          stroke-width="${size * 0.04}" 
          stroke-linejoin="round"/>
    <line x1="${innerSize * 0.5}" y1="${innerSize * 0.15}" 
          x2="${innerSize * 0.5}" y2="${innerSize * 0.85}" 
          stroke="white" 
          stroke-width="${size * 0.03}"/>
    <line x1="${innerSize * 0.15}" y1="${innerSize * 0.5}" 
          x2="${innerSize * 0.85}" y2="${innerSize * 0.5}" 
          stroke="white" 
          stroke-width="${size * 0.03}"/>
  </g>
</svg>`;
};

const iconsDir = path.join(__dirname, '../public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons (these will be converted to PNG)
sizes.forEach(size => {
  const svg = createSvgIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svg);
  console.log(`Created ${filename}`);
});

// Also create apple-touch-icon
const appleSvg = createSvgIcon(180);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.svg'), appleSvg);
console.log('Created apple-touch-icon.svg');

console.log('\n✅ SVG icons created!');
console.log('\nTo convert to PNG, you can use:');
console.log('1. Online: https://cloudconvert.com/svg-to-png');
console.log('2. Or install sharp: npm install sharp');
console.log('   Then run: node scripts/convert-icons.js');

