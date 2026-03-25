# CI/CD & Deployment

This document describes the build and deployment pipeline.

---

## Overview

Deployment is fully automated via GitHub Actions. Pushing to the `release` branch triggers the workflow in `.github/workflows/release.yml`, which:

1. Builds Docker images for both BE and FE
2. Pushes images to Google Container Registry (GCR)
3. Renders `app.yaml` files with secrets
4. Deploys both services to **Google App Engine (Flex)**

---

## Trigger

```yaml
on:
  push:
    branches:
      - release
```

Any push to the `release` branch triggers the full pipeline. There is no manual trigger or staging step.

---

## Jobs

### `build-and-push`

Builds Docker images and pushes them to Google Container Registry:

| Registry | Purpose |
|---|---|
| `gcr.io` (Google Container Registry) | Used by App Engine for deployment |

Images are tagged with the **git commit SHA** (`${{ github.sha }}`), ensuring every deployment is traceable to an exact commit.

### `deploy`

Depends on `build-and-push`. Runs in the `production` GitHub environment (which gates access to production secrets).

Steps:
1. Authenticates to Google Cloud using `GCP_SA_KEY`
2. Sets up the `gcloud` CLI
3. Renders `cloudhw-BE/app.yaml` via `envsubst` → `app.rendered.yaml`
4. Deploys BE to App Engine using the GCR image from the previous job
5. Renders `cloudhw-FE/app.yaml` via `envsubst` → `app.rendered.yaml`
6. Deploys FE to App Engine using the GCR image

The rendered `*.rendered.yaml` files contain plain-text secrets and are **never committed** — they exist only during the workflow run.

---

## App Engine Services

| Service | App Engine service name | Port |
|---|---|---|
| Backend (.NET) | `api` | 8080 |
| Frontend (nginx) | `default` | 8080 |

Both use `runtime: custom` (Docker-based) with `env: flex`.

Scaling is configured in `app.yaml`:
```yaml
automatic_scaling:
  min_num_instances: 1
  max_num_instances: 3
```

---

## Configuration Injection

App Engine Flex passes environment variables via `env_variables` in `app.yaml`. Since secrets cannot be committed, the `app.yaml` files use `${VAR}` placeholders which are filled at deploy time:

```
GitHub Secrets
    └─ workflow step: env: { VAR: ${{ secrets.VAR }} }
         └─ envsubst < app.yaml > app.rendered.yaml
              └─ gcloud app deploy app.rendered.yaml
```

See [environment-variables.md](environment-variables.md) for the full variable reference.

---

## Frontend Runtime Configuration

The FE Docker image uses `envsubst` at **container startup** (not build time) to inject `BACKEND_URL`:

```dockerfile
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/assets/env.template.js \
  > /usr/share/nginx/html/assets/env.js && exec nginx -g 'daemon off;'"]
```

This means `BACKEND_URL` can differ between environments without rebuilding the image.

---

## Database

In production, the backend connects to **Google Cloud SQL (PostgreSQL)** via the Cloud SQL proxy, configured through:

```yaml
beta_settings:
  cloud_sql_instances: "${GCP_CLOUDSQL_CONNECTION_NAME}"
```

The connection string is built by `SystemContext.GetConnectionString()` from `POSTGRES_*` environment variables.

Migrations are applied automatically at backend startup via `ApplyMigrationsAsync()` in `Program.cs`.

---

## Deploying Manually

If you need to deploy without pushing to `release` (e.g. hotfix):

```bash
# Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Render and deploy BE
export POSTGRES_HOST=... # set all vars
envsubst < cloudhw-BE/app.yaml > cloudhw-BE/app.rendered.yaml
gcloud app deploy cloudhw-BE/app.rendered.yaml --image-url=gcr.io/PROJECT/cloudhw-be:TAG

# Render and deploy FE
export BACKEND_URL=https://api.yourdomain.com/
envsubst < cloudhw-FE/app.yaml > cloudhw-FE/app.rendered.yaml
gcloud app deploy cloudhw-FE/app.rendered.yaml --image-url=gcr.io/PROJECT/cloudhw-fe:TAG
```
