# TypeScript & React Coding Standards

## 1. TypeScript Standards
- **Strict Typing**: Never use `any`. Use strict interfaces, type aliases, and discriminated unions for state machines and action handling.
- **Null & Undefined**: Guard against nullable properties; prefer optional chaining `?.` and nullish coalescing `??`.
- **Exporting Types**: Keep data models and shared interfaces in dedicated `types/` files or co-located with their domain logic.

## 2. React Guidelines
- **Functional Components**: Use standard functional components with typed props.
- **Custom Hooks**: Extract stateful business logic, async calls, or subscriptions into reusable custom hooks (e.g. `useDispatchData`).
- **Performance**: Use `useCallback` and `useMemo` for performance-sensitive subtrees and callbacks passed to memoized children.
- **Error Boundaries & Loading States**: Always implement comprehensive error and loading state handling across components.

## 3. Styling & UX
- Modern, accessible styling with harmonious color palettes, clear visual hierarchy, and smooth micro-interactions.
- Responsive layout support for desktop, tablet, and mobile breakpoints.
