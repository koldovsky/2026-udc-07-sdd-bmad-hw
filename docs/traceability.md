# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/discounts.test.ts`

## Таблиця

| AC | Що перевіряє | Де реалізовано (файл:символ) | Тест (назва) | Статус |
|---|---|---|---|---|
| AC-1 | Gold 10% на 1000 грн без промокодів, доставка 49 грн | `discounts.ts:priceOrder` + `pricing.ts:tierPercent` / `shippingKopecks` | `AC-1: Gold order without coupons` | ✅ |
| AC-2 | Прострочений відсотковий промокод — тихий пропуск | `discounts.ts:priceOrder` (`Date.parse`, `tNow >= tExp`) | `AC-2: expired coupon does not apply` | ✅ |
| AC-3 | Два відсоткові промокоди на одну категорію, послідовно | `discounts.ts:priceOrder` + `isEligible` | `AC-3: two coupons on the same category` | ✅ |
| AC-4 | Фікс більший за товари — обрізати, доставка лишається | `discounts.ts:priceOrder` (гілка `kind === "fixed"`) | `AC-4: discount exceeds merchandise` | ✅ |
| AC-5 | 15 коп. × 10% → 2 (half-up на рядку) | `discounts.ts:percentOffKopecks` | `AC-5: half-kopeck rounds up` | ✅ |
| AC-6 | Порожнє замовлення: нулі, `shippingKopecks([]) === 0`, без throw | `discounts.ts:priceOrder` + `pricing.ts:shippingKopecks` | `AC-6: empty order` | ✅ |
| AC-7 | Категорійний 20% лише від `fresh`, не від усього чека | `discounts.ts:isEligible` | `AC-7: category coupon on fresh only` | ✅ |
| AC-8 | `minSubtotalKopecks` по початковому subtotal, не після Gold | `discounts.ts:priceOrder` (перевірка `subtotal < min`) | `AC-8: minSubtotal on original not post-tier` | ✅ |
| AC-9 | Gold потім 15% послідовно (23 500, не 25 000) | `discounts.ts:priceOrder` (рівень, далі купони) | `AC-9: sequential Gold then 15 percent` | ✅ |
| AC-10 | Два рядки по 15 коп. Gold → 4, не 3 | `discounts.ts:percentOffKopecks` (цикл по рядках) | `AC-10: two lines round separately` | ✅ |
| AC-11 | Поріг не досягнуто — купон не застосовується | `discounts.ts:priceOrder` (`minSubtotalKopecks`) | `AC-11: minSubtotal not met` | ✅ |
| AC-12 | Дубль коду один раз, невідомий код — пропуск | `discounts.ts:priceOrder` (`seen`, `catalog.find`) | `AC-12: duplicate and unknown codes` | ✅ |
| AC-13 | Silver 5% на 1000 грн | `discounts.ts:priceOrder` + `pricing.ts:tierPercent` | `AC-13: Silver order without coupons` | ✅ |
| AC-14 | Відсоток поза 0–100 — тихий пропуск | `discounts.ts:priceOrder` (`Number.isInteger` / діапазон) | `AC-14: percent outside 0-100 is skipped` | ✅ |
| AC-15 | Зіставлення коду чутливе до регістру | `discounts.ts:priceOrder` (`c.code === code`) | `AC-15: coupon codes are case-sensitive` | ✅ |
| AC-16 | Фікс з’їдає рядки в порядку `items`; видно з `couponDiscountKopecks` після `FRESH50` | `discounts.ts:priceOrder` (гілка `kind === "fixed"`, цикл `order.items`) | `AC-16: fixed coupon consumes items in array order` | ✅ |

## Зворотна перевірка

Пройшли від `priceOrder` / хелперів до AC, не навпаки.

- **Чи є в коді поведінка, якої немає в жодному AC?** Так — зворотна перевірка це знайшла (до дописування AC-13…AC-16 і після):
  1. **Silver 5%** — `tierPercent` уже мапив `"silver" → 5`, але жоден AC не викликав Silver. *Зробили:* AC-13 + тест.
  2. **Відсоток поза 0–100 / нецілий** — гілка D-8 у `priceOrder`. *Зробили:* AC-14 на `value: 150`. Нецілий відсоток лишається тією ж `Number.isInteger`-гілкою; окремий AC не додавали.
  3. **Регістр коду (D-10)** — `===` без `trim`. AC-12 бив лише відсутній код. *Зробили:* AC-15 (`save10` vs `SAVE10`).
  4. **Порядок з’їдання рядків фіксованим купоном (D-11)** — цикл `order.items.entries()`. Спочатку здавалось, що без по рядкових залишків у breakdown це не видно; це не так: після нескоупованого фіксу категорійний купон змінює публічне `couponDiscountKopecks`. *Зробили:* AC-16 (`standard`+`fresh`, `FIX15000` потім `FRESH50`) — 17_500 (фікс 15_000 + 2_500 від залишку `fresh`), а не 15_000 як при списанні з кінця.
  5. **`Date.parse` → `NaN`, від’ємний фікс, інший `kind`** — ті самі `continue`, що D-8 / AC-2 / AC-14. Окремих AC немає. `kind` у типі лише `"percent" \| "fixed"`, тож «інший kind» без `as` не спостерігається. *Зробили:* лишили код (спека D-8), не роздували сюїту клонами skip-шляху.
  6. **`if (lineRemaining === undefined) continue`** — захист `noUncheckedIndexedAccess`, не бізнес-правило. Лишили.

- **Чи є AC без тесту?** Немає (AC-1…AC-16, кожен має `it("AC-N: …")` у `discounts.test.ts`).

- **Чи є тест, який не мапиться на жоден AC?** У `discounts.test.ts` — немає. Вісім тестів у `pricing.test.ts` не мапляться на AC знижок: це засіяний контракт підсумків/доставки/`tierPercent`, їх не чіпали.

## Що з цього вийшло

Зворотна перевірка знайшла розрив між **таблицею рішень** і **списком AC**: D-8 / D-10 / Silver / D-11 уже були в спекі й у коді, але без критерію, який можна побачити у vitest. Це не «агент намалював фічу», а неповний шар AC — спека думала глибше, ніж тестувала. Дописали AC-13…AC-16 і тести. D-11 спостерігається через `couponDiscountKopecks` (AC-16), без розширення контракту. Код після цього кроку не спрощували під тести.
