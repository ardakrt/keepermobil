#!/usr/bin/env node

/**
 * Icon Generator Script
 *
 * Bu script, kaynak görselden (source-icon.png) uygulama için gerekli
 * tüm ikon dosyalarını oluşturur.
 *
 * Kullanım:
 *   node scripts/generate-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Yollar
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SOURCE_ICON = path.join(ASSETS_DIR, 'source-icon.png');

// Çıktı dosyaları
const OUTPUT_FILES = {
  icon: path.join(ASSETS_DIR, 'icon.png'),
  adaptiveIcon: path.join(ASSETS_DIR, 'adaptive-icon.png'),
  favicon: path.join(ASSETS_DIR, 'favicon.png'),
  splashIcon: path.join(ASSETS_DIR, 'splash-icon.png')
};

// Arka plan rengini görselden otomatik tespit etme
async function detectBackgroundColor(imagePath) {
  try {
    const image = sharp(imagePath);
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Sol üst köşeden renk örneği al (arka plan genelde köşelerde)
    const r = data[0];
    const g = data[1];
    const b = data[2];

    // RGB'yi HEX'e çevir
    const toHex = (c) => c.toString(16).padStart(2, '0');
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    console.log(`✓ Tespit edilen arka plan rengi: ${hex}`);
    return hex;
  } catch (error) {
    console.warn('⚠ Arka plan rengi tespit edilemedi, varsayılan kullanılıyor:', error.message);
    return '#CBD5E1'; // Varsayılan açık gri
  }
}

// Görselin arka planını şeffaflaştırma
async function removeBackground(inputPath, outputPath, targetSize = 1024) {
  console.log(`\n📸 Arka plan kaldırılıyor: ${path.basename(outputPath)}`);

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`  → Orijinal boyut: ${metadata.width}x${metadata.height}`);

    // Görseli hedef boyuta getir
    let resized = image.resize(targetSize, targetSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    });

    // Adaptive icon için arka planı kaldır ve içeriği biraz küçült (safe zone için)
    // Adaptive icon'da merkezi 432x432 px alan güvenli alan (1024x1024 canvas'ta %66)
    const safeZoneSize = Math.floor(targetSize * 0.75); // %75 güvenli alan

    await sharp(inputPath)
      .resize(safeZoneSize, safeZoneSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .extend({
        top: Math.floor((targetSize - safeZoneSize) / 2),
        bottom: Math.ceil((targetSize - safeZoneSize) / 2),
        left: Math.floor((targetSize - safeZoneSize) / 2),
        right: Math.ceil((targetSize - safeZoneSize) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Oluşturuldu: ${targetSize}x${targetSize}px`);
    return true;
  } catch (error) {
    console.error(`  ✗ Hata:`, error.message);
    return false;
  }
}

// Ana ikon oluşturma (arka plan dahil)
async function generateMainIcon(inputPath, outputPath, targetSize = 1024) {
  console.log(`\n🎨 Ana ikon oluşturuluyor: ${path.basename(outputPath)}`);

  try {
    await sharp(inputPath)
      .resize(targetSize, targetSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Oluşturuldu: ${targetSize}x${targetSize}px`);
    return true;
  } catch (error) {
    console.error(`  ✗ Hata:`, error.message);
    return false;
  }
}

// Küçük ikon oluşturma (favicon, splash vb.)
async function generateResizedIcon(inputPath, outputPath, targetSize, label) {
  console.log(`\n🔧 ${label} oluşturuluyor: ${path.basename(outputPath)}`);

  try {
    await sharp(inputPath)
      .resize(targetSize, targetSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Oluşturuldu: ${targetSize}x${targetSize}px`);
    return true;
  } catch (error) {
    console.error(`  ✗ Hata:`, error.message);
    return false;
  }
}

// Ana işlem
async function main() {
  console.log('🚀 İkon üretimi başlatılıyor...\n');

  // Kaynak dosya kontrolü
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`❌ Hata: Kaynak dosya bulunamadı: ${SOURCE_ICON}`);
    console.error('Lütfen assets/source-icon.png dosyasını ekleyin.');
    process.exit(1);
  }

  console.log(`✓ Kaynak dosya bulundu: ${path.basename(SOURCE_ICON)}`);

  // Arka plan rengini tespit et
  const bgColor = await detectBackgroundColor(SOURCE_ICON);

  // İkonları oluştur
  const results = await Promise.all([
    // 1. Ana ikon (1024x1024, arka plan dahil)
    generateMainIcon(SOURCE_ICON, OUTPUT_FILES.icon, 1024),

    // 2. Adaptive icon foreground (şeffaf arka plan)
    removeBackground(SOURCE_ICON, OUTPUT_FILES.adaptiveIcon, 1024),

    // 3. Favicon (48x48, web için)
    generateResizedIcon(SOURCE_ICON, OUTPUT_FILES.favicon, 48, 'Favicon'),

    // 4. Splash icon (400x400, splash screen için)
    generateResizedIcon(SOURCE_ICON, OUTPUT_FILES.splashIcon, 400, 'Splash Icon')
  ]);

  // Sonuç raporu
  const successCount = results.filter(r => r).length;
  const totalCount = results.length;

  console.log('\n' + '='.repeat(50));
  console.log(`📊 SONUÇ: ${successCount}/${totalCount} dosya başarıyla oluşturuldu`);
  console.log('='.repeat(50));

  if (successCount === totalCount) {
    console.log('\n✅ Tüm ikonlar başarıyla oluşturuldu!');
    console.log('\n📝 SONRAKİ ADIMLAR:');
    console.log('1. app.json dosyasında adaptiveIcon.backgroundColor değerini şu renge güncelleyin:');
    console.log(`   "${bgColor}"`);
    console.log('2. Projeyi yeniden build edin:');
    console.log('   npm run android veya eas build');
    console.log('3. Uygulamayı açıp ikonu kontrol edin.');
  } else {
    console.log('\n⚠️ Bazı ikonlar oluşturulamadı. Lütfen hataları kontrol edin.');
    process.exit(1);
  }
}

// Scripti çalıştır
main().catch((error) => {
  console.error('\n❌ Beklenmeyen hata:', error);
  process.exit(1);
});
