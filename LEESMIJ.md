# Empire 2D — van Delphi naar het web

[English: README.md](README.md)

Een herimplementatie voor de browser van de **Empire 2D-applicatie voor de analyse van vlakke raamwerken**, gebouwd met React en TypeScript in [`web/`](web/).

**Status: een werkend kernprototype, geen gevalideerde vervanging voor constructieve berekeningen.** De websolver is getest met analytisch oplosbare ligger- en raamwerkmodellen, maar nog niet vergeleken met het oorspronkelijke Windows-programma of representatieve `.EL2`-projecten. Gebruik deze proefversie niet voor constructief ontwerp of beslissingen over veiligheid.

De oorspronkelijke Delphi-applicatie is onderzocht in een afzonderlijk lokaal archief. De Pascal-bronbestanden, formulieren, resources, uitvoerbare bestanden, DLL's en ZIP-bestanden zijn **niet opgenomen in deze repository**. Ze blijven ongewijzigd in de oorspronkelijke werkmap; het `.gitignore`-bestand in de hoofdmap laat uitsluitend de nieuwe webapplicatie en documentatie toe.

## De webapplicatie starten

Vereist Node.js 22.12+ en npm (Node 22 of 24 LTS aanbevolen).

```sh
cd web
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Als die poort bezet is, vermeldt Vite de volgende beschikbare poort.

```sh
npm test          # Analytische solvertests, JSON-validatie en tests voor de bewerkingsgeschiedenis
npm run lint     # Lintcontroles voor TypeScript en React
npm run build    # Strikte TypeScript-controles en productiebuild
npm run format:check # De opmaak van de broncode controleren
npm run preview  # De productiebuild lokaal aanbieden
npm run test:e2e # Browsertests van gebruikershandelingen; standaard is Google Chrome vereist
```

De Playwright-configuratie gebruikt een lokaal geïnstalleerde versie van Chrome. Om in plaats daarvan het door Playwright gedownloade Chromium te gebruiken, verwijder je `channel: 'chrome'` uit `web/playwright.config.ts` en voer je vanuit `web/` het commando `npx playwright install chromium` uit.

## Publiceren op Vercel

Het Vercel-project heet **`empire`** en valt onder het team **Stacking Turtles** (`stacking-turtles`). Het is gekoppeld aan `stackingturtles/empire` op GitHub. [Open het projectdashboard](https://vercel.com/stacking-turtles/empire).

Projectinstellingen: hoofdmap **`web`**, framework **Vite**, installatiecommando **`npm ci`**, buildcommando **`npm run build`** en uitvoermap **`dist`**. Er zijn geen applicatieomgevingsvariabelen of backendservices nodig.

Voer vanuit de hoofdmap van een schone checkout van deze repository de volgende commando's uit om een previewversie te publiceren:

```sh
vercel link --repo --scope stacking-turtles --yes
vercel deploy --project empire --scope stacking-turtles --target=preview --yes
```

Gebruik expliciet `--target=preview`: anders kan Vercel de eerste deployment van een nieuw project als productie behandelen. De lokale koppelgegevens in `.vercel/` worden door Git genegeerd. Het oorspronkelijke archief van de Delphi-applicatie maakt geen deel uit van deze repository of de deployment.

De GitHub-integratie publiceert toekomstige pushes automatisch: **`main` publiceert naar productie**, terwijl andere branches previewversies opleveren. Push alleen naar `main` wanneer je een productieversie wilt uitbrengen.

## Wat werkt

- Een moderne, responsieve modelleeromgeving met een SVG-tekening van het raamwerk.
- Knooppunten, staven en eigen profieldefinities toevoegen, selecteren, bewerken en verwijderen.
- Inklemmingen, scharnierende opleggingen en rolopleggingen met horizontale of verticale verplaatsingsbeperking.
- Knooppuntskrachten in de X- en Y-richting en knooppuntsmomenten; lineair variërende dwarsbelastingen op staven.
- Starre of scharnierende staafeinden, waarbij beide uiteinden onafhankelijk kunnen worden vrijgegeven.
- Optioneel eigengewicht op basis van profieloppervlakte, dichtheid en zwaartekracht in het globale assenstelsel.
- Lineair-elastische analyse van vlakke raamwerken met drie vrijheidsgraden per knooppunt.
- Diagrammen van vervormingen, buigende momenten, dwarskrachten en normaalkrachten.
- Knooppuntsverplaatsingen, oplegreacties, benaderde piekwaarden van staafkrachten en normaalspanningen.
- Voorbeelden van een portaal, een gebouw met drie overspanningen en vier bouwlagen, een vrij opgelegde ligger en een uitkragende ligger.
- Ongedaan maken en opnieuw uitvoeren, de tekening verschuiven en zoomen, plaatsing op een raster van 0,5 m en labels.
- JSON-import en -export met versienummer, automatisch lokaal opslaan in de browser, CSV-export van resultaten en afdrukbare rapporten/PDF via de browser.
- Validatie van onjuist opgebouwde projecten, ontbrekende verwijzingen, ongeldige profielen, niet-verbonden knooppunten en singuliere of instabiele modellen.

De eerste versie werkt bewust **volledig lokaal in de browser**: geen backend, databaseservice, accounts of uploads van projecten. Lettertypen worden met de applicatie meegeleverd. Een gedownload JSON-bestand is de overdraagbare reservekopie; browseropslag is geen duurzaam archief.

## Eerste stappen

1. De app opent met een illustratief portaalmodel.
2. Selecteer een knooppunt of staaf in de tekening of in **Model explorer** en bewerk de eigenschappen rechts. Wijzigingen in getallen en tekst worden toegepast zodra het invoerveld de focus verliest of je op Enter drukt.
3. Voeg knooppunten toe met het tekengereedschap, of gebruik **+** naast **Nodes** als alternatief dat met het toetsenbord te bedienen is. Verbind twee knooppunten met het staafgereedschap, of voeg een verbinding toe via **Model explorer** en wijzig de eindpunten.
4. Pas de profieleigenschappen en opleggingen aan en kies **Analyse**.
5. Wissel tussen de resultatendiagrammen of de tabbladen met numerieke resultaten. Elke modelwijziging, ook via ongedaan maken of opnieuw uitvoeren, verwijdert de verouderde resultaten.
6. Gebruik **Save copy** om een `.empire.json`-project te downloaden. **Open** leest dit webformaat, niet de oorspronkelijke binaire `.EL2`-bestanden.

Kies voor het grotere gebouwmodel **Examples → Three-bay, four-storey frame** en vervolgens **Analyse**. Het model heeft 20 knooppunten, 28 staven met starre verbindingen, drie overspanningen van 6 m, vier bouwlagen van 3,5 m, ingeklemde kolomvoeten, vloer- en dakbelastingen, horizontale belastingen en eigengewicht. De twee eigen gelaste I-profielen zijn geïdealiseerd en niet gecertificeerd op basis van een profielcatalogus. Bekijk [de modelspecificatie](docs/three-bay-four-storey.md) of [download het JSON-project](web/public/examples/three-bay-four-storey.empire.json).

De meegeleverde HE100A-geometrie is afkomstig uit `HE100A_Demo` in het lokaal onderzochte oorspronkelijke bestand `EL_ALG.PAS`. Voor de webversie is expliciet een dichtheid van 7.850 kg/m³ aangenomen; er wordt geen aanspraak gemaakt op certificering op basis van een profielcatalogus. Het bewust slanke profiel van het portaal kan bij de voorbeeldbelastingen een waarschuwing voor grote verplaatsingen geven; dit is geen aanbeveling voor een constructief ontwerp.

## Beperkingen en resterend migratiewerk

Deze versie ondersteunt één lineair-statisch belastinggeval, maximaal 150 knooppunten, 300 staven en 80 profieldefinities. Nog niet alle functies van de Delphi-applicatie zijn beschikbaar.

Nog niet geïmplementeerd: import en export van oorspronkelijke binaire `.EL2`-bestanden, herstel van de oorspronkelijke materiaal- en profielcatalogi, puntlasten binnen staven, voorgeschreven oplegverplaatsingen en -zettingen, door de gebruiker ingestelde zwaartekrachtvectoren, belasting- en materiaalfactoren, de oorspronkelijke knik- en gecombineerde spanningscontroles, hulpmiddelen voor profielrotatie en catalogi, het onderverdelen van staven, DXF-export, de oorspronkelijke weergave- en afdrukopties en vertalingen van de gebruikersinterface.

De solver gebruikt de Euler–Bernoulli-liggertheorie voor kleine verplaatsingen. Er worden geen tweede-orde-, niet-lineaire, plastische, dynamische of afschuifvervormingsanalyses en geen controles volgens constructienormen uitgevoerd. De gerapporteerde piekwaarden van staven worden op 81 meetpunten benaderd en zijn niet gegarandeerd de wiskundige extrema. De spanning is de bovengrens voor normaalspanning `|N|/A + |M|/W`, **geen** beoordeling van veiligheid of draagvermogen.

## Documentatie

- [Analyse van de oorspronkelijke applicatie en migratieoverzicht](docs/legacy-analysis.md)
- [Architectuur van de webapplicatie en numerieke methode](docs/web-architecture.md)
- [JSON-projectformaat en eenheden](docs/project-format.md)
- [Voorbeeld met drie overspanningen en vier bouwlagen](docs/three-bay-four-storey.md)

## Mappenstructuur

```text
.gitignore                 Houdt het lokale archief van de oorspronkelijke applicatie buiten versiebeheer
docs/                      Analyse, voorbeeldspecificaties en numerieke toelichting
web/                       React- en TypeScript-applicatie met Vite
  src/model.ts             Schema met versienummer, validatie, voorbeelden en bewerkingsgeschiedenis
  src/solver.ts            Constructieve solver, onafhankelijk van de gebruikersinterface
  src/components/          Tekening, modelverkenner, eigenschappen en resultaten
  public/examples/         Downloadbare voorbeeldprojecten in het webformaat
  src/*.test.ts            Unittests voor numerieke functies, voorbeelden en modellen
  tests/                   Playwright-browsertests van gebruikershandelingen
```
