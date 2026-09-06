# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/discounts.test.ts`
**Стан:** `cd app && npm test` — 68 зелених тестів (8 наявних `pricing` + 60 за
критеріями AC-1 … AC-60).

Колонка «Де реалізовано» називає символ у `app/src/discounts.ts` і крок
розрахунку з розділу 6 специфікації, бо саме крок, а не рядок коду, лишиться
правдою після рефакторингу.

## Таблиця

| AC | Що перевіряє | Де реалізовано (файл:символ) | Тест (назва) | Статус |
|---|---|---|---|---|
| AC-1 | Знижка за рівнем Gold рахується тільки від товарів | `discounts.ts:priceOrder` (кроки 1–3, 12) | `AC-1: gold tier discounts the items and nothing else` | ✅ |
| AC-2 | Промокод діє на залишок після рівня | `discounts.ts:priceOrder` (кроки 3, 6) | `AC-2: the coupon applies to what the tier discount left` | ✅ |
| AC-3 | Спрацьовує один промокод — найвигідніший | `discounts.ts:priceOrder` (крок 8) | `AC-3: only the best of two coupons applies` | ✅ |
| AC-4 | Промокод недійсний у сам момент закінчення | `discounts.ts:priceOrder` (крок 5, `now >= Date.parse`) | `AC-4: a coupon is invalid on the instant it expires` | ✅ |
| AC-5 | База категорійного промокоду — категорія, зменшена на рівень | `discounts.ts:priceOrder` (крок 6), `discounts.ts:idiv` | `AC-5: a category coupon's base is that category, less the tier percentage` | ✅ |
| AC-6 | Поріг звіряється з сумою до знижки за рівнем | `discounts.ts:priceOrder` (крок 5, поріг) | `AC-6: the threshold is measured against the subtotal before the tier discount` | ✅ |
| AC-7 | Міжнародна доставка не зменшується знижкою | `discounts.ts:priceOrder` (крок 12, `shippingKopecks`) | `AC-7: an international order keeps full shipping and discounts only items` | ✅ |
| AC-8 | Код поза каталогом → `unknown` | `discounts.ts:priceOrder` (крок 5, пошук у `byCode`) | `AC-8: a code absent from the catalog is rejected as unknown` | ✅ |
| AC-9 | Дублікат коду згортається і не потрапляє у відмови | `discounts.ts:priceOrder` (крок 4) | `AC-9: the same code typed twice is applied once and reported never` | ✅ |
| AC-10 | Регістр і пробіли не впливають на збіг | `discounts.ts:normaliseCode` (крок 4) | `AC-10: matching ignores case and surrounding whitespace` | ✅ |
| AC-11 | Категорії немає в кошику → `no-effect` | `discounts.ts:priceOrder` (крок 7), `discounts.ts:categoryTotals` | `AC-11: a coupon for a category the cart lacks has no effect` | ✅ |
| AC-12 | Фіксована знижка більша за замовлення обмежується | `discounts.ts:discountFor` (гілка `fixed`) | `AC-12: a fixed coupon larger than the order clamps to the items` | ✅ |
| AC-13 | Відсоткова знижка округлюється вниз | `discounts.ts:discountFor` (гілка `percent`), `discounts.ts:idiv` | `AC-13: a percentage discount rounds down to the whole kopeck` | ✅ |
| AC-14 | Порожнє замовлення дає нуль по всіх полях | `discounts.ts:priceOrder` (кроки 1, 12) | `AC-14: an order with no items prices to zero` | ✅ |
| AC-15 | Недосягнутий поріг повертається разом зі значенням | `discounts.ts:priceOrder` (крок 5, поріг) | `AC-15: an unmet threshold is reported with the threshold itself` | ✅ |
| AC-16 | За рівності знижок виграє введений раніше | `discounts.ts:priceOrder` (крок 8, строге `>`) | `AC-16: a tie goes to the code typed earlier` | ✅ |
| AC-17 | Дата поза діапазонами відхиляється регекспом | `discounts.ts:expiresAtIsUsable` (`DATE_ONLY`, `DATE_TIME`) | `AC-17: an out-of-range date is rejected by the regex, not by the engine's parser` | ✅ |
| AC-18 | Знижка менша за копійку → `too-small` | `discounts.ts:priceOrder` (крок 7, `scopeTotal`) | `AC-18: a discount rounded away to nothing is too-small, not no-effect` | ✅ |
| AC-19 | База Gold округлюється вниз рівно один раз | `discounts.ts:priceOrder` (крок 6), `discounts.ts:idiv` | `AC-19: a gold category base rounds down exactly once` | ✅ |
| AC-20 | Фіксований категорійний промокод обмежується базою категорії | `discounts.ts:discountFor` (гілка `fixed`), крок 6 | `AC-20: a fixed category coupon clamps to the category base` | ✅ |
| AC-21 | Порожнє замовлення все одно розбирає введені коди | `discounts.ts:priceOrder` (кроки 7, 12) | `AC-21: an empty order still resolves the codes that were typed` | ✅ |
| AC-22 | Порожній рядок не вважається введеним кодом | `discounts.ts:normaliseCode` (крок 4) | `AC-22: a blank entry is not a typed code at all` | ✅ |
| AC-23 | Silver дає 5% до промокоду | `discounts.ts:priceOrder` (крок 2, `tierPercent`) | `AC-23: silver tier takes 5% before the coupon` | ✅ |
| AC-24 | Відсоток понад 100 не дотягується до інших категорій | `discounts.ts:discountFor` (обмеження базою) | `AC-24: an over-100 percentage still cannot reach outside its category` | ✅ |
| AC-25 | Відʼємний `value` не стає націнкою | `discounts.ts:discountFor` (`value <= 0`) | `AC-25: a negative value gives no discount instead of a surcharge` | ✅ |
| AC-26 | Час без явного зсуву відхиляється | `discounts.ts:expiresAtIsUsable` (`DATE_TIME`) | `AC-26: a time without an explicit offset is refused` | ✅ |
| AC-27 | `Invalid Date` у `now` відхиляє всі промокоди | `discounts.ts:priceOrder` (крок 5, `nowIsInvalid`) | `AC-27: an Invalid Date in \`now\` expires every coupon instead of honouring it` | ✅ |
| AC-28 | `appliedCouponCode` — рядок каталогу дослівно | `discounts.ts:priceOrder` (крок 10) | `AC-28: the applied code is the catalog spelling, not the typed one` | ✅ |
| AC-29 | `unknown` повертає введений рядок дослівно | `discounts.ts:priceOrder` (крок 4, `raw`; крок 5) | `AC-29: an unknown code is echoed exactly as typed, whitespace included` | ✅ |
| AC-30 | Відмови впорядковані за введенням, не за кроками | `discounts.ts:priceOrder` (крок 11) | `AC-30: rejections come out in the order the codes were typed` | ✅ |
| AC-31 | Нульова база при непорожньому обсязі → `too-small` | `discounts.ts:priceOrder` (крок 7, `scopeTotal`) | `AC-31: an empty base with a non-empty scope is too-small, not no-effect` | ✅ |
| AC-32 | Одна відмова не блокує решту кодів | `discounts.ts:priceOrder` (крок 5, поодинока відмова) | `AC-32: one expired code does not block the others` | ✅ |
| AC-33 | Два записи з тим самим кодом → береться перший | `discounts.ts:priceOrder` (індекс `byCode`) | `AC-33: two catalog entries with the same code resolve to the first` | ✅ |
| AC-34 | Повністю цифрове замовлення без доставки | `discounts.ts:priceOrder` (крок 12, `shippingKopecks`) | `AC-34: a fully digital order pays no shipping` | ✅ |
| AC-35 | Поріг категорійного коду міряє повну суму товарів | `discounts.ts:priceOrder` (крок 5, `subtotal < threshold`) | `AC-35: a category coupon's threshold still measures the whole subtotal` | ✅ |
| AC-36 | База Silver: обрана формула проти відкинутої | `discounts.ts:priceOrder` (крок 6), `discounts.ts:idiv` | `AC-36: a silver category base rounds down where the rejected formula would not` | ✅ |
| AC-37 | `NaN` не доїжджає до підсумку | `discounts.ts:discountFor` (`Number.isInteger` першим) | `AC-37: a NaN value gives no discount and never reaches the total` | ✅ |
| AC-38 | Дробовий фіксований `value` не дає дробової суми | `discounts.ts:discountFor` (`Number.isInteger`) | `AC-38: a fractional fixed value gives no discount and the fields stay integers` | ✅ |
| AC-39 | Поріг `0` заданий і досягнутий | `discounts.ts:priceOrder` (крок 5, `!== undefined`) | `AC-39: a threshold of 0 is set and met, not absent` | ✅ |
| AC-40 | Нечитабельний поріг закриває код і не показується | `discounts.ts:priceOrder` (крок 5; крок 11, умовне поле) | `AC-40: an unreadable threshold closes the coupon and is not echoed` | ✅ |
| AC-41 | Нерядковий елемент ігнорується як порожній | `discounts.ts:normaliseCode` (крок 4) | `AC-41: a non-string entry is ignored like a blank one and never throws` | ✅ |
| AC-42 | Невідомий `kind` дає нуль, а не здогадку | `discounts.ts:discountFor` (фінальний `return 0`) | `AC-42: an unrecognised kind gives no discount and never throws` | ✅ |
| AC-43 | Верхні межі розділу 3 лишаються в безпечних цілих | `discounts.ts:priceOrder` (кроки 2, 6, 12), `discounts.ts:idiv` | `AC-43: the stated upper bounds stay inside safe-integer arithmetic` | ✅ |
| AC-44 | Порожній каталог відхиляє все і не ламає суму | `discounts.ts:priceOrder` (індекс `byCode` порожній) | `AC-44: an empty catalog rejects every code and still prices the order` | ✅ |
| AC-45 | Пошук у каталозі стоїть раніше за перевірку часу | `discounts.ts:priceOrder` (порядок кроку 5) | `AC-45: lookup runs before the clock, so an unknown code stays unknown` | ✅ |
| AC-46 | Неіснуючий календарний день → `expired` | `discounts.ts:expiresAtIsUsable` (`setUTCFullYear`) | `AC-46: a calendar day that does not exist expires the coupon` | ✅ |
| AC-47 | Жоден код не зник і не порахований двічі (I-1, I-4) | `discounts.ts:priceOrder` (кроки 4–11) | `AC-47: every unique typed code is accounted for exactly once (I-1, I-4)` | ✅ |
| AC-48 | Чистота, тотожність розкладки, цілі копійки (I-2, I-3, I-5) | `discounts.ts:priceOrder` (весь ланцюг) | `AC-48: the call is pure and the breakdown adds up in whole kopecks (I-2, I-3, I-5)` | ✅ |
| AC-49 | Справжнє 29 лютого проходить перевірку | `discounts.ts:expiresAtIsUsable` (`setUTCFullYear`) | `AC-49: a real leap day survives the calendar check` | ✅ |
| AC-50 | Товар із категорією поза обʼєднанням: у сумі, не в категорії | `discounts.ts:categoryTotals`, `discounts.ts:isKnownCategory` | `AC-50: an item category outside the union counts in the subtotal and no category total` | ✅ |
| AC-51 | `category: null` вважається заданою | `discounts.ts:priceOrder` (крок 6, `!== undefined`) | `AC-51: a null category counts as set, so the coupon covers nothing` | ✅ |
| AC-52 | Категорія поза обʼєднанням не поширюється на кошик | `discounts.ts:priceOrder` (крок 6), `discounts.ts:categoryTotals` | `AC-52: a category outside the union covers nothing rather than everything` | ✅ |
| AC-53 | Перевищення межі місткості обмежується базою | `discounts.ts:discountFor` (`Math.min(…, base)`) | `AC-53: a percentage far past the capacity bound clamps to the base` | ✅ |
| AC-54 | Запис, що різниться лише регістром, недосяжний | `discounts.ts:priceOrder` (індекс `byCode`, перший запис) | `AC-54: a catalog entry differing only in case is unreachable` | ✅ |
| AC-55 | Два коди на одну категорію не складаються | `discounts.ts:priceOrder` (кроки 6, 8) | `AC-55: two coupons on the same category do not compound` | ✅ |
| AC-56 | Строк дії перевіряється раніше за поріг | `discounts.ts:priceOrder` (порядок кроку 5) | `AC-56: expiry is reported ahead of the threshold` | ✅ |
| AC-57 | Відʼємний поріг закриває, а не відкриває промокод | `discounts.ts:priceOrder` (крок 5, `threshold < 0`) | `AC-57: a negative threshold closes the coupon rather than opening it` | ✅ |
| AC-58 | Зсув понад +14:00 відхиляється, +14:00 проходить | `discounts.ts:expiresAtIsUsable` (`DATE_TIME`) | `AC-58: an offset beyond +14:00 is refused, +14:00 itself is accepted` | ✅ |
| AC-59 | Відсутній `expiresAt` не означає «вічний промокод» | `discounts.ts:expiresAtIsUsable` цілком (`typeof !== "string"` і обидва регекспи — див. зауваження нижче) | `AC-59: a missing expiry date does not mean the coupon never expires` | ✅ |
| AC-60 | `Infinity` не віддає замовлення безкоштовно | `discounts.ts:discountFor` (`Number.isInteger`) | `AC-60: an infinite value gives no discount rather than the whole order` | ✅ |

