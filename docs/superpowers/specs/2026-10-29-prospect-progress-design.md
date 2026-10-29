# Prospect progress and credit-state repair

The user approved repairing the generation experience before delivery acceptance. No new paid analysis is authorized in this iteration; preserve the remaining two credits and all report versions.

## Behavior

Show server-owned milestones instead of an estimated total percentage. Acquisition preparation reports when it checks the saved market context, collects website/public business evidence, collects confirmed competitors, and organises the saved sources. Formal generation reports evidence processing, evaluation, validation and persistence. No countdown, automatic progress animation or fixed five-minute promise.

The existing stage enum suffices: collecting_market, collecting_site (website and public profile), collecting_competitors, building_evidence, evaluating, validating and persisting. Existing clients remain compatible. Report contents, rulesets, charging and provider budgets do not change.

Preparation stage writes must be fenced by the current SQL lease, generation and original deadline, rejected after the input is frozen, and owner-readable through the existing task status endpoint. They cannot create tasks, extend deadlines, consume points, change reports or overwrite terminal states. Formal stage events use existing guarded Redis transitions and callback synchronization.

Before reservation, show free setup and the one-credit boundary. After a workflow is known and verified, show one credit reserved/used for that workflow, with no extra charge to continue or refresh. While reconnecting, show that the existing workflow is being checked, rather than asserting a second charge or a verified payment state. Failed/refunded tasks retain explicit refund and retry-cost wording.

## Verification and release

Meaningful SQL tests cover valid stages, wrong lease/generation, expiry, frozen/terminal tasks and execution permissions. Backend tests cover stage order and stopping on lease loss. Frontend tests cover milestone status, no fabricated percentages, reconnecting/paid/refunded copy and removal of the duration bucket. Shared synthetic browser journeys run in cloud CI.

Publish the backward-compatible database update before the backend starts stage calls; deploy frontend and backend through the existing gates. Verify actual deployment revisions, health and unchanged balance/report checksums. Existing live reports and free entry screens can be checked without points; a new real active-generation timeline is not claimed as verified without a later authorized workflow.
