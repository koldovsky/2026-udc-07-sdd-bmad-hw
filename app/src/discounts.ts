import type { Coupon, LineItem, Order } from "./types.js";
import {
  lineTotalKopecks,
  shippingKopecks,
  subtotalKopecks,
  tierPercent,
} from "./pricing.js";

export type CouponRejectionReason =
  | "invalid_or_unknown"
  | "expired"
  | "minimum_not_met"
  | "no_matching_category"
  | "duplicate";

export type CouponResult =
  | { code: string; status: "applied"; discountKopecks: number }
  | {
      code: string;
      status: "rejected";
      discountKopecks: 0;
      reason: CouponRejectionReason;
    };

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  couponResults: CouponResult[];
  shippingKopecks: number;
  totalKopecks: number;
}

interface RemainingLine {
  category: LineItem["category"];
  kopecks: number;
}

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

function roundPercentDiscount(eligibleKopecks: number, percent: number): number {
  return Math.floor((eligibleKopecks * percent + 50) / 100);
}

function allocateDiscount(lines: RemainingLine[], discountKopecks: number): void {
  const eligibleTotal = lines.reduce((sum, line) => sum + line.kopecks, 0);
  if (eligibleTotal === 0 || discountKopecks === 0) return;

  const allocations = lines.map((line) =>
    Math.floor((discountKopecks * line.kopecks) / eligibleTotal),
  );
  let remainder = discountKopecks - allocations.reduce((sum, allocation) => sum + allocation, 0);

  for (let index = 0; remainder > 0; index = (index + 1) % lines.length) {
    const line = lines[index];
    const allocation = allocations[index];
    if (line !== undefined && allocation !== undefined && allocation < line.kopecks) {
      allocations[index] = allocation + 1;
      remainder -= 1;
    }
  }

  lines.forEach((line, index) => {
    line.kopecks -= allocations[index] ?? 0;
  });
}

function rejected(code: string, reason: CouponRejectionReason): CouponResult {
  return { code, status: "rejected", discountKopecks: 0, reason };
}

function hasOriginalCategory(order: Order, category: LineItem["category"]): boolean {
  return order.items.some((item) => item.category === category);
}

export function priceOrder(order: Order, coupons: Coupon[], now: Date): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const remainingLines: RemainingLine[] = order.items.map((item) => ({
    category: item.category,
    kopecks: lineTotalKopecks(item),
  }));

  const tierEligible = remainingLines.reduce((sum, line) => sum + line.kopecks, 0);
  const tierDiscountKopecks = Math.min(
    tierEligible,
    roundPercentDiscount(tierEligible, tierPercent(order)),
  );
  allocateDiscount(remainingLines, tierDiscountKopecks);

  const couponResults: CouponResult[] = [];
  const appliedCodes = new Set<string>();
  let couponDiscountKopecks = 0;
  const currentTime = now.getTime();

  for (const enteredCode of order.coupons) {
    const code = normalizeCode(enteredCode);
    const matchingCoupons = code === ""
      ? []
      : coupons.filter((coupon) => normalizeCode(coupon.code) === code);
    const coupon = matchingCoupons.length === 1 ? matchingCoupons[0] : undefined;

    if (coupon === undefined || Number.isNaN(Date.parse(coupon.expiresAt))) {
      couponResults.push(rejected(code, "invalid_or_unknown"));
      continue;
    }

    if (currentTime >= Date.parse(coupon.expiresAt)) {
      couponResults.push(rejected(code, "expired"));
      continue;
    }

    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) {
      couponResults.push(rejected(code, "minimum_not_met"));
      continue;
    }

    if (coupon.category !== undefined && !hasOriginalCategory(order, coupon.category)) {
      couponResults.push(rejected(code, "no_matching_category"));
      continue;
    }

    if (appliedCodes.has(code)) {
      couponResults.push(rejected(code, "duplicate"));
      continue;
    }

    const eligibleLines = coupon.category === undefined
      ? remainingLines
      : remainingLines.filter((line) => line.category === coupon.category);
    const eligibleKopecks = eligibleLines.reduce((sum, line) => sum + line.kopecks, 0);
    const uncappedDiscount = coupon.kind === "percent"
      ? roundPercentDiscount(eligibleKopecks, coupon.value)
      : coupon.value;
    const discountKopecks = Math.min(eligibleKopecks, uncappedDiscount);

    allocateDiscount(eligibleLines, discountKopecks);
    couponDiscountKopecks += discountKopecks;
    appliedCodes.add(code);
    couponResults.push({ code, status: "applied", discountKopecks });
  }

  const shipping = shippingKopecks(order);
  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks,
    couponDiscountKopecks,
    couponResults,
    shippingKopecks: shipping,
    totalKopecks: subtotal - tierDiscountKopecks - couponDiscountKopecks + shipping,
  };
}
