import { Link, useParams, Navigate } from 'react-router-dom';
import useTitle from '../useTitle.js';

// NOTE: policy wording below is starter text. Have the shop owner (and, for Privacy/Terms, a lawyer) review it before launch.
const pages = {
  about: {
    title: 'About SkyCart',
    body: [
      ['', 'SkyCart is a drone shop for beginners, creators and professionals. We stock camera drones, FPV racers, toy drones, industrial and agricultural drones, and the accessories to go with them.'],
      ['What we care about', 'Honest specs, fair prices and drones that are ready to fly. Every listing shows flight time, range, camera and weight so you can compare before you buy.'],
    ],
  },
  shipping: {
    title: 'Shipping',
    body: [
      ['Rates', 'Orders over $500 ship free. Smaller orders ship for a flat $15. Sales tax of 8% is added at checkout.'],
      ['Processing', 'Orders are processed in 1–2 business days. You get an email when your order ships, with the carrier and tracking number.'],
      ['Tracking', 'Once shipped, the tracking details also appear on your order page under My orders.'],
      ['Changes and cancellations', 'You can cancel an order yourself while it is still processing. After it ships, use our returns process.'],
    ],
  },
  returns: {
    title: 'Returns',
    body: [
      ['30-day returns', 'Return unused products in their original packaging within 30 days of delivery for a refund of the item price.'],
      ['Damaged or faulty items', 'Contact us within 7 days with your order number and photos and we will replace or refund the item.'],
      ['How to start a return', 'Email support@skycart.example with your order number. We will reply with return instructions.'],
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: [
      ['What we collect', 'Your name, email, shipping addresses and order history, so we can process and deliver your orders and let you sign in.'],
      ['How we use it', 'To fulfil orders, send order and shipping emails, and reset your password. We do not sell your data.'],
      ['Your choices', 'You can edit your details and saved addresses in your account at any time. To delete your account, contact support.'],
      ['Security', 'Passwords are stored hashed. Payment is made on delivery, so we do not store card details.'],
    ],
  },
  terms: {
    title: 'Terms of service',
    body: [
      ['Orders', 'An order is accepted when we send a shipping confirmation. Prices and availability can change; the price you see at checkout is the price you pay.'],
      ['Using drones responsibly', 'You are responsible for following the aviation rules, registration and licensing requirements that apply where you fly.'],
      ['Liability', 'To the extent the law allows, our liability is limited to the price paid for the product.'],
    ],
  },
  contact: {
    title: 'Contact us',
    body: [
      ['Support', 'Email support@skycart.example. We reply within one business day.'],
      ['Orders', 'Have your order number ready. You can find it under My orders.'],
    ],
  },
};

export const infoSlugs = Object.keys(pages);

export default function Info({ slug: fixed }) {
  const params = useParams();
  const slug = fixed || params.slug;
  const page = pages[slug];
  useTitle(page?.title);
  if (!page) return <Navigate to="/" replace />;
  return (
    <article className="info">
      <h1>{page.title}</h1>
      {page.body.map(([h, text]) => (
        <section key={h || text}>
          {h && <h3>{h}</h3>}
          <p>{text}</p>
        </section>
      ))}
      <p className="muted">Questions? <Link to="/contact">Contact us</Link>.</p>
    </article>
  );
}
