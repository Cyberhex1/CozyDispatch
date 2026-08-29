---
name: cozy
description: Workflow for designing, building, refactoring, and verifying full-stack TypeScript and React features with clean architecture and type safety.
---

# Full-Stack Feature Development Workflow

When implementing new features, components, or refactoring in this codebase, follow these phases:

## Phase 1: Requirements & Architecture Analysis
1. Inspect the relevant types in `src/types/` and backend/server interfaces.
2. Identify existing components, custom hooks, and shared utilities before creating new ones to maintain consistency.
3. Define the component hierarchy and state flow (unidirectional data flow).

## Phase 2: Implementation Steps
1. **Types First**: Define or update TypeScript interfaces/types for props, payloads, and state models.
2. **Logic & Custom Hooks**: Implement the state management, API/socket communication, and helper utilities.
3. **UI Components**: Build modular React components with accessible HTML elements and polished styling.
4. **Integration**: Connect components to the main view/dashboard.

## Phase 3: Verification & Quality Checks
1. Run type checks (e.g. `npx tsc --noEmit`) to ensure zero type errors.
2. Check for missing error states, loading skeletons, or unhandled promise rejections.
3. Verify responsiveness and visual consistency.
