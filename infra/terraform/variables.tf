variable "project_id" {
  description = "Google Cloud project id."
  type        = string
}

variable "region" {
  description = "Primary GCP region for Cloud SQL and Artifact Registry."
  type        = string
}

variable "app_engine_location" {
  description = "App Engine application location id. This is immutable after the app is created."
  type        = string
}

variable "artifact_registry_repository" {
  description = "Artifact Registry Docker repository id."
  type        = string
  default     = "cloudhw"
}

variable "cloud_sql_instance_name" {
  description = "Cloud SQL instance name."
  type        = string
  default     = "cloudhw-postgres"
}

variable "cloud_sql_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-f1-micro"
}

variable "cloud_sql_disk_size_gb" {
  description = "Initial Cloud SQL disk size in GB."
  type        = number
  default     = 20
}

variable "cloud_sql_availability_type" {
  description = "Cloud SQL availability type."
  type        = string
  default     = "ZONAL"
}

variable "postgres_db" {
  description = "Application database name."
  type        = string
}

variable "postgres_user" {
  description = "Application database username."
  type        = string
}

variable "postgres_password" {
  description = "Application database password."
  type        = string
  sensitive   = true
}

variable "deletion_protection" {
  description = "Prevents accidental deletion of managed infra."
  type        = bool
  default     = true
}
