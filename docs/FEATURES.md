# SkyCart — Features

What the shop does today. For the wider e-commerce checklist, including what is not built, see [ecommerce-feature-list.md](ecommerce-feature-list.md).

## Storefront

| Area | Features |
|---|---|
| Browsing | Home page with banner, category tiles and top-rated products; shop page with category and price filters, sorting (newest, price, rating) and paging |
| Search | Header search over product name, brand and description |
| Product page | Photo gallery with thumbnails, price, stock level, specs (flight time, range, camera, weight), quantity picker, Add to cart, Buy now |
| Reviews | Signed-in users leave one rating and comment per product; average rating shown on cards |
| Discovery | Related products ("You may also like"), recently viewed, wishlist hearts, side-by-side compare of up to 4 drones |
| Look and feel | Design based on the DJI design system in `assets/`, responsive layout, dark and light theme switch (remembers your choice, no flash on load), per-page titles |
| Help pages | About, Shipping, Returns, Privacy, Terms, Contact. The wording is starter text and needs review before launch |

## Cart and checkout

- Cart kept in the browser; for signed-in customers it is also saved to the account and merged on sign-in, so it follows them between devices. Signing out empties it.
- Stock limits enforced in the cart and again on the server.
- Saved address book (add, edit, delete, default) usable at checkout.
- Coupon codes: percent or fixed amount, minimum order, usage limit, expiry date.
- Server-calculated pricing: free shipping over $500, otherwise a $15 flat rate; 8% tax on the discounted amount. The browser cannot set prices.
- Payment: Cash on Delivery or Card on Delivery. There is no online payment yet.
- Order confirmation page and email.

## Customer account

- Register, sign in, profile, change password.
- Forgot password: emailed link, one hour, single use.
- Order history and order detail with status, tracking number and link.
- Cancel an order while it is still processing (stock and coupon use are restored).
- Request a return within 30 days of delivery and follow its status.
- Printable invoice (Print, then Save as PDF).
- Wishlist page.

## Admin dashboard (`/admin`)

| Section | What you can do | Needs permission |
|---|---|---|
| Overview | Revenue, orders, products and customers, last 7 days sales chart, orders by status, low-stock list, best sellers, recent orders | `dashboard` |
| Reports | Seven reports with date ranges, charts, CSV export and print (below) | `reports` |
| Products | Add, edit, delete; upload a main photo and up to 8 gallery photos; edit stock in place; filter by category or stock; export CSV; import CSV | `products` |
| Categories | Add, rename (products move with it), delete empty categories | `products` |
| Orders | Filter by status, change status, add carrier and tracking number (marks the order shipped), handle return requests (approve, reject, refund), export CSV | `orders` |
| Coupons | Create, edit, switch on or off, delete | `coupons` |
| Users | Search, filter by role and status, add users, edit profile, suspend or reinstate, send a password-reset link, delete; detail page with order totals, addresses and recent orders | `users.view`, `users.manage` |
| Roles | Table of what each role can do and how many people hold it | `users.view` |

### Reports

Sales (by day, week or month), products, categories, customers, inventory, coupons and returns. Revenue counts orders that are not cancelled and not refunded; cancellations and refunds are reported separately. Every report exports to CSV, and Print gives a clean page for saving as PDF.

### Roles and permissions

Roles are fixed in `server/utils/permissions.js`. The server checks them on every dashboard request, and the dashboard menu only shows what a role can reach.

| Role | Can do |
|---|---|
| Customer | Shop only |
| Support | Orders, shipments, returns; look up users |
| Manager | Support's access plus overview, reports, products, categories and coupons |
| Admin | Everything, including users and roles |

Safeguards: you cannot suspend, delete or change the role of your own account. A suspended account cannot sign in, and a session it already has open stops working. A role change shows up the next time the app loads, with no need to sign in again.

## Security and reliability

- Passwords hashed with bcrypt; sign-in uses a signed token valid for 30 days.
- Rate limits: 600 requests per 15 minutes on the API, 20 per 15 minutes on sign-in, register and reset.
- Security headers (helmet), 100 kb request size limit, input checks, and protection against clients setting fields they should not (for example a product's rating or reviews).
- Orders reserve stock atomically, so the last units cannot be oversold; a failed order undoes any reservation.
- Image uploads limited to JPG, PNG and WebP up to 5 MB, with the file extension taken from the verified type.
- CSV exports neutralise spreadsheet formulas. Tracking links must be http or https.
- 49 automated API tests run against a separate `_test` database.

## Email

Order placed, shipped, cancelled and password reset. Without `SMTP_*` settings the emails are printed to the server console instead of being sent.

## SEO

`robots.txt`, a sitemap listing pages and every product, and a title and description for each page. Open Graph tags and server-side rendering are not done.

## Sample data

`npm run seed` loads 18 products (9 real DJI, Autel, Parrot and Yuneec drones with photos plus other drones and accessories), 2 users, 2 coupons and the categories. See [drone-catalog.md](drone-catalog.md) for the product list.

| Account | Email | Password |
|---|---|---|
| Admin | `admin@droneshop.com` | `admin123` |
| Customer | `user@droneshop.com` | `user123` |

Coupons: `WELCOME10` (10% off), `SAVE50` ($50 off orders over $500). Change these passwords before any real deployment.

## Not built

Online payment, real email service setup, guest checkout, product variants, shipping zones and regional tax, brand management, email verification, two-factor sign-in, editable roles, audit log, multi-currency and language, cloud image storage, database backups, and browser-level UI tests.
