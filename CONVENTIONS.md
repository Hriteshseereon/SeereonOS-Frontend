# SeereonOS web — build conventions

Read this before writing any screen. The foundation is done; modules fill in pages and API clients.

> **There is no mock / demo mode any more (v8).** Every call goes to the real backend (`backend/`, FastAPI +
> PostgreSQL) at `VITE_API_BASE_URL` (default: same-origin `/api/v1`). Business rules, money and permissions live
> ONLY in the backend. `src/mock/` is a frozen TypeScript reference kept for backend tooling (golden vectors /
> parity); it is excluded from `tsconfig.json`, never shipped, and **no app file may import it**
> (`grep -rn "@/mock\|/mock/" src --include=*.ts --include=*.tsx | grep -v "^src/mock/"` must print nothing).
> Sections below that mention `src/mock/...` describe rules that now live in the matching `backend/app/...` module.

## Stack
React 18 + TypeScript + Vite, Tailwind v4 (tokens from the tenant theme), TanStack Query, Zustand, Recharts, Radix (dialog/menu/popover/tooltip/switch), cmdk, sonner, lucide-react, date-fns, jsPDF + autotable, ExcelJS, dnd-kit.

## Folder ownership
- `src/types/entities.ts`, `src/types/reports.ts` — entity + report contracts (snake_case, money in paise). Read-only for modules; if you truly need a new field, add it as optional and note it in your report.
- `src/domain/*` — calendar, money formatting, costing, permissions, labels, `docMarkup` (letter markup renderer +
  placeholder catalogue), `defaults` (DEFAULT_THEME / DEFAULT_SETTINGS for display). Pure, frontend-owned. Use them; don't duplicate.
- `src/api/http.ts` — the only transport (fetch, bearer token, If-Match, `cache: 'no-store'`); `src/api/query.ts` — `useApi` / `useMut`.
- `src/api/types/*.ts` — JSON shapes of API responses that are not plain entities (dashboards, sales, finance, …). Types only.
- `src/api/<module>.ts` — typed client functions + `useApi` hooks for your module.
- `backend/app/routes/<module>.py` — the REST handlers; `backend/app/engine/*` — shared calculations (analytics, costing, workflows, maker-checker, docgen).
- `src/modules/<module>/*` — pages and components. Page files already exist as stubs with a default export; replace them, keep the file name and default export.
- `src/ui/*` — design system. Import from `@/ui`. Do not fork components; compose them.

## API contract (mirrors FastAPI /api/v1)
- Client: `http.get/post/patch/put/del` from `@/api/http`; `http.full(method, path, {body, ifMatch})` returns `{data, warnings}` — pass that to `useMut` so warnings toast.
- Reads: `useApi(['key', ...], () => api.x())` (tenant + role scope is prefixed automatically).
- Writes: `useMut(fn, { success: 'Saved' })` — errors toast automatically with the API message. After ANY successful write
  (non-GET, except read-only previews/quotes/simulations) the transport triggers `refreshAfterWrite()`: every cached query
  is invalidated and the ones on screen refetch, so new records appear in every list/dashboard without a reload.
  `invalidate: [...]` may still be passed as documentation; it is not needed for correctness.
- Errors: never swallow them. Lists/details render `<ErrorState error onRetry>` with the backend's message; mutations toast
  it (or show it inline with `silentError` + your own `Callout`). Network failures and 502/503/504 also raise the global
  "Can't reach the server" banner (`src/app/ConnectionBanner.tsx`), which retries by itself. A 401 signs the person out.
- Errors from the backend: `{error: {code, message, field?}}` → `ApiError(status, code, message, field)`. Show `message`; map `field` to the form field.
- Money is paise integers. Money is computed by the backend, never in components. Components only format (`fmtMoney`, `fmtMoneyExact`, `fmtMoneyCompact`, `<Money/>`).
- Planned price chain (CEO definition): total cost = people + additional costs + maintenance → + contingency (% of total cost)
  → actual cost → + markup (% of actual cost) → project price (to the paisa). Show it with `<CostChain>` (`src/modules/projects/costing/CostChain.tsx`).
- Payments: only through the server's provider (Razorpay order → Checkout → server-side signature verify). When `GET /billing`
  says `payments.enabled = false` the UI shows no pay buttons. Nothing in the UI may fake success.
