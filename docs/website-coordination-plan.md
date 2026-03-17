# Maestro Website — Coordination Plan

## Goal
Build a modern, beautiful, stylish marketing website for Maestro (agent-maestro). The current draft at `docs/maestro-website/` is a basic scaffold — we need a complete redesign from the ground up.

## Source Material
- `docs/BRIEF_DOCUMENTATION.md` — product overview, architecture, features
- `docs/website/*.md` — feature content (7 files covering UI, backend, CLI, coordination, tasks, teams, terminal)
- `README.md` — quick start, project description
- Current scaffold: `docs/maestro-website/` (React 19 + Vite 7)

## Phase 1: Design (Parallel)

Spawn 4 design team members who work in parallel. Each produces deliverables that must be reviewed and approved by the Final Reviewer before moving to implementation.

### 1. Content Designer
- Write all copy: hero, taglines, feature descriptions, CTAs, footer
- Define the narrative flow — what story does the site tell?
- Write content for every page/section
- Produce a content map (what goes where)
- Tone: professional but approachable, developer-focused, not corporate fluff

### 2. Styles & Looks Designer
- Define the visual identity: color palette, typography, spacing system
- Design tokens (CSS custom properties) for consistent theming
- Dark theme as primary (developer tool aesthetic)
- Micro-interactions and animation guidelines
- Component style specs (buttons, cards, nav, code blocks, etc.)
- Produce a design system document with all tokens and component styles

### 3. UX / Pages Designer
- Define site structure: how many pages, what sections, navigation flow
- Page layouts with clear content zones
- Responsive breakpoints and mobile strategy
- Interactive elements: scroll animations, hover states, transitions
- Information architecture — user journey from landing to "get started"
- Produce wireframes/layout specs for every page and section

### 4. Final Reviewer (Quality)
- Reviews ALL deliverables from designers 1-3
- Ensures consistency across content, styles, and UX
- Checks for gaps: missing sections, broken flow, inconsistent tone
- Validates that the design represents Maestro's capabilities accurately
- Approves or sends back with feedback
- Only when all 3 designers are approved does Phase 2 begin

## Phase 2: Implementation (Parallel)

Once all designs are approved, split implementation into separate work streams. Spawn dedicated implementers for each:

### Implementation Split
1. **Foundation & Layout** — project setup, CSS tokens/variables, global layout components, navigation, responsive grid
2. **Hero & Landing Section** — hero component, animations, CTA buttons, above-the-fold experience
3. **Feature Sections** — core pillars cards, coordination section, tasks/teams panels, terminal section
4. **Pages & Routing** — additional pages (docs, getting started, etc.), page transitions, routing setup
5. **Polish & Integration** — micro-interactions, scroll animations, responsive testing, accessibility, performance

Each implementer works on their section independently, following the approved design specs.

## Phase 3: Assembly & Final Review

- Stitch all implemented sections into the final website
- Final reviewer does a complete pass on the built site
- Fix any integration issues, visual inconsistencies, or bugs
- Ensure the site builds cleanly and is ready for deployment

## Tech Stack
- React 19 + Vite 7 (existing setup at `docs/maestro-website/`)
- TypeScript
- CSS (custom properties / design tokens, no CSS framework unless designers recommend one)
- Possibly Framer Motion for animations

## Quality Bar
- Visually stunning — this is the public face of Maestro
- Fast loading, no unnecessary dependencies
- Accessible (WCAG AA minimum)
- Responsive (mobile-first)
- Clean, maintainable code
