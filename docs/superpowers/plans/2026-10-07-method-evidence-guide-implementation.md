# Implementation plan

The writing-plans skill is not installed in this session. This explicit implementation checklist follows the approved design.

1. Add a scoped guide stylesheet and accessible tab primitive for method examples, priority contexts and delivery wording.
2. Replace the public MethodV22 composition with focused overview, scope, continuous-case, priority, execution/review and delivery sections. Reuse FAQ and isolated ActionPlanDemo; preserve section destinations.
3. Place official sources beside related examples; remove future execution controls and third-report naming from the route.
4. Update CTA tests and add guide component/E2E coverage including immutable evidence, keyboard controls and non-generating links.
5. Run checks, inspect responsive preview, repair issues and show the completed local page.

## Verification completed

- `npm run typecheck` passed after correcting the new Testing Library option types.
- `npm test -- src/components/framework`: 10 files, 71 tests passed.
- `npm run test:e2e -- e2e/method-guide.spec.ts --workers=1`: 2 tests passed, including 1440 / 1024 / 390 px overflow checks, keyboard tab switching, isolated plan reordering/saving, anchor clearance and sample/Case routes.
- `npm run build` passed after the final component split.
- Browser inspection confirmed desktop priority layout, mobile reading and no horizontal overflow. Temporary viewport overrides were reset. The public preview is `http://127.0.0.1:3100/framework`; screenshot `/tmp/searchtrust-method-guide-preview.png`.
- No deployment, report API or billing changes. Prior unrelated working-tree changes were preserved.