- Strip salary/margin fields when the viewer lacks the grant (`canSeeMargins(ctx)`, `canSeeSalaries(ctx)`), and make the UI handle `null`.
- View-as and read-only tenants are enforced by the router for all non-GET routes. In the UI, disable write controls with `useReadOnly()` and hide ones the role can't use with `useCan()` / `<Can>`.

## Design language (Apple / Zoho / One-design calibre)
**Two layouts, one codebase.** The desktop web app (≥1024 px, `lg:`) is a proper, information-dense web application: persistent sidebar, wide canvas (up to 1680 px), multi-column dashboards (12-col grids, 3–4 KPI tiles per row, side-by-side charts), full sortable data tables, master–detail and split views, hover states, keyboard shortcuts, right-side drawers. It must NOT look like a stretched phone screen — no single centred column of big cards, no oversized touch spacing on desktop.
The same screens must also render pixel-perfect on phones (<768 px) for the mobile app: bottom tab bar, cards instead of tables (`mobileCard`), bottom sheets, sticky action bars, 16 px gutters, ≥40 px touch targets, no horizontal page scroll. Tablet (`md:`) sits in between. Build the desktop layout deliberately AND the phone layout deliberately — both are first-class; check both at 1440×900 and 390×844.
- Desktop density: body 14 px, table rows ~44 px, controls 36–40 px, 24–32 px page padding, cards with 20 px padding; use `lg:grid-cols-12` compositions, sticky page toolbars, split panes (list left, detail right) where it helps.
- Page skeleton: `<PageHeader title subtitle actions back?/>` then content. Section labels via `<SectionTitle>`; cards via `<Card>` + `<CardHeader>`.
- Lists: `<DataTable>` with a `mobileCard` renderer (phones get cards, desktop gets the table). Grouped settings/mobile lists: `<ListGroup><ListRow/></ListGroup>`.
- Forms: `<Field label hint error required>` wrapping `Input/Select/Textarea/MoneyInput/Combobox/PeoplePicker/Switch/Checkbox/Segmented`. Create/edit flows use `<Dialog>` (bottom sheet on phones) or `<Sheet>` for bigger forms. Primary action bottom-right on desktop, full-width stacked on phones (Dialog footer does this).
- Confirmation & reasons: `const { confirm, askReason } = useConfirm()` — never `window.confirm/prompt/alert`.
- Status: `<StatusBadge map={PROJECT_STATUS} value=…/>` and maps in `@/domain/labels`. Semantic tones only for state; brand colour for identity/primary actions.
- Numbers: `tnum` class / `<Money>`; right-align numeric table columns. Dates via `fmtDate`. Hours via `fmtHours`.
- Every data view has loading (`SkeletonRows`/`SkeletonCards`), empty (`EmptyState` with a next action) and error (`ErrorState` with retry) states. Use `<QueryState q={…}>` where convenient.
- Charts: `BarChart / LineChart / DonutChart / ChartTable` from `@/ui`. One axis only. A lone series wears brand colour; multiple series use the validated palette in fixed order. Provide a table view toggle for important charts.
- Icons: lucide-react at 16–20 px, stroke ~1.9. No emoji in UI.
- Copy: short, specific, active voice. Buttons say what they do ("Submit week", "Record payment"). Toasts confirm in past tense ("Week submitted"). Errors explain the fix.
- Touch targets ≥ 40 px on phones. Sticky bottom action bars on phone for primary flows (e.g. timesheet Save/Submit) positioned above the tab bar: `fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] lg:static`.
- Use `useUI().openTask(id)` to open the task drawer from anywhere; `useUI().openAI(prompt)` to open the AI assistant with a question.

## Accounts
There are no demo logins in the app. Create a workspace with **Sign up**, then invite people from People. Optional local
development fixtures are a backend concern (see backend/README.md) and never part of a production deployment.

## Brand
The official Seereon logo is in `src/assets/` (gold on transparent): `SeereonLogo`, `SeereonEmblem`, `Wordmark` in `@/ui`, raw URLs in `@/assets/brand`. Never redraw or alter the emblem (the Ashtalakshmi star frame is sacred). Seereon tenant's `logo_data_url` is the emblem; other tenants upload their own. Brand gold `#DAB34F` is the Seereon preset accent.

## Checks before you finish
`npm run typecheck` must report no errors, and `npm run build` must succeed. Keep all state server-side (no page-level fake data, no browser-only records).

