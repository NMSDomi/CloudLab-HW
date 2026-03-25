"""
PikVjú – Test user seed script
================================
Registers N load-test users via the REST API, then confirms their email
addresses directly in the database (bypassing the email flow).

Usage
-----
1. Copy .env.example to .env and fill in the values (or export the vars).
2. Make sure the backend is reachable at BACKEND_URL.

    python seed_users.py \
        --host  https://api-dot-YOUR_PROJECT.appspot.com \
        --count 20 \
        --prefix loadtest \
        --password "LoadTest@2026!"

The script writes credentials to users.json so locustfile.py can pick them up.

Environment variables (can be loaded from ../.env)
---------------------------------------------------
POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
"""

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv

# Load ../.env if present (same vars the app uses)
load_dotenv(Path(__file__).parent.parent / ".env")

USERS_FILE = Path(__file__).parent / "users.json"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed load-test users for PikVjú")
    p.add_argument("--host",     required=True,  help="Backend base URL, e.g. https://api-dot-xxx.appspot.com")
    p.add_argument("--count",    type=int, default=15, help="Number of test users to create (default: 15)")
    p.add_argument("--prefix",   default="loadtest",  help="Email prefix (default: loadtest)")
    p.add_argument("--password", default="LoadTest@2026!", help="Password for all test users")
    p.add_argument("--domain",   default="pikvju.test", help="Email domain (default: pikvju.test)")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

def register_user(session: requests.Session, host: str, email: str, password: str, name: str) -> bool:
    url = f"{host}/api/user/register"
    try:
        resp = session.post(url, json={"email": email, "password": password, "name": name}, timeout=15)
        if resp.status_code == 200:
            return True
        # 400 with duplicate email → already exists, still OK
        if resp.status_code == 400 and "already" in resp.text.lower():
            print(f"  [skip] {email} already exists")
            return True
        print(f"  [warn] {email}: {resp.status_code} {resp.text[:120]}")
        return False
    except requests.RequestException as e:
        print(f"  [error] {email}: {e}")
        return False


# ---------------------------------------------------------------------------
# DB confirmation (bypasses email link)
# ---------------------------------------------------------------------------

def confirm_users_in_db(prefix: str, domain: str) -> int:
    conn_params = {
        "host":     os.environ["POSTGRES_HOST"],
        "port":     int(os.environ.get("POSTGRES_PORT", 5432)),
        "user":     os.environ["POSTGRES_USER"],
        "password": os.environ["POSTGRES_PASSWORD"],
        "dbname":   os.environ["POSTGRES_DB"],
    }

    pattern = f"{prefix}%@{domain}"
    print(f'\nConfirming users matching "{pattern}" in DB …')

    try:
        conn = psycopg2.connect(**conn_params)
        cur  = conn.cursor()
        cur.execute(
            'UPDATE "AspNetUsers" SET "EmailConfirmed" = TRUE WHERE "Email" LIKE %s AND "EmailConfirmed" = FALSE',
            (pattern,),
        )
        updated = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        return updated
    except psycopg2.Error as e:
        print(f"  [db error] {e}")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()
    host = args.host.rstrip("/")

    session = requests.Session()
    users   = []

    print(f"Registering {args.count} users at {host} …\n")

    for i in range(1, args.count + 1):
        email = f"{args.prefix}{i:02d}@{args.domain}"
        name  = f"LoadTest User {i:02d}"
        ok    = register_user(session, host, email, args.password, name)
        if ok:
            users.append({"email": email, "password": args.password})
            print(f"  [ok] {email}")

    confirmed = confirm_users_in_db(args.prefix, args.domain)
    print(f"Confirmed {confirmed} user(s) in the database.")

    USERS_FILE.write_text(json.dumps(users, indent=2))
    print(f"\nCredentials written to {USERS_FILE}")
    print("Run the load test with:")
    print(f"  locust -f locustfile.py --host={host}")


if __name__ == "__main__":
    main()
