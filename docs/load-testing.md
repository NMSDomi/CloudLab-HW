# Load Testing & Auto-Scaling Documentation

## Overview

This document describes the full flow for load testing the PikVjú photo album
application on a fresh (empty) Google App Engine deployment, including
auto-scaling configuration and how to verify scale-out and scale-in behaviour.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Deployed backend | `gcloud app deploy` completed, service `api` is running |
| Cloud SQL instance | Public IP enabled, port 5432 |
| GCP VM | Used as the cloud-based load generator |

---

## Step 1 – Verify the deployment

Open the App Engine dashboard and confirm both services are healthy:

```
https://console.cloud.google.com/appengine/services
```

The `api` service should show **1 instance** and status **Serving**.

Check the backend directly:

```bash
curl https://api-dot-YOUR_PROJECT.appspot.com/api/album/public
# Expected: [] (empty array – no albums yet)
```

---

## Step 2 – Create the GCP VM

```bash
gcloud compute instances create locust-runner \
  --machine-type=e2-standard-2 \
  --zone=europe-west10-a \
  --image-family=debian-12 \
  --image-project=debian-cloud
```

Get the VM's external IP — you will need it for Cloud SQL in the next step:

```bash
gcloud compute instances describe locust-runner \
  --zone=europe-west10-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

---

## Step 3 – Allow the VM's IP in Cloud SQL

The seed script connects directly to Cloud SQL via psycopg2.
Cloud SQL only accepts connections from explicitly authorized IPs.

1. Go to **GCP Console → Cloud SQL → your instance → Connections → Networking → Authorized networks**
2. Click **Add network**, enter the VM's external IP as `VM.IP.HERE/32`, save.

---

## Step 4 – Copy `.env` to the VM

The seed script reads DB credentials from the project root `.env` file.
Since `.env` is gitignored it is not in the repository, so copy it manually:

```bash
# Run from the CloudLab-HW project root on your local machine
gcloud compute scp .env locust-runner:~/CloudLab-HW/.env --zone=europe-west10-a
```

Make sure these variables are present in your `.env`:

```
POSTGRES_HOST=your_cloud_SQL_public_IP
POSTGRES_PORT=5432
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_pass
POSTGRES_DB=your_db_name
```

---

## Step 5 – Set up the VM

```bash
gcloud compute ssh locust-runner --zone=europe-west10-a
```

```bash
# On the VM:
sudo apt-get update && sudo apt-get install -y python3-pip python3-venv git
git clone https://github.com/YOUR_USERNAME/CloudLab-HW.git
cd CloudLab-HW/load-tests
python3 -m venv .locust_env
source .locust_env/bin/activate
pip install -r requirements.txt
```

---

## Step 6 – Seed test users

The load test requires pre-confirmed user accounts because registration
requires email confirmation. The seed script registers users via the API
and confirms them directly in the database.

```bash
# On the VM, inside CloudLab-HW/load-tests with venv active:
python seed_users.py \
  --host  https://api-dot-YOUR_PROJECT.appspot.com \
  --count 20
```

**Expected output:**
```
Registering 20 users at https://api-dot-...

  [ok] loadtest01@pikvju.test
  [ok] loadtest02@pikvju.test
  ...
  [ok] loadtest20@pikvju.test

Confirming users matching "loadtest%@pikvju.test" in DB …
Confirmed 20 user(s) in the database.

Credentials written to /home/.../CloudLab-HW/load-tests/users.json
```

Verify one user can log in:

```bash
curl -X POST https://api-dot-YOUR_PROJECT.appspot.com/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"loadtest01@pikvju.test","password":"LoadTest@2026!","rememberMe":false}'
# Expected: {"token":"eyJ...","expires":"..."}
```

---

## Step 7 – Auto-scaling configuration

The `cloudhw-BE/app.yaml` is already configured for demonstration scaling:

```yaml
automatic_scaling:
  min_num_instances: 1
  max_num_instances: 4
  cool_down_period_sec: 60        # re-evaluate scaling every 60 s
  cpu_utilization:
    target_utilization: 0.4       # scale out above 40% average CPU
  target_concurrent_requests: 10  # scale out above 10 concurrent req/instance
```

With `target_concurrent_requests: 10`, a load of 50+ concurrent users
reliably triggers a new instance within 1–2 minutes.

> **Note:** These thresholds are intentionally aggressive for demonstration
> purposes. In production, `target_utilization: 0.6` and
> `target_concurrent_requests: 80` are more typical values.

---

## Step 8 – Run the load test (headless, from the VM)

```bash
# On the VM, inside CloudLab-HW/load-tests with venv active:
locust -f locustfile.py \
  --host=https://api-dot-YOUR_PROJECT.appspot.com \
  --headless \
  --html=report.html \
  --csv=results
