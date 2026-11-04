<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Institutional contracting is public and guest-based; private order access uses a per-browser random capability hash, never a purchaser account or exposed billing records.
- Institutional capacity and flat package amounts are enforced by service-role-only SQL functions; pending orders reserve centres and atomic verified activation creates one licence without double-counting, with isolated test/live inventories.
- Stripe checkout uses inline price_data and authoritative session retrieval; reconciliation never releases unknown payment states by time alone, and solidarity licences remain explicitly unassigned until real beneficiary schools are designated.
- Guest checkout return origins must be explicitly allowed; receipt leaves are non-indexable, and browser-held capabilities are never placed in navigation URLs.
- Human-delivered support/training uses Stripe automatic tax with inclusive package totals; checkout metadata contains order/package references only, not educational records.
- Licence activation transactionally enqueues one private confirmation; Resend uses persisted payloads and stable idempotency keys, bounded to its retention window, so retries do not duplicate mail or affect paid licence activation. Production requires a configured verified sender; explicit owner-only testing configuration claims sandbox purchases only and enforces its fixed recipient before every send.
- Purchase email recovery runs through a managed-authenticated public job route that reconciles Stripe before draining the outbox; this covers purchasers who do not return from checkout without exposing billing data.
- Domain logic lives in src/lib/edu (pure, tested); store.ts adapts authenticated Cloud data to domain records and prediction-service.ts remains separate to avoid fabricated AI outputs.
- Hackathon prediction fixtures live separately from the real prediction-service contract, apply only to marked sample students and never enter persisted educational evidence; plans handoff carries an accessible student ID only and starts with explicit review unchecked.
- Initial example records are explicitly marked as samples and imported once into the intended teacher's school, never injected during page reads; original authored observations are distinct from computed rule factors.
- Unreviewed suggestions live in intervention_proposals; caller-RLS SQL validation atomically creates a reviewed intervention only after explicit teacher confirmation, preserving the active-plan review invariant.
- Sandbox example capacity lives in private institutional_sample_allocations and is included in both availability and atomic reservations, never represented as paid orders, licences or confirmation emails.
- Educational pages live under the client-only authenticated layout; one root-mounted auth subscriber updates identity and cache, preventing private SSR reads and stale signed-out data.
- Sign-in preserves a sanitized same-origin destination so each educational tab resumes after login instead of always opening the dashboard.
- Educational selectors share EduSelect and the language picker uses the same Button/menu system; rule factors and model status are semantic data translated by the UI, not stored-language copy.
- Leaf metadata uses eduPageHead locale keys, refreshed on language selection; the document shell reflects the same i18n language for accessibility after reload.
- School roles are protected in user_roles, never profile metadata; new-school creation is isolated, and existing-school membership requires a director-issued email-bound invitation to prevent privilege escalation.
- Teachers can read/write only their own school students and reviewed plans; directors read aggregate-only SQL results, with no student observations or notes exposed.
- Metric snapshots are maintained by database triggers; data-free private per-user notifications invalidate Cloud queries, avoiding disclosure through live updates.
- Aggregate trends use one latest UTC-day snapshot per student, and intervention inserts require explicit reviewed=true; server-controlled timestamps prevent fabricated audit dates.
- Email recovery state belongs to the root auth subscriber, not URL parsing in the recovery page, because authentication consumes recovery parameters before rendering.
- i18n: i18next with bundled es/en/fr JSON in src/i18n/locales (single "translation" namespace, semantic keys). All UI strings go through useTranslation; never hardcode copy in components. SSR translations use one instance per router/request. The first client hydration takes its language from the server-rendered html element; persistLanguage keeps the cookie and local preference aligned. Do not change the shared client instance while deferred boundaries hydrate. A vitest test enforces key parity across locales; add new keys to all three files.

- Impact Lab reuses intervention_plans; impact_studies stores one immutable server-captured baseline per plan, and impact_followups is append-only through ownership-checked RPCs. Illustrative targets never enter either table.
- Institutional impact releases only cohorts of at least five distinct real students and selects one latest measured plan per student. The legacy director dashboard also suppresses small and complementary groups. This is a disclosure-reduction rule, not a guarantee of anonymity or causal validation.
