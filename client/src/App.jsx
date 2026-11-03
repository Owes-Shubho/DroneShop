import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import { Protected } from './components/Bits.jsx';
import { Drone, Check } from './components/Icons.jsx';
import { useCart } from './context/CartContext.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import ProductPage from './pages/ProductPage.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/AuthPages.jsx';
import Account from './pages/Account.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Invoice from './pages/Invoice.jsx';
import Info from './pages/Info.jsx';
import Coupons from './pages/admin/Coupons.jsx';
import { MyOrders, OrderDetail } from './pages/Orders.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import Overview from './pages/admin/Overview.jsx';
import AdminProducts from './pages/admin/Products.jsx';
import ProductForm from './pages/admin/ProductForm.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import Users from './pages/admin/Users.jsx';

export default function App() {
  const { notice } = useCart();
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          {['about', 'shipping', 'returns', 'privacy', 'terms', 'contact'].map((s) => (
            <Route key={s} path={`/${s}`} element={<Info slug={s} />} />
          ))}
          <Route path="/account" element={<Protected><Account /></Protected>} />
          <Route path="/wishlist" element={<Protected><Wishlist /></Protected>} />
          <Route path="/orders/:id/invoice" element={<Protected><Invoice /></Protected>} />
          <Route path="/checkout" element={<Protected><Checkout /></Protected>} />
          <Route path="/orders" element={<Protected><MyOrders /></Protected>} />
          <Route path="/orders/:id" element={<Protected><OrderDetail /></Protected>} />
          <Route path="/admin" element={<Protected adminOnly><AdminLayout /></Protected>}>
            <Route index element={<Overview />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/:id" element={<ProductForm />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="users" element={<Users />} />
          </Route>
          <Route path="*" element={<p>Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
      </main>

      {notice && (
        <div className="toast" role="status" key={notice.id}>
          <Check width={18} height={18} /> {notice.name} added to cart <Link to="/cart">View cart</Link>
        </div>
      )}

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Link to="/" className="logo"><span className="logo-mark"><Drone width={18} height={18} /></span>SkyCart</Link>
              <p>Camera, racing, industrial and beginner drones, with the accessories to match.</p>
            </div>
            <div>
              <h4>Shop</h4>
              <Link to="/shop?category=Camera%20Drones">Camera drones</Link>
              <Link to="/shop?category=Racing%20Drones">Racing drones</Link>
              <Link to="/shop?category=Toy%20Drones">Toy drones</Link>
              <Link to="/shop?category=Accessories">Accessories</Link>
            </div>
            <div>
              <h4>Account</h4>
              <Link to="/login">Sign in</Link>
              <Link to="/orders">My orders</Link>
              <Link to="/wishlist">Wishlist</Link>
              <Link to="/cart">Cart</Link>
            </div>
            <div>
              <h4>Help</h4>
              <Link to="/shipping">Shipping</Link>
              <Link to="/returns">Returns</Link>
              <Link to="/about">About us</Link>
              <Link to="/contact">Contact</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} SkyCart Drone Shop</span>
            <span>Product photos from Wikimedia Commons contributors (credits in the project's CREDITS.md)</span>
          </div>
        </div>
      </footer>
    </>
  );
}
