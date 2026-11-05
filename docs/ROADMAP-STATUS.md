# SkyCart — Roadmap status

The four-phase plan for SkyCart (single-vendor drone shop on the MERN stack) compared with what is built today. ✅ built · 🟡 partly built · ⬜ not built.

The project was built feature by feature rather than phase by phase, so it is ahead of the plan in some places (reports, user roles, returns, compare) and behind in others (SKU, cost and inventory history, payments, shipping zones, audit log).

## Summary

| Phase | Theme | Status |
|---|---|---|
| 1 | Core e-commerce | Almost done. Missing: store settings page, a real contact form |
| 2 | Business management | About half done. Catalogue basics (SKU, cost, brands, drone fields, SKU import) are in. Missing: variants, compatibility, inventory history, suppliers, shipping zones, online payment, Excel import |
| 3 | Advanced e-commerce and reporting | About half done. Reports, wishlist, compare, related and recently viewed are in; profit, Q&A, newsletter, banners, abandoned cart, notifications are not |
| 4 | Security, production, enterprise | Roles and the basic security layer are in; audit log, refresh tokens, backups, Docker, CI, monitoring and the drone-specific tools are not |

## Technology: plan versus actual

| Plan | Built | Note |
|---|---|---|
| React | React 18 + Vite | Same |
| Node, Express, MongoDB | Same | Same |
| Tailwind CSS | Plain CSS with design tokens | The DJI design system in `assets/` is implemented directly |
| Redux Toolkit | React context | Auth, cart, wishlist, compare are small; Redux is not needed yet |
| JWT + refresh token | One 30-day JWT in `localStorage` | Refresh tokens and httpOnly cookies are Phase 4 work |
| Cloudinary / S3 | Local disk (`server/uploads`) | Fine for one server only |
| Recharts | CSS bar charts | Enough for the current charts |
| Payment gateway | Cash / card on delivery only | bKash, Nagad, SSLCommerz not started |
| Currency | USD | The plan assumes Bangladesh (BDT, Dhaka zones); not configured |
| Modular `modules/` folders | `routes/`, `models/`, `utils/` | Same ideas, flatter layout |

## Phase 1 — Core e-commerce

| Item | Status | Notes |
|---|---|---|
| Home, header, footer, category navigation | ✅ | Categories are on the home page and the shop filter; no category menu in the header |
| Listing, details, gallery, search, filters, sorting | ✅ | |
| Cart, checkout, order confirmation | ✅ | |
| Register, login, forgot password, profile, order history | ✅ | |
| About and contact pages | 🟡 | Contact is text only; no form or stored inquiries |
| Dashboard, product CRUD, category CRUD, image upload | ✅ | |
| Brand CRUD | ✅ | Name, logo, description; products must use a listed brand |
| Basic stock management | ✅ | Edit in place, low-stock list |
| Orders: list, details, status | ✅ | |
| Customers: list and details | ✅ | |
| Store configuration | ⬜ | Shipping ($15, free over $500) and tax (8%) are constants in `server/utils/pricing.js` |
| Validation and central error handling | 🟡 | Hand-written checks; no validation library |

## Phase 2 — Business management

| Item | Status | Notes |
|---|---|---|
| Product variants | ⬜ | |
| Drone-specific specifications | ✅ | Four fixed fields plus free-form attributes (Motor KV, battery capacity, propeller size, ...), model number, part number, condition, warranty |
| Compatibility management | ⬜ | |
| SKU, purchase cost, margin | ✅ | Unique SKU (generated if blank), cost visible to staff only, margin shown on the product form. Barcode not built |
| Inventory tracking, adjustments, low-stock alerts | 🟡 | Stock count, edit in place, low-stock list; no reason codes or alerts |
| Inventory movement log, suppliers | ⬜ | |
| CSV import and export | ✅ | Matches by SKU (or name + brand when there is no SKU); optional cost, model, condition, warranty and spec: columns; per-row error report |
| Excel import and export | ⬜ | |
| Duplicate-SKU check | ✅ | Inside the file and against existing products |
| Import template, preview, history, rollback | ⬜ | Valid rows are applied immediately; invalid rows are skipped and listed |
| Bulk price and stock updates | 🟡 | Possible through a CSV update |
| Order flow: cancel, tracking, invoice | ✅ | |
| Order confirmation step, packed / out-for-delivery statuses | ⬜ | Statuses are Processing, Shipped, Delivered, Cancelled |
| Packing slips, internal order notes | ⬜ | |
| Separate payment status | 🟡 | A paid flag on the order |
| Returns and refunds | ✅ | Request, approve, reject, refund with restock; no money moves |
| Multiple addresses, suspend / reinstate customers | ✅ | |
| Customer segmentation, groups | ⬜ | |
| Coupons: percent, fixed, minimum, usage limit, expiry, report | ✅ | |
| Coupons: free shipping, category / product specific, first order, per-customer limit | ⬜ | |
| Shipping zones, configurable delivery charges, courier | ⬜ | |
| Cash / card on delivery | ✅ | |
| Online payment, transaction records, verification | ⬜ | Needs a gateway account |

