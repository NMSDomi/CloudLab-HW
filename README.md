# CloudHW - PikVjú

## Technológiai stack

- **Frontend:** Angular 18+ (standalone components, TypeScript, nginx)
- **Backend:** C# / .NET 8 Web API
- **Adatbáziskezelés:** Entity Framework Core
- **Adatbázis:** PostgreSQL (felhasználók, albumok és fotók metaadatainak tárolása)
- **Autentikáció:** ASP.NET Identity, JWT access token + HttpOnly refresh-token cookie
- **Email:** MailKit / SMTP (regisztráció megerősítés, jelszó visszaállítás)
- **Konténerizáció:** Docker, Docker Compose

## Release stack

- **Backend & Frontend:** Google App Engine (Flex) — Docker-alapú custom runtime
- **Adatbázis:** Google Cloud SQL (PostgreSQL)
- **IaC:** Terraform
- **CI/CD:** GitHub Actions — push a `release` branchre → Terraform apply → build → deploy

## Specifikáció

Megismerkedni egy PaaS környezettel felhasználói szinten és segítségével létrehozni egy fényképalbum alkalmazást.

**Eszközök, feltételek:**

- A megoldásnak valamilyen publikusan elérhető PaaS környezetben (OpenShift/AppEngine/Heroku/...) kell működnie.
- A végleges alkalmazásváltozatnak skálázhatónak és többrétegűnek kell lennie.
- Tetszőleges nyelv, tetszőleges keretrendszer használható.
- GitHub-ra feltöltve a build induljon el automatikusan.

**Funkcionális követelmények:**

- Fényképek feltöltése / törlése.
- Minden fényképnek legyen neve (max. 40 karakter), és feltöltési dátuma (év-hó-nap óra:perc).
- Fényképek nevének és dátumának listázása név szerint / dátum szerint rendezve.
- Lista egy elemére kattintva mutassa meg a név mögötti képet.
- Felhasználókezelés (regisztráció, belépés, kilépés).
- Feltöltés, törlés csak bejelentkezett felhasználónak engedélyezett.
- Tetszőleges további opcionális funkciók.


## Lokális futtatás

```bash
cp .env.example .env
docker compose -f docker-compose.development.yml up -d   # PostgreSQL + pgAdmin
cd cloudhw-BE  && dotnet run --launch-profile https       # API — https://localhost:7174
cd cloudhw-FE  && npm install && ng serve                 # SPA — http://localhost:4200
```

Környezeti változók: lásd [.env.example](.env.example).

## Deploy

Push a `release` branchre → GitHub Actions előbb `terraform apply`-jal szinkronizálja a GCP infrastruktúrát, utána buildeli a Docker image-eket, `envsubst`-tal rendereli az `app.yaml` fájlokat, majd `gcloud app deploy`-jal kitelepíti mindkét service-t (backend: `api`, frontend: `default`).

IaC dokumentáció: [docs/iac.md](docs/iac.md)

## Load testing & skálázódás demonstrálása

A [`load-tests/`](load-tests/) könyvtár tartalmaz egy Locust-alapú terheléstesztet, amely automatikusan bemutatja a horizontális skálázódást (~15 perc, 1→4 instance, majd visszaskálázás).

| Dokumentum | Leírás |
|---|---|
| [docs/load-testing.md](docs/load-testing.md) | Lépésről lépésre: VM setup, seed, futtatás, eredmények gyűjtése |
| [docs/load_testing_setting_and_documentation.md](docs/load_testing_setting_and_documentation.md) | Terheléspróba jegyzőkönyv: skálázás konfiguráció, tesztelt végpontok, eredmények, tanulságok |
| [load-tests/locustfile.py](load-tests/locustfile.py) | Locust teszt forráskódja (két felhasználói modell) |
