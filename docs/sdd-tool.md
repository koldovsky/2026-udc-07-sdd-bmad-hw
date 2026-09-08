# SDD-інструмент: OpenSpec (Task B)

**Інструмент:** [OpenSpec](https://github.com/Fission-AI/openspec) (`@fission-ai/openspec@1.12.0`),
через `/opsx:*` команди, схема `spec-driven`.

**Що згенерував:** `openspec/changes/discount-system/` — `proposal.md` (навіщо),
`specs/pricing-discounts/spec.md` (AC-1…AC-11 у форматі Requirement/Scenario),
`design.md` (алгоритм розрахунку) і `tasks.md` (чекліст реалізації). Сам
контент — числа, рішення, алгоритм — писався вручну на основі вже готового
`docs/spec/pricing-discounts.md`; інструмент дав лише структуру й формат.

**Що дав понад звичайний markdown:**
- `openspec validate --strict` реально перевіряє формат (обов'язкові сценарії,
  Purpose, не дає лишити capability без жодної дельти) — помилку видно одразу,
  а не в рев'ю.
- Явний граф залежностей: `design`/`tasks` заблоковані, поки не готові
  попередні артефакти — порядок роботи неможливо порушити випадково.
- Примусове розділення чому/що/як по окремих файлах, а не один суцільний документ.
- `tasks.md` з чекбоксами, які фаза apply вміє сама відмічати як прогрес.

**Що довелося робити руками:**
- Специфікація `docs/spec/pricing-discounts.md` написана вручну; інструмент почав працювати вже з готовим текстом.
- **Обхід середовища.** `openspec --version` у Git Bash падав із
  `Cannot find module '...\anaconda3\Library\...\openspec.js'` — shell-shim
  викликає `cygpath -w`, а на PATH першою стоїть Anaconda-версія, яка ламає
  шлях. Команди довелося запускати через PowerShell.
