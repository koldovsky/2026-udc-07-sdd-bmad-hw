# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/pricing.test.ts`

## Таблиця AC → Код → Тест

| AC | Що перевіряє | Де реалізовано (функція) | Тест (назва) | Статус |
|---|---|---|---|---|
| AC-1 | Знижка за рівнем Gold на 1000 грн | `discountPrice()`: tierPercent lookup, Math.round (line 43-44) | `AC-1: Gold customer gets 10% discount = 100 грн` | ✅ |
| AC-2 | Прострочений промокод ігнорується | `discountPrice()`: expiration check (line 62-64) | `AC-2: coupon with expiresAt = yesterday is ignored` | ✅ |
| AC-3 | Два послідовні промокоди на одну категорію | `discountPrice()`: categoryAdjustments Map (line 56-57, 88-91), sequential application (line 94-96) | `AC-3: first -10%, second -20% on fresh category` | ✅ |
| AC-4 | Знижка > суми → 0 до сплати (не мінус) | `discountPrice()`: Math.min, negative clamp (line 74-75, 99-101) | `AC-4: coupon -500 грн on 200 грн = 0 payment` | ✅ |
| AC-5 | Мінімальна сума замовлення не досягнута | `discountPrice()`: minSubtotalKopecks check (line 67-69) | `AC-5: coupon requires 100,000 but order is 80,000` | ✅ |
| AC-6 | Рівень + промокод послідовно | `discountPrice()`: tier (line 43-44), then coupon loop (line 61-96), sequential base adjustment | `AC-6: 10% tier + 15% coupon = 765 грн` | ✅ |
| AC-7 | Промокод на категорію без товарів цієї категорії | `discountPrice()`: category filter + reduce (line 72-75), base becomes 0 if no items | `AC-7: coupon on fresh but no fresh items = 0 discount` | ✅ |
| AC-8 | Округлення 0.5 копійок (границя) | `discountPrice()`: Math.round (line 44, 79-80) | `AC-8: Silver 5% on 333 копійок = 16.65 → 17` | ✅ |
| AC-9 | Три послідовні промокоди | `discountPrice()`: coupon loop applied 3 times (line 61-96), each decrements currentSubtotal | `AC-9: 10%, 20%, 5% applied sequentially` | ✅ |
| AC-10 | Порожнє замовлення (границя) | `discountPrice()`: subtotalKopecks(order) returns 0 for empty items (line 41) | `AC-10: zero items = 0 subtotal, 0 discounts` | ✅ |

## Зворотна перевірка

### Чи є в коді поведінка, якої немає в жодному AC?

**Немає.** Кожна логічна гілка в `discountPrice()` відповідає рішенню з D-1..D-13 у специфікації:
- Tier calculation (D-1, AC-1, AC-6)
- Expiration check (D-8, AC-2)
- Category filtering (D-5, AC-7)
- Sequential application (D-3, AC-3, AC-6, AC-9)
- Minimum subtotal (D-6, AC-5)
- Negative clamp (D-7, AC-4)
- Shipping separation (D-2, AC-1, AC-6)
- Rounding (D-4, AC-8)
- Empty order handling (D-12, AC-10)

### Чи є AC без тесту?

**Немає.** Кожен AC-1 через AC-10 має точний тест з однаковою назвою.

### Чи є тест, який не мапиться на жоден AC?

**Немає.** Тести у файлі:
- 8 існуючих тестів на наявну поведінку (lineTotalKopecks, subtotalKopecks, shippingKopecks, tierPercent) — це з базового модуля, не з нашої фічі
- 10 нових тестів AC-1..AC-10 — 1-до-1 з критеріями

### Непокриті граничні випадки?

Обговорено та покрито:
- AC-4 (знижка > суми): негативна сума → 0 ✅
- AC-8 (рounding 0.5): 0.5 → 1 ✅
- AC-10 (порожнє замовлення): 0 товарів ✅

## Що з цього вийшло

Специфікація виявилась повною й точною. Під час реалізації виникла одна тонкість (AC-3): як коректно розраховувати послідовні промокоди на одну категорію? Видно було з їі тексту (D-3: "другий применяється до суми після першого"), але реалізація потребувала додатку `categoryAdjustments` Map, щоб відстежити, скільки вже знято з кожної категорії. Це не вимагало змін у специфікації—лише більш уважної реалізації алгоритму. Таблиця простежуваності довела, що ніяких невідповідностей між документом і кодом немає.
