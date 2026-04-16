locals {
  common_labels = {
    app        = "cloudhw"
    managed_by = "terraform"
  }

  required_services = toset([
    "appengine.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "compute.googleapis.com",
    "sqladmin.googleapis.com"
  ])
}

resource "google_project_service" "services" {
  for_each = local.required_services

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repository
  description   = "Docker images for the CloudHW frontend and backend services."
  format        = "DOCKER"

  labels = local.common_labels

  depends_on = [
    google_project_service.services["artifactregistry.googleapis.com"]
  ]
}

resource "google_sql_database_instance" "postgres" {
  name                = var.cloud_sql_instance_name
  project             = var.project_id
  region              = var.region
  database_version    = "POSTGRES_15"
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.cloud_sql_tier
    availability_type = var.cloud_sql_availability_type
    disk_type         = "PD_SSD"
    disk_size         = var.cloud_sql_disk_size_gb
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled = true
    }

    insights_config {
      query_insights_enabled = true
    }

    user_labels = local.common_labels
  }

  depends_on = [
    google_project_service.services["sqladmin.googleapis.com"]
  ]
}

resource "google_sql_database" "app" {
  name     = var.postgres_db
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app" {
  name     = var.postgres_user
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  password = var.postgres_password
}