## Зворотна перевірка

### Чи є в коді поведінка, якої немає в жодному AC?

Була — **дві гілки**, обидві знайдені саме цим кроком, обидві вже закриті:

1. **`expiresAt`, який не є рядком або відсутній.** Крок 5 специфікації вимагає
   цього дослівно («нерядковий чи відсутній `expiresAt` жодному регекспу не
   відповідає і теж дає `expired`»), але жоден із 58 критеріїв цього не
   закріплював: AC-17, AC-26 і AC-58 усі подають рядки. Гілка небезпечна тим, що
   реалізація без неї — тобто така, що покладається лише на
   `now >= Date.parse(expiresAt)` — дає `Date.parse(undefined) === NaN`,
   порівняння з `NaN` дає `false`, і промокод без строку дії живе **вічно**.
   Уточнення до рядка AC-59 у таблиці: в `expiresAtIsUsable` цей випадок
   закритий **двічі**. Явний `typeof expiresAt !== "string"` стоїть першим, але
   й без нього `DATE_ONLY.test(undefined)` приводить аргумент до рядка
   `"undefined"`, який жодному з двох регекспів не відповідає. Тому видалення
   самого рядка `typeof` не змінює поведінки й не валить жодного тесту:
   критерій закріплює **поведінку** функції, а не той один рядок. Явну
   перевірку лишено навмисно — вона робить намір видимим і не залежить від
   того, як `RegExp.prototype.test` приводить аргумент до рядка.
