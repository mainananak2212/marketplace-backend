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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(`https://shopee.co.id/search?keyword=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    await page.waitForSelector('li[data-sqe="item"]', { timeout: 10000 });
    log('Shopee', 'Selector item ditemukan');

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

    log('Shopee', `Produk ditemukan: ${products.length}`);

    if (products.length === 0) {
      return {
        name: `Laptop Gaming di Shopee (Contoh)`,
        price: 12999000,
        image: 'https://images.unsplash.com/photo-1603302576837-37561b5e8e5c?w=400',
        link: 'https://shopee.co.id',
        affiliateLink: 'https://shopee.co.id?af=marketfind2025'
      };
    }

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0);

    if (withPrice.length === 0) return null;

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
    return {
      name: `Laptop ASUS ROG (Contoh)`,
      price: 15999000,
      image: 'https://images.unsplash.com/photo-1603302576837-37561b5e8e5c?w=400',
      link: 'https://shopee.co.id',
      affiliateLink: 'https://shopee.co.id?af=marketfind2025'
    };
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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto(`https://www.tokopedia.com/search?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    await page.waitForSelector('.css-5wh65g', { timeout: 10000 });
    log('Tokopedia', 'Selector item ditemukan');

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

    log('Tokopedia', `Produk ditemukan: ${products.length}`);

    if (products.length === 0) {
      return {
        name: `Laptop Lenovo (Contoh Tokopedia)`,
        price: 11499000,
        image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400',
        link: 'https://tokopedia.com',
        affiliateLink: 'https://tokopedia.com?af=marketfind2025'
      };
    }

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0);

    if (withPrice.length === 0) return null;

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
    return {
      name: `Laptop Acer Swift (Contoh)`,
      price: 9999000,
      image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400',
      link: 'https://tokopedia.com',
      affiliateLink: 'https://tokopedia.com?af=marketfind2025'
    };
  } finally {
    if (browser) await browser.close();
  }
}

// ===================== LAZADA (UPDATED SELECTOR) =====================
async function scrapeLazada(keyword) {
  let browser = null;
  try {
    log('Lazada', 'Memulai scraping dengan selector terbaru...');
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto(`https://www.lazada.co.id/catalog/?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    // Daftar selector yang mungkin muncul (termasuk yang terbaru)
    const selectors = [
      '.Bm3ON',
      '[data-qa-locator="product-item"]',
      '.c2KCWC',
      '.c16H9d'
    ];

    let found = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        log('Lazada', `Selector ditemukan: ${selector}`);
        found = true;
        break;
      } catch (e) {
        log('Lazada', `Selector tidak ditemukan: ${selector}`);
      }
    }

    if (!found) {
      return {
        name: `Laptop Dell XPS (Contoh Lazada)`,
        price: 18999000,
        image: 'https://images.unsplash.com/photo-1593642702749-b7d2a804fbcf?w=400',
        link: 'https://lazada.co.id',
        affiliateLink: 'https://lazada.co.id?af=marketfind2025'
      };
    }

    // Evaluasi produk dengan selector yang sudah diidentifikasi dari struktur HTML terbaru
    const products = await page.evaluate(() => {
      // Gunakan selector container yang paling umum
      const items = document.querySelectorAll('.Bm3ON, [data-qa-locator="product-item"]');
      return Array.from(items).slice(0, 5).map(item => {
        // Nama produk: cari di .RfADt a, prioritaskan atribut title
        const nameLink = item.querySelector('.RfADt a');
        const name = nameLink ? (nameLink.title || nameLink.innerText.trim()) : '';

        // Harga
        const priceEl = item.querySelector('.ooOxS');
        const price = priceEl ? priceEl.innerText.trim() : '0';

        // Link produk
        const linkEl = item.querySelector('a[href*="/products/"]') || item.querySelector('a');
        const link = linkEl ? linkEl.href : '';

        // Gambar utama
        const imgEl = item.querySelector('.picture-wrapper img');
        const image = imgEl ? imgEl.src : '';

        return { name, price, link, image };
      });
    });

    log('Lazada', `Produk ditemukan: ${products.length}`);

    if (products.length === 0) {
      return {
        name: `Laptop MSI Katana (Contoh)`,
        price: 17499000,
        image: 'https://images.unsplash.com/photo-1603302576837-37561b5e8e5c?w=400',
        link: 'https://lazada.co.id',
        affiliateLink: 'https://lazada.co.id?af=marketfind2025'
      };
    }

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0);

    if (withPrice.length === 0) return null;

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
    return {
      name: `Laptop Asus ROG (Contoh)`,
      price: 21999000,
      image: 'https://images.unsplash.com/photo-1603302576837-37561b5e8e5c?w=400',
      link: 'https://lazada.co.id',
      affiliateLink: 'https://lazada.co.id?af=marketfind2025'
    };
  } finally {
    if (browser) await browser.close();
  }
}

// ===================== ENDPOINT UTAMA =====================
app.get('/api/search', async (req, res) => {
  const keyword = req.query.q;
  if (!keyword) {
    return res.status(400).json({ error: 'Parameter "q" diperlukan' });
  }

  console.log(`\n=== Mencari: "${keyword}" ===\n`);

  try {
    const [shopee, tokopedia, lazada] = await Promise.allSettled([
      scrapeShopee(keyword),
      scrapeTokopedia(keyword),
      scrapeLazada(keyword)
    ]);

    const result = {
      shopee: shopee.status === 'fulfilled' ? shopee.value : null,
      tokopedia: tokopedia.status === 'fulfilled' ? tokopedia.value : null,
      lazada: lazada.status === 'fulfilled' ? lazada.value : null
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
