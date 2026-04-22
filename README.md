# ERM UI Prototype

Enterprise Risk Management (ERM) frontend prototype built with React + Vite + TailwindCSS.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Build

```bash
npm run build
```

## Routes

- `/dashboard` Executive overview with KPIs, heatmap, trend, and department chart
- `/risks` Risk register with sorting, column visibility, density toggle, and filters
- `/risks/:id` Risk details (Overview, Financial, Mitigation, Audit)
- `/queue` Pending review queue with approve/reject/request info/assign flows
- `/committee` Committee agenda + decisions log
- `/create` Risk creation form with validation and expected-loss preview
- `/admin` Simple org/reference data view

## Demo Notes

- Data is loaded from backend API and cached in `localStorage` for resilience.
- If backend is unavailable, UI shows service state instead of local mock dataset.
- `expectedLoss` is computed from `probability * impactMostLikely`.
- Severity thresholds are defined in `src/lib/compute.js`.
- Subtle enterprise animations are implemented with Framer Motion for:
  - Route transitions
  - Modal/drawer open/close
  - KPI card hover lift