2. **`value: Infinity`.** D-27 називає його поіменно поряд із `NaN` і `1234.5`,
   але критерії існували лише на два останні (AC-37, AC-38). Реалізація, що
   перевіряє `Number.isNaN` замість `Number.isInteger`, обчислює
   `min(Infinity, base)` = `base`, тобто віддає весь обсяг промокоду безкоштовно.

Обидві поведінки в коді були правильні, але трималися на прозі специфікації, а
не на тесті. За вказівкою розділу 11 специфікації спершу дописано критерії
**AC-59** і **AC-60** (`docs/spec/pricing-discounts.md`, розділ 5, і два
сценарії в дельту OpenSpec), потім тести. Після цього поведінки без критерію в
коді не лишилось.

Окремо зафіксовано одне місце, яке критерію свідомо **не** отримало: запис
каталогу, чиє поле `code` не є рядком, нормалізується в порожній рядок і стає
недосяжним. Розділ 3 специфікації називає рядковий `code` гарантією викликача, а
його порушення — поведінкою, не визначеною специфікацією; код лише виконує
загальну обіцянку розділу 7 «не кидати виняток на будь-якому значенні всередині
правильної форми». Критерій тут закріпив би те, чого специфікація не обіцяє.

### Чи є AC без тесту?

Немає. Перевірено механічно, а не оком: усі ID від `AC-1` до `AC-60` присутні в
іменах тестів, без пропусків і без зайвих.

