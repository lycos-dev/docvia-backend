# CLAUDE.md — Docvia Frontend Project Memory

> This file is the single source of truth for Claude when working on this project.
> Read this fully before writing any code or making any architectural decisions.

---

## 1. Project Overview

**Docvia** is a web-based platform that transforms academic PDF documents into
gamified learning experiences. Users upload PDFs, the system (AI backend) segments
them into learning chapters, and presents them as an interactive roadmap with
progress tracking, achievements, and gamification elements.

**Current status:** Frontend only. Backend integration is pending.
All data is currently mocked. No authentication is wired to a real API yet.

---

## 2. Tech Stack

| Layer           | Technology                              | Version  |
|-----------------|-----------------------------------------|----------|
| Framework       | React                                   | 19.x     |
| Language        | TypeScript (strict mode)                | 5.9.x    |
| Build tool      | Vite                                    | 7.x      |
| Styling         | Tailwind CSS                            | **v4**   |
| Routing         | React Router DOM                        | 7.x      |
| State           | React Context (ThemeContext only)       | —        |
| Icons           | Lucide React                            | 0.563.x  |
| Animations      | Framer Motion                           | 12.x     |
| Font            | Poppins (Google Fonts, weights 300–700) | —        |
| Utility libs    | clsx, tailwind-merge                    | latest   |

**No Three.js.** It was evaluated and removed — pure SVG achieves the same
visual result with zero bundle cost and no WebGL fragility.

**No additional packages** should be added without a strong reason. Tailwind
breakpoints handle all responsive needs.

---

## 3. Project Structure

```
docvia-frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx                        # Wraps AppRouter in ThemeProvider
│   │   └── router/
│   │       └── index.tsx                  # All routes defined here
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── ForgotPasswordForm.tsx
│   │   │   │   ├── Logo.tsx
│   │   │   │   ├── SignInForm.tsx
│   │   │   │   └── SignUpForm.tsx
│   │   │   ├── pages/
│   │   │   │   ├── SignInPage.tsx
│   │   │   │   ├── SignUpPage.tsx
│   │   │   │   ├── ForgotPasswordPage.tsx
│   │   │   │   └── CreateNewPasswordPage.tsx
│   │   │   └── types/index.ts
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── DashboardLayout.tsx    # Fixed sidebar + main area
│   │   │   │   ├── TopBar.tsx             # Search + theme toggle
│   │   │   │   ├── WelcomeBanner.tsx
│   │   │   │   ├── ReadingSection.tsx     # Document grid/list with filters
│   │   │   │   ├── ReadingCard.tsx        # Individual document card
│   │   │   │   ├── StreakCard.tsx         # Gamification streak
│   │   │   │   └── Sidebar/
│   │   │   │       ├── index.tsx
│   │   │   │       ├── NavItem.tsx
│   │   │   │       ├── FileRow.tsx
│   │   │   │       ├── UserCard.tsx
│   │   │   │       └── UploadModal.tsx
│   │   │   ├── pages/
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── ProgressPage.tsx       # Placeholder
│   │   │   │   └── SettingsPage.tsx       # Placeholder
│   │   │   └── types/
│   │   │       ├── index.ts
│   │   │       └── sidebar.types.ts
│   │   └── roadmap/
│   │       ├── components/
│   │       │   ├── MilestoneNode.tsx
│   │       │   ├── MilestoneModal.tsx
│   │       │   └── ConfettiOverlay.tsx
│   │       ├── hooks/
│   │       │   └── useRoadmapAnimation.ts
│   │       ├── pages/
│   │       │   └── RoadmapPage.tsx        # Self-contained fullscreen page
│   │       ├── types/index.ts
│   │       └── utils/pathCalculations.ts
│   ├── shared/
│   │   ├── components/ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Checkbox.tsx
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx
│   │   └── utils/cn.ts
│   ├── styles/globals.css
│   └── main.tsx
├── public/
│   └── assets/
│       ├── logo/docvia_logo_transparent.png
│       ├── favicon/docvia_favicon.png
│       └── images/                        # Document cover images, penguin etc.
├── index.html
├── package.json
├── postcss.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 4. Routing

```
/                   → redirect to /signin
/signin             → SignInPage
/signup             → SignUpPage
/forgot-password    → ForgotPasswordPage
/create-new-password→ CreateNewPasswordPage