## Corporate visual language (v2 — replaces anything above that conflicts)
The product must read as a clean enterprise application (SAP Fiori / Zoho / Microsoft 365 / Apple Settings), never as an AI-generated template.
- **Default is light mode.** Theme default: IBM Plex Sans, soft (4–8 px) radii, light sidebar, comfortable density.
- **Icons:** only from `@/ui/icons` (Phosphor, regular weight). 16 px in dense UI, 18 px in navigation, 20 px max elsewhere. No icon tiles/chips (coloured squares behind icons), no decorative icons on every card title or KPI tile, no emoji. Use an icon only where it helps recognition (actions, navigation, status).
- **No decoration:** no gradients, glows, blurred/frosted backgrounds, grid patterns, coloured card stripes/rails, drop shadows on cards (border only; shadows only for popovers, dialogs, sheets).
- **Typography:** weights 400/500/600 only (never 700+). Page title 20–22 px/600. Card title 14 px/600. Body 13.5–14 px. Labels/help 12–12.5 px in `text-ink-3`. Sentence case everywhere; UPPERCASE only for table column headers (11.5 px, 0.04em tracking). No letter-spaced eyebrows over headings.
- **Colour:** brand colour for primary actions, active navigation, selected state and single-series charts only. Status colour only for status. Everything else neutral (ink / ink-2 / ink-3 / line / surface).
- **Components:** cards `rounded-lg border border-line bg-surface`, no shadow. Badges are small rectangular pills (`Badge`/`StatusBadge`), no dots. Avatars are flat tinted initials. Buttons: one primary per view; secondary is outlined.
- **Layout:** no element may overlap another or overflow the viewport at any width from 360 px to 1920 px. Long text wraps or truncates inside `min-w-0` containers; numbers never wrap mid-value (`whitespace-nowrap tnum`). Wide tables scroll inside their card (`overflow-x-auto`). KPI rows: `grid-cols-2` on phones, 3–4 per row on desktop (never more than 6); labels wrap to two lines rather than truncate.
- **Check:** run the audit script (see your brief) at 360/390/768/1024/1280/1440/1920 until your routes report no overflow, offscreen or overlaps.

## v3 business processes — shared contracts
- New entities: `src/types/business.ts`. New Task fields (optional) in `entities.ts`: kind, assigned_by, reviewer_id, submitted_on, approved_by, approved_on, review_round, timeliness, variance_days, delay_reason_code, delay_reason, quality_rating, priority.
- New DB tables are declared in `src/mock/server.ts` (task_reviews, documents, document_versions, document_acks, document_views, leave_requests, leave_policies, appraisal_cycles, appraisals, goals, feedback, candidates, interviews, lifecycle_checklists, assets, expense_claims, vendors, purchase_orders, vendor_bills, budgets, clients, contracts, revenue_leakage, objectives, key_results).
- Seed data for each area goes in `src/mock/seeds/<area>.ts` (`seed(db, h)`), called at the end of buildSeed. Use `h.base(tenantId)` for row metadata, deterministic `h.rnd()`, dates relative to `h.today`. Seed BOTH tenants sensibly where relevant (Seereon richly; Kalinga lightly).
- Shared calculations: `src/mock/performance.ts` (workingDayVariance, timelinessOf, taskTimeliness, taskStats, reportsOf, teamOf, DELAY_REASON_LABEL). Never re-implement task timeliness elsewhere.
- Built-in project `p_general_<tenantSlug>` (code GEN, "General & admin") holds general tasks that line managers assign outside client projects.
- Approval endpoints (fixed contract, used by the Approvals inbox):
  - Tasks: `POST /tasks/:id/submit {note, proof_url?, delay_reason_code?, delay_reason?}` · `POST /tasks/:id/approve {quality_rating (1–5), note?}` · `POST /tasks/:id/send-back {reason (min 10 chars)}`
  - Leave: `POST /leave-requests/:id/approve` · `POST /leave-requests/:id/reject {reason}`
  - Expenses: `POST /expenses/:id/approve` · `POST /expenses/:id/reject {reason}` · `POST /expenses/:id/pay`
  - Purchase orders: `POST /purchase-orders/:id/approve` · `POST /purchase-orders/:id/reject {reason}` · Vendor bills: `POST /vendor-bills/:id/approve` · `POST /vendor-bills/:id/pay`
  - Appraisals: manager acts on `/appraisals/:id` (no inline approve).
  - Timesheets: existing `/approvals/:weekId/approve|reject`.
- Every decision writes `logActivity(ctx, entity, id, action, summary)` and notifies the requester with `notify()` (use the closest NTF code; NTF-14 for task assignment, NTF-06 for send-backs/rejections, NTF-05 for approvals).
- Roles: `ops` is shown as "HR & operations" — it is the HR role.