```bash
grep -o 'AC-[0-9]*' app/src/discounts.test.ts | grep -oE '[0-9]+' | sort -n | uniq | diff <(seq 1 60) -
```

### Чи є тест, який не мапиться на жоден AC?

У `app/src/discounts.test.ts` — немає, усі 60 названі за критерієм. Поза ним у
пакеті лишаються 8 засіяних тестів `app/src/pricing.test.ts` на вже
специфіковану поведінку (підсумки, доставка, відсоток за рівнем). Вони не
мапляться на жоден AC і не мають: ця поведінка існувала до специфікації, і
`priceOrder` її не змінює, а використовує.

## Що з цього вийшло

Зворотна перевірка знайшла дві розбіжності, і обидві — одного роду: не помилка
в коді, а **поведінка, яку специфікація описала прозою й не закріпила
критерієм**. Таблиця «AC → код → тест» їх не показала б ніколи, бо вона йде
тільки в один бік: усі 58 рядків були заповнені й зелені саме тоді, коли обидві
дірки були відкриті. Знайшов їх лише прохід у зворотний бік — від гілок коду до
списку критеріїв.

Специфікацію довелося правити після початку кодування — додано AC-59 і AC-60.
Це говорить не про те, що вона була неповна в рішеннях: усі 32 рішення розділу 4
витримали реалізацію без жодної зміни, і жодної розвилки, не закритої рішенням,
не знайшлось. Неповним був **шар перевірки**: критерії писалися від рішень, а
рішення D-24 і D-27 кожне перелічує кілька випадків, і критерій дістався не
кожному. Ціна помилки при цьому нерівномірна — обидва пропущені випадки
відкривали знижку, а не закривали, тобто коштували б магазину грошей, і жоден із
них не проявився б у тестах.
