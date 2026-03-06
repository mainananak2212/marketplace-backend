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

// ===================== SHOPEE =====================
async function scrapeShopee(keyword) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(`https://shopee.co.id/search?keyword=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 10000,
    });

    // Tunggu selector produk muncul
    await page.waitForSelector('[data-sqe="item"]', { timeout: 10000 });

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-sqe="item"]');
      return Array.from(items).slice(0, 5).map(item => {
        const name = item.querySelector('.ZEgDH9')?.innerText || '';
        const priceEl = item.querySelector('.HP1U1L');
        const price = priceEl ? priceEl.innerText : '0';
        const link = item.querySelector('a')?.href || '';
        const image = item.querySelector('img')?.src || '';
        return { name, price, link, image };
      });
    });

    if (products.length === 0) return null;

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0);

    if (withPrice.length === 0) return null;

    const cheapest = withPrice.reduce((min, p) => p.priceNum < min.priceNum ? p : min, withPrice[0]);

    // Ganti dengan link afiliasi Anda nanti
    const affiliateLink = cheapest.link + '?af=marketfind2025';

    return {
      name: cheapest.name,
      price: cheapest.priceNum,
      image: cheapest.image,
      link: cheapest.link,
      affiliateLink
    };
  } catch (err) {
    console.error('Shopee error:', err);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ===================== TOKOPEDIA =====================
async function scrapeTokopedia(keyword) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(`https://www.tokopedia.com/search?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 10000,
    });

    await page.waitForSelector('.css-12sieg3', { timeout: 10000 });

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.css-12sieg3');
      return Array.from(items).slice(0, 5).map(item => {
        const name = item.querySelector('.prd_link-product-name')?.innerText || '';
        const priceEl = item.querySelector('.prd_link-product-price');
        const price = priceEl ? priceEl.innerText : '0';
        const link = item.querySelector('a')?.href || '';
        const image = item.querySelector('img')?.src || '';
        return { name, price, link, image };
      });
    });

    if (products.length === 0) return null;

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0);

    if (withPrice.length === 0) return null;

    const cheapest = withPrice.reduce((min, p) => p.priceNum < min.priceNum ? p : min, withPrice[0]);

    const affiliateLink = cheapest.link + '?af=marketfind2025';

    return {
      name: cheapest.name,
      price: cheapest.priceNum,
      image: cheapest.image,
      link: cheapest.link,
      affiliateLink
    };
  } catch (err) {
    console.error('Tokopedia error:', err);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ===================== LAZADA =====================
async function scrapeLazada(keyword) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(`https://www.lazada.co.id/catalog/?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 10000,
    });

    await page.waitForSelector('.Bm3ON', { timeout: 10000 });

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.Bm3ON');
      return Array.from(items).slice(0, 5).map(item => {
        const name = item.querySelector('.RfADt')?.innerText || '';
        const priceEl = item.querySelector('.ooOxS');
        const price = priceEl ? priceEl.innerText : '0';
        const link = item.querySelector('a')?.href || '';
        const image = item.querySelector('img')?.src || '';
        return { name, price, link, image };
      });
    });

    if (products.length === 0) return null;

    const withPrice = products.map(p => ({
      ...p,
      priceNum: extractPrice(p.price)
    })).filter(p => p.priceNum > 0);

    if (withPrice.length === 0) return null;

    const cheapest = withPrice.reduce((min, p) => p.priceNum < min.priceNum ? p : min, withPrice[0]);

    const affiliateLink = cheapest.link + '?af=marketfind2025';

    return {
      name: cheapest.name,
      price: cheapest.priceNum,
      image: cheapest.image,
      link: cheapest.link,
      affiliateLink
    };
  } catch (err) {
    console.error('Lazada error:', err);
    return null;
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

  try {
    // Jalankan scraping paralel
    const [shopee, tokopedia, lazada] = await Promise.allSettled([
      scrapeShopee(keyword),
      scrapeTokopedia(keyword),
      scrapeLazada(keyword)
    ]);

    res.json({
      shopee: shopee.status === 'fulfilled' ? shopee.value : null,
      tokopedia: tokopedia.status === 'fulfilled' ? tokopedia.value : null,
      lazada: lazada.status === 'fulfilled' ? lazada.value : null
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan internal' });
  }
});

// Untuk local testing (tidak digunakan di Vercel)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

// Export untuk Vercel
module.exports = app;
