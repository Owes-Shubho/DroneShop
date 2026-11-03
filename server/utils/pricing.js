// Single source of truth for order totals. Used by the quote endpoint and by order creation.
export const FREE_SHIPPING_OVER = 500;
export const SHIPPING_FLAT = 15;
export const TAX_RATE = 0.08;

export const round = (n) => Math.round(n * 100) / 100;

/** Returns the reason a coupon cannot be used for this subtotal, or null if it is valid. */
export function couponProblem(coupon, subtotal, now = new Date()) {
  if (!coupon || !coupon.active) return 'Invalid coupon code';
  if (coupon.expiresAt && coupon.expiresAt < now) return 'This coupon has expired';
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return 'This coupon has been fully redeemed';
  if (subtotal < coupon.minSubtotal) return `Spend at least $${coupon.minSubtotal} to use this coupon`;
  return null;
}

export function totals(itemsPrice, coupon) {
  const raw = coupon ? (coupon.type === 'percent' ? (itemsPrice * coupon.value) / 100 : coupon.value) : 0;
  const discountPrice = round(Math.min(raw, itemsPrice));
  const discounted = round(itemsPrice - discountPrice);
  const shippingPrice = discounted > FREE_SHIPPING_OVER || discounted === 0 ? 0 : SHIPPING_FLAT;
  const taxPrice = round(discounted * TAX_RATE);
  return {
    itemsPrice: round(itemsPrice),
    discountPrice,
    shippingPrice,
    taxPrice,
    totalPrice: round(discounted + shippingPrice + taxPrice),
  };
}
