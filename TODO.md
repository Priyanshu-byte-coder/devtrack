# TODO - Issue #2399 Empty State for Goals Widget

## Plan
- [x] Update `src/components/GoalTracker.tsx` to replace the current `goals.length === 0` text with the reusable `<EmptyState />` component.

- [x] Add a primary “Create Goal” CTA in the empty state.

- [x] Make the CTA scroll to the existing inline goal creation form inside `GoalTracker`.

- [x] Ensure the UI remains accessible (aria) and responsive.

- [ ] Run tests/build/lint to confirm no console/type errors.


