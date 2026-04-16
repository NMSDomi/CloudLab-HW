# Infrastructure-as-Code

This project now manages the production Google Cloud environment from the repository.

## Tooling

- **IaC tool:** Terraform
- **Platform:** Google Cloud Platform
- **PaaS runtime:** Google App Engine Flexible Environment
- **Database:** Google Cloud SQL for PostgreSQL
- **CI/CD:** GitHub Actions

## Managed components

The Terraform configuration in [`infra/terraform`](../infra/terraform/) defines:

- the App Engine application bootstrap
- the Artifact Registry Docker repository
- the Cloud SQL PostgreSQL instance
- the application database
- the application database user
- the required Google APIs for these services

Terraform state is stored in a remote GCS backend so that every GitHub Actions run works against the same infrastructure state.

## Deployment workflow

Push to the `release` branch triggers the GitHub Actions pipeline:

1. `terraform apply` synchronizes the GCP infrastructure
2. backend and frontend Docker images are built
3. images are pushed to Artifact Registry
4. App Engine deployment manifests are rendered
5. backend and frontend services are deployed

## Database lifecycle

The database server itself is created by Terraform, so the persistent production database is part of the IaC definition.

Schema changes are still handled by EF Core migrations at backend startup. This means:

- Terraform creates and preserves the database infrastructure
- the application updates the schema when a new version is deployed
- the existing database is reused across deployments, so data is not reset on every release

## Existing environments

If the target GCP project already has an App Engine application, import it into Terraform state before the first apply:

```bash
cd infra/terraform
terraform init -backend-config="bucket=YOUR_TF_STATE_BUCKET" -backend-config="prefix=cloudhw/release"
terraform import google_app_engine_application.app apps/YOUR_PROJECT_ID
```

If the Cloud SQL instance already exists as well, import that resource before enabling the release workflow.