```

The test stops automatically after ~15 minutes when `ScalingDemoShape` finishes.

| Phase | Duration | Users | Expected GCP behaviour |
|---|---|---|---|
| Warm-up | 0–2 min | 10 | 1 instance, low CPU |
| Ramp-up | 2–5 min | 50 | 2nd instance starts |
| Peak | 5–9 min | 100 | 3–5 instances active |
| Ramp-down | 9–12 min | 20 | Scale-in begins |
| Cool-down | 12–15 min | 5 | Back to 1 instance |

---

## Step 9 – Collect results

```bash
# On your local machine:
gcloud compute scp locust-runner:~/CloudLab-HW/load-tests/report.html ./ --zone=europe-west10-a
gcloud compute scp "locust-runner:~/CloudLab-HW/load-tests/results_*.csv" ./ --zone=europe-west10-a
```

---

## Step 10 – Observe auto-scaling in GCP Console

During the test, monitor the following:

### Instance count
**App Engine → Services → api → Instances**

You should see the instance count rise from 1 to 3–5 during Phase 3,
then drop back to 1 during Phase 5.
Screenshot this graph as evidence for the report.

### Latency & request rate
**App Engine → Services → api → View logs / Metrics**

Or via Cloud Monitoring:
```
Metric: appengine.googleapis.com/http/server/response_latencies
Grouped by: version
```

### Cloud SQL load
**Cloud SQL → your instance → Operations & logs → System insights**

Watch for spikes in connections and query latency during Phase 3.

---

## Step 11 – What the load test covers

### User types

**`RegisteringUser`** (~25% of VUs) — anonymous visitor flow:
- `GET  /api/album/public` — browse public albums
- `GET  /api/album/search?q=...` — search albums
- `GET  /api/album/{id}` — view album detail
- `GET  /api/album/{id}/cover` — view album cover
- `POST /api/user/register` — registration (no email confirmation)
- `POST /api/user/login` — login attempt (401 path, tests rejection)

**`PhotoAlbumUser`** (~75% of VUs) — authenticated user flow:

| Category | Endpoints tested |
|---|---|
| Auth cycle | `POST /login`, `POST /logout`, `POST /refresh-token` |
| Profile | `GET /me`, `PUT /me`, `GET /user/search`, `GET /user/public/{id}` |
| Public browse | `GET /album/public`, `GET /album/search` |
| Albums (read) | `GET /album/my`, `GET /album/shared`, `GET /album/{id}`, `GET /album/{id}/cover`, `GET /album/{id}/shares` |
| Albums (write) | `POST /album`, `PUT /album/{id}`, `POST /album/{id}/share`, `DELETE /album/{id}/share/{uid}` |
| Pictures (read) | `GET /picture/album/{id}`, `GET /picture/album/{id}/thumbnails`, `GET /picture/{id}`, `GET /picture/{id}/data`, `GET /picture/{id}/thumbnail` |
| Pictures (write) | `POST /picture/album/{id}` (upload), `PATCH /picture/{id}/name`, `PUT /album/{id}/cover`, `DELETE /picture/{id}` |
| Heavy ops | `GET /album/{id}/download` (ZIP) |

---

## Step 12 – Interpreting results

Locust generates a summary table at the end. Key metrics:

| Metric | Healthy target |
|---|---|
| Failure rate | < 1% |
| Median response time | < 500 ms (reads), < 2000 ms (uploads) |
| 95th percentile | < 3000 ms |
| Requests/sec | Should grow as instances scale out |

The CSV files contain per-endpoint breakdown:
- `results_stats.csv` — aggregate stats
- `results_stats_history.csv` — time-series (good for charts)
- `results_failures.csv` — all failed requests

---

## Cleanup after testing

1. Delete the VM:
```bash
gcloud compute instances delete locust-runner --zone=europe-west10-a
```

2. Revoke the VM's IP from Cloud SQL Authorized Networks.

3. Remove loadtest users from the DB (optional):
```sql
DELETE FROM "AspNetUsers" WHERE "Email" LIKE 'loadtest%@pikvju.test';
```

4. Re-enable rate limiting in [Program.cs](../cloudhw-BE/Program.cs):
```csharp
builder.SetupRateLimiting();
// ...
app.UseRateLimiter();
```

5. Redeploy the backend:
```bash
git add cloudhw-BE/Program.cs
git commit -m "Re-enable rate limiting after load test"
git push origin release
```
