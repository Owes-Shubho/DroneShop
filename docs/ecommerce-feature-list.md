# E-commerce feature list — SkyCart

A standard feature checklist for an online shop, with the current status of this project.

**Status key:** ✅ built · 🟡 partly built · ⬜ not built
**Priority key:** **P1** needed to take real orders · **P2** expected by most shoppers · **P3** nice to have

## 1. Catalog and discovery

| Feature | Status | Priority | Notes |
|---|---|---|---|
| Product listing with images, price, brand | ✅ | P1 | Cards with stock tags |
| Product detail page with description and specs | ✅ | P1 | Four spec fields (flight time, range, camera, weight) |
| Categories | ✅ | P1 | Admin can add, rename (products move with it) and delete empty categories |
| Search | 🟡 | P1 | Text search on name, brand, description; no typo tolerance or suggestions |
| Filters (category, price range) | ✅ | P1 | Brand and rating filters missing |
| Sorting (newest, price, rating) | ✅ | P2 | |
| Pagination | ✅ | P1 | |
| Multiple images / gallery per product | ✅ | P2 | Main image plus up to 8 gallery photos, with thumbnails on the product page |
| Product variants (colour, bundle, battery pack) | ⬜ | P2 | |
| Related / recommended products | ✅ | P3 | Same category first, then same brand |
| Recently viewed | ✅ | P3 | Kept in the visitor's browser |
| Product comparison | ✅ | P3 | Pick up to 4 drones, compare specs side by side |
| Ratings and reviews | 🟡 | P2 | Logged-in users, one review each; admins can remove reviews; not limited to buyers, no photos |

## 2. Cart and checkout

| Feature | Status | Priority | Notes |
|---|---|---|---|
| Add, change quantity, remove | ✅ | P1 | Stored in the browser |
| Cart saved to the account (syncs across devices) | ✅ | P2 | Merged with the browser cart on sign-in; cleared on sign-out |
| Stock limit enforced in cart | ✅ | P1 | Re-checked on the server when ordering |
| Guest checkout | ⬜ | P2 | Account is required today |
| Shipping address form | ✅ | P1 | |
| Saved addresses / address book | ✅ | P2 | Add, edit, delete, default; pick one at checkout or save from checkout |
| Shipping cost rules | 🟡 | P1 | Flat $15, free over $500; no carriers, zones or weight rates |
| Tax calculation | 🟡 | P1 | Flat 8%; no per-region rules |
| Coupons and discount codes | ✅ | P2 | Percent or fixed, minimum order, usage limit, expiry; validated on the server |
| Order summary and server-side price check | ✅ | P1 | Checkout shows a server-calculated quote; the order total is recomputed again on creation |
| Online payment (card, wallet) | ⬜ | P1 | Cash/Card on delivery only |
| Order confirmation page | ✅ | P1 | |

## 3. Accounts and security

| Feature | Status | Priority | Notes |
|---|---|---|---|
| Register and log in | ✅ | P1 | JWT, bcrypt-hashed passwords |
| Roles (customer, admin) | ✅ | P1 | |
| Forgot / reset password | ✅ | P1 | One-hour single-use link; email goes to the server console until SMTP is configured |
| Email verification | ⬜ | P2 | |
| Profile and change password | ✅ | P2 | Account page |
| Order history and order detail | ✅ | P1 | |
| Wishlist / saved items | ✅ | P2 | Heart on cards and product page; wishlist page |
| Rate limiting on login and API | ✅ | P1 | 20 attempts per 15 min on auth routes, 600 per 15 min on the API |
| Security headers (helmet), input sanitising | ✅ | P1 | helmet, 100 kb body limit, type checks on auth input, mass-assignment fields stripped |
| Token storage hardening (httpOnly cookie) | ⬜ | P2 | Token is in localStorage today |
| Two-factor login for admins | ⬜ | P3 | |

## 4. Orders and fulfilment