/dashboard          → DashboardLayout > DashboardPage
/progress           → DashboardLayout > ProgressPage
/settings           → DashboardLayout > SettingsPage

/roadmap            → RoadmapPage          ← FULLSCREEN, NO DashboardLayout
```

**Critical:** `/roadmap` renders WITHOUT `DashboardLayout`. It is a
`fixed inset-0` fullscreen overlay with its own header, close button,
and theme toggle. It navigates back to `/dashboard` on close.

---

## 5. Design System

### 5.1 Tailwind v4 Theme (globals.css)

```css
@theme {
  --color-primary:       #89ADE2;
  --color-primary-dark:  #6B93D1;
  --color-primary-light: #A5C2EB;
  --color-background:    #F5F5F5;
  --color-card:          #FFFFFF;
  --color-text-primary:  #000000;
  --color-text-secondary:#666666;
  --color-text-muted:    #999999;
  --font-poppins:        Poppins, sans-serif;
}
```

Dark mode overrides are in `.dark {}` block in globals.css.

**Dark mode is class-based** (`@variant dark (&:where(.dark, .dark *))`),
toggled by ThemeContext via `document.documentElement.classList.toggle('dark')`.
This is a Tailwind v4 specific config — do NOT use the v3 `darkMode: 'class'`
in tailwind.config.js (there is no tailwind.config.js in v4).

### 5.2 Dashboard Theme Tokens

When building components that sit inside the dashboard or need to match it:

| Token          | Light             | Dark                        |
|----------------|-------------------|-----------------------------|
| Page bg        | `#F4F4F4`         | `#0f172a`                   |
| Surface / card | `#FFFFFF`         | `#1e293b`                   |
| Border         | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.1)`     |
| Text primary   | `#111827`         | `#F1F5F9`                   |
| Text muted     | `#6B7280`         | `#94A3B8`                   |
| Sub-bg         | `#F8FAFC`         | `#0f172a`                   |

### 5.3 Roadmap-Specific Colors

| State      | Color     |
|------------|-----------|
| Completed  | `#22C55E` |
| Current    | `#3B82F6` |
| Locked     | `#6B7280` |
| Progress % | green `#4ADE80` |

Module pin colors (per chapter order):
`#EF4444` → `#F97316` → `#22C55E` → `#3B82F6` → `#8B5CF6`

### 5.4 Typography

- Font: **Poppins** everywhere (`font-poppins` or `fontFamily: 'Poppins, sans-serif'`)
- Headings: `font-semibold` or `font-bold`
- Body: `font-normal` or `font-medium`
- Never use Inter, Roboto, Arial, or system fonts

### 5.5 Animations (globals.css keyframes)

```css
@keyframes milestoneUnlock { … }   /* node pop-in */
@keyframes modalPop        { … }   /* modal entrance */
@keyframes slideUp         { … }   /* bottom sheet entrance */
```

---

## 6. Key Component Patterns

### 6.1 DashboardLayout

```tsx
// Main content ALWAYS has ml-64 to offset the fixed 264px sidebar
<div className="flex-1 ml-64 px-6 py-6 xl:px-10 overflow-y-auto">
```

### 6.2 Sidebar

- Fixed left, 264px wide, `h-screen`
- Upload button opens `UploadModal`
- NavItems use `useLocation` for active state
- UserCard dropdown is `position: absolute; bottom: full`
- Z-index: Modals `z-50`, Dropdowns `z-40`

### 6.3 ThemeContext

```tsx
const { theme, toggleTheme, setTheme } = useTheme();
// theme is 'light' | 'dark'
// Persisted to localStorage under key 'docvia-theme'
```

