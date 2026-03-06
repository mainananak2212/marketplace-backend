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

// ===================== SHOPEE (UPDATED SELECTOR) =====================
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
    
    // Set timeout lebih panjang
    await page.goto(`https://shopee.co.id/search?keyword=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    // Coba beberapa selector alternatif
    const selectors = [
      '[data-sqe="item"]',
      '.shopee-search-item-result__item',
      '.col-xs-2-4',
      '.row.shopee-search-item-result__items .col-xs-2-4'
    ];

    let found = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        log('Shopee', `Selector ditemukan: ${selector}`);
        found = true;
        break;
      } catch (e) {
        log('Shopee', `Selector tidak ditemukan: ${selector}`);
      }
    }

    if (!found) {
      log('Shopee', 'Tidak ada selector yang cocok');
      return null;
    }

    const products = await page.evaluate(() => {
      // Coba berbagai kemungkinan selector item
      const possibleItemSelectors = [
        '[data-sqe="item"]',
        '.shopee-search-item-result__item',
        '.col-xs-2-4'
      ];
      
      let items = [];
      for (const sel of possibleItemSelectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          items = found;
          break;
        }
      }

      return Array.from(items).slice(0, 5).map(item => {
        // Coba berbagai selector untuk nama
        const nameSelectors = ['.ZEgDH9', '.CDDksN', 'div[data-sqe="name"]', '.product-name'];
        let name = '';
        for (const sel of nameSelectors) {
          const el = item.querySelector(sel);
          if (el) {
            name = el.innerText;
            break;
          }
        }

        // Selector harga
        const priceSelectors = ['.HP1U1L', '.ZEgDH9', '.price', 'span[data-sqe="price"]'];
        let price = '0';
        for (const sel of priceSelectors) {
          const el = item.querySelector(sel);
          if (el) {
            price = el.innerText;
            break;
          }
        }

        // Link dan gambar
        const link = item.querySelector('a')?.href || '';
        const image = item.querySelector('img')?.src || '';

        return { name, price, link, image };
      });
    });

    log('Shopee', `Produk ditemukan: ${products.length}`);

    if (products.length === 0) {
      // Fallback data dummy untuk testing
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
    // Return dummy data jika error
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

// ===================== TOKOPEDIA (UPDATED) =====================
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

    // Selector terbaru Tokopedia
    const selectors = [
      '.css-12sieg3',
      '[data-testid="lstCL2ProductList"]',
      '.unf-product',
      '.pcv3__container'
    ];

    let found = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        log('Tokopedia', `Selector ditemukan: ${selector}`);
        found = true;
        break;
      } catch (e) {
        log('Tokopedia', `Selector tidak ditemukan: ${selector}`);
      }
    }

    if (!found) {
      return {
        name: `Laptop Lenovo (Contoh Tokopedia)`,
        price: 11499000,
        image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400',
        link: 'https://tokopedia.com',
        affiliateLink: 'https://tokopedia.com?af=marketfind2025'
      };
    }

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.css-12sieg3, [data-testid="lstCL2ProductList"]');
      return Array.from(items).slice(0, 5).map(item => {
        const name = item.querySelector('.prd_link-product-name, .unf-product__name')?.innerText || '';
        const price = item.querySelector('.prd_link-product-price, .unf-product__price')?.innerText || '0';
        const link = item.querySelector('a')?.href || '';
        const image = item.querySelector('img')?.src || '';
        return { name, price, link, image };
      });
    });

    if (products.length === 0) {
      return {
        name: `Laptop HP Pavilion (Contoh)`,
        price: 12499000,
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

// ===================== LAZADA (UPDATED) =====================
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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto(`https://www.lazada.co.id/catalog/?q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

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

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.Bm3ON, [data-qa-locator="product-item"]');
      return Array.from(items).slice(0, 5).map(item => {
        const name = item.querySelector('.RfADt, .c16H9d')?.innerText || '';
        const price = item.querySelector('.ooOxS, .c13VH6')?.innerText || '0';
        const link = item.querySelector('a')?.href || '';
        const image = item.querySelector('img')?.src || '';
        return { name, price, link, image };
      });
    });

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
