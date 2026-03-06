const express = require('express');
const cors = require('cors');
const chromium = require('@sparticuz/chrome-aws-lambda');

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

// Helper untuk data dummy
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

// Setup halaman dengan anti-deteksi
async function setupPage(page) {
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
}

// Fungsi untuk meluncurkan browser (otomatis menyesuaikan environment)
async function launchBrowser() {
  const isVercel = !!process.env.VERCEL;
  const isLambda = !!process.env.AWS_EXECUTION_ENV;

  if (isVercel || isLambda) {
    // Di Vercel atau Lambda: gunakan chrome-aws-lambda + puppeteer-core
    const puppeteer = require('puppeteer-core');
    return await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
  } else {
    // Di lokal: gunakan puppeteer biasa (harus diinstal sebagai devDependency)
    const puppeteer = require('puppeteer');
    return await puppeteer.launch({
      headless: true,
    });
  }
}

// ==================== SHOPEE ====================
async function scrapeShopee(keyword, logCallback = console.log) {
  let browser = null;
  try {
    logCallback('Memulai scraping Shopee...');
    browser = await launchBrowser();

    const page = await browser.newPage();
    await setupPage(page);

    await page.goto(`https://shopee.co.id/search?keyword=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    // Scroll untuk memicu lazy load
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(2000);

    logCallback('Menunggu selector li[data-sqe="item"]');
    await page.waitForSelector('li[data-sqe="item"]', { timeout: 15000 });
    logCallback('Selector item ditemukan');

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('li[data-sqe="item"]');
      return Array.from(items).slice(0, 5).map(item => {
        const nameEl = item.querySelector('.whitespace-normal.line-clamp-2');
        const name = nameEl ? nameEl.innerText.trim() : '';
        const priceEl = item.querySelector('.truncate.flex.items-baseline .truncate.text-base\\/5.font-medium');
        const price = priceEl ? priceEl.innerText.trim() : '0';
        const linkEl = item.querySelector('a[href*="/"]');
        const link = linkEl ? linkEl.href : '';
        const imgEl = item.querySelector('img');
        const image = imgEl ? imgEl.src : '';
        return { name, price, link, image };
      });
    });

    logCallback(`Produk ditemukan: ${products.length}`);
    if (products.length > 0) {
      logCallback(`Contoh produk pertama: ${JSON.stringify(products[0])}`);
    }

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0 && p.name);

    logCallback(`Produk valid setelah filter harga: ${withPrice.length}`);

    if (withPrice.length === 0) {
      logCallback('Tidak ada produk valid, mengembalikan null');
      return null;
    }

    const cheapest = withPrice.reduce((min, p) => p.priceNum < min.priceNum ? p : min, withPrice[0]);
    logCallback(`Produk termurah: ${cheapest.name} - Rp ${cheapest.priceNum}`);

    return {
      name: cheapest.name,
      price: cheapest.priceNum,
      image: cheapest.image,
      link: cheapest.link,
      affiliateLink: cheapest.link + '?af=marketfind2025'
    };
  } catch (err) {
    logCallback(`ERROR: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ==================== TOKOPEDIA ====================
async function scrapeTokopedia(keyword, logCallback = console.log) {
  let browser = null;
  try {
    logCallback('Memulai scraping Tokopedia...');
    browser = await launchBrowser();

    const page = await browser.newPage();
    await setupPage(page);

    await page.goto(`https://www.tokopedia.com/search?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(2000);

    logCallback('Menunggu selector .css-5wh65g');
    await page.waitForSelector('.css-5wh65g', { timeout: 15000 });
    logCallback('Selector item ditemukan');

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.css-5wh65g');
      return Array.from(items).slice(0, 5).map(item => {
        const nameContainer = item.querySelector('[class*="SzILjt4fxHUFNVT48ZPhHA"]');
        let name = '';
        if (nameContainer) {
          const span = nameContainer.querySelector('span');
          if (span) name = span.innerText.trim();
        }
        const priceEl = item.querySelector('[class*="urMOIDHH7I0Iy1Dv2oFaNw"]');
        const price = priceEl ? priceEl.innerText.trim() : '0';
        const linkEl = item.querySelector('a[href*="tokopedia.com"]');
        const link = linkEl ? linkEl.href : '';
        const imgEl = item.querySelector('img[alt="product-image"]');
        const image = imgEl ? imgEl.src : '';
        return { name, price, link, image };
      });
    });

    logCallback(`Produk ditemukan: ${products.length}`);
    if (products.length > 0) {
      logCallback(`Contoh produk pertama: ${JSON.stringify(products[0])}`);
    }

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0 && p.name);

    logCallback(`Produk valid setelah filter harga: ${withPrice.length}`);

    if (withPrice.length === 0) {
      logCallback('Tidak ada produk valid, mengembalikan null');
      return null;
    }

    const cheapest = withPrice.reduce((min, p) => p.priceNum < min.priceNum ? p : min, withPrice[0]);
    logCallback(`Produk termurah: ${cheapest.name} - Rp ${cheapest.priceNum}`);

    return {
      name: cheapest.name,
      price: cheapest.priceNum,
      image: cheapest.image,
      link: cheapest.link,
      affiliateLink: cheapest.link + '?af=marketfind2025'
    };
  } catch (err) {
    logCallback(`ERROR: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ==================== LAZADA ====================
async function scrapeLazada(keyword, logCallback = console.log) {
  let browser = null;
  try {
    logCallback('Memulai scraping Lazada...');
    browser = await launchBrowser();

    const page = await browser.newPage();
    await setupPage(page);

    await page.goto(`https://www.lazada.co.id/catalog/?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(3000);

    const containerSelectors = [
      '.Bm3ON',
      '[data-qa-locator="product-item"]',
      '.c2KCWC',
      '.c16H9d'
    ];

    let foundContainer = null;
    for (const selector of containerSelectors) {
      try {
        logCallback(`Mencoba container selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        logCallback(`Container ditemukan: ${selector}`);
        foundContainer = selector;
        break;
      } catch (e) {
        logCallback(`Container tidak ditemukan: ${selector}`);
      }
    }

    if (!foundContainer) {
      logCallback('Tidak ada container produk, mengembalikan null');
      return null;
    }

    const products = await page.$$eval(foundContainer, (items) => {
      return items.slice(0, 5).map(item => {
        const nameLink = item.querySelector('.RfADt a');
        let name = '';
        if (nameLink) {
          name = nameLink.title || nameLink.innerText.trim();
        }
        const priceEl = item.querySelector('.ooOxS');
        const price = priceEl ? priceEl.innerText.trim() : '0';
        const linkEl = item.querySelector('a[href*="/products/"]') || item.querySelector('a');
        const link = linkEl ? linkEl.href : '';
        const imgEl = item.querySelector('.picture-wrapper img');
        const image = imgEl ? imgEl.src : '';
        return { name, price, link, image };
      });
    });

    logCallback(`Produk ditemukan: ${products.length}`);
    if (products.length > 0) {
      logCallback(`Contoh produk pertama: ${JSON.stringify(products[0])}`);
    }

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0 && p.name);

    logCallback(`Produk valid setelah filter harga: ${withPrice.length}`);

    if (withPrice.length === 0) {
      logCallback('Tidak ada produk valid, mengembalikan null');
      return null;
    }

    const cheapest = withPrice.reduce((min, p) => p.priceNum < min.priceNum ? p : min, withPrice[0]);
    logCallback(`Produk termurah: ${cheapest.name} - Rp ${cheapest.priceNum}`);

    return {
      name: cheapest.name,
      price: cheapest.priceNum,
      image: cheapest.image,
      link: cheapest.link,
      affiliateLink: cheapest.link + '?af=marketfind2025'
    };
  } catch (err) {
    logCallback(`ERROR: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ==================== ROUTE DEBUG HTML ====================
app.get('/debug', async (req, res) => {
  const keyword = req.query.q || 'laptop';
  console.log(`\n=== DEBUG MODE: Mencari "${keyword}" ===\n`);

  const logs = { shopee: [], tokopedia: [], lazada: [] };
  const results = {};

  async function runScrape(platform, scrapeFn) {
    const platformLogs = [];
    platformLogs.push(`Memulai scraping ${platform} untuk "${keyword}"`);
    try {
      const result = await scrapeFn(keyword, (msg) => platformLogs.push(msg));
      platformLogs.push(`Scraping selesai, hasil: ${result ? 'ada data' : 'tidak ada data'}`);
      results[platform] = result;
    } catch (err) {
      platformLogs.push(`ERROR: ${err.message}`);
      results[platform] = null;
    }
    logs[platform] = platformLogs;
  }

  await Promise.allSettled([
    runScrape('shopee', scrapeShopee),
    runScrape('tokopedia', scrapeTokopedia),
    runScrape('lazada', scrapeLazada)
  ]);

  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Debug Scraping</title>
    <style>
      body { font-family: Arial; margin: 20px; background: #f5f5f5; }
      .platform { background: white; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      h2 { margin-top: 0; text-transform: capitalize; }
      .product { display: flex; gap: 20px; border-top: 1px solid #eee; padding: 10px 0; }
      .product img { width: 100px; height: 100px; object-fit: cover; border: 1px solid #ddd; }
      .dummy { color: orange; font-weight: bold; }
      .error { color: red; }
      .log { background: #f0f0f0; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; border-left: 3px solid #888; margin-bottom: 10px; }
      .info { background: #e8f4fd; padding: 5px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>🔍 Debug Scraping untuk keyword: "${keyword}"</h1>
    <p><a href="/api/search?q=${encodeURIComponent(keyword)}">Lihat response JSON</a></p>
  `;

  for (const platform of ['shopee', 'tokopedia', 'lazada']) {
    const result = results[platform];
    const platformLogs = logs[platform];
    html += `<div class="platform">`;
    html += `<h2>${platform.toUpperCase()}</h2>`;
    html += `<div class="log">${platformLogs.join('<br>')}</div>`;

    if (result && result.name && !result.name.includes('Contoh')) {
      html += `<div class="product">`;
      html += `<img src="${result.image}" alt="${result.name}" onerror="this.src='https://via.placeholder.com/100'">`;
      html += `<div><strong>${result.name}</strong><br>Harga: Rp ${result.price.toLocaleString()}<br><a href="${result.link}" target="_blank">Link Produk</a> | <a href="${result.affiliateLink}" target="_blank">Link Afiliasi</a></div>`;
      html += `</div>`;
    } else if (result) {
      html += `<div class="product dummy">`;
      html += `<p><strong>⚠️ DATA DUMMY:</strong> ${result.name} - Rp ${result.price.toLocaleString()}</p>`;
      html += `</div>`;
    } else {
      html += `<p class="error">❌ Tidak ada data (null)</p>`;
    }
    html += `</div>`;
  }

  html += `</body></html>`;
  res.send(html);
});

// ==================== ENDPOINT UTAMA (JSON) ====================
app.get('/api/search', async (req, res) => {
  const keyword = req.query.q;
  if (!keyword) {
    return res.status(400).json({ error: 'Parameter "q" diperlukan' });
  }

  console.log(`\n=== Mencari: "${keyword}" ===\n`);

  try {
    const [shopee, tokopedia, lazada] = await Promise.allSettled([
      scrapeShopee(keyword, (msg) => log('Shopee', msg)),
      scrapeTokopedia(keyword, (msg) => log('Tokopedia', msg)),
      scrapeLazada(keyword, (msg) => log('Lazada', msg))
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
    console.log(`Gunakan /debug?q=laptop untuk melihat hasil dalam HTML`);
  });
}

module.exports = app;
