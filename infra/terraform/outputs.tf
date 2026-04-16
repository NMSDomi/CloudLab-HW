output "artifact_registry_repository_url" {
  description = "Base Artifact Registry URL for Docker images."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name for App Engine beta_settings.cloud_sql_instances."
  value       = google_sql_database_instance.postgres.connection_name
}

output "cloud_sql_socket_host" {
  description = "Unix socket host path used by the backend inside App Engine."
  value       = "/cloudsql/${google_sql_database_instance.postgres.connection_name}"
}

output "cloud_sql_instance_name" {
  description = "Managed Cloud SQL instance name."
  value       = google_sql_database_instance.postgres.name
}
