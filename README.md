# DefaultStackr testpagina

Speelbare Neon Snake-pagina om een GitHub-push en een DefaultStackr-deploy te controleren.

- Installatie: `npm ci`
- Build: `npm run build`
- Start: `npm run start`
- Health path: `/healthz`
- URL: wordt door het platform aangemaakt als `<slug>.defaultstackr.cloud`
- Versie: `/version` of `/healthz` geeft de commitversie van de draaiende code terug.

Gebruik de pijltjestoetsen om te sturen, spatie om (opnieuw) te starten en P om te pauzeren. Op een tablet of telefoon kun je swipen of de schermknoppen gebruiken. De beste score blijft lokaal in je browser bewaard.

Voor een automatische redeploy-test: noteer de huidige `/version`, push een wijziging naar de ingestelde branch en controleer of de versie na een nieuwe uitrol is veranderd. Zonder GitHub-webhook of een andere push-trigger start het platform nog geen nieuwe uitrol.

De app gebruikt geen sleutels, betaalgegevens of database.
