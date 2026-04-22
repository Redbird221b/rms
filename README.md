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

## Deployment (Docker, no CI)

Проект деплоится вручную через Docker на сервере.

### 1) Подготовка

1. Установите Docker + Docker Compose plugin.
2. Скопируйте код в директорию сервера и перейдите в `frontend`.
3. Создайте `.env.production` на основе `.env.example`:

```bash
cp .env.example .env.production
```

4. Заполните `.env.production`:

- `VITE_API_BASE_URL` (например `http://<host>:8000`)
- `VITE_KEYCLOAK_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`
- `VITE_KEYCLOAK_FLOW`

5. Создайте/проверьте общий docker network с backend:

```bash
docker network create riskapp-network || true
```

### 2) Деплой

```bash
./deploy.sh
```

Скрипт выполняет:

- `docker compose -f docker-compose.prod.yml down --remove-orphans`
- `docker compose -f docker-compose.prod.yml up -d --build`

### 3) Проверка

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f frontend
```

Для остановки:

```bash
docker compose -f docker-compose.prod.yml down
```
