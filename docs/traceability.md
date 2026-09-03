# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/discounts.test.ts`

## Таблиця

| AC | Що перевіряє | Де реалізовано (файл:символ) | Тест (назва) | Статус |
|---|---|---|---|---|
| AC-1 | Gold tier 10% на товари, доставка окремо | `discounts.ts:applyTierDiscount`, `discounts.ts:priceOrder` | `AC-1: gold customer, no coupons` | ✅ |
| AC-2 | Прострочений промокод кидає `ExpiredCouponError` до розрахунку | `discounts.ts:resolveCoupons` | `AC-2: expired coupon` | ✅ |
| AC-3 | Два промокоди на одну категорію послідовно | `discounts.ts:applyCoupon`, `discounts.ts:applyPercentCategory` | `AC-3: two coupons on the same category` | ✅ |
| AC-4 | Занадто велика фіксована знижка пропускається цілком | `discounts.ts:applyFixedCategory`, `discounts.ts:applyFixedOrderWide` | `AC-4: discount larger than the order` | ✅ |
| AC-5 | Порожнє замовлення — усі поля 0 | `discounts.ts:priceOrder` | `AC-5: empty order` | ✅ |
| AC-6 | `minSubtotalKopecks` після tier-знижки | `discounts.ts:applyCoupon` | `AC-6: minSubtotalKopecks after earlier discounts` | ✅ |
| AC-7 | Категорійний промокод від суми категорії | `discounts.ts:applyPercentCategory` | `AC-7: category coupon base` | ✅ |
| AC-8 | `minSubtotalKopecks` порівнюється з order-wide залишком | `discounts.ts:applyCoupon` | `AC-8: category coupon minSubtotal is order-wide` | ✅ |
| AC-9 | Округлення вгору на кожному кроці | `discounts.ts:percentOfCeil` | `AC-9: rounding up at each step` | ✅ |
| AC-10 | Повторений код застосовується один раз | `discounts.ts:resolveCoupons` | `AC-10: repeated coupon code` | ✅ |
| AC-11 | Невідомий код ігнорується | `discounts.ts:resolveCoupons` | `AC-11: unknown coupon code` | ✅ |
| AC-12 | Фіксована знижка на все замовлення ділиться між відрами | `discounts.ts:allocateFixedOrderWide`, `discounts.ts:applyFixedOrderWide` | `AC-12: order-wide fixed allocation` | ✅ |
| AC-13 | Tier-знижка по кожній категорії перед категорійним купоном | `discounts.ts:applyTierDiscount`, `discounts.ts:applyPercentCategory` | `AC-13: tier discount reaches every category` | ✅ |

## Зворотна перевірка

- **Чи є в коді поведінка, якої немає в жодному AC?** Одна знахідка: дедублікація каталогу купонів за кодом — якщо `coupons` (каталог) містить кілька записів з однаковим `code`, перемагає перший (`discounts.ts:resolveCoupons`, побудова `catalogueByCode`). Ця вимога сформульована в OpenSpec-делті (`openspec/changes/add-discounts/specs/pricing-discounts/spec.md`, розділ "Typed coupon codes are resolved against the catalogue"), але не потрапила назад у таблицю рішень D-1…D-16 чи в жоден AC цього документа — D-13 описує лише код, введений клієнтом двічі, а не дублікати в самому каталозі. Поведінка не покрита жодним тестом.
  Решта допоміжних функцій (`buildBuckets`, `orderWideRemaining`, `allocateFixedOrderWide`, `applyPercentOrderWide`, `applyFixedCategory`) — внутрішня реалізація AC-1…AC-13. Окремо: «skip-whole при перевищенні» застосовано в коді і до `percent`-, і до `fixed`-купонів (`applyPercentCategory`, `applyPercentOrderWide`), хоча приклад в AC-4 показує лише `fixed`-купони (`BIG`/`SMALL`) — але саме формулювання AC-4 не обмежує тип купона, тому це вважається коректною реалізацією AC-4, а не розширенням поза специфікацією. Варіант з percent-купоном, що перевищує суму, просто не має власного окремого тесту.
- **Чи є AC без тесту?** Немає — кожен AC-1…AC-13 має відповідний `describe` у `discounts.test.ts`.
- **Чи є тест, який не мапиться на жоден AC?** Так, чотири допоміжні блоки: `percentOfCeil rounding` (задача 2.3), `category bucket ledger` (задача 2.4), `ExpiredCouponError` (задача 2.2), `package entry point` (задача 5.1). Вони перевіряють контракт і внутрішні інваріанти, зазначені в `tasks.md`, а не окремі AC.

## Що з цього вийшло

Зворотна перевірка виявила одну поведінку поза специфікацією: дедублікацію каталогу купонів за кодом (перший запис виграє), додану в OpenSpec-делті, але не синхронізовану назад у D-таблицю чи AC цього документа і не покриту тестом. Усі 13 AC покриті тестами з іменами, що збігаються з id критеріїв; чотири додаткові тести перевіряють внутрішній контракт, а не конкретні AC. «Skip-whole» логіка для percent-купонів відповідає загальному формулюванню AC-4, тож не вважається самовільним додаванням — лише відсутністю окремого тесту на цей варіант.