## v4 access, master data, workflows & maker-checker — shared contracts
- **Permissions are the only capability check.** Keys and default roles: `src/domain/permissionCatalog.ts` (PERMISSIONS, DEFAULT_ROLES, effectivePermissions). `Action` = permission key. UI: `useCan()(key)` / `<Gate action>` / `<GateAny actions>`; NavItem `action` or `anyOf`. Server: `has(ctx, key)`, `hasAny`, `requireAction`, `requireAny`, `usersWith(ctx, key)`, `permissionsOf(user)`.
- **`ctx.role` / `useEffectiveRole()` is the persona** (admin | pm | sales | ops | employee) — use it ONLY to pick a home dashboard or default view, never to decide what someone may see or do. Data scope = permission (e.g. `projects.view_all`, `deals.view_all`, `people.view_all`, `documents.view_all`), else own/team scope.
- Roles are tenant data: `db.roles` (RoleDef: key, name, persona, permissions, is_system, active). User: `role_key`, `extra_permissions`, `revoked_permissions`, `must_change_password`, master refs (`employee_code, department_id, designation_id, grade_id, location_id, shift_id, cost_centre_id, employment_type`). `user.role` is kept equal to the role's persona. Login and `/me` return the user with computed `permissions` and `role_name` (`withAccess(u)`).
- Default roles: Administrator (locked, full), CEO, CTO, Project Manager, HR Manager, HR Executive, Sales Manager, Sales Executive, Employee. Demo: santosh=CEO, debasish=Administrator, subhankar=Project Manager (+margins.view), priya=HR Manager, baishali=Sales Manager, subham=Sales Executive, devs=Employee.
- View as: header `X-View-As: <role key>`; session `viewAs = {key,name,persona,permissions}`; read-only.
- **Maker-checker** (`src/mock/makerChecker.ts`, client `src/api/changes.ts`): guarded writes validate, then `return propose(ctx, {entity, entity_id, action, summary, before, after, payload, required_permission, base_version})`. Register the real write with `registerApplier(entity, (ctx, cs) => ({ result, result_id }))` at module load of the route file. Response is `Proposed<R>` = `{pending:false,result,result_id}` | `{pending:true,change}`; UI calls `announce(r, 'Saved')` and must handle both. Maker ≠ checker; checker needs `makerchecker.check` + the change's `required_permission`. Tenant config `tenant.maker_checker {enabled, entities[], sla_days}`. Change screen: `/changes`; notifications link there.
- **Approval workflows** (`src/mock/workflows.ts`): `resolveChain(ctx, process, {requester_id, amount_paise, project_id, reviewer_id})` → ordered `{step, index, approver_id}[]`; `nextInChain(chain, currentApproverId)`. Defaults reproduce v3 behaviour. Processes: leave, expense, purchase_order, vendor_bill, timesheet, task_review.
- Master data tables: locations, departments, designations, grades, cost_centres, shifts, email_templates, email_outbox; `tenant.org` (OrgProfile). Provisioning for new tenants: `src/mock/seeds/access.ts provisionTenant` → `seeds/master.ts provisionMaster`.
- Emails are never really sent: the mock writes `email_outbox` rows (rendered template). The UI shows them under Setup → Emails → Sent.
- Routes: `/setup` (SetupLayout: checklist, org, locations, departments, designations, grades, cost-centres, shifts, roles, roles/:key, maker-checker, workflows, emails), `/people` (users & employees), `/people/new` (create employee), `/changes`, `/welcome/password` (forced first-login password change).