## Phase 3 — Advanced e-commerce and intelligence

| Item | Status | Notes |
|---|---|---|
| Wishlist, comparison, related, recently viewed | ✅ | |
| Reviews and ratings | 🟡 | Not limited to verified buyers; no photos |
| Product Q&A, frequently bought together | ⬜ | |
| Advanced search, suggestions | 🟡 | Text search only |
| Back-in-stock alerts, newsletter | ⬜ | |
| Reports: sales, products, categories, customers, inventory, coupons, returns | ✅ | CSV export and print / PDF |
| Profit and cost reports | ⬜ | Needs purchase cost on products |
| Payment and delivery reports, date-range comparison | ⬜ | |
| Excel and true PDF export | ⬜ | CSV and browser print only |
| Banners, campaigns, abandoned-cart reminders | ⬜ | The cart is saved on the server, so reminders are feasible |
| robots.txt, sitemap, per-page titles | ✅ | |
| Open Graph, SEO fields per product, slugs | ⬜ | |
| Emails: order placed, shipped, cancelled, password reset | 🟡 | Print to the console until SMTP is configured; no payment or delivered email |
| Admin notification center | ⬜ | |

## Phase 4 — Security, production, enterprise

| Item | Status | Notes |
|---|---|---|
| Multiple admin accounts, RBAC | 🟡 | Fixed roles: Support, Manager, Admin, enforced on the server. The plan's Product / Order / Inventory / Support Manager and Report Viewer are not separate roles |
| Activity log, login history, session management | ⬜ | Only last sign-in time is stored |
| Password hashing, rate limiting, security headers, CORS | ✅ | |
| Secure upload validation | ✅ | |
| Refresh token rotation, httpOnly cookies | ⬜ | |
| Blanket input sanitising, brute-force lockout | 🟡 | Type checks on sign-in input; limits are per IP |
| Backups and restore testing | ⬜ | |
| Purchase orders, goods receiving, multi-warehouse, RMA, repair tracking | ⬜ | |
| Serial numbers, warranty registration, support tickets | ⬜ | |
| Drone tools: compatibility database / checker, builder, manuals | ⬜ | Comparison exists |
| Integrations: gateways, courier, SMS, analytics, cloud storage | ⬜ | |
| Docker, Nginx, CI/CD, monitoring, load testing | ⬜ | |
| Automated tests | 🟡 | 59 API tests; no browser tests |

## Business rules check

| Rule | Status |
|---|---|
| Never oversell | ✅ Atomic stock claims, tested with concurrent orders |
| Re-validate price and stock at checkout | ✅ |
| Order snapshots of name, image and price | ✅ |
| Coupons validated on the server | ✅ |
| Permissions enforced on the server | ✅ |
| Restock only when appropriate | ✅ On cancel and refund |
| SKU unique | ✅ |
| Cost and selling price separate | ✅ Cost is staff-only; orders do not yet store the cost at time of sale, so a profit report is still to do |
| Separate refund record | 🟡 Stored on the order |
| Verified-purchase reviews | ⬜ |
| Whole import validated before applying | ⬜ Row by row |

## Suggested order for the rest

1. **Catalogue foundation (Phase 2): done.** SKU, purchase cost, brand management, drone specification fields and SKU-based import are in.
2. **Inventory and orders:** stock movement log with reasons, supplier list, extra order statuses and notes, packing slip.
3. **Shipping and store settings:** shipping zones and charges, tax, currency and store details editable in the dashboard instead of code.
4. **Compatibility:** which drone models a battery, motor or propeller fits, shown on the product page.
5. **Payments:** gateway integration once there is an account (needs keys, webhooks, and a decision on bKash / Nagad / SSLCommerz or card).
6. **Hardening (Phase 4):** audit log, refresh tokens, backups, Docker and CI.
