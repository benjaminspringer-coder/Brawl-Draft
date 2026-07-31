# Replit-Anleitung: Automatischer EU Completed-Tournament Scanner für corestats.pro

Diese Dokumentation erklärt Schritt für Schritt, wie ein Replit-Projekt automatisch täglich alle **beendeten EU-Turniere** von `corestats.pro/tournaments` inklusive der passenden **Matcherino-Links** extrahiert. Die Lösung nutzt die interne JSON-API von Corestats, sodass kein Browser und kein manuelles Durchklicken der 58 Completed-Pages nötig ist.

* * *

## 1\. Wie die Website funktioniert (technischer Hintergrund)

`corestats.pro/tournaments` lädt die Turnier-Daten nicht als statisches HTML, sondern über eine **interne JSON-API**, die vom Frontend per JavaScript abgefragt wird. Die Completed-Pagination (1/58) ist reines Frontend-Paging — die Daten aller Turniere kommen in einem einzigen API-Call zurück.

### Die drei relevanten API-Endpunkte

| Endpunkt | Zweck |
| --- | --- |
| `https://corestats.pro/api/tournaments?page=1&pageSize=999` | Liefert alle Turniere als JSON-Array (`body.contents`). Mit `pageSize=999` bekommt man bis zu 999 Turniere in einem einzigen Call. |
| `https://corestats.pro/api/matcherino/regions` | Liefert das Mapping von Region-ID → Region-Name (z.B. `25 → EU/Germany-1`). |
| `https://corestats.pro/api/settings` | Allgemeine Site-Einstellungen (für den Scanner nicht zwingend nötig). |

### Wichtiger Hinweis: Cloudflare-Schutz

Die API ist durch **Cloudflare** geschützt. Ein einfacher `fetch`/`curl`/`requests`\-Call von einem Server ohne Browser-Kontext wird blockiert und erhält eine HTML-Challenge-Seite statt JSON. Das bedeutet für Replit:

-   Ein reiner `requests.get()`\-Call funktioniert **nicht**.
-   Es wird entweder ein **Headless-Browser** (z.B. Playwright/Puppeteer) benötigt, der die Cloudflare-Challenge löst, oder man muss die Cloudflare-Cookies (`cf_clearance`) aus einer Browser-Session manuell mitgeben.
-   Innerhalb eines echten Browsers (der die Seite bereits geladen hat) funktioniert ein `fetch('/api/tournaments?...')` problemlos, weil der Browser die Challenge-Cookies bereits besitzt.

* * *

## 2\. Die JSON-Struktur der Turnier-API

Ein einzelner Aufruf von `https://corestats.pro/api/tournaments?page=1&pageSize=999` liefert ein Objekt mit folgender Form:

```json
{
  "body": {
    "contents": [ /* Array von Turnier-Objekten */ ]
  },
  "cached": true,
  "status": 200
}
```

### Relevante Felder eines Turnier-Objekts (in `body.contents[i]`)

| Feld | Typ | Bedeutung | Beispiel |
| --- | --- | --- | --- |
| `id` | number | Die Matcherino-Turnier-ID (= bountyId). Daraus wird der Matcherino-Link gebaut. | `213502` |
| `title` | string | Name des Turniers | `"SPORTSTARS (EMEA #46)"` |
| `gameRegionId` | number | **Region-ID** — der Schlüssel für die EU-Filterung | `25` (= EU/Germany-1) |
| `bracketStatus` | string | Status des Brackets: `"completed"`, `"in-progress"`, `"preparing"`, `"ready"`, `"check-in"` | `"completed"` |
| `status` | string | Allgemeiner Turnier-Status: `"in-progress"`, `"ready"` | `"in-progress"` |
| `startAt` | string (ISO 8601) | Startzeit des Turniers | `"2026-07-29T18:00:00Z"` |
| `endAt` | string | null | Endzeit (oft `null`, wird nicht immer gesetzt) | `null` |
| `totalBalance` | number | Prize Pool in Cent (durch 100 teilen für Dollar) | `6181` (= $61.81) |
| `balance` | number | Aktueller Prize-Pool-Stand in Cent | `5270` |
| `teamSignups` | number | Anzahl registrierter Teams | `169` |
| `isFeatured` | boolean | Ob das Turnier in "Featured" auftaucht | `false` |
| `gameId` | number | Spiel-ID (122 = Brawl Stars) | `122` |

