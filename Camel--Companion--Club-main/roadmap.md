# EduPulse continuity and languages
## Hackathon prediction demonstration
- [x] Add explicitly simulated model metrics, sample-only risk probabilities, student selection and illustrative factor bars.
- [x] Link the selected student to the plans page with an unreviewed teacher form; never persist simulated evidence.
- [x] Translate all new UI and verify selection, handoff, human review and layouts with focused tests.

Verified: 36 focused tests passed, covering the supplied 78/34/8 risks, 92 confidence, 89.4/91.2/0.90 illustrative metrics, 42/28/18/12 relative example weights, exclusion of real/unknown students and access-scoped handoff. The real inference service still reports not configured; only the explicitly chosen hackathon UI uses simulation. Signed-in Playwright selected all three requested examples, followed the selected ALU-8102 to /planes, verified blank notes and unchecked review, required human confirmation, saved a teacher-authored support plan and read it back after reload. The temporary plan was deleted without changing existing plans or proposals. Spanish/English/French, the user's 1068×674 viewport and 390×844 mobile layout render without horizontal overflow or page errors. All content leaves retain app-specific metadata; latest build is OK. No real model was trained, evaluated or connected.

## Requested initial educational data
- [x] Identify the intended teacher/school without crossing account boundaries.
- [x] Persist the five supplied pseudonymous students, connectivity, contextual factors, and a reviewed intervention plus a separate proposal awaiting teacher validation.
- [x] Show the seeded records across the educational views and verify saved data through the signed-in interface.
- [x] Set sandbox-only sample capacity to the requested 9/4/2 without fabricated paid orders, licences or emails; preserve live inventory.
- [x] Run focused data, review, permissions and language tests.

Verified in the requesting user's existing teacher account: five persisted students with the supplied attendance, grades, resources, connectivity and observations; rule-derived red/red/yellow/green/green levels; one reviewed ALU-8102 follow-up plan and one unreviewed ALU-4319 proposal. Unspecified submissions and two historical dates use disclosed illustrative values, explicitly marked as demo data. All six requested views read Cloud records; course/code search, red-alert filtering, student detail, English/French headings and Spanish authored observations were checked in the signed-in UI. A disposable proposal required explicit review, became one persisted plan after reload and was deleted; the original pending proposal remains unapproved. No AI predictions were fabricated. Verified 9/4/2 sandbox availability after authoritative reconciliation of expired Stripe sessions, retaining the pre-existing active pilot purchase and adding only one private district sample allocation. Forty-five focused tests and six capacity/grant/concurrency integration tests passed; temporary payment fixtures were removed, live capacity remained unchanged and the latest build is OK.

## Purchase confirmation emails
- [x] Configure hackathon-only Resend sending from onboarding@resend.dev to the owner's specified Resend registration email; do not redirect live purchaser confirmations.
- [x] Add trilingual confirmation details addressed only to the billing email after verified licence activation, with private durable queueing and Resend gateway delivery.
- [x] Prevent duplicate confirmations with atomic activation queueing, exclusive claims, stored payloads and provider idempotency; retry transient failures and hold ambiguous outcomes beyond the safe retention window.
- [x] Add managed authenticated five-minute purchase reconciliation and email retries, including purchasers who close checkout before returning.
- [x] Complete a real Stripe sandbox checkout and verify Resend accepts the confirmation with the requested sender and recipient; repeated reconciliation does not resend. Remove the disposable purchase and restore its capacity.

Hackathon verification: 46 focused rule, confirmation, Cloud outbox and language tests passed. A EUR490 sandbox checkout was completed in Stripe, activated through the authenticated reconciliation job and sent from the requested testing sender solely to the user's specified account email. Resend returned an accepted email ID persisted as sent; re-running the job preserved that ID and attempt count. Inbox placement cannot be observed from this project. Test configuration never claims live purchases and a verified domain is still required for future real purchasers. Publish these changes to apply the new sender configuration and scheduled job to the published app.

Verified: 42 focused confirmation, Cloud outbox, licensing-rule and language tests passed. Real Cloud fixtures confirmed unpaid/invalid activation queues nothing, concurrent activation queues once, claims are exclusive, acknowledgements persist and expired ambiguous sends are held for review; fixtures were removed. Authenticated job reconciles successfully and reports sender unconfigured with zero sends; unauthenticated job is rejected (401). Purchase page renders with no runtime errors and the latest build is OK. An older capacity regression assumes two regional places remain but only one is currently available from existing orders; it was not modified or made to delete existing purchases.

## Institutional payments
- [x] Confirm own-account Stripe after explaining built-in payments, and obtain actual package prices, currency, capacity and beneficiary assignment rules.
- [x] Connect the confirmed Stripe integration securely before implementing checkout.
- [x] Add guest institutional contracting with dynamic package amounts and verified, idempotent licence activation and capacity accounting.
- [x] Verify successful, cancelled and sold-out flows with tests and the checkout interface in all three languages.

Verified: actual hosted Stripe test checkout at EUR4,500 for two solidarity centre places, active persisted licence after return and reload, exhausted-capacity disabled button, unpaid checkout with no licence, cancellation and restored places, trilingual titles and mobile layouts without overflow. Thirty-seven licensing/language/routing tests (including real Cloud concurrency, grants and idempotency checks) and nineteen educational regression tests passed. Disposable Cloud orders/licences were removed and initial test capacities restored to 10/5/2. Payments remain in Stripe test mode; live payments require the owner's live key and publication. Solidarity places explicitly await designation of real schools; no school bank data or prioritisation was fabricated. Verification uses Stripe session retrieval on return and on package refresh; no webhook or background schedule was added.

- [x] Preserve working student, alert, prediction and plan navigation with Cloud permissions.
- [x] Unify language selection and shared controls; translate dynamic signals in Spanish, English and French.
- [x] Verify navigation, persisted data, languages and consistent layouts.

Verified with a disposable teacher: student creation/persistence, alert filtering and translated factors, all five tabs after password sign-in, prediction model-not-configured state and observed signals, French intervention creation/persistence, language persistence and translated leaf metadata, desktop/mobile layouts. No model was connected and no AI predictions were fabricated.

## Previous Cloud delivery
- [x] Email registration, sign-in, profile and secure school membership.
- [x] Persistent pseudonymous students, metric history and human-reviewed interventions.
- [x] Cloud-backed classroom, alerts, plans and director aggregates with live updates.
- [x] Trilingual interface, permission tests and end-to-end verification.

Verified with disposable accounts: email/password sign-in, new school, email-bound invitation, student creation/edit, reviewed plan creation/completion, persistence after reload, live director updates, cross-school permissions, director aggregate-only access and sign-out. Email/signup settings were read from hosted auth; reserved test domains are rejected. Inbox delivery and recovery-link round trip were not verified.