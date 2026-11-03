# SkyCart — Technical Stack

A MERN application: MongoDB, Express, React and Node.js. The client and server are separate packages in one repository.

## Overview

```
Browser (React SPA, Vite)
   |  /api, /uploads
   v
Vite dev proxy (port 5173) ---> Express API (port 5000) ---> MongoDB
                                   |
                                   +--> uploads/ (product images on disk)
                                   +--> SMTP server (optional email)
```

In development the Vite server proxies `/api` and `/uploads` to the API, so the browser talks to one origin.

## Backend (`server/`)

| Piece | Choice | Notes |
|---|---|---|
| Runtime | Node.js | Developed on Node 24; uses ES modules and the built-in test runner |
| Web framework | Express 4 | Routers per area, shared error middleware |
| Database | MongoDB with Mongoose 8 | Local MongoDB or an Atlas connection string |
| Authentication | `jsonwebtoken` 9, `bcryptjs` 2 | 30-day signed tokens, hashed passwords |
| Security | `helmet` 8, `cors`, `express-rate-limit` 7 | Security headers, CORS limited to `CLIENT_URL`, request rate limits |
| File uploads | `multer` 2 | Disk storage in `server/uploads`, served at `/uploads` |
| Email | `nodemailer` 10 | SMTP when configured, console output otherwise |
| Config | `dotenv` | `server/.env` (not committed); `.env.example` lists the settings |
| Tests | `node:test` | No extra test libraries |

### Layout

```
server/
  server.js          starts the API (loads .env, connects to MongoDB)
  app.js             builds the Express app (also used by the tests)
  seed.js            loads sample data
  models/            User, Product, Order, Coupon, Category
  routes/            auth, account, products, categories, orders, admin, reports, upload, seo
  middleware/        auth (protect, staff, requires, admin), error handling
  utils/             pricing, permissions, mailer, csvOut, csvParse
  tests/             api.test.js
```

### Data model

| Collection | Holds |
|---|---|
| `users` | name, email, password hash, role and admin flag, suspended flag, last sign-in, saved addresses, wishlist, saved cart, reset-token hash |
| `products` | name, brand, category, description, image and gallery, price, stock, specs, embedded reviews, rating |
| `categories` | name (unique) |
| `orders` | user, item snapshot (name, image, price, quantity), shipping address, payment method, coupon, totals, tracking, status, return request, refund flag |
| `coupons` | code, type (percent or fixed), value, minimum order, expiry, usage limit and count, active flag |

### API areas

| Prefix | Purpose |
|---|---|
| `/api/auth` | register, login, current identity, forgot and reset password |
| `/api/account` | profile, password, address book, wishlist, saved cart |
| `/api/products` | list and search, detail, related, by-ids, reviews, admin create, update, delete |
| `/api/categories` | public list; admin add, rename, delete |
| `/api/orders` | price quote, create, my orders, detail, cancel, return request; staff list, status, tracking, return decision |
| `/api/admin` | stats, users and roles, coupons, CSV import and export |
| `/api/admin/reports` | sales, products, categories, customers, inventory, coupons, returns (JSON or CSV) |
| `/api/upload` | product image upload |
| `/robots.txt`, `/sitemap.xml` | SEO |

### Key design points

- **Server-side pricing.** `utils/pricing.js` is the only place totals are calculated. The quote and order routes both use it, and client-sent prices are ignored.
- **Atomic stock and coupon claims.** Stock is decremented with a conditional update and rolled back if a later step fails; the same pattern protects coupon usage limits.
- **Role permissions.** `utils/permissions.js` maps roles to permissions. Routes use `requires('<permission>')` from `middleware/auth.js`. The older `isAdmin` flag stays authoritative for admins.
- **Reports.** One route builds each report as columns, rows and a summary with MongoDB aggregations; the same data feeds the screen and the CSV.
- **Testability.** `app.js` exports the app without listening, so tests call it over HTTP with a throwaway port; rate limiting is switched off when `NODE_ENV=test`.

## Frontend (`client/`)

| Piece | Choice | Notes |
|---|---|---|
| UI library | React 18 | Function components and hooks |
| Routing | `react-router-dom` 6 | Protected routes with role permission checks |
| Build tool | Vite 5 with `@vitejs/plugin-react` | Dev server with proxy, production build to `client/dist` |
| Styling | Plain CSS in `src/index.css` | CSS custom properties from the DJI design tokens; dark theme through `data-theme`; print styles for invoices and reports |
| State | React context | Auth, cart, wishlist, compare; no state library |
| Data fetching | `fetch` through `src/api.js` | Small wrapper that adds the token and turns errors into messages |
| Fonts | Open Sans (Google Fonts) | Loaded from `index.html` |

There are no UI component or charting libraries. Charts are drawn with CSS bars.

### Layout

```
client/src/
  main.jsx, App.jsx      providers and routes
  api.js                 fetch wrapper, money format, file download
  context/               Auth, Cart, Wishlist, Compare
  components/            Navbar, ProductCard and helpers, Icons, ThemeToggle, CompareBar
  pages/                 storefront pages
  pages/admin/           dashboard pages (overview, reports, products, orders, users, roles, ...)
  useTitle.js            page title and description
  useCategories.js       category list from the API
```

### Browser storage

`localStorage` holds the signed-in user, cart, compare list, recently viewed products and theme. Every read and write is guarded, and the app works without it.

## Tooling and conventions

- **Package manager:** npm, with a root `package.json` for shortcuts (`install:all`, `seed`, `server`, `client`).
- **Module system:** ES modules on both sides.
- **Tests:** `npm test --prefix server` runs 49 integration tests against `droneshop_test`. The tests refuse to run on a database whose name does not end in `_test`.
- **Version control:** Git; commits carry the project owner's identity only.
- **Assets:** product photos from Wikimedia Commons in `client/public/images/drones/`, credits in `CREDITS.md`; the design system reference is `assets/DESIGN-dji.md`.

## Configuration

| Setting | Where | Purpose |
|---|---|---|
| `PORT` | `server/.env` | API port (default 5000) |
| `MONGO_URI` | `server/.env` | MongoDB connection string |
| `JWT_SECRET` | `server/.env` | Required; signs login tokens |
| `CLIENT_URL` | `server/.env` | Allowed browser origin for CORS |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | `server/.env` | Optional email delivery |
| `MONGO_URI_TEST` | environment | Optional test database; name must end in `_test` |

## Running it

```bash
npm run install:all
npm run seed
npm run server
npm run client
```

The shop is at http://localhost:5173 and the API at http://localhost:5000. MongoDB must be running first.

## Production notes

- Build the client with `npm run build --prefix client` and serve `client/dist` from a web server or CDN; point `/api` and `/uploads` at the API.
- Set a long random `JWT_SECRET`, a real `CLIENT_URL`, and SMTP settings.
- Uploaded images live on the API server's disk. Move them to cloud storage before running more than one server.
- Back up the database; nothing in the project does it.
- Add an online payment provider before taking card payments.
