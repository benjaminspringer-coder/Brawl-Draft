<h1>CoreStats Draft-Extraktion — Komplette Anleitung für Replit</h1><blockquote> <p><strong>Ziel:</strong> Draft-Daten (Picks, Bans, Maps) der Brawl-Stars-Turniere von <code>corestats.pro</code> für <strong>Day 1 und Day 2</strong> (EMEA Qualifier, JUL 2026) extrahieren und in einer Replit-Webseite verfügbar machen.</p> </blockquote><p>Diese Anleitung enthält alles, was du brauchst: <strong>was installieren</strong>, <strong>wie Cloudflare umgehen</strong>, <strong>welche API-Endpunkte</strong>, <strong>wie parsen</strong> und <strong>wie in die Webseite einbauen</strong>.</p><hr><h2>1. Das Problem &amp; die Lösung im Überblick</h2><p><code>corestats.pro</code> ist durch <strong>Cloudflare</strong> geschützt ("Just a moment…"-Challenge). Ein normaler <code>fetch</code>/<code>requests</code>/<code>curl</code>-Aufruf bekommt nur eine 403-Seite zurück. Die Seite rendert zusätzlich alles clientseitig mit JavaScript.</p><p><strong>Die Lösung:</strong> Wir nutzen <strong>Playwright</strong> (echter Chromium-Browser), lassen ihn die Cloudflare-Challenge automatisch lösen und greifen dann <strong>im Browser-Kontext</strong> auf die internen JSON-APIs von CoreStats zu. Das ist der einzige zuverlässige Weg.</p><h3>Die drei API-Endpunkte (das Herzstück)</h3><p>Alle Endpunkte liefern JSON und sind nur über den authentifizierten Browser erreichbar:</p><table class="e-rte-table"> <thead> <tr> <th>Endpunkt</th> <th>Zweck</th> <th>Beispiel</th> </tr> </thead> <tbody><tr> <td><code>/api/brackets/data?url={segmentId}</code></td> <td>Alle Matches, Teams, Spieler, Scores eines Turnier-Segments</td> <td>siehe unten</td> </tr> <tr> <td><code>/api/match/live/{matchId}</code></td> <td><strong>Draft pro Match</strong>: Sets, Maps (Modus + Name), Bans, Picks, Builds</td> <td>siehe unten</td> </tr> <tr> <td><code>/api/match/global-bans/{matchId}</code></td> <td>Globale Bans pro Match (oft leer)</td> <td>optional</td> </tr> </tbody></table><h3>Die Segment-IDs (Turnier-Identifikation)</h3><p>Diese UUIDs identifizieren den Turnier-Baum. Sie stehen in jedem Match-Objekt als <code>segment_id</code> und in der URL, die der Browser beim Laden aufruft. Für die EMEA-Turniere im Juli 2026 (Parameter <code>m=jul26&amp;r=emea</code>):</p><pre><code>Day 1 (s=qday1):  19264db4-70c9-11f1-a49f-cade9bdb68ea
Day 2 (s=qday2):  192a3398-70c9-11f1-a63e-cade9bdb68ea
</code></pre><blockquote> <p><strong>Wie findet man die Segment-ID für andere Tage/Regionen?</strong> Lade die Seite <code>https://corestats.pro/brackets?m=...&amp;r=...&amp;s=...</code> im Browser und lies die Performance-Entries aus: <code>performance.getEntriesByType('resource').map(e=&gt;e.name).filter(n=&gt;n.includes('brackets/data'))</code>. Dort steht die <code>url={segmentId}</code>. Alternativ: Jedes Match-Objekt im Bracket-JSON enthält das Feld <code>segment_id</code>.</p> </blockquote><hr><h2>2. Was du auf Replit installieren musst</h2><p>Replit nutzt Nix für Systempakete und <code>pip</code> für Python-Pakete.</p><h3>Schritt 2.1 — Python-Pakete (in der Shell)</h3><pre><code class="language-bash">pip install playwright
</code></pre><h3>Schritt 2.2 — Chromium-Browser für Playwright installieren</h3><pre><code class="language-bash">playwright install chromium
</code></pre><blockquote> <p>Falls Replit die System-Abhängigkeiten von Chromium nicht automatisch aufrüstet:</p> <pre><code class="language-bash">playwright install-deps chromium
</code></pre> <p>(braucht <code>sudo</code> — auf Replit nix-basiert meist automatisch verfügbar).</p> </blockquote><h3>Schritt 2.3 — Virtueller Display (Xvfb) — <strong>SEHR WICHTIG</strong></h3><p><strong>Cloudflare blockiert den <code>headless=True</code>-Modus</strong> (Automation wird erkannt → Challenge wird nie gelöst → Timeout). Der Browser <strong>muss</strong> im sichtbaren Modus (<code>headless=False</code>) laufen. Auf einem Server ohne Bildschirm braucht man dafür <strong>Xvfb</strong> (virtueller X-Server).</p><p>Auf Replit (Nix) in der <code>replit.nix</code> Datei ergänzen:</p><pre><code class="language-nix">{ pkgs }: {
  deps = [
    pkgs.chromium         # oft schon durch playwright installiert
    pkgs.xorg.xvfb        # virtueller Display-Server
    pkgs.xorg.xauth
  ];
}
</code></pre><p>Oder direkt über die Shell installieren (Debian/Ubuntu-basiert):</p><pre><code class="language-bash">sudo apt-get update &amp;&amp; sudo apt-get install -y xvfb
</code></pre><h3>Schritt 2.4 — Vollständige Installations-Checkliste</h3><pre><code class="language-bash"># 1) Python-Paket
pip install playwright

