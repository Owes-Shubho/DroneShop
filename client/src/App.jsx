import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import { Protected } from './components/Bits.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import ProductPage from './pages/ProductPage.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import { MyOrders, OrderDetail } from './pages/Orders.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
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
          <Route path="/checkout" element={<Protected><Checkout /></Protected>} />
          <Route path="/orders" element={<Protected><MyOrders /></Protected>} />
          <Route path="/orders/:id" element={<Protected><OrderDetail /></Protected>} />
          <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
          <Route path="*" element={<p>Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
      </main>
      <footer className="footer">© {new Date().getFullYear()} SkyCart Drone Shop</footer>
    </>
  );
}
