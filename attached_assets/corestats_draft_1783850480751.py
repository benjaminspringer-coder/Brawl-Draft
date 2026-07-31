#!/usr/bin/env python3
"""
CoreStats Draft Extractor — Standalone für Replit
==================================================
Extrahiert Picks, Bans und Maps der CoreStats-Turniere (Brawl Stars).

Nutzung:
    pip install playwright
    playwright install chromium
    sudo apt-get install -y xvfb           # oder via replit.nix: pkgs.xorg.xvfb
    xvfb-run --auto-servernum python3 corestats_draft.py

Output: data/drafts_day1.json, data/drafts_day2.json, data/drafts_all.json
"""
import json
import os
import time
from playwright.sync_api import sync_playwright

BASE = "https://corestats.pro"

# Segment-IDs der EMEA-Turniere (JUL 2026).
# Diese UUIDs identifizieren den jeweiligen Turnier-Baum.
SEGMENTS = {
    "day1": "19264db4-70c9-11f1-a49f-cade9bdb68ea",   # EMEA Qualifier Day 1 (s=qday1)
    "day2": "192a3398-70c9-11f1-a63e-cade9bdb68ea",   # EMEA Qualifier Day 2 (s=qday2)
}


def _team_picks(gt, idx):
    """Extrahiert Picks + Builds eines Teams aus einem Game-Objekt."""
    if len(gt) <= idx:
        return {"is_winner": None, "picks": []}
    return {
        "is_winner": gt[idx].get("isWinner"),
        "picks": [
            {
                "brawler": p["brawler"]["name"],
                "player": p.get("name") or p.get("tag"),
                "gadget": p["brawler"].get("gadget", {}).get("name"),
                "star_power": p["brawler"].get("starPower", {}).get("name"),
                "hypercharge": p["brawler"].get("hyperCharge", {}).get("name"),
                "gears": [gg.get("name") for gg in p["brawler"].get("gears", [])],
            }
            for p in gt[idx].get("players", [])
            if p.get("brawler")
        ],
    }


def get_played_matches(page, segment_id):
    """Holt alle gespielten Matches (ohne Bye) eines Segments über die interne API."""
    raw = page.evaluate(f"""async () => {{
        const r = await fetch('/api/brackets/data?url={segment_id}');
        return await r.text();
    }}""")
    data = json.loads(raw)["data"]
    played = [
        m for m in data["match"]
        if not m["opponent1"]["is_bye"]
        and not m["opponent2"]["is_bye"]
        and (m["opponent1"]["score"] is not None or m["opponent2"]["score"] is not None)
    ]
    return played


def get_match_draft(page, match):
    """Holt Picks/Bans/Maps fuer ein einzelnes Match via /api/match/live/{id}."""
    mid = match["id"]
    raw = page.evaluate(f"""async () => {{
        const r = await fetch('/api/match/live/{mid}');
        return await r.text();
    }}""")
    try:
        live = json.loads(raw)
    except Exception:
        return None  # kein gueltiges JSON -> Match ueberspringen

    # Die API kann entweder {"data":[...]} oder direkt [...] (Fehler/Rate-Limit)
    # zurueckgeben. Beides robust behandeln:
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
        "team1": {
            "name": o1["name"],
            "code": o1.get("team_code"),
            "score": o1.get("score"),
            "result": o1.get("result"),
            "seed": o1.get("seed"),
            "players": [{"name": p["name"], "tag": p.get("tag")} for p in o1.get("players", [])],
        },
        "team2": {
            "name": o2["name"],
            "code": o2.get("team_code"),
            "score": o2.get("score"),
            "result": o2.get("result"),
            "seed": o2.get("seed"),
            "players": [{"name": p["name"], "tag": p.get("tag")} for p in o2.get("players", [])],
        },
        "winner": "team1" if o1.get("result") == "win" else "team2" if o2.get("result") == "win" else None,
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
            "team1_bans": [b["name"] for b in teams[0].get("bans", [])] if len(teams) > 0 else [],
            "team2_bans": [b["name"] for b in teams[1].get("bans", [])] if len(teams) > 1 else [],
            "maps": [],
        }
        for g in games:
            loc = g.get("location", {})
            gt = g.get("teams", [])
            s["maps"].append(
                {
                    "mode": loc.get("gameMode"),
                    "map": loc.get("name"),
                    "map_id": loc.get("id"),
                    "duration": g.get("duration"),
                    "team1": _team_picks(gt, 0),
                    "team2": _team_picks(gt, 1),
                }
            )
        draft["sets"].append(s)
    return draft


def extract_all(day_filter=None, out_dir="data", sleep_seconds=0.12):
    """Hauptfunktion: extrahiert Drafts für alle (oder einen) Tag(e) und speichert JSON."""
    os.makedirs(out_dir, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,  # MUSS False sein, sonst blockiert Cloudflare!
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1366, "height": 768},
        )
        page = context.new_page()

        # Seite laden & Cloudflare-Challenge abwarten
        print("Lade CoreStats & warte auf Cloudflare-Challenge...")
        page.goto(
            f"{BASE}/brackets?m=jul26&r=emea&s=qday1",
            wait_until="networkidle",
            timeout=60000,
        )
        page.wait_for_selector("article.match", timeout=45000)
        print("  -> Cloudflare geloest, Seite bereit.")

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
                time.sleep(sleep_seconds)
            path = os.path.join(out_dir, f"drafts_{day}.json")
            json.dump(
                {"day": day, "match_count": len(drafts), "drafts": drafts},
                open(path, "w"),
                ensure_ascii=False,
                indent=1,
            )
            print(f"  -> gespeichert: {path}")
            all_drafts += drafts

        combined = os.path.join(out_dir, "drafts_all.json")
        json.dump(
            {"total_matches": len(all_drafts), "drafts": all_drafts},
            open(combined, "w"),
            ensure_ascii=False,
            indent=1,
        )
        print(f"\nFERTIG: {len(all_drafts)} Drafts -> {combined}")
        browser.close()
        return all_drafts


if __name__ == "__main__":
    extract_all()