# 2) Browser + Deps
playwright install chromium
playwright install-deps chromium    # falls nötig

# 3) Virtueller Display
sudo apt-get install -y xvfb         # oder über replit.nix: pkgs.xorg.xvfb

# 4) Test ob alles da ist
python3 -c "from playwright.sync_api import sync_playwright; print('ok')"
which Xvfb
</code></pre><hr><h2>3. Der fertige Extraktions-Code</h2><p>Lege eine Datei <code>corestats_draft.py</code> an. Dieses Skript ist <strong>komplett standalone</strong> — es startet einen eigenen Chromium, löst Cloudflare und extrahiert <strong>alle</strong> Draft-Daten.</p><pre><code class="language-python"># corestats_draft.py
import json, os, time
from playwright.sync_api import sync_playwright

BASE = "https://corestats.pro"

# Segment-IDs der EMEA-Turniere (JUL 2026)
SEGMENTS = {
    "day1": "19264db4-70c9-11f1-a49f-cade9bdb68ea",
    "day2": "192a3398-70c9-11f1-a63e-cade9bdb68ea",
}


def get_played_matches(page, segment_id):
    """Holt alle gespielten Matches (ohne Bye) eines Segments."""
    raw = page.evaluate(f"""async () =&gt; {{
        const r = await fetch('/api/brackets/data?url={segment_id}');
        return await r.text();
    }}""")
    data = json.loads(raw)["data"]
    played = [m for m in data["match"]
              if not m["opponent1"]["is_bye"] and not m["opponent2"]["is_bye"]
              and (m["opponent1"]["score"] is not None
                   or m["opponent2"]["score"] is not None)]
    return played


def get_match_draft(page, match):
    """Holt Picks/Bans/Maps für ein einzelnes Match via /api/match/live."""
    mid = match["id"]
    raw = page.evaluate(f"""async () =&gt; {{
        const r = await fetch('/api/match/live/{mid}');
        return await r.text();
    }}""")
    try:
        live = json.loads(raw)
    except Exception:
        return None  # kein gültiges JSON -&gt; Match überspringen

    # API kann {"data":[...]} ODER direkt [...] (Fehler/Rate-Limit) liefern:
    if isinstance(live, list):
        data_list = live
    elif isinstance(live, dict):
        data_list = live.get("data")
    else:
        return None
    if not data_list:
        return None

    o1, o2 = match["opponent1"], match["opponent2"]
    draft = {
        "match_id": mid,
        "match_number": match.get("number"),
        "round": match.get("round_id"),
        "format": "Bo" + str(match.get("child_count", 3)),
        "team1": {"name": o1["name"], "code": o1.get("team_code"),
                  "score": o1.get("score"), "result": o1.get("result"),
                  "seed": o1.get("seed"),
                  "players": [{"name": p["name"], "tag": p.get("tag")}
                              for p in o1.get("players", [])]},
        "team2": {"name": o2["name"], "code": o2.get("team_code"),
                  "score": o2.get("score"), "result": o2.get("result"),
                  "seed": o2.get("seed"),
                  "players": [{"name": p["name"], "tag": p.get("tag")}
                              for p in o2.get("players", [])]},
        "winner": "team1" if o1.get("result") == "win"
                  else "team2" if o2.get("result") == "win" else None,
        "sets": [],
    }

    for el in data_list:
        if not isinstance(el, dict):
            continue
        games, teams = el.get("games", []), el.get("teams", [])
        if not games and not teams:
            continue
        s = {
            "round_in_match": el.get("round"),
            "team1_bans": [b["name"] for b in teams[0].get("bans", [])] if len(teams) &gt; 0 else [],
            "team2_bans": [b["name"] for b in teams[1].get("bans", [])] if len(teams) &gt; 1 else [],
            "maps": [],
        }
        for g in games:
            loc = g.get("location", {})
            gt = g.get("teams", [])
            s["maps"].append({
                "mode": loc.get("gameMode"),     # z.B. HEIST, KNOCKOUT, BRAWL BALL, BOUNTY
                "map": loc.get("name"),          # z.B. Safe Zone, Goldarm Gulch, Pinhole Punt
                "map_id": loc.get("id"),
                "duration": g.get("duration"),
                "team1": _team_picks(gt, 0),
                "team2": _team_picks(gt, 1),
            })
        draft["sets"].append(s)
    return draft


