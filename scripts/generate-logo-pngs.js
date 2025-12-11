/**
 * Logo PNG Generator Script
 * 
 * Bu script SVG logonuzu PNG formatına dönüştürür.
 * Node.js ile çalıştırın: node scripts/generate-logo-pngs.js
 * 
 * Gerekli paketler:
 * npm install sharp
 */

const fs = require('fs');
const path = require('path');

// SVG içeriği (32x32 viewBox) - Orijinal logo siyah arka plan ile
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" fill="#000000"/>
  <path d="M7 4C6.44772 4 6 4.44772 6 5V27C6 27.5523 6.44772 28 7 28H11C11.5523 28 12 27.5523 12 27V19L19.2929 27.2929C19.6834 27.6834 20.3166 27.6834 20.7071 27.2929L26.2929 21.7071C26.9229 21.0771 26.4767 20 25.5858 20H18L12 14V5C12 4.44772 11.5523 4 11 4H7Z" fill="#ffffff"/>
  <path d="M19.5 4L13.5 11.5L19.5 4Z" fill="#ffffff"/>
  <path d="M12 14.5L20 4.5H27L17 16L12 14.5Z" fill="#ffffff"/>
  <circle cx="27" cy="26" r="3.5" fill="#10b981"/>
</svg>`;

// Android Adaptive Icon için foreground SVG
// Android adaptive icon 108x108dp, güvenli alan merkezdeki 66x66dp
// Logo 66dp içine sığmalı, yani %18 padding her taraftan (21dp)
const adaptiveForegroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" fill="none">
  <g transform="translate(21, 21) scale(2.0625)">
    <path d="M7 4C6.44772 4 6 4.44772 6 5V27C6 27.5523 6.44772 28 7 28H11C11.5523 28 12 27.5523 12 27V19L19.2929 27.2929C19.6834 27.6834 20.3166 27.6834 20.7071 27.2929L26.2929 21.7071C26.9229 21.0771 26.4767 20 25.5858 20H18L12 14V5C12 4.44772 11.5523 4 11 4H7Z" fill="#ffffff"/>
    <path d="M19.5 4L13.5 11.5L19.5 4Z" fill="#ffffff"/>
    <path d="M12 14.5L20 4.5H27L17 16L12 14.5Z" fill="#ffffff"/>
    <circle cx="27" cy="26" r="3.5" fill="#10b981"/>
  </g>
</svg>`;

// Splash icon için SVG (daha büyük padding ile)
const splashSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
  <rect width="200" height="200" fill="#000000"/>
  <g transform="translate(40, 40) scale(3.75)">
    <path d="M7 4C6.44772 4 6 4.44772 6 5V27C6 27.5523 6.44772 28 7 28H11C11.5523 28 12 27.5523 12 27V19L19.2929 27.2929C19.6834 27.6834 20.3166 27.6834 20.7071 27.2929L26.2929 21.7071C26.9229 21.0771 26.4767 20 25.5858 20H18L12 14V5C12 4.44772 11.5523 4 11 4H7Z" fill="#ffffff"/>
    <path d="M19.5 4L13.5 11.5L19.5 4Z" fill="#ffffff"/>
    <path d="M12 14.5L20 4.5H27L17 16L12 14.5Z" fill="#ffffff"/>
    <circle cx="27" cy="26" r="3.5" fill="#10b981"/>
  </g>
</svg>`;

async function generatePNGs() {
  try {
    const sharp = require('sharp');
    const assetsDir = path.join(__dirname, '..', 'assets');

    // icon.png - 1024x1024 (tam logo siyah arka plan ile)
    console.log('Generating icon.png (1024x1024)...');
    await sharp(Buffer.from(svgContent))
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));

    // adaptive-icon.png - 1024x1024 (Android adaptive icon foreground)
    // Adaptive icon'da foreground layer kullanılır, background ayrıdır
    console.log('Generating adaptive-icon.png (1024x1024)...');
    await sharp(Buffer.from(adaptiveForegroundSvg))
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'adaptive-icon.png'));

    // splash-icon.png - 200x200 (will be scaled by Expo)
    console.log('Generating splash-icon.png (200x200)...');
    await sharp(Buffer.from(splashSvgContent))
      .resize(200, 200)
      .png()
      .toFile(path.join(assetsDir, 'splash-icon.png'));

    // favicon.png - 48x48
    console.log('Generating favicon.png (48x48)...');
    await sharp(Buffer.from(svgContent))
      .resize(48, 48)
      .png()
      .toFile(path.join(assetsDir, 'favicon.png'));

    // source-icon.png - original SVG preserved as PNG
    console.log('Generating source-icon.png (512x512)...');
    await sharp(Buffer.from(svgContent))
      .resize(512, 512)
      .png()
      .toFile(path.join(assetsDir, 'source-icon.png'));

    console.log('\n✅ All PNG files generated successfully!');
    console.log('Files created in:', assetsDir);

  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('Sharp module not found. Install it with:');
      console.error('npm install sharp');
    } else {
      console.error('Error generating PNGs:', error);
    }
    process.exit(1);
  }
}

generatePNGs();
