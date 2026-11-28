# DefaultStackr arcade

Een verzameling retro LCD-era games om een GitHub-push en een DefaultStackr-blue-green-deploy te controleren:

- **Snake** (1998) — klassieke slang met energiepunten.
- **Space Tetris** (2000) — vallende tetromino's met satellieten-thema.
- **Space Impact** (2002) — zijwaartse shooter met indicator-schepen.
- **Bounce** (2001) — trampoline-bouncing met blokken.
- **Pairs** (1999) — kaartspel voor paren.
- **Pole Position** (2003) — racen met nitro.
- **Trap!** (2000) — het ontwijken van rollende vallen.
- **Coaster Park** (2003) — bouwen en managen van een pretpark.
- **Frogger** (1997) — oversteken van de weg en de rivier naar het huis.

De startpagina is een mission deck: een handheld-console toont live de geselecteerde game, tik of focus een spelkaart om te schakelen en start via de console of de kaart. Op mobiel werken swipes en de schermknoppen; op desktop pijltjestoetsen, spatie (actie/vuren), Enter (starten) en P (pauze). Beste scores blijven lokaal in de browser bewaard.

## Commands

- Installatie: `npm ci`
- Build/syntax: `npm run build`
- Tests: `npm test`
- Start: `npm run start`
- Health: `/healthz`
- Versie: `/version` of `/healthz` geeft de commit van de draaiende code terug.
- URL: wordt door het platform aangemaakt als `<slug>.defaultstackr.cloud`

Voor een automatische redeploy-test: noteer de huidige `/version`, push een wijziging naar de ingestelde branch en controleer of de versie na een nieuwe uitrol is veranderd. Zonder GitHub-webhook of andere push-trigger start het platform geen nieuwe uitrol.

De app gebruikt geen sleutels, betaalgegevens of database.

## Globale highscore-API (feature branch)

De Arcade kan optioneel een PostgreSQL-leaderboard gebruiken op `defaultstackr_arcade`.
Installeer dependencies met `npm ci`, test met `npm run build` en `npm test`.
Gebruik alleen een secret-bearing systemd EnvironmentFile om `ARCADE_DATABASE_URL` in te stellen; commit geen URL's met wachtwoorden.
De idempotente SQL staat in `db/migrations/001_global_leaderboard.sql`.
Bij ontbrekende databaseconfiguratie geeft de leaderboard-API 503, maar de games blijven beschikbaar.

Spelers kiezen een nickname via de eerste bezoek-pop-up (of de "WISSEL"-knop in de topbalk). Een willekeurig browsergebonden token identificeert hun record; er is nog geen account-login over apparaten heen.
Scorevalidatie controleert slechts sessieduur en scoregrenzen. Dit is geen cheat-proof ranglijst: volledige competitieve validatie vraagt server-side replay of server-authoritative gameplay.
Voor productie zijn proxybewuste rate limiting, externe back-ups, een echte hersteltest en HTTPS vereist.