def _team_picks(gt, idx):
    if len(gt) &lt;= idx:
        return {"is_winner": None, "picks": []}
    return {
        "is_winner": gt[idx].get("isWinner"),
        "picks": [{
            "brawler": p["brawler"]["name"],
            "player": p.get("name") or p.get("tag"),
            "gadget": p["brawler"].get("gadget", {}).get("name"),
            "star_power": p["brawler"].get("starPower", {}).get("name"),
            "hypercharge": p["brawler"].get("hyperCharge", {}).get("name"),
            "gears": [gg.get("name") for gg in p["brawler"].get("gears", [])],
        } for p in gt[idx].get("players", []) if p.get("brawler")],
    }


def extract_all(day_filter=None, out_dir="data"):
    """Hauptfunktion: extrahiert Drafts für alle Tage und speichert JSON."""
    os.makedirs(out_dir, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,                      # MUSS False sein wg. Cloudflare!
            args=["--no-sandbox",
                  "--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"),
            viewport={"width": 1366, "height": 768},
        )
        page = context.new_page()

        # Seite laden &amp; Cloudflare-Challenge abwarten
        print("Lade CoreStats &amp; warte auf Cloudflare-Challenge...")
        page.goto(f"{BASE}/brackets?m=jul26&amp;r=emea&amp;s=qday1",
                  wait_until="networkidle", timeout=60000)
        page.wait_for_selector("article.match", timeout=45000)
        print("  -&gt; Cloudflare gelöst, Seite bereit.")

        all_drafts = []
        days = [day_filter] if day_filter else list(SEGMENTS.keys())
        for day in days:
            seg = SEGMENTS[day]
            matches = get_played_matches(page, seg)
            print(f"\n[{day}] {len(matches)} gespielte Matches (segment {seg[:8]})")
            drafts = []
            for i, m in enumerate(matches):
                d = get_match_draft(page, m)
                if d:
                    drafts.append(d)
                if (i + 1) % 20 == 0 or i == len(matches) - 1:
                    print(f"  [{i+1}/{len(matches)}] {len(drafts)} Drafts gesammelt")
                time.sleep(0.12)              # Server nicht überlasten
            path = os.path.join(out_dir, f"drafts_{day}.json")
            json.dump({"day": day, "match_count": len(drafts), "drafts": drafts},
                      open(path, "w"), ensure_ascii=False, indent=1)
            print(f"  -&gt; gespeichert: {path}")
            all_drafts += drafts

        combined = os.path.join(out_dir, "drafts_all.json")
        json.dump({"total_matches": len(all_drafts), "drafts": all_drafts},
                  open(combined, "w"), ensure_ascii=False, indent=1)
        print(f"\nFERTIG: {len(all_drafts)} Drafts -&gt; {combined}")
        browser.close()
        return all_drafts


if __name__ == "__main__":
    extract_all()
</code></pre><hr><h2>4. Skript ausführen</h2><h3>4.1 — Mit virtuellem Display starten</h3><p>Da <code>headless=False</code> gesetzt ist, braucht das Skript einen X-Server. Starte es über <code>xvfb-run</code> (erzeugt automatisch einen virtuellen Display):</p><pre><code class="language-bash">xvfb-run --auto-servernum python3 corestats_draft.py
</code></pre><p><strong>Alternative</strong> (Display manuell starten, nützlich wenn man den Browser sehen will):</p><pre><code class="language-bash"># Terminal 1: Display starten
Xvfb :99 -screen 0 1366x768x24 &amp;
export DISPLAY=:99