| Feature | Status | Priority | Notes |
|---|---|---|---|
| Order statuses (processing, shipped, delivered, cancelled) | ✅ | P1 | |
| Stock reduced on order, restored on cancel | ✅ | P1 | |
| Customer self-service cancel | ✅ | P2 | While the order is still processing; restores stock and coupon use |
| Shipment tracking number and carrier link | ✅ | P1 | Admin adds carrier, number and link; shown to the customer; marks the order shipped |
| Invoice / receipt PDF | ✅ | P2 | Print-friendly invoice page; use Print → Save as PDF |
| Returns and refunds workflow | ✅ | P2 | Customer requests within 30 days of delivery; admin approves, rejects or refunds (refund restocks). Money is not moved: there is no online payment yet |
| Email / SMS notifications (confirmation, shipped) | 🟡 | P1 | Order placed, shipped, cancelled and password reset emails are built; they print to the server console until SMTP is set. No SMS |
| Packing slip / label printing | ⬜ | P3 | |

## 5. Admin dashboard

| Feature | Status | Priority | Notes |
|---|---|---|---|
| Sales overview (revenue, orders, 7-day chart) | ✅ | P1 | |
| Product add, edit, delete | ✅ | P1 | |
| Image upload | ✅ | P1 | JPG, PNG, WebP up to 5 MB, stored on the server's disk |
| Quick stock edit and low-stock list | ✅ | P1 | |
| Order list, filter, status change | ✅ | P1 | |
| Customer list, role change, delete | ✅ | P2 | |
| Best-seller report | ✅ | P2 | |
| Category and brand management | 🟡 | P2 | Categories done; brands are free text |
| Bulk import / export (CSV) | ✅ | P2 | Export orders and products (spreadsheet-safe); import products with per-row error report |
| Review moderation | ✅ | P2 | Admins can remove a review from the product page |
| Discount / coupon management | ✅ | P2 | Admin page: create, edit, turn on/off, delete |
| Reports by date range, export | ⬜ | P2 | |
| Activity / audit log | ⬜ | P3 | |
| Staff roles with limited permissions | ⬜ | P3 | |

## 6. Content, SEO and marketing

| Feature | Status | Priority | Notes |
|---|---|---|---|
| Responsive design (phone, tablet, desktop) | ✅ | P1 | |
| Dark and light theme | ✅ | P3 | |
| Page titles, meta descriptions, Open Graph | 🟡 | P2 | Per-page titles and descriptions; Open Graph tags and server rendering not done |
| Sitemap and robots.txt | ✅ | P2 | Served by the API: lists pages and every product |
| Static pages (About, Contact, Shipping, Returns, Privacy, Terms) | ✅ | P1 | About, Shipping, Returns, Privacy, Terms, Contact — starter text, review before launch |
| Newsletter signup | ⬜ | P3 | |
| Banners / promotions managed from admin | ⬜ | P3 | Home banner is hard-coded |
| Analytics and conversion tracking | ⬜ | P2 | |

## 7. Platform and quality

| Feature | Status | Priority | Notes |
|---|---|---|---|
| Server-side validation and error messages | 🟡 | P1 | Checks on auth, orders, coupons, uploads; no schema validation library |
| Automated tests (API and UI) | 🟡 | P1 | 33 API tests (pricing, auth, accounts, orders, coupons, admin, categories, cart, returns, import); no UI tests |
| Image optimisation and CDN | ⬜ | P2 | Images are served as uploaded |
| Cloud file storage for uploads | ⬜ | P1 | Needed once the server is not a single machine |
| Environment config and secrets | ✅ | P1 | `.env`, git-ignored |
| Logging and error monitoring | ⬜ | P2 | |
| Database backups | ⬜ | P1 | |
| Accessibility (keyboard, contrast, labels) | 🟡 | P2 | Basic labels and focus styles; not audited |
| Multi-currency, multi-language | ⬜ | P3 | USD and English only |

## Suggested build order (what is left)

1. **Take real orders safely (P1):** online payments (needs a payment-provider account and keys), a real SMTP service for email, database backups, cloud storage for uploaded images.
2. **Raise conversion (P2):** guest checkout, product variants, shipping zones/carrier rates and regional tax, brand management.
3. **Grow (P3):** staff roles, two-factor login for admins, multi-currency and language.
