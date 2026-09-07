## Why

Рівні лояльності (`tierPercent`) уже є в коді, але ніде не зменшують суму чека. Осіння кампанія потребує, щоб клієнт на checkout бачив одну передбачувану суму: рівень Silver/Gold плюс усі валідні введені промокоди, у цілих копійках і без відʼємної вартості товарів.

Бізнес-тікет (`materials/feature-request.md`) навмисно неоднозначний. Поведінку вже зафіксовано в погодженій специфікації `docs/spec/pricing-discounts.md` (статус agreed, D-1…D-14, AC-1…AC-15, алгоритм §5). Цей change лише переносить ту специфікацію в цикл OpenSpec — нових рішень щодо знижок немає.

## What Changes

- Додається рушій знижок як новий модуль поруч із наявним `app/src/pricing.ts` (напр. `app/src/discounts.ts`).
- Публічний контракт — рівно той, що в специфікації §5: `priceOrder(order, catalog, nowIso) → PriceBreakdown`.
- `PriceBreakdown` містить пʼять цілих полів: `subtotalKopecks`, `tierDiscountKopecks`, `couponDiscountKopecks`, `shippingKopecks`, `totalKopecks`.
- Рівень застосовується першим по рядках; далі всі валідні промокоди в порядку `order.coupons`; доставка не знижується.
- Зʼявляються vitest-тести, названі за AC-1…AC-15. Наявні 8 тестів `pricing.test.ts` лишаються зеленими.
- Сигнатури `lineTotalKopecks`, `subtotalKopecks`, `shippingKopecks`, `tierPercent` і форми в `app/src/types.ts` не змінюються.

Поза скоупом (зі специфікації §2): UI checkout, тости, адмінка купонів, антифрод між замовленнями, free shipping, податки, інші валюти, BOGO/бандли, перерахунок доставки від суми після знижок, валідація «брудного» замовлення.

## Capabilities

### New Capabilities

- `pricing-discounts`: розрахунок суми замовлення зі знижкою за рівнем і промокодами за погодженою специфікацією (`priceOrder` + `PriceBreakdown`).

### Modified Capabilities

- (немає — у `openspec/specs/` ще немає поведінкових специфікацій)

## Impact

- Нові файли в `app/src/` (рушій + тести за AC). Експорт з `app/src/index.ts`.
- Залежності не додаються. Гроші — лише цілі копійки, без float-арифметики.
- Немає **BREAKING** змін наявного API.
- Джерело правди для чисел і порядку кроків лишається `docs/spec/pricing-discounts.md`; артефакти цього change її транслюють, а не замінюють.
