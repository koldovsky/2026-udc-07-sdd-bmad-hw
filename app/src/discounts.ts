import type { Order, Coupon } from "./types.js";
import { subtotalKopecks, tierPercent, shippingKopecks } from "./pricing.js";

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  shippingKopecks: number;
  totalKopecks: number;
}

export function priceOrder(order: Order, coupons: Coupon[]): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const shipping = shippingKopecks(order);
  
  if (subtotal === 0) {
    return {
      subtotalKopecks: 0,
      tierDiscountKopecks: 0,
      couponDiscountKopecks: 0,
      shippingKopecks: shipping,
      totalKopecks: shipping
    };
  }

  // Tier discount
  const tierPct = tierPercent(order);
  const tierDiscount = Math.round((subtotal * tierPct) / 100);
  
  let remainingSubtotal = subtotal - tierDiscount;
  let totalCouponDiscount = 0;
  
  // Calculate original subtotals per category for category coupons
  const categoryTotals: Record<string, number> = {};
  for (const item of order.items) {
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + (item.unitPriceKopecks * item.quantity);
  }

  // Map requested coupons from the order in the order they were typed
  const couponMap = new Map(coupons.map(c => [c.code, c]));
  const requestedCoupons = order.coupons
    .map(code => couponMap.get(code))
    .filter((c): c is Coupon => c !== undefined);

  // Process valid coupons
  const validCoupons = requestedCoupons.filter(c => {
    if (new Date(c.expiresAt).getTime() <= Date.now()) {
      return false; // AC-2: expired
    }
    if (c.minSubtotalKopecks !== undefined && subtotal < c.minSubtotalKopecks) {
      return false; // AC-6: minSubtotal checks against original subtotal
    }
    return true;
  });

  for (const coupon of validCoupons) {
    let discountAmount = 0;
    
    if (coupon.category) {
      const catTotal = categoryTotals[coupon.category] || 0;
      if (catTotal > 0) {
        if (coupon.kind === "percent") {
          discountAmount = Math.round((catTotal * coupon.value) / 100);
        } else {
          discountAmount = Math.min(coupon.value, catTotal);
        }
      }
    } else {
      if (coupon.kind === "percent") {
        discountAmount = Math.round((remainingSubtotal * coupon.value) / 100);
      } else {
        discountAmount = coupon.value;
      }
    }
    
    if (discountAmount > remainingSubtotal) {
      discountAmount = remainingSubtotal; // AC-4: cap discount
    }
    
    totalCouponDiscount += discountAmount;
    remainingSubtotal -= discountAmount;
  }

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: totalCouponDiscount,
    shippingKopecks: shipping,
    totalKopecks: remainingSubtotal + shipping
  };
}
