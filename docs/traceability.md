# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/discounts.test.ts` (14 тестів, назви за ID критеріїв)
**Перевірка:** `cd app && npm test` — 22 зелених (8 наявних + 14 нових),
`npm run typecheck` чистий.

## Таблиця

| AC | Що перевіряє | Де реалізовано (файл:символ) | Тест (назва) | Статус |
|---|---|---|---|---|
| AC-1 | Знижка за рівнем Gold 10% від суми товарів, без промокодів | `discounts.ts:priceOrder` (розрахунок `tierDiscount`) | `AC-1: gold tier 10% applied to the items subtotal, no coupons` | ✅ |
| AC-2 | Прострочений промокод — тиха відмова, без виключення | `discounts.ts:isCouponApplicable` (перевірка `expiresAt`) | `AC-2: expired coupon is a silent skip, no throw` | ✅ |
| AC-3 | Два промокоди на одну категорію застосовуються по черзі, у порядку введення | `discounts.ts:priceOrder` (цикл по `resolveCoupons`, `categoryRemainder`) | `AC-3: two coupons on the same category apply sequentially` | ✅ |
| AC-4 | Фіксований промокод більший за базу — обмежується, підсумок не від'ємний | `discounts.ts:priceOrder` (`actual = max(0, min(nominal, base, orderRemainder))`) | `AC-4: a fixed coupon larger than the base is capped, total never negative` | ✅ |
| AC-5 | Порожнє замовлення — усі суми 0 | `discounts.ts:priceOrder` (`subtotal = 0` → всі гілки 0; `shippingKopecks` = 0) | `AC-5: empty order is all zeros` | ✅ |
| AC-6 | Рівно пів копійки при округленні знижки за рівнем — вниз | `discounts.ts:roundHalfDown` | `AC-6: half a kopeck in tier rounding rounds down` | ✅ |
| AC-7 | `minSubtotalKopecks` звіряється з оригінальним subtotal, включно | `discounts.ts:isCouponApplicable` (`originalSubtotal < coupon.minSubtotalKopecks`) | `AC-7: minSubtotal is checked against the original subtotal, inclusive` | ✅ |
| AC-8 | Той самий код двічі — застосовується один раз | `discounts.ts:resolveCoupons` (`seen: Set<string>`) | `AC-8: the same code entered twice is applied once` | ✅ |
| AC-9 | Код відсутній у каталозі — тиха відмова, без виключення | `discounts.ts:resolveCoupons` (`catalogue.find(...)` → `undefined` відкидається) | `AC-9: a code missing from the catalogue is a silent skip, no throw` | ✅ |
| AC-10 | Категорійний промокод — відсоток від суми саме цієї категорії | `discounts.ts:categorySubtotalKopecks` + `priceOrder` (`base = categoryRemainder`) | `AC-10: a category coupon is a percentage of that category's subtotal` | ✅ |
| AC-11 | Рівень + відсотковий промокод складаються послідовно, не додаванням відсотків | `discounts.ts:priceOrder` (`orderRemainder -= actual`; `base = orderRemainder`) | `AC-11: tier and a percentage coupon stack sequentially, not additively` | ✅ |
| AC-12 | Order-wide знижка не зменшує категорійну базу | `discounts.ts:priceOrder` (`categoryRemainder` оновлюється лише `if (scoped)`) | `AC-12: an order-wide discount does not shrink the category base` | ✅ |
| AC-13 | `now` точно дорівнює `expiresAt` — вважається простроченим | `discounts.ts:isCouponApplicable` (`now.getTime() >= new Date(coupon.expiresAt).getTime()`) | `AC-13: now exactly equal to expiresAt counts as expired` | ✅ |
| AC-14 | Категорійний промокод додатково обмежується залишком замовлення | `discounts.ts:priceOrder` (`min(nominal, base, orderRemainder)`) | `AC-14: a category coupon is also capped by the order remainder` | ✅ |

## Зворотна перевірка

### Чи є в коді поведінка, якої немає в жодному AC?

Два місця:

1. **Категорійний промокод, коли в замовленні немає товарів цієї категорії.**
   `isCouponApplicable` явно повертає `false`, якщо
   `categorySubtotalKopecks(order.items, coupon.category) === 0`. Це прямий
   наслідок D-18 (логічне І умов) і D-5, але **жоден AC цей шлях не закриває** —
   AC-10/AC-12/AC-14 усі використовують категорійний купон із наявними
   товарами категорії. Кандидат на новий `AC-15`. Поки лишено як є: поведінка
   збігається з рішенням у специфікації, бракує лише тесту-якоря.

2. **Зовнішній `Math.max(0, subtotal - tierDiscount - couponDiscount)`** у
   `totalKopecks`. Покроковий клампінг (`actual`) уже гарантує невід'ємність,
   тож зовнішній `max(0, …)` — недосяжна гілка. На відміну від пункту 1, вона
   **запитана**: контракт у розділі 5 специфікації явно пише
   «`… − couponDiscountKopecks` (не нижче 0, D-7)». Тобто це дубль між
   покроковим інваріантом і формулою контракту, а не самодіяльність коду.

> Ранню редакцію реалізації з третім клампом —
> `Math.min(tierDiscount, subtotal)` для знижки за рівнем — прибрано саме за
> результатом цієї перевірки: `tierPercent` дає 0/5/10, тож знижка за рівнем
> ніколи не перевищить базу, і клампу там не було чого робити.

### Чи є AC без тесту?

Немає. Кожен із AC-1…AC-14 має рівно один тест із відповідною назвою.

### Чи є тест, який не мапиться на жоден AC?

У `discounts.test.ts` — немає, усі 14 названі за ID критеріїв. У репо
залишаються 8 тестів `pricing.test.ts` — це **засіяні** тести на захищену
поведінку `pricing.ts` (`subtotal`, `shipping`, `tierPercent`), не на рушій
знижок; вони не входять у скоуп специфікації й не мапляться на AC за задумом.

## Що з цього вийшло

Зворотна перевірка знайшла **одну реальну прогалину в покритті** (категорійний
купон без товарів категорії — шлях коду є, дедикованого AC немає) і **два
захисні клампи**, які за інших правил специфікації недосяжні — незапитана,
хай і нешкідлива, ініціатива реалізації. Специфікацію правити **не довелося**:
усі 14 AC зійшлися з першої реалізації, а найтонше місце (два лічильники
залишку, D-15) було достатньо однозначно описане, щоб AC-12 і AC-14 пройшли
без здогадок. Це радше свідчить, що для фічі такого розміру спека вийшла
повна — що варто перевірити A/B-тестом у Task D.
