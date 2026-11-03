import { Router } from 'express';
import Product from '../models/Product.js';

const router = Router();
const site = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /checkout\nAllow: /\n\nSitemap: ${site()}/sitemap.xml\n`);
});

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const products = await Product.find().select('_id updatedAt');
    const pages = ['', '/shop', '/about', '/shipping', '/returns', '/privacy', '/terms', '/contact'];
    const urls = [
      ...pages.map((p) => `<url><loc>${site()}${p}</loc></url>`),
      ...products.map((p) => `<url><loc>${site()}/product/${p._id}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`),
    ];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
  } catch (err) {
    next(err);
  }
});

export default router;