# Terminal 2: Skript laufen lassen
python3 corestats_draft.py
</code></pre><h3>4.2 — Nur einen Tag extrahieren</h3><pre><code class="language-bash">xvfb-run --auto-servernum python3 -c "from corestats_draft import extract_all; extract_all('day2')"
</code></pre><h3>4.3 — Was passiert beim Start (Erwartete Ausgabe)</h3><pre><code>Lade CoreStats &amp; warte auf Cloudflare-Challenge...
  -&gt; Cloudflare gelöst, Seite bereit.

[day1] 767 gespielte Matches (segment 19264db4)
  [20/767] 20 Drafts gesammelt
  [40/767] 40 Drafts gesammelt
  ...
  -&gt; gespeichert: data/drafts_day1.json

[day2] 51 gespielte Matches (segment 192a3398)
  [20/51] 20 Drafts gesammelt
  ...
  -&gt; gespeichert: data/drafts_day2.json

FERTIG: 818 Drafts -&gt; data/drafts_all.json
</code></pre><p>Dauer: ca. 7–10 Minuten (0,12 s Pause pro Match + Cloudflare-Initialisierung).</p><hr><h2>5. Die JSON-Datenstruktur (was du bekommst)</h2><p><code>data/drafts_all.json</code> enthält ein Array von Match-Drafts. Beispiel eines Eintrags:</p><pre><code class="language-json">{
  "match_id": "c7a2b24e-77d4-11f1-8640-b6b64b77d564",
  "match_number": 1,
  "round": 1,
  "format": "Bo5",
  "team1": {
    "name": "FUT Esports", "code": null, "score": 3, "result": "win", "seed": 1,
    "players": [{"name": "...", "tag": "#..."}]
  },
  "team2": {
    "name": "F/A🇰🇷", "code": null, "score": 0, "result": "loss", "seed": 2,
    "players": [{"name": "...", "tag": "#..."}]
  },
  "winner": "team1",
  "sets": [
    {
      "round_in_match": 2,
      "team1_bans": ["SURGE", "8-BIT", "MAX"],
      "team2_bans": ["EDGAR", "CROW", "COLETTE"],
      "maps": [
        {
          "mode": "HEIST",
          "map": "Safe Zone",
          "map_id": 15000019,
          "duration": 56,
          "team1": {
            "is_winner": true,
            "picks": [
              {"brawler": "MEG", "player": "...", "gadget": "TOOLBOX",
               "star_power": "FORCE FIELD", "hypercharge": "TUNGSTEN TOUGHNESS",
               "gears": ["SHIELD", "DAMAGE"]}
            ]
          },
          "team2": {
            "is_winner": false,
            "picks": [
              {"brawler": "CHUCK", "player": "...", "gadget": "REROUTING",
               "star_power": "...", "hypercharge": "...", "gears": []}
            ]
          }
        }
      ]
    }
  ]
}
</code></pre><h3>Wo was zu finden ist — Schnellreferenz</h3><table class="e-rte-table"> <thead> <tr> <th>Du willst…</th> <th>Pfad im JSON</th> </tr> </thead> <tbody><tr> <td>Teamnamen &amp; Score</td> <td><code>team1.name</code>, <code>team1.score</code>, <code>team2.name</code>, <code>team2.score</code></td> </tr> <tr> <td>Gewinner des Matches</td> <td><code>winner</code> ("team1"/"team2")</td> </tr> <tr> <td>Bans eines Teams (pro Set)</td> <td><code>sets[].team1_bans</code>, <code>sets[].team2_bans</code></td> </tr> <tr> <td>Map-Name &amp; Modus</td> <td><code>sets[].maps[].map</code>, <code>sets[].maps[].mode</code></td> </tr> <tr> <td>Picks pro Map</td> <td><code>sets[].maps[].team1.picks[]</code>, <code>.team2.picks[]</code></td> </tr> <tr> <td>Gewinner einer Map</td> <td><code>sets[].maps[].team1.is_winner</code>, <code>.team2.is_winner</code></td> </tr> <tr> <td>Brawler-Build (Gadget/SP/HC/Gears)</td> <td><code>picks[].gadget</code>, <code>.star_power</code>, <code>.hypercharge</code>, <code>.gears</code></td> </tr> <tr> <td>Spielername zu einem Pick</td> <td><code>picks[].player</code></td> </tr> <tr> <td>Format (Bo3/Bo5)</td> <td><code>format</code></td> </tr> <tr> <td>Runde im Turnier</td> <td><code>round</code></td> </tr> </tbody></table><hr><h2>6. In die Replit-Webseite einbauen</h2><h3>6.1 — Daten als statische JSON-Datei bereitstellen</h3><p>Nach dem Extrahieren liegen die Dateien in <code>data/</code>. Lege sie in deinen <code>static</code>/ <code>public</code>-Ordner, damit die Webseite sie per <code>fetch</code> laden kann:</p><pre><code>dein-replit-projekt/
├── corestats_draft.py      # Extraktions-Skript (Teil 3)
├── data/
│   ├── drafts_day1.json
│   ├── drafts_day2.json
│   └── drafts_all.json
└── static/                 # oder public/
    └── drafts_all.json     # Kopie für die Webseite
