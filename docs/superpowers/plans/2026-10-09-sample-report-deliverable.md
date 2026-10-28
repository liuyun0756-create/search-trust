# Sample Report: review the deliverable

Approved scope: local website redesign only. Retain the same AC repair case and two stages. Present report prose as a deliverable, with one visible demonstration disclosure outside the document. Do not invent measured results or source snapshots.

1. Explain both workflows before the reader. Service requires a completed Prospect Case; direct service is unavailable. No automated email promise.
2. Use an accessible two-stage reader with section navigation, evidence disclosures and detailed three-action plans. Preserve #sample-prospect, #sample-verified and #report-scenarios deep links.
3. Replace independent wording editors with a local-only action-plan demo using the real DeliveryPlanAction fields. Save, preview and confirm are isolated demo states. Evidence is immutable; target changes require review. Draft edits must not alter saved preview; further edits reset confirmation.
4. Put PDF branding controls above the plan: agency/personal name, agency logo (PNG/JPEG <1MB), client name and footer. Applies to PDF downloads in the real workspace, not saved or applied to share links. Retain SearchTrust identity. No client logo, brand persistence or full white-label claim. Local branding preview is not a PDF export. Existing fixed PDF clearly remains unchanged by demo edits.
5. Replace repeated delivery claims with stage-specific client conversation guidance linking to the corresponding report sections.
6. Update report FAQs, preserve paid workflow rules, and use separate Prospect/service entries.

Verification: component tests for stages, immutable evidence, draft/save/review, logo validation and local isolation; E2E deep links, workflow details, desktop/mobile overflow and no API mutations; typecheck and production build; local browser visual review. No deployment.

## Completed verification

- Sample Report and MethodGuide component suites: 14 tests passed.
- New Sample Report E2E suite plus homepage-to-report deep-link regression: 4 tests passed.
- TypeScript check and production build passed; `git diff --check` passed.
- Responsive checks at 1440, 1024 and 390 px passed without horizontal overflow. Manual browser review covered report reading and branding at desktop and 390 px.
- Local preview: http://127.0.0.1:3100/sample-report. No deployment, backend, billing or real-report permissions changed.

## Approved hero refinement

Centered headline, concise introduction and two report-reading buttons. Decorative layered report covers flank the copy on desktop; a quiet curved wash connects the two stages. Artwork is non-interactive and hidden from assistive technology, with paper covers omitted on narrower screens. Both buttons reuse the existing stage-selection and in-page navigation. Workflow cards retain their content and disclosures; only their duplicate reading buttons are removed.

Verification: 7 Sample Report component tests and 4 E2E tests passed, including centered layout at 1440/1191/1024/390 px, keyboard activation, report deep links and no overflow. Typecheck, production build and diff whitespace check passed. Manual desktop/mobile review completed; no deployment.

## Approved workflow panel refinement

Replaced the two collapsed workflow cards with left-aligned pill tabs and one full-width panel. Prospect is selected by default; each stage shows all six existing steps grouped into three columns, a contextual low-contrast illustration and an output summary. No nested accordions or duplicated report-reading buttons. Workflow tabs have their own state, support arrow/Home/End keys, and do not change the report reader, URL or analysis state. Continuity and service-entry limitations remain visible outside the panels.

Verification: 8 component tests and 5 Sample Report E2E tests passed, including complete step visibility, stage/report independence, left alignment and responsive overflow checks. Typecheck, production build and whitespace checks passed. Desktop and mobile visual review completed. Local preview only; no deployment.

## Approved report-reader refinement

Default to complete chapter-by-chapter reading, with an optional continuous view of all five chapters. Compact report metadata replaces the large cover; chapter navigation stays separate from report-stage selection. Desktop navigation is sticky and highlights the current chapter; continuous mode tracks scrolling. Mobile uses a sticky chapter selector and normal page scrolling, not an inner scroll pane. Previous/next controls and existing stage/chapter deep links remain available. Scroll and focus run after the selected chapter is rendered.

All three action plans are fully visible in the actions chapter. Unconfirmed evidence conditions stay visible beside their observations; auxiliary checked-scope detail can expand. Review & branding is a separate post-reading handoff, not a report chapter. Original report content, backend, billing, PDFs and editing permissions are unchanged.

Verification: 9 component tests and 6 Sample Report E2E tests passed, covering keyboard focus, chapter visibility, deep-link refresh, continuous scroll tracking, sticky navigation, both stages and widths 1440/1191/1024/390 px. Typecheck, production build and whitespace checks passed. Manual desktop and mobile visual review completed. Local preview only; no deployment.

## Approved delivery showcase (supersedes the local form demo)

Replaced the separate branding form and local action-plan editor with one three-step showcase: adapt the plan, review the client version, then add PDF identity. The shared report stage presents proposed/adapted action wording, all three actions with completion and client-confirmation checks, and default/branded cover comparisons. The section retains #plan-review and links to Prospect and existing-client Case entry points.

Removed the marketing-page input/upload forms, draft/save/approval simulation and associated unsaved-change guards. Real workspace editing, report evidence, exported PDFs and backend permissions are unchanged. The showcase does not imply a successful save, approval or send. PDF branding boundaries remain visible: per-export only, not saved, no online-link branding, SearchTrust remains. FAQ copy now describes the showcase instead of page edits.

Verification: 9 component tests and 6 E2E tests passed, including both comparisons, keyboard navigation, no form inputs/API writes, three visible review actions, branding limits and overflow checks at 1440/1191/1024/390 px. Desktop/mobile visual review completed. No deployment.

## Approved report-backed client conversations

Replaced stage-specific conversation guidance and repeated chapter links with three independent client–SEO conversation cards: why this work, what is included, and how progress will be reviewed. Each card shows its initial question, SEO answer and a readable report excerpt by default. Excerpts include concrete findings, three proposed actions or completion/review checks, rather than source-category chips. The existing Verified report supplies the recommendation and action titles; no measured results or quantitative evidence have been invented.

Each client follow-up opens its own SEO reply without closing another card, changing report selection or navigating away. Desktop uses three columns; narrower screens stack the cards. Frontend-design and micro-interaction guidance informed the restrained document/chat hierarchy, explicit keyboard-accessible expansion state and reduced-motion behavior. No fake typing, autoplay, editable fields, API mutations, billing changes or report-permission changes.

Verification: 11 component tests and 7 Sample Report E2E tests passed. Typecheck, production build and whitespace checks passed. Responsive checks cover 1440/1191/1024/390 px, independent expansion, keyboard focus, no overflow, unchanged report stage/hash and reduced-motion support. Manual desktop/mobile visual review completed. Local preview only; no deployment.