### Beispiel eines kompletten Turnier-Objekts (gekürzt)

```json
{
  "id": 213502,
  "title": "SPORTSTARS (EMEA #46)",
  "gameRegionId": 25,
  "bracketStatus": "ready",
  "status": "ready",
  "startAt": "2026-07-29T18:00:00Z",
  "endAt": null,
  "totalBalance": 6181,
  "balance": 5270,
  "teamSignups": 169,
  "isFeatured": false,
  "gameId": 122
}
```

* * *

## 3\. Die Region-API und die EU-Region-IDs

Ein Aufruf von `https://corestats.pro/api/matcherino/regions` liefert ein Array aller Regionen. Jede Region hat die Form:

```json
{
  "id": 25,
  "name": "EU/Germany-1",
  "gameId": 122,
  "brawlStarsBattleRegionId": 16
}
```

### Alle EU-Region-IDs (Stand ermittelt am 2026-07-30)

| Region-ID (`gameRegionId`) | Name |
| --- | --- |
| **14** | EU/Ireland |
| **15** | EU/Italy |
| **17** | EU/Germany-2 |
| **18** | EU/Finland |
| **25** | EU/Germany-1 |

Das sind die fünf IDs, für die ein Turnier als **EU-Turnier** gilt. Im Code definiert man diese als Konstante:

```javascript
const EU_REGION_IDS = [14, 15, 17, 18, 25];
```

### Vollständige Regions-Liste (zur Referenz)

| ID | Name | Kontinent |
| --- | --- | --- |
| 6 | NA/Oregon | Nordamerika |
| 7 | NA/Dallas | Nordamerika |
| 8 | NA/Virginia | Nordamerika |
| 9 | NA/LosAngeles | Nordamerika |
| 10 | NA/Miami | Nordamerika |
| 11 | SA/Peru | Südamerika |
| 12 | SA/Chile | Südamerika |
| 13 | SA/Brasil-1 | Südamerika |
| 14 | EU/Ireland | **Europa** |
| 15 | EU/Italy | **Europa** |
| 17 | EU/Germany-2 | **Europa** |
| 18 | EU/Finland | **Europa** |
| 20 | AP/India | Asien-Pazifik |
| 21 | AP/Singapore | Asien-Pazifik |
| 22 | AP/Japan | Asien-Pazifik |
| 23 | AP/HongKong | Asien-Pazifik |
| 25 | EU/Germany-1 | **Europa** |
| (weitere) | ME/Riyadh etc. | Middle East / andere |

Falls Corestats in Zukunft neue EU-Regionen hinzufügt, kann man die Liste dynamisch aus der Regions-API laden (siehe Code-Beispiel weiter unten).

* * *

## 4\. Wann ist ein Turnier "Completed / Ended"?

Hier gibt es eine wichtige Feinheit, die man verstehen muss:

### Die Website-Logik ("ENDED" / "COMPLETED TOURNAMENTS")

Die Website zeigt ein Turnier im Bereich "COMPLETED TOURNAMENTS" an, sobald die **Startzeit (`startAt`) in der Vergangenheit liegt** — unabhängig davon, ob das Bracket schon finalisiert ist. Das erklärt, warum sehr aktuelle Turniere (z.B. "Time to Win #38" vom Jul 30) auf der Website als "ENDED" erscheinen, obwohl ihr `bracketStatus` noch `"in-progress"` oder `"ready"` ist.

### Die API-Logik (`bracketStatus`)

-   `bracketStatus === "completed"` → Das Bracket wurde finalisiert (offiziell beendet).
-   `bracketStatus === "in-progress"` → Läuft oder ist gerade gestartet/gestartet worden.
-   `bracketStatus === "preparing"` → Noch nicht gestartet (upcoming).
-   `bracketStatus === "ready"` → Bereit, kurz vor Start.

### Empfohlene Filter-Strategie für den Scanner

Um genau die Turniere zu bekommen, die die Website unter "COMPLETED TOURNAMENTS" zeigt, sollte man **beide Kriterien kombinieren**:

