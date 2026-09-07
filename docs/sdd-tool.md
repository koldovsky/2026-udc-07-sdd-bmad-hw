# Task B — SDD-інструмент

**Інструмент:** OpenSpec (`@fission-ai/openspec` 1.12.0), схема `spec-driven`.  
**Change:** `add-pricing-discounts`  
**Архів:** `openspec/changes/archive/2026-09-07-add-pricing-discounts/`  
**Main spec після sync:** `openspec/specs/pricing-discounts/spec.md`

Вхід був не тікет, а вже готова специфікація `docs/spec/pricing-discounts.md` (Task A: D-1…D-14, AC-1…AC-12, алгоритм §5). Питання цього кроку: що OpenSpec додав *понад* цей markdown, а не чи вміє він замінити Task A.

## Що він згенерував

Цикл `/opsx-propose` → `/opsx-apply` → `/opsx-archive` (зі sync у main specs).

| Артефакт | Шлях | Роль |
|---|---|---|
| proposal | `proposal.md` | навіщо фіча, скоуп, capability `pricing-discounts` |
| delta-spec | `specs/pricing-discounts/spec.md` | ADDED requirements + сценарії WHEN/THEN |
| design | `design.md` | модуль `discounts.ts`, контракт, алгоритм §5 |
| tasks | `tasks.md` | чекліст `- [ ]` під apply |
| main spec | `openspec/specs/pricing-discounts/spec.md` | те саме після archive/sync, уже без заголовків ADDED |

CLI сам файлів не писав: `openspec new change` дав порожній каталог і `.openspec.yaml`. Текст артефактів написав агент за інструкціями `openspec instructions <artifact> --json`.

## Що дав понад markdown-специфікацію

Не нові рішення про знижки. Спека вже закрила розвилки; промпт прямо заборонив їх відкривати, і інструмент цього не зробив.

Що реально з’явилось поверх `docs/spec/pricing-discounts.md`:

1. **Фази.** Propose не дає писати код, навіть якщо в тому ж повідомленні просять реалізацію. Apply не стартує без `tasks.md`. Це дисципліна процесу, не якість вимог.
2. **Трекабельні задачі.** 16 пунктів `- [ ]` з перевіркою в рядку. Markdown-спека має AC, але не має чекліста «зроби модуль → алгоритм → AC-1…AC-12 → npm test», який агент відмічає під час apply.
3. **Форматний контракт.** `openspec validate --strict` вимагає `#### Scenario`, SHALL/MUST, Purpose ≥50 символів. Це ловить зламаний шаблон, не помилку в копійках (15+15 Gold → 4, не 3).
4. **Місце в репо після archive.** Main spec у `openspec/specs/` — канон інструмента. Наша спека в `docs/spec/` лишилась джерелом правди для чисел; OpenSpec тримає її копію у своєму форматі.

У `design.md` з’явилось одне інженерне рішення, якого не було в Task A як шляху файлу: рушій живе в `app/src/discounts.ts`, а не в `pricing.ts`. Це наслідок захищеного контракту, не інсайт OpenSpec.

## Що лишилось руками

- Усі розвилки D-1…D-14 і нормативний алгоритм — у `docs/spec/pricing-discounts.md` до `/opsx-propose`.
- Промпт, який сказав інструменту «транслируй, не вигадуй». Без нього propose міг би наново «вирішити» stacking/округлення.
- Переклад AC у сценарії OpenSpec і чекліст тестів — агент скопіював числа зі спеки; CLI їх не вивів.
- Реалізація (`discounts.ts`, тести) — `/opsx-apply` лише читає `tasks.md`; код пише агент.
- Два корені `openspec/` (репо і `app/openspec/`) CLI не узгодив: команди треба було запускати з кореня репо.

## Висновок

На фічі цього розміру OpenSpec **майже нічого не додав до змісту специфікації**. Він не закрив жодної розвилки, не знайшов пропущеного AC і не перевірив, що 15 × 10% = 1.5, а після half-up округлення результат становить 2 копійки. Думала markdown-спека.

Натомість він дав **обгортку виконання**: окремі фази, чекбокси, валідатор формату, архів. Це відповідає на «навіщо він тут», якщо мета — провести агента через план → код → sync, а не отримати кращі вимоги, ніж уже є в `docs/spec/pricing-discounts.md`.
