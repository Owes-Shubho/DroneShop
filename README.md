# SkyCart — MERN Drone Shop

Full-stack e-commerce app: **MongoDB + Express + React (Vite) + Node**.

## Features
- Browse/search/filter/sort/paginate drones, product pages with specs and reviews
- Cart (persisted in localStorage), checkout, order history
- JWT auth (register/login), bcrypt-hashed passwords
- Server-side price calculation and atomic stock decrement on order
- Admin dashboard: create/edit/delete products, update order status

## Setup
Requires Node 18+ and a MongoDB instance (local, or a free MongoDB Atlas URI).

```bash
npm run install:all
cp server/.env.example server/.env   # edit MONGO_URI and JWT_SECRET
npm run seed                         # sample products + demo users
```

Run in two terminals:

```bash
npm run server   # API on http://localhost:5000
npm run client   # App on http://localhost:5173
```

## Demo accounts (from seed)
- Admin: `admin@droneshop.com` / `admin123`
- Customer: `user@droneshop.com` / `user123`

## API
| Route | Access |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | public / user |
| `GET /api/products`, `/top`, `/:id` | public |
| `POST/PUT/DELETE /api/products[/:id]` | admin |
| `POST /api/products/:id/reviews` | user |
| `POST /api/orders`, `GET /api/orders/mine`, `GET /api/orders/:id` | user |
| `GET /api/orders`, `PUT /api/orders/:id/status` | admin |