</code></pre><p>Kopieren:</p><pre><code class="language-bash">mkdir -p static &amp;&amp; cp data/drafts_*.json static/
</code></pre><h3>6.2 — Frontend: Drafts laden &amp; anzeigen (Beispiel)</h3><pre><code class="language-html">&lt;!-- index.html --&gt;
&lt;!DOCTYPE html&gt;
&lt;html lang="de"&gt;
&lt;head&gt;&lt;meta charset="utf-8"&gt;&lt;title&gt;CoreStats Drafts&lt;/title&gt;&lt;/head&gt;
&lt;body&gt;
  &lt;h1&gt;CoreStats Drafts — EMEA JUL26&lt;/h1&gt;
  &lt;select id="daySelect"&gt;
    &lt;option value="drafts_day1.json"&gt;Day 1&lt;/option&gt;
    &lt;option value="drafts_day2.json"&gt;Day 2&lt;/option&gt;
  &lt;/select&gt;
  &lt;div id="matches"&gt;&lt;/div&gt;

  &lt;script&gt;
    async function loadDrafts(file) {
      const res = await fetch('/static/' + file);
      const data = await res.json();
      const box = document.getElementById('matches');
      box.innerHTML = '';
      data.drafts.forEach(m =&gt; {
        const el = document.createElement('div');
        el.innerHTML = `
          &lt;h3&gt;Match ${m.match_number} (Runde ${m.round}, ${m.format}):
              ${m.team1.name} ${m.team1.score} – ${m.team2.score} ${m.team2.name}&lt;/h3&gt;`;
        m.sets.forEach(s =&gt; {
          const sEl = document.createElement('div');
          sEl.innerHTML = `
            &lt;p&gt;Bans: ${m.team1.name} → ${s.team1_bans.join(', ')} |
                      ${m.team2.name} → ${s.team2_bans.join(', ')}&lt;/p&gt;`;
          s.maps.forEach(mp =&gt; {
            const t1 = mp.team1.picks.map(p =&gt; p.brawler).join(', ');
            const t2 = mp.team2.picks.map(p =&gt; p.brawler).join(', ');
            sEl.innerHTML += `&lt;p&gt;🗺️ ${mp.mode} – ${mp.map} (${mp.duration}s):
              &lt;b&gt;${mp.team1.is_winner ? '✅' : ''}&lt;/b&gt; ${t1} vs ${t2}
              &lt;b&gt;${mp.team2.is_winner ? '✅' : ''}&lt;/b&gt;&lt;/p&gt;`;
          });
          el.appendChild(sEl);
        });
        box.appendChild(el);
      });
    }
    document.getElementById('daySelect').addEventListener('change', e =&gt; loadDrafts(e.target.value));
    loadDrafts('drafts_day1.json');  // initial
  &lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;
