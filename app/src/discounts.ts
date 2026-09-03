import type { Coupon, LineItem, Order } from "./types.js";
import {
  lineTotalKopecks,
  shippingKopecks,
  subtotalKopecks,
  tierPercent,
} from "./pricing.js";

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  shippingKopecks: number;
  totalKopecks: number;
}

export class ExpiredCouponError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Coupon ${code} has expired`);
    this.name = "ExpiredCouponError";
    this.code = code;
  }
}

const CATEGORY_ORDER: LineItem["category"][] = ["standard", "fresh", "digital"];

type CategoryBuckets = Map<LineItem["category"], number>;

/** Single rounding site for all percentage discounts. */
function percentOfCeil(baseKopecks: number, percent: number): number {
  return Math.ceil((baseKopecks * percent) / 100);
}

function buildBuckets(order: Order): CategoryBuckets {
  const buckets: CategoryBuckets = new Map();
  for (const category of CATEGORY_ORDER) {
    buckets.set(category, 0);
  }
  for (const line of order.items) {
    buckets.set(line.category, (buckets.get(line.category) ?? 0) + lineTotalKopecks(line));
  }
  return buckets;
}

function orderWideRemaining(buckets: CategoryBuckets): number {
  let total = 0;
  for (const amount of buckets.values()) {
    total += amount;
  }
  return total;
}

function resolveCoupons(typedCodes: string[], catalogue: Coupon[]): Coupon[] {
  const catalogueByCode = new Map<string, Coupon>();
  for (const coupon of catalogue) {
    if (!catalogueByCode.has(coupon.code)) {
      catalogueByCode.set(coupon.code, coupon);
    }
  }

  const seen = new Set<string>();
  const resolved: Coupon[] = [];

  for (const code of typedCodes) {
    if (seen.has(code)) {
      continue;
    }
    seen.add(code);

    const coupon = catalogueByCode.get(code);
    if (!coupon) {
      continue;
    }

    if (Date.now() >= Date.parse(coupon.expiresAt)) {
      throw new ExpiredCouponError(code);
    }

    resolved.push(coupon);
  }

  return resolved;
}

function applyTierDiscount(buckets: CategoryBuckets, percent: number): number {
  let total = 0;
  for (const category of CATEGORY_ORDER) {
    const amount = buckets.get(category) ?? 0;
    if (amount <= 0 || percent <= 0) {
      continue;
    }
    const discount = percentOfCeil(amount, percent);
    const applied = Math.min(discount, amount);
    buckets.set(category, amount - applied);
    total += applied;
  }
  return total;
}

function allocateFixedOrderWide(
  buckets: CategoryBuckets,
  totalDiscount: number,
): Map<LineItem["category"], number> {
  const allocation = new Map<LineItem["category"], number>();
  const orderTotal = orderWideRemaining(buckets);
  if (orderTotal === 0) {
    return allocation;
  }

  const activeCategories = CATEGORY_ORDER.filter((category) => (buckets.get(category) ?? 0) > 0);
  let allocated = 0;
  const shares: {
    category: LineItem["category"];
    bucketAmount: number;
    floorShare: number;
  }[] = [];

  for (const category of activeCategories) {
    const bucketAmount = buckets.get(category) ?? 0;
    const exactShare = (totalDiscount * bucketAmount) / orderTotal;
    const floorShare = Math.floor(exactShare);
    allocation.set(category, floorShare);
    allocated += floorShare;
    shares.push({ category, bucketAmount, floorShare });
  }

  let leftover = totalDiscount - allocated;
  shares.sort((left, right) => {
    if (right.bucketAmount !== left.bucketAmount) {
      return right.bucketAmount - left.bucketAmount;
    }
    return CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
  });

  for (const share of shares) {
    if (leftover <= 0) {
      break;
    }
    const current = allocation.get(share.category) ?? 0;
    const bucketAmount = buckets.get(share.category) ?? 0;
    if (current < bucketAmount) {
      allocation.set(share.category, current + 1);
      leftover -= 1;
    }
  }

  return allocation;
}

function applyPercentCategory(
  buckets: CategoryBuckets,
  category: LineItem["category"],
  percent: number,
): number {
  const bucketAmount = buckets.get(category) ?? 0;
  if (bucketAmount === 0) {
    return 0;
  }

  const discount = percentOfCeil(bucketAmount, percent);
  if (discount > bucketAmount) {
    return 0;
  }

  buckets.set(category, bucketAmount - discount);
  return discount;
}

function applyPercentOrderWide(buckets: CategoryBuckets, percent: number): number {
  const deductions = new Map<LineItem["category"], number>();
  let totalDiscount = 0;

  for (const category of CATEGORY_ORDER) {
    const bucketAmount = buckets.get(category) ?? 0;
    if (bucketAmount <= 0) {
      continue;
    }
    const discount = percentOfCeil(bucketAmount, percent);
    if (discount > bucketAmount) {
      return 0;
    }
    deductions.set(category, discount);
    totalDiscount += discount;
  }

  if (totalDiscount > orderWideRemaining(buckets)) {
    return 0;
  }

  for (const [category, discount] of deductions) {
    buckets.set(category, (buckets.get(category) ?? 0) - discount);
  }
  return totalDiscount;
}

function applyFixedCategory(
  buckets: CategoryBuckets,
  category: LineItem["category"],
  value: number,
): number {
  const bucketAmount = buckets.get(category) ?? 0;
  if (bucketAmount === 0 || value > bucketAmount) {
    return 0;
  }

  buckets.set(category, bucketAmount - value);
  return value;
}

function applyFixedOrderWide(buckets: CategoryBuckets, value: number): number {
  const remaining = orderWideRemaining(buckets);
  if (remaining === 0 || value > remaining) {
    return 0;
  }

  const allocation = allocateFixedOrderWide(buckets, value);
  let total = 0;
  for (const [category, amount] of allocation) {
    if (amount <= 0) {
      continue;
    }
    buckets.set(category, (buckets.get(category) ?? 0) - amount);
    total += amount;
  }
  return total;
}

function applyCoupon(buckets: CategoryBuckets, coupon: Coupon): number {
  const remaining = orderWideRemaining(buckets);
  if (coupon.minSubtotalKopecks !== undefined && remaining < coupon.minSubtotalKopecks) {
    return 0;
  }

  if (coupon.kind === "percent") {
    if (coupon.category) {
      return applyPercentCategory(buckets, coupon.category, coupon.value);
    }
    return applyPercentOrderWide(buckets, coupon.value);
  }

  if (coupon.category) {
    return applyFixedCategory(buckets, coupon.category, coupon.value);
  }
  return applyFixedOrderWide(buckets, coupon.value);
}

export function priceOrder(order: Order, coupons: Coupon[]): PriceBreakdown {
  const subtotal = subtotalKopecks(order);

  if (order.items.length === 0) {
    return {
      subtotalKopecks: 0,
      tierDiscountKopecks: 0,
      couponDiscountKopecks: 0,
      shippingKopecks: 0,
      totalKopecks: 0,
    };
  }

  const buckets = buildBuckets(order);
  const tierDiscountKopecks = applyTierDiscount(buckets, tierPercent(order));
  const resolvedCoupons = resolveCoupons(order.coupons, coupons);

  let couponDiscountKopecks = 0;
  for (const coupon of resolvedCoupons) {
    couponDiscountKopecks += applyCoupon(buckets, coupon);
  }

  const shipping = shippingKopecks(order);
  const totalKopecks = subtotal - tierDiscountKopecks - couponDiscountKopecks + shipping;

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks,
    couponDiscountKopecks,
    shippingKopecks: shipping,
    totalKopecks,
  };
}