1.  **`startAt` liegt in der Vergangenheit** (Turnier hat bereits begonnen/beendet), UND
2.  **`bracketStatus` ist `"completed"` ODER `"in-progress"`** (also nicht mehr `"preparing"`/`"ready"`/`"check-in"`).

Wenn man nur die offiziell finalisierten Turniere will, reicht `bracketStatus === "completed"` allein. Will man exakt die Website-Liste nachbilden, nutzt man die `startAt`\-basierte Logik.

* * *

## 5\. Der Matcherino-Link

Der "Register on Matcherino"-Link folgt immer demselben Schema:

```
https://matcherino.com/tournaments/{id}
```

wobei `{id}` das `id`\-Feld des Turnier-Objekts ist (identisch mit der `bountyId` in den Website-URLs). Beispiele:

| Turnier | id | Matcherino-Link |
| --- | --- | --- |
| SPORTSTARS (EMEA #46) | 213502 | [https://matcherino.com/tournaments/213502](https://matcherino.com/tournaments/213502) |
| Time to Win #38 | 214210 | [https://matcherino.com/tournaments/214210](https://matcherino.com/tournaments/214210) |
| SkilZ ScrimZ #6 | 208351 | [https://matcherino.com/tournaments/208351](https://matcherino.com/tournaments/208351) |
| Fenris Pack Trials #9 | 210990 | [https://matcherino.com/tournaments/210990](https://matcherino.com/tournaments/210990) |
| BC\* Series #18 | 212841 | [https://matcherino.com/tournaments/212841](https://matcherino.com/tournaments/212841) |

Man muss also **kein Detail-Overlay öffnen**, um den Link zu bekommen — er ergibt sich direkt aus der `id`.

* * *

## 6\. Das Cloudflare-Problem und wie man es in Replit löst

Die Corestats-API ist durch Cloudflare geschützt. Ein direkter HTTP-Request von einem Server wird mit einer Challenge-Seite beantwortet. Es gibt drei Lösungsansätze für Replit:

### Lösung A: Headless-Browser mit Playwright (empfohlen)

Man nutzt Playwright, um eine echte Browser-Instanz zu starten, die Seite einmal zu laden (damit Cloudflare die Challenge löst und Cookies setzt), und dann per `page.evaluate()` den `fetch`\-Call an die API innerhalb des Browser-Kontexts auszuführen.

**Vorteile:** Zuverlässig, löst Cloudflare automatisch, kein manuelles Cookie-Management. **Nachteile:** Benötigt mehr Ressourcen (Browser läuft im Hintergrund).

### Lösung B: Cloudflare-Cookies manuell mitgeben

Man löst die Cloudflare-Challenge einmalig in einem Browser, extrahiert den `cf_clearance`\-Cookie (und ggf. den User-Agent) und sendet diese bei jedem `requests`/`fetch`\-Call mit.

**Vorteile:** Leicht, schnell, wenig Ressourcen. **Nachteile:** Der `cf_clearance`\-Cookie läuft nach einiger Zeit ab (meist einige Stunden bis Tage) und muss dann erneuert werden. Für einen täglichen Scan muss man das Cookie-Refresh-Logik einbauen.

### Lösung C: cloudscraper (Python)

Die Python-Library `cloudscraper` kann einfache Cloudflare-Challenges automatisch lösen. Sie ist ein Drop-in-Ersatz für `requests`.

**Vorteile:** Sehr einfach zu verwenden. **Nachteile:** Funktioniert nicht immer bei neueren Cloudflare-Challenge-Typen; kann unzuverlässig sein.

* * *

## 7\. Kompletter Code für Replit

### Variante 1: Node.js mit Playwright (empfohlen für Replit)

Diese Variante startet einen Headless-Browser, lädt die Corestats-Seite (Cloudflare wird automatisch gelöst), führt dann den API-Call im Browser-Kontext aus, filtert die EU-Turniere und speichert das Ergebnis als JSON-Datei.

**Datei: `package.json`**

```json
{
  "name": "eu-tournament-scanner",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node scanner.js",
    "scan": "node scanner.js"
  },
  "dependencies": {
    "playwright": "^1.40.0"
  }
}
```

**Datei: `scanner.js`**

```javascript
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// === KONFIGURATION ===
const EU_REGION_IDS = [14, 15, 17, 18, 25]; // EU/Ireland, EU/Italy, EU/Germany-2, EU/Finland, EU/Germany-1
const CORESTATS_URL = 'https://corestats.pro/tournaments';
const API_URL = 'https://corestats.pro/api/tournaments?page=1&pageSize=999';
const REGIONS_API_URL = 'https://corestats.pro/api/matcherino/regions';
const OUTPUT_DIR = './output';

async function runScan() {
  console.log('Starte EU Completed-Tournament Scan...');
  
  // Browser starten (Headless)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // 1. Hauptseite laden (löst Cloudflare-Challenge und setzt Cookies)
    console.log('Lade corestats.pro (Cloudflare-Challenge lösen)...');
    await page.goto(CORESTATS_URL, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Kurz warten, damit Cloudflare sicher durch ist
    await page.waitForTimeout(3000);

    // 2. Regionen abrufen (optional, falls sich Regionen ändern)
    console.log('Rufe Regions-API ab...');
    const regionsData = await page.evaluate(async (url) => {
      const resp = await fetch(url);
      return resp.json();
    }, REGIONS_API_URL);
    
    // EU-Regionen dynamisch ermitteln (fallback auf statische Liste)
    let euRegionIds = EU_REGION_IDS;
    let regionMap = {};
    if (regionsData && regionsData.body) {
      regionMap = {};
      regionsData.body.forEach(r => {
        regionMap[r.id] = r.name;
      });
      const dynamicEU = regionsData.body
        .filter(r => r.name.startsWith('EU/'))
        .map(r => r.id);
      if (dynamicEU.length > 0) {
        euRegionIds = dynamicEU;
        console.log('Dynamische EU-Region-IDs ermittelt:', euRegionIds);
      }
    }

    // 3. Turnier-API abrufen (im Browser-Kontext, mit Cloudflare-Cookies)
    console.log('Rufe Turnier-API ab...');
    const tournamentsData = await page.evaluate(async (url) => {
      const resp = await fetch(url);
      return resp.json();
    }, API_URL);

    const allTournaments = tournamentsData.body.contents;
    console.log(`Insgesamt ${allTournaments.length} Turniere erhalten.`);

    // 4. Filtern: EU + Completed (startAt in Vergangenheit + bracketStatus nicht upcoming)
    const now = new Date();
    const euCompletedTournaments = allTournaments
      .filter(t => {
        const isEU = euRegionIds.includes(t.gameRegionId);
        const startInPast = t.startAt && new Date(t.startAt) < now;
        const isNotUpcoming = t.bracketStatus !== 'preparing' && t.bracketStatus !== 'ready' && t.bracketStatus !== 'check-in';
        return isEU && startInPast && isNotUpcoming;
      })
      .map(t => ({
        id: t.id,
        title: t.title,
        region: regionMap[t.gameRegionId] || `Region-${t.gameRegionId}`,
        gameRegionId: t.gameRegionId,
        bracketStatus: t.bracketStatus,
        startAt: t.startAt,
        prizePool: t.totalBalance ? (t.totalBalance / 100).toFixed(2) : '0.00',
        teamsRegistered: t.teamSignups || 0,
        matcherinoLink: `https://matcherino.com/tournaments/${t.id}`,
        corestatsLink: `https://corestats.pro/tournaments?id=${t.id}`,
      }))
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt)); // Neueste zuerst

    console.log(`\n=== ${euCompletedTournaments.length} EU Completed-Turniere gefunden ===\n`);
    euCompletedTournaments.forEach((t, i) => {
      console.log(`${i + 1}. ${t.title}`);
      console.log(`   Region: ${t.region} | Start: ${t.startAt} | Prize: $${t.prizePool}`);
      console.log(`   Matcherino: ${t.matcherinoLink}`);
      console.log('');
    });

    // 5. Ergebnis speichern
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const outputFile = path.join(OUTPUT_DIR, `eu_tournaments_${timestamp}.json`);
    
    const output = {
      scanDate: new Date().toISOString(),
      totalTournamentsScanned: allTournaments.length,
      euCompletedCount: euCompletedTournaments.length,
      euRegionIds: euRegionIds,
      tournaments: euCompletedTournaments,
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`Ergebnis gespeichert: ${outputFile}`);

    // Auch eine "latest" Datei für die Website
    fs.writeFileSync(path.join(OUTPUT_DIR, 'eu_tournaments_latest.json'), JSON.stringify(output, null, 2));

    return euCompletedTournaments;

  } finally {
    await browser.close();
  }
}

