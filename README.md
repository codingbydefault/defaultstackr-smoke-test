# DefaultStackr arcade

Drie Nokia-era games om een GitHub-push en een DefaultStackr-blue-green-deploy te controleren:

- **Snake** (1998) — klassieke slang met energiepunten.
- **Space Tetris** (2000) — vallende tetromino's met satellieten-thema.
- **Space Impact** (2002) — zijwaartse shooter met indicator-schepen.

De startpagina is een spellkiezer. Tik op een spel en het start meteen in volledig scherm. Op mobiel werken swipes en de schermknoppen; op desktop pijltjestoetsen, spatie (actie/vuren), Enter (starten) en P (pauze). Beste scores blijven lokaal in de browser bewaard.

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
