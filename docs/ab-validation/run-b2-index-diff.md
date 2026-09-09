# Run B2 also modified app/src/index.ts (additively). Diff vs the seeded file:
```diff
diff --git a/app/src/index.ts b/app/src/index.ts
index b496353..d383dac 100644
--- a/app/src/index.ts
+++ b/app/src/index.ts
@@ -5,3 +5,12 @@ export {
   shippingKopecks,
   tierPercent,
 } from "./pricing.js";
+export { priceOrder, percentOfKopecks } from "./discounts.js";
+export type {
+  Category,
+  CouponScope,
+  CouponRejectionReason,
+  RejectedCoupon,
+  DiscountLine,
+  PriceBreakdown,
+} from "./discounts.js";
```