Always consume via `useTheme()` hook. Never read `localStorage` directly.

### 6.4 Shared UI Components

Located at `src/shared/components/ui/`:

- **Button** — variants: `primary | secondary | ghost | link`, sizes: `sm | md | lg`
- **Input** — supports `label`, `error`, `rightIcon` props
- **Checkbox** — label as string or ReactNode

Always use these before creating new form elements.

### 6.5 cn() utility

```tsx
import { cn } from '../../utils/cn';
// Combines clsx + tailwind-merge
cn('base-class', condition && 'conditional', className)
```

---

## 7. RoadmapPage Architecture

The roadmap is a self-contained page (`fixed inset-0 z-50`). Key decisions:

### Desktop (≥ md breakpoint)
- Horizontal sine-wave SVG road
- Dark navy road (`#1e2d45` / `#253550`) with 6 stroke layers for 3D depth
- White dashed center lane lines
- Colorful teardrop map-pin SVG nodes at wave peaks/valleys
- SVG cards below each pin connected by dashed vertical lines
- Drag-to-pan (CSS translate, NOT scroll — truly unbounded)
- Wheel zoom without Ctrl key
- `grab` / `grabbing` cursor

### Mobile (< md breakpoint)
- Vertical spine layout
- Colored circle pins on left spine
- Cards on right
- Connecting lines between nodes
- Tap → bottom sheet slides up

### SVG Road Path
Built from 5 pin positions alternating high/low:
```
ch1=low → ch2=high → ch3=mid → ch4=high → ch5=low
```
Using cubic bezier: `C midX prevY, midX currY, toX toY`

### No Three.js
Three.js was evaluated and removed. The car is a 🚗 emoji or SVG polygon.
Do NOT re-introduce Three.js or any WebGL dependency.

### Progressive Disclosure (when implementing 20+ lesson roadmaps)
- Completed modules: collapsed (header row only)
- Current + next 2: fully expanded with lesson tree
- Locked: hidden behind "Show N locked modules" toggle
- Milestones at 25% / 50% / 75% / 100%

---

## 8. Coding Standards

### TypeScript
- Strict mode — no `any`
- `interface` over `type` for object shapes
- Explicit return types on non-trivial functions
- No unused variables or parameters (enforced by tsconfig)

### Component Rules
- Functional components only
- Named exports for pages, default exports for components
- Props interfaces defined above the component
- Hooks at the top, event handlers before return
- One component per file (except small co-located helpers)

### File Naming
- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts` with `use` prefix
- Utils: `camelCase.ts`
- Types: `index.ts` or `*.types.ts`

### Styling Rules
- Tailwind utility classes only — no inline styles unless the value is dynamic
- Use `cn()` for conditional classes
- Always add `dark:` variants when adding light-mode styles
- Mobile-first: `sm:` `md:` `lg:` `xl:`
- Never use Tailwind v3 `tailwind.config.js` — this is Tailwind v4

### State Management
- `useState` for component-local state
- `useContext` + `ThemeContext` for global theme
- No Redux, Zustand, or other external state libraries
- Props drilling for parent → child communication

---

## 9. Known Issues / TODO

| Area          | Issue                                      | Priority |
|---------------|--------------------------------------------|----------|
| Auth          | No real API — all mocked with setTimeout   | High     |
| Upload        | Modal UI only, no actual file processing   | High     |
| Roadmap       | Milestone data is hardcoded                | Medium   |
| Progress page | Placeholder only                           | Medium   |
| Settings page | Placeholder only                           | Medium   |
| File browser  | Sidebar files don't link to documents      | Low      |
| Roadmap       | Mobile bottom sheet not fully polished     | Low      |
| Responsive    | Sidebar collapse on mobile not implemented | Low      |

---

## 10. Backend Integration Notes

When the backend is ready, these are the integration points:

```
POST /api/auth/login          → authService.login()
POST /api/auth/register       → authService.register()
POST /api/auth/logout         → authService.logout()
GET  /api/auth/profile        → authService.getProfile()
POST /api/auth/forgot-password→ authService.forgotPassword()
GET  /api/auth/google         → authService.getGoogleAuthUrl()
POST /api/auth/google/verify  → authService.verifyGoogleToken()
```

API base URL is configured in `src/shared/config/api.config.ts`
via `VITE_API_URL` env variable (defaults to `http://localhost:3001/api`).

