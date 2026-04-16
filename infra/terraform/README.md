# Terraform Infrastructure

This directory contains the Google Cloud infrastructure definition for the CloudHW release environment.

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# fill in real values
terraform init -backend-config="bucket=YOUR_TF_STATE_BUCKET" -backend-config="prefix=cloudhw/release"
terraform plan
terraform apply
```

The configuration expects a remote GCS backend. Create the bucket once before the first `init`.

## Existing App Engine project

If the App Engine application already exists in the target project, import it before the first apply:

```bash
terraform import google_app_engine_application.app apps/YOUR_PROJECT_ID
```

If the Cloud SQL instance already exists, import that resource as well before enabling the GitHub workflow.

This resource is marked with `prevent_destroy = true`, because App Engine application deletion is effectively irreversible for the project.

## Outputs used by CI/CD

The GitHub Actions release workflow reads these Terraform outputs:

- `artifact_registry_repository_url`
- `cloud_sql_connection_name`
- `cloud_sql_socket_host`

These outputs are then used to build images and render the App Engine deployment manifests.
