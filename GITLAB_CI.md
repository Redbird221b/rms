# GitLab CI/CD (Frontend)

Файл пайплайна: `.gitlab-ci.yml`

## Что делает пайплайн

1. `quality` — запускает `npm run lint` (пока в режиме `allow_failure: true`).
2. `build` — собирает `npm run build`, сохраняет `dist/` как artifact.
3. `docker` — собирает и публикует Docker-образ в `$CI_REGISTRY_IMAGE` через `kaniko` (без `docker:dind`).
4. `deploy` — по SSH обновляет контейнер на сервере.

## Обязательные GitLab Variables

Добавьте в `Settings -> CI/CD -> Variables`:

- `SSH_PRIVATE_KEY_B64` (masked + protected, base64 от приватного ключа)
- `STAGING_DEPLOY_HOST`
- `STAGING_DEPLOY_USER`
- `PROD_DEPLOY_HOST`
- `PROD_DEPLOY_USER`
- `VITE_API_BASE_URL`
- `VITE_KEYCLOAK_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`
- `VITE_KEYCLOAK_FLOW`

## Логика по веткам

- `develop`: build + docker + авто-деплой на staging.
- default branch (`main`): build + docker + ручной деплой на production.

## Важно

Сейчас в проекте есть существующие ошибки ESLint, поэтому job `frontend:lint` не блокирует pipeline.
Когда поправите lint-ошибки, уберите `allow_failure: true` в `.gitlab-ci.yml`.

Для стадии сборки образа не нужен `privileged` runner.

`SSH_PRIVATE_KEY` тоже поддерживается (legacy), но для GitLab masked-переменных удобнее использовать `SSH_PRIVATE_KEY_B64`.
