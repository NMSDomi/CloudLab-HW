# CI/CD & Deployment

This document describes the build and deployment pipeline.

---

## Overview

Deployment is fully automated via GitHub Actions. Pushing to the `release` branch triggers the workflow in `.github/workflows/release.yml`, which:

1. Applies the Terraform infrastructure in `infra/terraform`
2. Builds Docker images for both BE and FE
3. Pushes images to Artifact Registry
4. Renders `app.yaml` files with secrets and Terraform outputs
5. Deploys both services to **Google App Engine (Flex)**

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

### `terraform-apply`

Creates or updates the managed Google Cloud infrastructure:

| Resource group | Purpose |
|---|---|
| App Engine application | Hosts the frontend and backend services |
| Artifact Registry | Stores Docker images for deploy |
| Cloud SQL PostgreSQL | Persistent production database |
| SQL database + SQL user | Application-level database access |
| Required Google APIs | Enables the managed services used by the stack |

The workflow exports Terraform outputs and passes them into later jobs. Most importantly:

- `artifact_registry_repository_url`
- `cloud_sql_connection_name`
- `cloud_sql_socket_host`

Terraform state is stored remotely in a GCS bucket configured through the `TF_STATE_BUCKET` GitHub secret, so each workflow run sees the same infrastructure state.

### `build-and-push`

Builds Docker images and pushes them to Artifact Registry:

| Registry | Purpose |
|---|---|
| `REGION-docker.pkg.dev` (Artifact Registry) | Used by App Engine for deployment |

Images are tagged with the **git commit SHA** (`${{ github.sha }}`), ensuring every deployment is traceable to an exact commit.

### `deploy`

Depends on `terraform-apply` and `build-and-push`. Runs in the `production` GitHub environment (which gates access to production secrets).

Steps:
1. Authenticates to Google Cloud using `GCP_SA_KEY`
2. Sets up the `gcloud` CLI
3. Renders `cloudhw-BE/app.yaml` via `envsubst` → `app.rendered.yaml`
4. Deploys BE to App Engine using the Artifact Registry image from the previous job
5. Renders `cloudhw-FE/app.yaml` via `envsubst` → `app.rendered.yaml`
6. Deploys FE to App Engine using the Artifact Registry image

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

The Cloud SQL connection values are now injected from Terraform outputs during deploy:

```text
terraform output cloud_sql_connection_name -> GCP_CLOUDSQL_CONNECTION_NAME
terraform output cloud_sql_socket_host     -> POSTGRES_HOST
```

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

The Cloud SQL instance itself is provisioned by Terraform, so the database server lifecycle is part of the repository's Infrastructure-as-Code definition.

---

## Deploying Manually

If you need to deploy without pushing to `release` (e.g. hotfix):

```bash
# Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Provision / update infrastructure
cd infra/terraform
terraform init -backend-config="bucket=YOUR_TF_STATE_BUCKET" -backend-config="prefix=cloudhw/release"
terraform apply
cd ../..

# Render and deploy BE
export POSTGRES_HOST="$(terraform -chdir=infra/terraform output -raw cloud_sql_socket_host)"
export GCP_CLOUDSQL_CONNECTION_NAME="$(terraform -chdir=infra/terraform output -raw cloud_sql_connection_name)"
envsubst < cloudhw-BE/app.yaml > cloudhw-BE/app.rendered.yaml
gcloud app deploy cloudhw-BE/app.rendered.yaml --image-url=REGION-docker.pkg.dev/PROJECT/REPO/cloudhw-be:TAG

# Render and deploy FE
export BACKEND_URL=https://api.yourdomain.com/
envsubst < cloudhw-FE/app.yaml > cloudhw-FE/app.rendered.yaml
gcloud app deploy cloudhw-FE/app.rendered.yaml --image-url=REGION-docker.pkg.dev/PROJECT/REPO/cloudhw-fe:TAG
```