## v5 Feature Guide parity — shared contracts
The Feature Guide (Seereon Delivery Board, 28 Sep 2026, `docs/Seereon-Delivery-Board-Feature-Guide.pdf`, screenshots in `docs/feature-guide-screens/`) is the priority spec; checklist with IDs in `docs/feature-guide-checklist.md`. Every G-ID must be fully implemented without removing any v3/v4 feature (approvals, maker-checker, permissions, master data…).
- Task detail: `Task.stage` (TaskStage), `progress` (0–100), `tag` (TaskTag, e.g. bug), `actual_start_on`, `baseline_due_on`, `target_revisions[]`, `slip_flagged_on`/`slip_note`. `status` stays the summary state all rules use; set stage via `statusForStage(stage, current)`; read with `stageOf(t)` / `progressOf(t)` from `src/domain/delivery.ts`. Moving into unit/functional testing/UAT raises progress to ≥60/75/90; completed = 100. Earned hours = est × progress.
- Complexity adds `very_high`. LeaveType adds `optional_holiday`. ActivityType adds `whatsapp`. Delegation adds `project_id` (scope) and `include_tasks`. DailyUpdate adds `demo_note`. ChangeRequest adds `number`, `requested_by_client`, `requested_on`, `impact_days`, `note`, `proposed_tasks`, `tasks_added_on`. Project `priority` is 1–5 (`PROJECT_PRIORITY`) and `costing` (ProjectCosting). Allocation `milestone_id` may be null = all milestones. User `productive_hours`.
- Settings: `team.default_productive_hours` (default 6). (`finance.cost_loading_pct` is legacy: kept in the settings type for old data, not shown and not used by costing — v6.)
- Costing formulas (Feature Guide §6, v6): cost per hour = monthly CTC ÷ (working days in the month × minimum hours per day), e.g. ₹60,000 ÷ (22 × 9) = ₹303 per hour (`costPerHour` in `src/domain/costing.ts`, `costPerHourFor` in `src/mock/costing.ts`); a full working day = minimum hours × cost per hour; resource cost = cost per hour × minimum hours × alloc% × working days, month by month at each month's rate; man-days = working days × alloc%; price ↔ markup; margin vs markup. No cost loading.
- Header week switcher: `useUI().week` / `setWeek()` / `useWeek()` (Monday ISO) in `src/stores/ui.ts`.
- DB key is `seereonos.mockdb.v9`; seeds must populate the new fields realistically (stages/progress/tags on tasks, costing plans, CR numbers, etc.).

## v7 — sidebar IA, cost calculator, task visibility, workflow management, documents hub, GST invoices
- The Feature Guide features (docs/feature-guide-checklist.md, cross-reference workbook) must NOT change or disappear. v7 only adds and improves around them.
- New entities in `src/types/v7.ts` (CostEstimate, WfTemplate/WfInstance, DocTemplate/IssuedDocument/EmployeeDocument, InvoiceLine/InvoiceParty) and optional GST fields on `Invoice` in entities.ts. DB tables: cost_estimates, wf_templates, wf_instances, doc_templates, issued_documents, employee_documents. DB key bumped.
- New permission keys: tasks.view_all, estimates.manage, documents.templates, documents.employee_files, workflows.design, workflows.start.
- Document generation contract: `issueDocument(ctx, {template_key|template_id, employee_id, vars, title, period, source})` in `src/mock/docgen.ts` (standard placeholders from `standardVars`). Workflows (appraisal letters), payroll (payslips) and onboarding (offer/joining letters) all issue documents through it; employees see them in Documents → My documents.
- Routes: /projects/cost-calculator(/:id), /tasks/new, /workflows, /workflows/designer(/:id), /workflows/run/:id, /documents (hub with tabs), /documents/templates/:id, /documents/employees/:userId, /documents/issued/:id, /finance/invoices/new, /finance/invoices/:id(/edit).

### v7 integration rules (final)
- Task visibility: always use `canSeeTask(ctx, t)` from `src/mock/routes/tasks.ts` for any task list, search or dashboard.
- Invoices: `amount_paise` = taxable value (revenue); GST lives on the invoice only; drafts and cancelled invoices are excluded from revenue, reports and margin counts.
- Generated letters go through `issueDocument` (src/mock/docgen.ts); CTC changes from workflows go through maker-checker `cost_rate`.
- Estimates: named people need `cost_rates.view`; otherwise cost-derived figures are redacted server-side.
- Provisioning for new tenants calls `provisionDocDefaults` and `provisionWfTemplates`.

### v7 test round (final frontend build)
- Persona tests (T1), business-flow/validation QA (T2, 350 API checks) and UI/routes/responsive QA (T3) all pass; reports in the session scratchpad (t1/persona_report.md, t2/qa_report.md, t3/ui_report.md).
- "Achieved, not invoiced" has ONE definition everywhere (CEO, margins, milestones, operations): billing_status none, billing amount > 0, and milestoneState achieved_* (formally achieved or all tasks done).
- Resource load card: over 300% shows per-day terms ("~Xh/day vs Yh focus"); §16 productive hours are guide data, do not change.
- isRealISODate() in src/domain/calendar.ts guards every server date field (no 2027-02-30).
- Deep links: PublicOnly mirrors LoginPage redirect logic; cold deep link lands on the requested route after login.