</code></pre><h3>6.3 — Daten aktualisieren (regelmäßig neu extrahieren)</h3><p>Wenn sich Turnier-Ergebnisse ändern, einfach das Skript neu laufen lassen:</p><pre><code class="language-bash">xvfb-run --auto-servernum python3 corestats_draft.py
cp data/drafts_*.json static/
</code></pre><p>Oder als <strong>Cron-Job</strong> in Replit (z. B. stündlich während eines laufenden Turniers): in der <code>replit.nix</code> oder einem Shell-Skript den obigen Befehl hinterlegen.</p><hr><h2>7. Fehlerbehebung (Troubleshooting)</h2><table class="e-rte-table"> <thead> <tr> <th>Problem</th> <th>Ursache</th> <th>Lösung</th> </tr> </thead> <tbody><tr> <td><code>TimeoutError</code> bei <code>wait_for_selector("article.match")</code></td> <td>Cloudflare-Challenge nicht gelöst</td> <td><code>headless=False</code> setzen + <code>xvfb-run</code> verwenden (Abschnitt 2.3/4.1)</td> </tr> <tr> <td>403 / "Just a moment" bei <code>fetch</code>-Ergebnis</td> <td>Browser-Kontext nicht authentifiziert</td> <td>Fetch <strong>immer</strong> über <code>page.evaluate(async()=&gt;fetch(...))</code> ausführen, nie mit <code>requests</code>/<code>curl</code></td> </tr> <tr> <td><code>playwright._impl._errors.Error: Executable doesn't exist</code></td> <td>Chromium nicht installiert</td> <td><code>playwright install chromium</code> ausführen</td> </tr> <tr> <td>Browser startet gar nicht</td> <td>Fehlende System-Libs</td> <td><code>playwright install-deps chromium</code> bzw. <code>sudo apt install -y xvfb</code></td> </tr> <tr> <td>Nur wenige/keine Matches</td> <td>Falsche Segment-ID</td> <td>Segment-ID prüfen (Abschnitt 1), evtl. wurde das Turnier noch nicht gespielt</td> </tr> <tr> <td><code>data</code>-Array im live-JSON ist leer</td> <td>Match noch nicht gespielt/abgeschlossen</td> <td>Match hat Score in Brackets, aber keine Replay-Daten → überspringen</td> </tr> <tr> <td>Rate-Limit / Block nach vielen Requests</td> <td>Zu schnell</td> <td><code>time.sleep</code> zwischen den Matches erhöhen (z. B. 0,3 s)</td> </tr> </tbody></table><h3>Wichtiger Hinweis zur Cloudflare-<code>cf_clearance</code></h3><p>Die Challenge löst ein <strong>Browser-Fingerprint</strong> (User-Agent, TLS, Canvas, etc.). Deshalb funktioniert <strong>kein</strong> direkter Python-<code>requests</code>-Ansatz — selbst mit den entschllüsselten Cookies schlägt Cloudflare wegen des falschen TLS-Fingerprints fehl. <strong>Playwright mit <code>headless=False</code> ist die einzige zuverlässige Methode.</strong> Falls es trotzdem klemmt, hilft <code>playwright-stealth</code>:</p><pre><code class="language-bash">pip install playwright-stealth
</code></pre><p>und im Code:</p><pre><code class="language-python">from playwright_stealth import stealth_sync
page = context.new_page()
stealth_sync(page)
</code></pre><hr><h2>8. Für andere Turniere / Regionen / Monate anpassen</h2><p>Die URL-Parameter sind:</p><ul> <li><code>m</code> = Monat, z. B. <code>jul26</code>, <code>aug26</code></li> <li><code>r</code> = Region, z. B. <code>emea</code>, <code>na</code>, <code>sa</code>, <code>apac</code></li> <li><code>s</code> = Stage/Day, z. B. <code>qday1</code>, <code>qday2</code>, <code>champ</code>, <code>lcq</code></li> </ul><p><strong>Schritte für ein neues Turnier:</strong></p><ol> <li>URL zusammenbauen: <code>https://corestats.pro/brackets?m={m}&amp;r={r}&amp;s={s}</code></li> <li>Im Browser (oder per <code>page.evaluate</code>) die Segment-ID aus den Performance-Entries lesen oder aus dem ersten Match-Objekt (<code>segment_id</code>).</li> <li>In <code>SEGMENTS</code>-Dict im Skript eintragen.</li> <li>Skript laufen lassen.</li> </ol><hr class="e-rte-hr-focus"><h2>9. Schnellstart — Alles in einem Befehl</h2><pre><code class="language-bash"># Voraussetzung: pip, xvfb vorhanden
pip install playwright &amp;&amp; playwright install chromium
xvfb-run --auto-servernum python3 corestats_draft.py
</code></pre><p>Das war's. Danach liegen die fertigen Draft-Daten in <code>data/drafts_all.json</code> bereit.</p>