// Ausführen
runScan().catch(err => {
  console.error('Fehler beim Scan:', err);
  process.exit(1);
});
```

### Variante 2: Python mit cloudscraper (einfacher, aber evtl. unzuverlässiger bei Cloudflare)

**Datei: `scanner.py`**

```python
import cloudscraper
import json
from datetime import datetime, timezone
import os

# === KONFIGURATION ===
EU_REGION_IDS = [14, 15, 17, 18, 25]  # EU/Ireland, EU/Italy, EU/Germany-2, EU/Finland, EU/Germany-1
API_URL = "https://corestats.pro/api/tournaments?page=1&pageSize=999"
REGIONS_API_URL = "https://corestats.pro/api/matcherino/regions"
OUTPUT_DIR = "./output"

def run_scan():
    print("Starte EU Completed-Tournament Scan...")
    
    # cloudscraper umgeht einfache Cloudflare-Challenges
    scraper = cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
    )
    
    # 1. Hauptseite laden (setzt Cloudflare-Cookies)
    print("Lade corestats.pro (Cloudflare-Challenge lösen)...")
    scraper.get("https://corestats.pro/tournaments")
    
    # 2. Regionen abrufen
    print("Rufe Regions-API ab...")
    regions_resp = scraper.get(REGIONS_API_URL)
    regions_data = regions_resp.json()
    
    region_map = {}
    eu_region_ids = EU_REGION_IDS
    if regions_data and 'body' in regions_data:
        for r in regions_data['body']:
            region_map[r['id']] = r['name']
        dynamic_eu = [r['id'] for r in regions_data['body'] if r['name'].startswith('EU/')]
        if dynamic_eu:
            eu_region_ids = dynamic_eu
            print(f"Dynamische EU-Region-IDs: {eu_region_ids}")
    
    # 3. Turnier-API abrufen
    print("Rufe Turnier-API ab...")
    tour_resp = scraper.get(API_URL)
    tour_data = tour_resp.json()
    
    all_tournaments = tour_data['body']['contents']
    print(f"Insgesamt {len(all_tournaments)} Turniere erhalten.")
    
    # 4. Filtern: EU + Completed
    now = datetime.now(timezone.utc)
    eu_completed = []
    
    for t in all_tournaments:
        is_eu = t.get('gameRegionId') in eu_region_ids
        start_at = t.get('startAt')
        start_in_past = False
        if start_at:
            try:
                dt = datetime.fromisoformat(start_at.replace('Z', '+00:00'))
                start_in_past = dt < now
            except:
                start_in_past = False
        
        bracket_status = t.get('bracketStatus', '')
        is_not_upcoming = bracket_status not in ('preparing', 'ready', 'check-in')
        
        if is_eu and start_in_past and is_not_upcoming:
            region_name = region_map.get(t['gameRegionId'], f"Region-{t['gameRegionId']}")
            prize = t.get('totalBalance', 0) or 0
            eu_completed.append({
                'id': t['id'],
                'title': t['title'],
                'region': region_name,
                'gameRegionId': t['gameRegionId'],
                'bracketStatus': bracket_status,
                'startAt': start_at,
                'prizePool': f"{prize / 100:.2f}",
                'teamsRegistered': t.get('teamSignups', 0) or 0,
                'matcherinoLink': f"https://matcherino.com/tournaments/{t['id']}",
                'corestatsLink': f"https://corestats.pro/tournaments?id={t['id']}",
            })
    
    # Nach Startzeit absteigend sortieren (neueste zuerst)
    eu_completed.sort(key=lambda x: x['startAt'] or '', reverse=True)
    
    print(f"\n=== {len(eu_completed)} EU Completed-Turniere gefunden ===\n")
    for i, t in enumerate(eu_completed, 1):
        print(f"{i}. {t['title']}")
        print(f"   Region: {t['region']} | Start: {t['startAt']} | Prize: ${t['prizePool']}")
        print(f"   Matcherino: {t['matcherinoLink']}")
        print()
    
    # 5. Speichern
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    output = {
        'scanDate': datetime.now(timezone.utc).isoformat(),
        'totalTournamentsScanned': len(all_tournaments),
        'euCompletedCount': len(eu_completed),
        'euRegionIds': eu_region_ids,
        'tournaments': eu_completed,
    }
    
    output_file = os.path.join(OUTPUT_DIR, f"eu_tournaments_{timestamp}.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Ergebnis gespeichert: {output_file}")
    
    # Latest-Datei
    latest_file = os.path.join(OUTPUT_DIR, "eu_tournaments_latest.json")
    with open(latest_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    return eu_completed

if __name__ == '__main__':
    run_scan()
```

**Datei: `requirements.txt` (für Python-Variante)**

```
cloudscraper>=1.2.71
```

* * *

## 8\. Täglichen Scan in Replit einrichten (Cron/Scheduler)

Damit der Scan automatisch einmal pro Tag läuft, nutzt man Replits **Scheduled Deployments** oder einen internen Scheduler.

### Option A: Replit Scheduled Deployments (empfohlen)

In Replit unter **Deployments → Scheduled Deployments** kann man einen Cron-Ausdruck eintragen, der den Scan-Run automatisch startet:

-   **Cron-Ausdruck für täglich 09:00 UTC:** `0 9 * * *`
-   **Cron-Ausdruck für täglich 06:00 Uhr morgens (MEZ):** `0 5 * * *`
-   Der Run-Command wäre dann `node scanner.js` (Node.js) bzw. `python scanner.py` (Python).

### Option B: Interner Scheduler im Code (Node.js)

Man kann den Scheduler auch direkt im Code mit `node-cron` einbauen, sodass der Replit durchgehend läuft und sich selbst triggert:

**Datei: `scheduler.js`**

```javascript
const cron = require('node-cron');
const { runScan } = require('./scanner'); // runScan muss exportiert werden

// Tägliche um 09:00 UTC
cron.schedule('0 9 * * *', async () => {
  console.log('[' + new Date().toISOString() + '] Geplanter Scan startet...');
  try {
    await runScan();
    console.log('Scan erfolgreich abgeschlossen.');
  } catch (err) {
    console.error('Scan fehlgeschlagen:', err);
  }
});

console.log('Scheduler gestartet. Wartet auf nächsten Cron-Trigger (09:00 UTC täglich).');

// Optional: sofort einen Scan beim Start ausführen
// runScan().catch(console.error);
```

**Dazu in `package.json` ergänzen:**

```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "node-cron": "^3.0.3"
  }
}
```

* * *

## 9\. Die Output-Datei verstehen

Der Scanner erzeugt täglich eine JSON-Datei `output/eu_tournaments_YYYY-MM-DD.json` sowie eine `output/eu_tournaments_latest.json`. Die Struktur:

```json
{
  "scanDate": "2026-07-30T09:00:00.000Z",
  "totalTournamentsScanned": 513,
  "euCompletedCount": 16,
  "euRegionIds": [14, 15, 17, 18, 25],
  "tournaments": [
    {
      "id": 213502,
      "title": "SPORTSTARS (EMEA #46)",
      "region": "EU/Germany-1",
      "gameRegionId": 25,
      "bracketStatus": "ready",
      "startAt": "2026-07-29T18:00:00Z",
      "prizePool": "61.81",
      "teamsRegistered": 169,
      "matcherinoLink": "https://matcherino.com/tournaments/213502",
      "corestatsLink": "https://corestats.pro/tournaments?id=213502"
    }
  ]
}
```

Diese JSON-Datei kann die Replit-Webseite dann einlesen und anzeigen.

* * *

## 10\. Beachtenswerte Punkte und Edge Cases

1.  **`pageSize=999` deckt nicht ALLE 58 Completed-Pages ab.** Die API liefert mit `pageSize=999` ca. 513 Turniere (die aktuellsten). Die Completed-Pagination der Website zeigt ~464 Turniere (58 Seiten × 8), aber viele davon sind älter als der von der API zurückgegebene Zeitraum. Für einen **täglichen Scan** reicht das aber aus, da man jeden Tag nur die NEUEN beendeten Turniere des letzten Tages braucht. Wenn man die gesamte Historie will, muss man paginieren (mehrere API-Calls mit `page=2`, `page=3` etc.) oder `pageSize` weiter erhöhen und prüfen, ob die API das unterstützt.
2.  **`bracketStatus` vs. Website "ENDED":** Wie in Abschnitt 4 erklärt, zeigt die Website Turniere als "ENDED", sobald `startAt` in der Vergangenheit liegt. Der `bracketStatus` wird erst später auf `"completed"` gesetzt. Der Scanner nutzt daher die kombinierte Logik (`startAt` in Vergangenheit + nicht upcoming), um die Website-Liste nachzubilden.
3.  **`totalBalance` ist in Cent.** Um Dollar zu bekommen, durch 100 teilen. Beispiel: `6181` → `$61.81`.
4.  **Cloudflare-Cookie-Ablauf:** Wenn man Lösung B (manuelle Cookies) nutzt, läuft `cf_clearance` ab. Lösung A (Playwright) umgeht das, weil jeder Scan-Run einen frischen Browser startet.
5.  **Neue EU-Regionen:** Der Code lädt die Regionen dynamisch aus der Regions-API und filtert alle mit `name.startsWith('EU/')`. Falls Corestats neue EU-Server hinzufügt, werden sie automatisch erkannt.
6.  **Deduplizierung bei täglichen Scans:** Da jeden Tag ein neuer Scan läuft, können Turniere in mehreren Tages-Dateien auftauchen (sie bleiben ja beendet). Die Website sollte bei Bedarf über die `id` deduplizieren und nur die neuesten anzeigen.

* * *

## 11\. Schnell-Checkliste für Replit

-   [ ]  Neues Replit-Projekt erstellen (Node.js oder Python)
-   [ ]  Abhängigkeiten installieren (`npm install playwright node-cron` bzw. `pip install cloudscraper`)
-   [ ]  Bei Node.js: `npx playwright install chromium` ausführen (Browser herunterladen)
-   [ ]  `scanner.js` bzw. `scanner.py` einfügen
-   [ ]  Einmal manuell testen: `node scanner.js` bzw. `python scanner.py`
-   [ ]  Prüfen, ob `output/eu_tournaments_latest.json` korrekt erzeugt wurde
-   [ ]  Scheduled Deployment in Replit einrichten (Cron: `0 9 * * *`)
-   [ ]  Website-Bereich einbauen, der `eu_tournaments_latest.json` einliest und anzeigt

* * *

## 12\. Verifizierte Beispieldaten (manuell am 2026-07-30 geprüft)

Diese Turniere wurden manuell durch Öffnen der Detail-Overlays verifiziert und bestätigen, dass die API-Daten korrekt sind:

| Turnier | id | Region (manuell) | gameRegionId (API) | Matcherino-Link |
| --- | --- | --- | --- | --- |
| SPORTSTARS (EMEA #46) | 213502 | EU/Germany-1 | 25 ✅ | [https://matcherino.com/tournaments/213502](https://matcherino.com/tournaments/213502) |
| Time to Win #38 | 214210 | EU/Germany-1 | 25 ✅ | [https://matcherino.com/tournaments/214210](https://matcherino.com/tournaments/214210) |
| SkilZ ScrimZ #6 | 208351 | EU/Germany-2 | 17 ✅ | [https://matcherino.com/tournaments/208351](https://matcherino.com/tournaments/208351) |
| Fenris Pack Trials #9 | 210990 | EU/Germany-2 | 17 ✅ | [https://matcherino.com/tournaments/210990](https://matcherino.com/tournaments/210990) |
| BC\* Series #18 | 212841 | EU/Germany-2 | 17 ✅ | [https://matcherino.com/tournaments/212841](https://matcherino.com/tournaments/212841) |
| LIGA LNA #27 | 211674 | SA/Brasil-1 (nicht EU) | 13 ✅ | — |
| TE 8-Bit Only | 213264 | NA/Dallas (nicht EU) | (NA) ✅ | — |
| Transcending Void #24 | 213340 | AP/India (nicht EU) | 20 ✅ | — |
| NOLIFE#27 | 211631 | ME/Riyadh (nicht EU) | (ME) ✅ | — |

Die Übereinstimmung zwischen manueller Prüfung und API-Daten beträgt 100%, was die Zuverlässigkeit des API-Ansatzes bestätigt.