The roadmap modules/lessons will come from the backend AI segmentation.
The `MODULES` array in `RoadmapPage.tsx` is the mock — replace with API call.

---

## 11. Assets

```
/assets/logo/docvia_logo_transparent.png   — used in auth Logo.tsx and Sidebar
/assets/favicon/docvia_favicon.png         — index.html
/assets/images/penguin.png                 — WelcomeBanner
/assets/images/testing.png                 — ReadingSection mock cover
/assets/images/research.jpg
/assets/images/meeting.jpg
/assets/images/design.png
```

---

## 12. How to Work With This Codebase

When given a task:

1. **Read CLAUDE.md first** (this file) — especially sections 4, 5, 6, 7
2. **Identify which file(s) to touch** — minimize blast radius
3. **Match existing patterns** — look at how similar components are built
4. **Dark mode** — every new UI element needs `dark:` variants or `isDark` branches
5. **Responsive** — desktop first on roadmap, mobile-first on dashboard
6. **No new packages** unless explicitly approved
7. **Provide complete, copy-paste ready files** with the exact path at the top
8. **Keep mock data in place** — don't remove it until backend is ready

### Quick Answers

| Question                              | Answer                                    |
|---------------------------------------|-------------------------------------------|
| How is dark mode toggled?             | ThemeContext → classList.toggle('dark')   |
| Where is the roadmap entry point?     | `src/features/roadmap/pages/RoadmapPage.tsx` |
| Does roadmap use DashboardLayout?     | **No** — it's `fixed inset-0` fullscreen  |
| Is Three.js used?                     | **No** — removed, use SVG/CSS             |
| What font is used everywhere?         | **Poppins**                               |
| What Tailwind version?                | **v4** — no tailwind.config.js            |
| How are breakpoints used?             | `hidden md:flex` / `flex md:hidden`       |
| Where are shared UI components?       | `src/shared/components/ui/`               |
| What state library is used?           | **None** — only React Context + useState  |

---

## 13. Conversation History Summary

Key decisions made in previous sessions:

- **Three.js removed** — evaluated for the 3D car on the roadmap, decided
  pure SVG polygons + emoji achieve the same result without the ~600KB cost,
  WebGL fragility, or z-index/coordinate mapping complexity.

- **Roadmap layout** — Desktop uses horizontal sine-wave road (like the
  infographic reference provided). Mobile uses vertical spine. Responsive
  switching via Tailwind `md:` breakpoint only — no new packages.

- **Roadmap is fullscreen** — Not wrapped in DashboardLayout. Has its own
  close button (→ /dashboard), progress bar, and theme toggle.

- **Progressive disclosure** — For 20+ lesson roadmaps: collapse completed,
  expand current + next 2, hide locked behind toggle. Right panel with
  stats, learning modes, and AI Shortest Path badge.

- **Road style** — Dark navy road (`#1e2d45`) with multi-layer SVG strokes
  for 3D depth, white dashes, colored teardrop map-pin nodes, 🚗 at current
  position. Cards below pins with lesson lists.

- **Theme consistency** — Roadmap page uses the same dark/light tokens as
  the dashboard sidebar and cards for visual coherence.

- **Drag interaction** — CSS translate (not overflow scroll) for truly
  unbounded pan. Wheel zoom without Ctrl. `grab`/`grabbing` cursor.

- **Progress bar** — Absolutely centred in header via
  `absolute left-1/2 -translate-x-1/2`, independent of flanking elements.