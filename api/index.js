const express = require('express');
const cors = require('cors');
const chromium = require('@sparticuz/chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(cors());

// Helper: ekstrak angka dari string harga
function extractPrice(priceStr) {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

// Helper untuk logging
function log(platform, message, data = null) {
  console.log(`[${platform}] ${message}`, data ? JSON.stringify(data).substring(0, 200) : '');
}

// Helper untuk data dummy masing-masing platform
function getDummy(platform, keyword = 'Laptop') {
  const dummies = {
    shopee: {
      name: `${keyword} Gaming di Shopee (Contoh)`,
      price: 12999000,
      image: 'https://images.unsplash.com/photo-1603302576837-37561b5e8e5c?w=400',
      link: 'https://shopee.co.id',
      affiliateLink: 'https://shopee.co.id?af=marketfind2025'
    },
    tokopedia: {
      name: `${keyword} Lenovo (Contoh Tokopedia)`,
      price: 11499000,
      image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400',
      link: 'https://tokopedia.com',
      affiliateLink: 'https://tokopedia.com?af=marketfind2025'
    },
    lazada: {
      name: `${keyword} MSI Katana (Contoh)`,
      price: 17499000,
      image: 'https://images.unsplash.com/photo-1603302576837-37561b5e8e5c?w=400',
      link: 'https://lazada.co.id',
      affiliateLink: 'https://lazada.co.id?af=marketfind2025'
    }
  };
  return dummies[platform];
}

// Fungsi untuk mengkonfigurasi page dengan anti-detection
async function setupPage(page) {
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
}

// Fungsi untuk menjalankan scraping dengan retry
async function scrapeWithRetry(scrapeFn, platform, keyword, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      log(platform, `Percobaan ${i+1}/${retries+1}`);
      const result = await scrapeFn(keyword);
      // Jika hasil bukan dummy (tidak mengandung "Contoh") dan ada nama, anggap sukses
      if (result && result.name && !result.name.includes('Contoh')) {
        return result;
      }
      log(platform, 'Hasil masih dummy, mungkin gagal ekstrak');
    } catch (error) {
      log(platform, `Error percobaan ${i+1}:`, error.message);
    }
    if (i < retries) {
      log(platform, `Menunggu 2 detik sebelum percobaan berikutnya...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  log(platform, 'Semua percobaan gagal, mengembalikan data dummy');
  return getDummy(platform, keyword);
}

// ===================== SHOPEE =====================
async function scrapeShopee(keyword) {
  let browser = null;
  try {
    log('Shopee', 'Memulai scraping...');
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    await setupPage(page);
    
    await page.goto(`https://shopee.co.id/search?keyword=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    // Scroll untuk memicu lazy load
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(2000);

    await page.waitForSelector('li[data-sqe="item"]', { timeout: 15000 });
    log('Shopee', 'Selector item ditemukan');

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('li[data-sqe="item"]');
      return Array.from(items).slice(0, 5).map(item => {
        // Nama
        const nameEl = item.querySelector('.whitespace-normal.line-clamp-2');
        const name = nameEl ? nameEl.innerText.trim() : '';

        // Harga
        const priceEl = item.querySelector('.truncate.flex.items-baseline .truncate.text-base\\/5.font-medium');
        const price = priceEl ? priceEl.innerText.trim() : '0';

        // Link
        const linkEl = item.querySelector('a[href*="/"]');
        const link = linkEl ? linkEl.href : '';

        // Gambar
        const imgEl = item.querySelector('img');
        const image = imgEl ? imgEl.src : '';

        return { name, price, link, image };
      });
    });

    log('Shopee', `Produk ditemukan: ${products.length}`);

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0 && p.name);

    if (withPrice.length === 0) {
      log('Shopee', 'Tidak ada produk valid');
      return null;
    }

    const cheapest = withPrice.reduce((min, p) => p.priceNum < min.priceNum ? p : min, withPrice[0]);

    return {
      name: cheapest.name,
      price: cheapest.priceNum,
      image: cheapest.image,
      link: cheapest.link,
      affiliateLink: cheapest.link + '?af=marketfind2025'
    };
  } catch (err) {
    log('Shopee', 'Error:', err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ===================== TOKOPEDIA =====================
async function scrapeTokopedia(keyword) {
  let browser = null;
  try {
    log('Tokopedia', 'Memulai scraping...');
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    await setupPage(page);
    
    await page.goto(`https://www.tokopedia.com/search?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(2000);

    await page.waitForSelector('.css-5wh65g', { timeout: 15000 });
    log('Tokopedia', 'Selector item ditemukan');

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.css-5wh65g');
      return Array.from(items).slice(0, 5).map(item => {
        // Nama
        const nameContainer = item.querySelector('[class*="SzILjt4fxHUFNVT48ZPhHA"]');
        let name = '';
        if (nameContainer) {
          const span = nameContainer.querySelector('span');
          if (span) name = span.innerText.trim();
        }

        // Harga
        const priceEl = item.querySelector('[class*="urMOIDHH7I0Iy1Dv2oFaNw"]');
        const price = priceEl ? priceEl.innerText.trim() : '0';

        // Link
        const linkEl = item.querySelector('a[href*="tokopedia.com"]');
        const link = linkEl ? linkEl.href : '';

        // Gambar
        const imgEl = item.querySelector('img[alt="product-image"]');
        const image = imgEl ? imgEl.src : '';

        return { name, price, link, image };
      });
    });

    log('Tokopedia', `Produk ditemukan: ${products.length}`);

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0 && p.name);

    if (withPrice.length === 0) {
      log('Tokopedia', 'Tidak ada produk valid');
      return null;
    }

    const cheapest = withPrice.reduce((min, p) => p.priceNum < min.priceNum ? p : min, withPrice[0]);

    return {
      name: cheapest.name,
      price: cheapest.priceNum,
      image: cheapest.image,
      link: cheapest.link,
      affiliateLink: cheapest.link + '?af=marketfind2025'
    };
  } catch (err) {
    log('Tokopedia', 'Error:', err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ===================== LAZADA =====================
async function scrapeLazada(keyword) {
  let browser = null;
  try {
    log('Lazada', 'Memulai scraping...');
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    await setupPage(page);
    
    await page.goto(`https://www.lazada.co.id/catalog/?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    // Scroll untuk memicu lazy load
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(3000);

    // Cari container produk
    const containerSelectors = [
      '.Bm3ON',
      '[data-qa-locator="product-item"]',
      '.c2KCWC',
      '.c16H9d'
    ];

    let foundContainer = null;
    for (const selector of containerSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        log('Lazada', `Container ditemukan: ${selector}`);
        foundContainer = selector;
        break;
      } catch (e) {
        log('Lazada', `Container tidak ditemukan: ${selector}`);
      }
    }

    if (!foundContainer) {
      log('Lazada', 'Tidak ada container produk');
      return null;
    }

    const products = await page.$$eval(foundContainer, (items) => {
      return items.slice(0, 5).map(item => {
        // Nama
        const nameLink = item.querySelector('.RfADt a');
        let name = '';
        if (nameLink) {
          name = nameLink.title || nameLink.innerText.trim();
        }

        // Harga
        const priceEl = item.querySelector('.ooOxS');
        const price = priceEl ? priceEl.innerText.trim() : '0';

        // Link
        const linkEl = item.querySelector('a[href*="/products/"]') || item.querySelector('a');
        const link = linkEl ? linkEl.href : '';

        // Gambar utama
        const imgEl = item.querySelector('.picture-wrapper img');
        const image = imgEl ? imgEl.src : '';

        return { name, price, link, image };
      });
    });

    log('Lazada', `Produk ditemukan: ${products.length}`);

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0 && p.name);

    if (withPrice.length === 0) {
      log('Lazada', 'Tidak ada produk valid');
      return null;
    }

    const cheapest = withPrice.reduce((min, p) => p.priceNum < min.priceNum ? p : min, withPrice[0]);

    return {
      name: cheapest.name,
      price: cheapest.priceNum,
      image: cheapest.image,
      link: cheapest.link,
      affiliateLink: cheapest.link + '?af=marketfind2025'
    };
  } catch (err) {
    log('Lazada', 'Error:', err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ===================== ENDPOINT UTAMA DENGAN RETRY =====================
app.get('/api/search', async (req, res) => {
  const keyword = req.query.q;
  if (!keyword) {
    return res.status(400).json({ error: 'Parameter "q" diperlukan' });
  }

  console.log(`\n=== Mencari: "${keyword}" ===\n`);

  try {
    // Jalankan scraping dengan retry untuk masing-masing platform
    const [shopee, tokopedia, lazada] = await Promise.allSettled([
      scrapeWithRetry(scrapeShopee, 'shopee', keyword),
      scrapeWithRetry(scrapeTokopedia, 'tokopedia', keyword),
      scrapeWithRetry(scrapeLazada, 'lazada', keyword)
    ]);

    const result = {
      shopee: shopee.status === 'fulfilled' ? shopee.value : getDummy('shopee', keyword),
      tokopedia: tokopedia.status === 'fulfilled' ? tokopedia.value : getDummy('tokopedia', keyword),
      lazada: lazada.status === 'fulfilled' ? lazada.value : getDummy('lazada', keyword)
    };

    console.log('\n=== HASIL AKHIR ===');
    console.log(JSON.stringify(result, null, 2));

    res.json(result);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan internal' });
  }
});

// Untuk local testing
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
