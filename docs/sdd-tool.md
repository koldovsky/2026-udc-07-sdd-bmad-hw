# Task B — SDD-інструмент

**Інструмент:** OpenSpec `@fission-ai/openspec@1.11.0`  
**Схема:** `spec-driven`  
**Хост:** Cursor (`openspec init --tools cursor`)  
**Change:** `openspec/changes/add-checkout-discounts/`  
**Вхід:** уже готова `docs/spec/pricing-discounts.md` (Task A)

---

## Що він згенерував (сам)

`openspec init` створив каркас, а не зміст фічі:

- `openspec/config.yaml` (схема + пізніше вручну доданий `context`)
- порожні `openspec/specs/` і `openspec/changes/archive/`
- `.cursor/commands/opsx-*.md` і `.cursor/skills/openspec-*/SKILL.md`

`openspec new change "add-checkout-discounts"` створив теку зміни і `.openspec.yaml`. Файлів `proposal.md` / spec / `design.md` / `tasks.md` **не було** — CLI лише сказав наступну команду (`status`, потім `instructions <artifact>`).

Зміст чотирьох артефактів написано за шаблонами з `openspec instructions … --json`. `openspec validate add-checkout-discounts --type change --strict` перевірив формат (зокрема `## Purpose` ≥ 50 символів і сценарії з `####`).

У репо після циклу:

| Файл | Роль у схемі |
|---|---|
| `proposal.md` | навіщо / що зміниться / які capabilities |
| `specs/checkout-discounts/spec.md` | delta: SHALL/MUST + сценарії WHEN/THEN |
| `design.md` | як лягає в модулі (`discounts.ts`, `asOf`, без float) |
| `tasks.md` | чекліст 1.1–3.2 з критерієм «готово» в кожному рядку |

---

## Що дав понад звичайну markdown-специфікацію

Авторitative поведінка вже була в Task A: таблиця D-1…D-28, алгоритм у копійках, AC-1…AC-14, сигнатура `priceOrder`. OpenSpec **жодної з цих розвилок не закрив і не запропонував**. Він не прочитав тікет і не сказав «рахуй half-up».

Понад markdown він дав **процес і ворота**, не доменні рішення:

1. **Граф артефактів.** `tasks` заблокований, доки немає `specs` і `design`. Не можна «одразу tasks.md і в код» всередині схеми: `status --json` це показує (`blocked` / `missingDeps`).
2. **Розділення what / how / do.** Task A змішала рішення, алгоритм і контракт в одному файлі. Схема змушує три окремі документи; `design.md` прямо каже не повторювати proposal. Це корисно як дисципліна, навіть якщо текст узятий зі спеки.
3. **Валідатор формату.** `--strict` ловить бриф Purpose і сценарії не з чотирма `#`. Це не перевірка копійок у AC-5.
4. **Change vs main specs.** Delta лежить у `changes/…/specs/`, не в `openspec/specs/`, до archive. Для цього репо (одна фіча) вигода невелика, але контракт «не писати в main spec до apply» інструмент тримає сам.
5. **Чеклісти для наступного агента.** `/opsx-apply` парсить `- [ ] X.Y`. `tasks.md` прив’язує кроки до AC-ID — цього в Task A не було як плану реалізації.
6. **Slash-команди в Cursor.** `/opsx-propose` / `/opsx-apply` — це обв’язка workflow, не нова специфікація знижок.

Підсумок: на **цій** фічі інструмент майже нічого не додав до змісту спеки. Додав обгортку, щоб інший прогін агента йшов тими самими чотирма файлами, а не вигадував структуру.

---

## Що лишилось руками

- Уся таблиця рішень і всі числа AC — до OpenSpec, у `docs/spec/pricing-discounts.md`.
- `context` у `openspec/config.yaml` (стек, «не чіпати `pricing.ts` / `types.ts`»). Без цього `instructions` не знали б homework guardrails.
- Написання чотирьох артефактів. CLI не згенерував текст зі спеки; агент переказав Task A у шаблони OpenSpec. Delta-spec — проєкція AC, не відкриття.
- Ім’я change (`add-checkout-discounts`) і capability (`checkout-discounts`).
- Коміт на `ws07/Enzo-fly`. OpenSpec не комітить.
- Реалізація коду — поза цим пунктом (`/opsx-apply` / Task C). Після `tasks.md` цикл **зупиняється** (скіл propose прямо забороняє імплементацію в тому ж кроці).

Не робили: не ставили Spec Kit / BMAD; не archive (коду ще немає).

---

## Навіщо він тут (не README)

Питання воркшопу: чи SDD-інструмент думає за вас після доброї markdown-спеки.

На цьому прогоні — **ні**. Джерело істини лишилось `docs/spec/pricing-discounts.md`. OpenSpec змусив ще раз сказати те саме мовою SHALL + чекліста і не дав нового правила складання чи округлення. Якби Task A не було, агент у `/opsx-propose` знову мовчки вибрав би розвилки — інструмент цього не блокує, він блокує лише відсутність файлів.

Користь, яка все ж була: явний стоп перед кодом і `tasks.md`, де кожен крок має перевірку. Це дешевше, ніж ще одна вільна імплементація «з голови», і дорожче, ніж просто відкрити Task A і писати `discounts.ts`. Для фічі розміру «одна чиста функція» markdown-спеки вистачило б; інструмент окупається, якщо в репо кілька змін і треба не змішати delta з main spec.
