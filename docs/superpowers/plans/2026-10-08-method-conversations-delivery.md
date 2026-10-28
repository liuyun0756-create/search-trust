# Our Method: professional conversations and reviewed delivery

## Approved scope

- Add an introduction that explains the two evidence stages for an independent local SEO before the existing five chapters.
- Add five selectable, explicitly fictional email scenarios. Show a specific finding, source basis, qualified implication, relevant competitor context and a concrete offer. Do not manufacture reply rates, testimonials, observations, URLs or metric values.
- Explain source-to-report reasoning in a four-stage diagram with business scope above and SEO approval below. Additional details are native disclosures; essential inputs, checks, outputs and limits remain visible.
- Rework chapter 04 around three accessible tabs: what to change, when it is done and what to review. Keep implementation separate from proposed work and performance claims.
- Rework chapter 05 into a complete read-only fictional Verified Action Plan on the left and an honest, non-interactive video placeholder on the right. Remove the marketing module's SEO/client view toggle. Keep actual workspace permissions unchanged.

## Implementation

`MethodIntroduction`, `MethodConversations`, and `MethodPipeline` precede the chapter navigation. Chapters 01–03 remain intact. `MethodExecutionGuide` and `MethodDeliveryGuide` retain existing section anchors.

The email examples use shared structured data with a selected-first tab default, keyboard navigation and explicit source limitations. They illustrate professional communication, not collected customer findings or sent emails. Competitor comparisons are not forced where they cannot answer the question.

The complete client-reading sample reuses `sample-report-data.ts`: summary, decision, evidence, judgments, three actions, client inputs, review guidance, limitations and implementation/review status. It is not a real generated client report or an editable clone. The report reader is focusable and scrollable, with every section expanded. Home/End navigation is tested.

The video area is reserved only. No recording, play control, editor, sharing action or backend request has been added. Existing source observations remain immutable; actual editing covers the three-action plan, with saved/approved delivery versions.

## Validation

- TypeScript check and production build passed.
- Eight component tests passed, including all five email scenarios, keyboard selection, execution boundaries and complete shared sample content.
- Two end-to-end tests passed, including 1440 / 1024 / 390 px layouts, stage and chapter controls, report reader keyboard scrolling, real route destinations, no horizontal overflow, no runtime errors and no mutation requests from the demos.
- Local fixture preview: http://127.0.0.1:3100/framework . No production deployment.
- The existing in-app browser tab could not be rebound because it was on a blocked browser error surface; no workaround was attempted. Direct manual visual inspection in that tab remains for user review. The local server and route are available, and browser-driven automated tests passed.
