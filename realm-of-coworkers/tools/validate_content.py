"""Prüft packages/content gegen Abschnitt 4, 13.2 und 15.5 der Spezifikation.
Aufruf: python3 tools/validate_content.py  (Exit-Code 1 bei Fehlern). Wächst mit jeder Phase."""
import json, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1] / "packages" / "content"
ERR = []
def err(m): ERR.append(m)

CLASS_IDS = ["krieger", "magier", "waldlaeufer", "schurke", "kleriker", "runenweber"]
STATUS_IDS = set("""verbrennung frost eingefroren schock ruestungsbruch blendung verderbnis gift blutung betaeubung
wurzel furcht runenbruch verspottet angriffstempo_malus bewegung_malus schild regeneration raserei kraftrune
schutzrune runensturm adlerauge tarnung bollwerk spott_schutz unverwundbar""".split())
HANDLER_IDS = set("""taunt pierce trap barrage conditionalBonus teleportBehind channelSpin groundDelayed cleanse revive
overhealShield cooldownResetOnSwap buffedDamageReduction rollCooldown modifyValue
enemy_priest_heal enemy_bomber enemy_guardian_shield enemy_cultist_orb elite_slam
affix_schild affix_rasend affix_blutsauger affix_regenerierend
hazard_feuersaeule hazard_eisbrocken hazard_blitz hazard_wurzel hazard_lichtstrahl hazard_schattenzone
boss_glutmantel boss_eispanzer boss_statische_ladung boss_steinhaut boss_sonnenschild boss_schattenhuelle
sig_glutregen sig_frostnova sig_kettenblitz sig_beben sig_strahlenbuendel sig_stille""".split())
STATS = {"leb", "kra", "rue", "res", "tmp", "krt", "ksd", "ele", "dmgDealt", "dmgTaken", "rangePx", "moveSpeed"}
TO = {"target", "self", "allies", "lowestAllies", "enemiesAroundSelf", "enemiesAroundTarget"}
TARGETS = {"nearest", "focus", "lowestAlly", "self", "ground", "none"}
SLOTS = ["auto", "s1", "s2", "s3", "ult", "passive"]
UNLOCK = {"auto": 1, "s1": 1, "s2": 2, "s3": 3, "ult": 5, "passive": 1}          # 4.3
K_SPEC = {"krieger": 1.11, "magier": 1.64, "waldlaeufer": 1.63, "schurke": 1.62, "kleriker": 0.65, "runenweber": 0.78}  # 13.2
COOLDOWNS = {  # Abschnitt 4, in Slot-Reihenfolge auto, s1, s2, s3, ult
    "krieger": [1, 10, 8, 12, 60], "magier": [1, 6, 9, 15, 60], "waldlaeufer": [1, 6, 12, 12, 60],
    "schurke": [1, 8, 10, 9, 55], "kleriker": [1, 6, 14, 16, 90], "runenweber": [1, 16, 20, 18, 75]}
EFFECT_KEYS = {"damage": {"coef", "splashPct"}, "heal": {"coef", "pctMaxHp"}, "shield": {"pctMaxHpOf", "pct", "ms"},
    "status": {"id", "ms", "stacks", "chance", "value", "bossReplace"}, "buff": {"stat", "mult", "add", "ms", "display"},
    "handler": {"id", "params"}}
COMMON = {"k", "to", "count", "radiusPx"}
RULES = {"enemyInRange": set(), "inCombat": set(), "bossPresent": set(), "allyHasDebuff": set(), "allyDead": set(),
         "enemiesNear": {"count", "radiusPx"}, "allyBelowPct": {"pct"}, "alliesBelowPct": {"pct", "count"},
         "selfBelowPct": {"pct"}, "any": {"rules"}}

def check_rule(r, where):
    w = r.get("when")
    if w not in RULES: return err(f"{where}: unbekannte Auto-Cast-Regel {w}")
    if set(r) - {"when"} != RULES[w]: err(f"{where}: Regel {w} hat Felder {sorted(set(r) - {'when'})}")
    if w == "any":
        for x in r["rules"]: check_rule(x, where)

def check_effect(e, where):
    k = e.get("k")
    if k not in EFFECT_KEYS: return err(f"{where}: unbekannter Effekt {k}")
    extra = set(e) - COMMON - EFFECT_KEYS[k]
    if extra: err(f"{where}: unerlaubte Felder {sorted(extra)}")
    if e.get("to", "target") not in TO: err(f"{where}: to={e.get('to')}")
    if k == "status":
        if e["id"] not in STATUS_IDS: err(f"{where}: Status {e['id']} unbekannt")
        if "bossReplace" in e: check_effect(e["bossReplace"], where + " (bossReplace)")
    if k == "buff":
        if e["stat"] not in STATS: err(f"{where}: Wert {e['stat']} unbekannt")
        if ("mult" in e) == ("add" in e): err(f"{where}: buff braucht genau eines von mult/add")
        if "display" in e and e["display"] not in STATUS_IDS: err(f"{where}: display {e['display']} unbekannt")
    if k == "handler" and e["id"] not in HANDLER_IDS: err(f"{where}: Handler {e['id']} unbekannt")

def k_value(skill_list):
    """Summe Koeffizient / Abklingzeit wie in 13.2 (ohne situative Boni)."""
    total, mult = 0.0, 1.0
    for s in skill_list:
        cd = s["cooldownS"]
        for e in s["effects"]:
            if e["k"] == "damage": total += e["coef"] / cd
            elif e["k"] == "handler":
                p = e["params"]
                if e["id"] in ("pierce", "trap", "groundDelayed", "conditionalBonus", "teleportBehind"): total += p["coef"] / cd
                elif e["id"] == "barrage": total += p["arrows"] * p["coef"] / cd
                elif e["id"] == "channelSpin": total += p["hits"] * p["coef"] / cd
            elif e["k"] == "status" and e["id"] == "gift": total += e["value"] * e["ms"] / 1000 / cd
            elif e["k"] == "buff" and e["stat"] == "dmgDealt" and e.get("to", "self") == "self":
                mult *= 1 + (e["mult"] - 1) * e["ms"] / 1000 / cd
    return total * mult

# ---------- Phase 2: Statuseffekte und Elemente (6.1, 6.3, 6.4) ----------
CLEANSE_ORDER = ["betaeubung", "eingefroren", "wurzel", "furcht", "verderbnis", "ruestungsbruch", "blendung",
                 "frost", "schock", "gift", "blutung", "verbrennung"]          # 6.4, eingefroren nach E-008
WEAKENING = {"frost", "schock", "ruestungsbruch", "blendung", "verderbnis", "runenbruch"}   # 6.3
BOSS_IMMUNE = {"betaeubung", "wurzel", "furcht", "eingefroren"}                          # 6.4
HALF_ON_ELITE = {"betaeubung", "wurzel", "eingefroren"}                                   # 6.4, E-008
VALUE_PARAM = {"gift": "heroCoefPerS", "blutung": "heroCoefPerS", "verbrennung": "heroCoefPerS",
               "regeneration": "heroCoefPerS", "angriffstempo_malus": "attackSpeedMalusPct",
               "bewegung_malus": "moveSpeedMalusPct", "runenbruch": "dmgTakenPct"}         # E-009
SPEC_STATUS = {  # Dauer ms, Stapel, Kernwert laut 6.3
    "verbrennung": (5000, 3, "heroCoefPerS", 0.25), "frost": (5000, 3, "moveSpeedMalusPct", 30),
    "schock": (6000, 1, "cooldownSlowPct", 25), "ruestungsbruch": (6000, 3, "armorResMalusPctPerStack", 15),
    "blendung": (5000, 1, "dmgDealtMalusPct", 20), "verderbnis": (6000, 3, "dmgTakenPctPerStack", 10),
    "gift": (6000, 3, "heroCoefPerS", 0.35), "blutung": (5000, 3, "heroCoefPerS", 0.30),
    "betaeubung": (1500, 1, None, None), "wurzel": (2000, 1, None, None), "furcht": (2000, 1, None, None)}
ELEMENT_COLORS = {"feuer": "#E8552B", "eis": "#6EC6F0", "blitz": "#F2D030", "erde": "#8B5E34",
                  "licht": "#F7E39B", "schatten": "#7B4FBF"}                           # 14.8

def check_phase2(skills):
    status = json.load(open(ROOT / "status.json", encoding="utf-8"))
    ids = [x["id"] for x in status]
    if sorted(ids) != sorted(STATUS_IDS) or len(ids) != len(set(ids)): err("status.json: IDs weichen von 15.5 ab")
    by = {x["id"]: x for x in status}
    order = sorted((x for x in status if "cleanseOrder" in x), key=lambda x: x["cleanseOrder"])
    if [x["id"] for x in order] != CLEANSE_ORDER: err(f"status.json: Reinigungsreihenfolge {[x['id'] for x in order]}")
    if [x["cleanseOrder"] for x in order] != list(range(1, len(order) + 1)): err("status.json: cleanseOrder nicht fortlaufend")
    for x in status:
        i = x["id"]
        if x["kind"] not in ("buff", "debuff"): err(f"{i}: kind")
        if x["weakening"] != (i in WEAKENING): err(f"{i}: weakening falsch (6.3)")
        if x["bossImmune"] != (i in BOSS_IMMUNE): err(f"{i}: bossImmune falsch (6.4)")
        if x["eliteDurationMult"] != (0.5 if i in HALF_ON_ELITE else 1.0): err(f"{i}: eliteDurationMult falsch (6.4)")
        if not all(isinstance(v, (int, float)) for v in x["params"].values()): err(f"{i}: params nur Zahlen")
        if x["kind"] == "buff" and "cleanseOrder" in x: err(f"{i}: Buffs werden nicht gereinigt")
    for i, (ms, stacks, key, val) in SPEC_STATUS.items():
        x = by.get(i)
        if not x: continue
        if x["defaultMs"] != ms or x["maxStacks"] != stacks: err(f"{i}: Dauer oder Stapel weichen von 6.3 ab")
        if key and x["params"].get(key) != val: err(f"{i}: {key} = {x['params'].get(key)} statt {val}")
    for s in skills:                                   # value einer Fähigkeit muss einen Parameter überschreiben
        for e in s["effects"] + [e["bossReplace"] for e in s["effects"] if "bossReplace" in e]:
            if e["k"] == "status" and "value" in e:
                key = VALUE_PARAM.get(e["id"])
                if not key or key not in by[e["id"]]["params"]: err(f"{s['id']}: value ohne Parameter bei {e['id']}")
    elements = json.load(open(ROOT / "elements.json", encoding="utf-8"))
    el = {x["id"]: x for x in elements}
    if list(el) != ["physisch", "feuer", "eis", "blitz", "erde", "licht", "schatten"]: err("elements.json: IDs")
    for i, x in el.items():
        w = x["weakTo"]
        if i == "physisch":
            if w is not None: err("physisch darf keine Schwäche haben")
            continue
        if w not in el or el[w]["weakTo"] != i: err(f"{i}: Gegenelement nicht paarweise (6.1)")
        if x["color"] != ELEMENT_COLORS[i]: err(f"{i}: Farbe weicht von 14.8 ab")
    print(f"  Phase 2: {len(status)} Statuseffekte, {len(elements)} Elemente")

# ---------- Phase 3: Gegner, Elite, Arenen, Paletten, Stages (9, 10.2) ----------
ENEMY_SPEC = {  # 9.3: Leben, Schaden, Rüstung, Resistenz, Tempo, Reichweite, Intervall, Element, Gewicht
    "scherge":     (1.0, 1.0, .20, .10, 100,  60, 1.0, "physisch", 1.0),
    "hetzer":      (0.6, 0.9, .05, .05, 160,  60, 0.8, "physisch", 0.6),
    "schuetze":    (0.7, 1.1, .10, .20, 100, 420, 1.2, "physisch", 0.7),
    "schwarmling": (0.3, 0.5, .00, .00, 130,  50, 1.0, "kapitel",  0.3),
    "brecher":     (2.2, 1.2, .45, .15,  80,  70, 1.5, "physisch", 2.2),
    "priester":    (0.8, 0.4, .05, .30,  90, 380, 1.5, "kapitel",  0.8),
    "kultist":     (0.8, 1.2, .05, .45,  90, 380, 1.5, "kapitel",  0.8),
    "bomber":      (0.6, 0.3, .00, .00, 150,  40, 1.0, "kapitel",  0.6),
    "waechter":    (2.5, 1.3, .25, .35,  90,  80, 1.5, "kapitel",  2.5)}
AI = {"scherge": "melee", "hetzer": "melee", "schuetze": "ranged", "schwarmling": "melee", "brecher": "melee",
      "priester": "support", "kultist": "ranged", "bomber": "bomber", "waechter": "guardian"}
NEW_IN_CHAPTER = {1: ["scherge", "hetzer", "schuetze", "schwarmling"], 2: ["brecher", "priester"],
                  3: ["kultist"], 4: ["bomber"], 5: ["waechter"], 6: []}                      # 9.9
HAZARD_BY_CHAPTER = {1: "hazard_feuersaeule", 2: "hazard_eisbrocken", 3: "hazard_blitz",
                     4: "hazard_wurzel", 5: "hazard_lichtstrahl", 6: "hazard_schattenzone"}   # 9.8
BOSS_BY_CHAPTER = {1: "ignarch", 2: "glaciara", 3: "voltrax", 4: "gorthul", 5: "solaris", 6: "nyxhara"}
ENC_X = [1800, 3600, 5400, 7200, 9000, 10800]; ENC_PTS = [8, 10, 10, 12, 12, 14]              # 9.1, 9.5
ELITE_PLAN = {3: {6: 1}, 4: {4: 1, 6: 1}}                                                     # 9.7

def check_phase3():
    data = json.load(open(ROOT / "enemies.json", encoding="utf-8"))
    enemies, elite = data["enemies"], data["elite"]
    by = {e["id"]: e for e in enemies}
    if sorted(by) != sorted(ENEMY_SPEC): err("enemies.json: IDs weichen von 9.3 ab")
    for i, e in by.items():
        got = (e["hpMult"], e["dmgMult"], e["armorMit"], e["resMit"], e["speed"], e["rangePx"],
               e["intervalS"], e["element"], e["weight"])
        if got != ENEMY_SPEC[i]: err(f"{i}: Werte weichen von 9.3 ab: {got}")
        if e["ai"] != AI[i]: err(f"{i}: ai {e['ai']}")
        if (e["groupSize"] != 4) != (i != "schwarmling"): err(f"{i}: groupSize {e['groupSize']} (9.3)")
        for h in e["handlers"]:
            if h["id"] not in HANDLER_IDS: err(f"{i}: Handler {h['id']} unbekannt")
            if not all(isinstance(v, (int, float)) for v in h["params"].values()): err(f"{i}: Handler-Parameter nur Zahlen")
    if (elite["hpMult"], elite["dmgMult"], elite["armorMit"], elite["resMit"], elite["weight"]) != (4.0, 1.5, .30, .30, 6.0):
        err("elite: Werte weichen von 9.3 ab")
    if elite["replacesPoints"] != 4 or elite["itemChance"] != 0.25: err("elite: Punkte oder Beutechance (9.7)")
    if sorted(elite["affixes"]) != sorted(["affix_schild", "affix_rasend", "affix_blutsauger", "affix_regenerierend"]):
        err("elite: Affixe weichen von 9.7 ab")
    if sorted(elite["affixParams"]) != sorted(elite["affixes"]): err("elite: affixParams unvollständig")
    if any(b not in by for b in elite["bases"]): err("elite: unbekannter Basistyp")
    if elite["slam"] != {"everyS": 12, "telegraphMs": 1500, "radiusPx": 120, "pctRefHp": 15}: err("elite: Großangriff (9.7)")

    palette = json.load(open(ROOT / "levels" / "palette.json", encoding="utf-8"))
    if sorted(palette) != [str(c) for c in range(1, 7)]: err("palette.json: Kapitel 1 bis 6 erwartet")
    seen = set()
    for c in range(1, 7):
        p = palette[str(c)]
        if sum(p.values()) != 100: err(f"palette {c}: Summe {sum(p.values())} statt 100")
        if any(t not in by for t in p): err(f"palette {c}: unbekannter Gegnertyp")
        seen |= set(p)
        for t in NEW_IN_CHAPTER[c]:
            if t not in p: err(f"palette {c}: {t} fehlt (neu laut 9.9)")
        early = {t for ch in range(c + 1, 7) for t in NEW_IN_CHAPTER[ch]}
        if set(p) & early: err(f"palette {c}: Typ zu früh: {sorted(set(p) & early)}")
    if seen != set(by): err(f"palette: nie verwendete Typen {sorted(set(by) - seen)}")

    arenas = json.load(open(ROOT / "arenas.json", encoding="utf-8"))
    if len(arenas) != 6: err("arenas.json: 6 Arenen erwartet")
    for a in arenas:
        if (a["widthPx"], a["depthPx"], a["bossStartX"], a["heroStartX"]) != (1600, 240, 1100, [200, 700]):
            err(f"{a['id']}: Maße weichen von 10.2 ab")

    arena_ids = {a["id"] for a in arenas}
    for s in range(1, 31):
        d = json.load(open(ROOT / "levels" / f"stage-{s:02d}.json", encoding="utf-8"))
        c, k = (s - 1) // 5 + 1, (s - 1) % 5 + 1
        w = f"stage-{s:02d}"
        if (d["stage"], d["chapter"], d["recommendedLevel"]) != (s, c, s): err(f"{w}: Nummer, Kapitel oder Empfehlung (8.2)")
        if d["introId"] != w: err(f"{w}: introId")
        enc = d["encounters"]
        if k == 5:
            if d["lengthPx"] != 4500 or d["checkpoints"] != [2700, 4500]: err(f"{w}: Boss-Stage Länge oder Checkpoints (9.9)")
            if [e["points"] for e in enc] != [8, 10] or [e["x"] for e in enc] != [1800, 3600]: err(f"{w}: Boss-Stage Begegnungen (9.9)")
            if d.get("boss") != BOSS_BY_CHAPTER[c] or d["loot"] != "boss": err(f"{w}: Boss oder Beutetabelle")
            if d["hazard"] is not None: err(f"{w}: Boss-Stage ohne Gefahr (9.8)")
            if any(e["elites"] for e in enc): err(f"{w}: Boss-Stage ohne Elite (9.7)")
        else:
            if d["lengthPx"] != 12000 or d["checkpoints"] != [4500, 8100]: err(f"{w}: Länge oder Checkpoints (9.1)")
            if [e["x"] for e in enc] != ENC_X or [e["points"] for e in enc] != ENC_PTS: err(f"{w}: Begegnungen (9.1, 9.5)")
            if sum(e["points"] for e in enc) != 66: err(f"{w}: Summe der Punkte statt 66")
            if d["hazard"] != HAZARD_BY_CHAPTER[c] or d.get("boss") or d["loot"] != "normal": err(f"{w}: Gefahr, Boss oder Beute")
            if [i + 1 for i, e in enumerate(enc) if e["hazard"]] != [3, 5]: err(f"{w}: Gefahr-Begegnungen (9.8)")
            plan = ELITE_PLAN.get(k, {})
            if {i + 1: e["elites"] for i, e in enumerate(enc) if e["elites"]} != plan: err(f"{w}: Elite-Verteilung (9.7)")
        for i, e in enumerate(enc):
            n = len(e["groupSplit"])
            if n != (2 if (k == 5 or i < 2) else 3): err(f"{w}: Begegnung {i+1} hat {n} Gruppen (9.5)")
            if abs(sum(e["groupSplit"]) - 1) > 1e-9: err(f"{w}: Begegnung {i+1} Aufteilung ergibt nicht 1")
            if e["groupDelaysS"] != [0, 8, 16][:n]: err(f"{w}: Begegnung {i+1} Verzögerungen (9.5)")
    if f"arena_{'aschenwaelder'}" not in arena_ids: err("arenas.json: Namensschema")
    print(f"  Phase 3: {len(enemies)} Gegnertypen, {len(arenas)} Arenen, 30 Stages")

# ---------- Phase 4: Bosse (10) ----------
BOSS_SPEC = {  # 10.3, 10.6, 10.9: Kapitel, Leben, Element, Rüstung, Resistenz, Timer, Passiv, Debuff, Waffenstatus
    "ignarch":  (1, 11400, "feuer",    .30, .20,  15, "boss_glutmantel",        "verbrennung",    "verbrennung"),
    "glaciara": (2, 18600, "eis",      .35, .20,  25, "boss_eispanzer",         "frost",          "frost"),
    "voltrax":  (3, 26300, "blitz",    .20, .30,  40, "boss_statische_ladung",  "schock",         "schock"),
    "gorthul":  (4, 34300, "erde",     .45, .15,  60, "boss_steinhaut",         "wurzel",         "ruestungsbruch"),
    "solaris":  (5, 42700, "licht",    .25, .25,  90, "boss_sonnenschild",      "blendung",       "blendung"),
    "nyxhara":  (6, 51600, "schatten", .25, .25, 120, "boss_schattenhuelle",    "verderbnis",     "verderbnis")}
SIG = {"ignarch": ("sig_glutregen", 20), "glaciara": ("sig_frostnova", 20), "voltrax": ("sig_kettenblitz", 15),
       "gorthul": ("sig_beben", 25), "solaris": ("sig_strahlenbuendel", 20), "nyxhara": ("sig_stille", 15)}   # 10.6
ATTACK_SPEC = {  # 10.4: Intervall ms, Anteil RefLeben, Schadensart
    "standard": (2500, 11, "phys"), "pulse": (12000, 8, "elem"),
    "telegraph": (20000, 30, "elem"), "signature": (30000, None, "elem")}
DPS_MEAN_K = {1: 76.0, 2: 124.0, 3: 175.0, 4: 229.0, 5: 285.0, 6: 344.3}   # Mittelwert Magier/Waldläufer/Schurke, 13.3

def check_phase4(elements):
    opp = {e["id"]: e["weakTo"] for e in elements}
    bosses = json.load(open(ROOT / "bosses.json", encoding="utf-8"))
    arenas = {a["id"] for a in json.load(open(ROOT / "arenas.json", encoding="utf-8"))}
    if [b["id"] for b in bosses] != list(BOSS_SPEC): err("bosses.json: IDs oder Reihenfolge")
    for b in bosses:
        i = b["id"]; ch, hp, el, arm, res, timer, passive, debuff, wst = BOSS_SPEC[i]
        got = (b["chapter"], b["hpBase"], b["element"], b["armorMit"], b["resMit"], b["timerMinutes"])
        if got != (ch, hp, el, arm, res, timer): err(f"{i}: Grundwerte weichen von 10.3/10.6/10.9 ab: {got}")
        if b["passive"]["id"] != passive: err(f"{i}: Passiv {b['passive']['id']} (10.6)")
        if b["debuff"] != debuff: err(f"{i}: Debuff (10.6)")
        if b["debuff"] not in STATUS_IDS or b["weapon"]["status"] not in STATUS_IDS: err(f"{i}: unbekannter Status")
        if (b["weapon"]["status"], b["weapon"]["chance"]) != (wst, 0.05): err(f"{i}: Bosswaffe (8.5)")
        ph = b["phases"]
        if [p["fromPct"] for p in ph] != [100, 66, 33] or [p["toPct"] for p in ph] != [66, 33, 0]:
            err(f"{i}: Phasenschwellen (10.5)")
        if [p["element"] for p in ph] != [el, opp[el], el]: err(f"{i}: Phasen-Elemente (10.5)")
        for name, (iv, pct, dt) in ATTACK_SPEC.items():
            a = b["attacks"][name]
            if a["intervalMs"] != iv or a["dmgType"] != dt: err(f"{i}.{name}: Intervall oder Schadensart (10.4)")
            if pct and a["pctRefHp"] != pct: err(f"{i}.{name}: Anteil RefLeben {a['pctRefHp']} statt {pct}")
        sg = b["attacks"]["signature"]
        if (sg["handler"], sg["pctRefHp"]) != SIG[i]: err(f"{i}: Signaturangriff weicht von 10.6 ab")
        if sg.get("fromPhase") != 2: err(f"{i}: Signaturangriff erst ab Phase 2 (10.4)")
        if sg["handler"] not in HANDLER_IDS or b["passive"]["id"] not in HANDLER_IDS: err(f"{i}: Handler unbekannt")
        for a in (b["attacks"]["telegraph"], sg):
            if a.get("telegraphMs") != 1500: err(f"{i}: Anzeigedauer 1500 ms erwartet (6.7)")
        if b["adds"] != {"enemy": "schwarmling", "firstAtS": 15, "everyS": 30, "groupsPerWave": 1}:
            err(f"{i}: Adds weichen von 10.4 ab")
        if b["arena"] not in arenas: err(f"{i}: Arena {b['arena']} fehlt")
        if b["dialog"] != {"before": f"{i}_before", "after": f"{i}_after"}: err(f"{i}: Dialog-Schlüssel")
        ist = round(150 * DPS_MEAN_K[ch], -2)     # 10.3: 150 s mal mittlerer Schadensklassen-DPS
        if abs(b["hpBase"] - ist) > 100: err(f"{i}: Boss-Leben {b['hpBase']} statt {ist:.0f} (10.3, 13.4)")
    for c in range(1, 7):                          # Querverweis zu den Boss-Stages
        st = json.load(open(ROOT / "levels" / f"stage-{5*c:02d}.json", encoding="utf-8"))
        b = next(x for x in bosses if x["chapter"] == c)
        if st["boss"] != b["id"]: err(f"stage-{5*c:02d}: verweist nicht auf {b['id']}")
    print(f"  Phase 4: {len(bosses)} Bosse")

# ---------- Phase 5: Ausrüstung, Beute, Gems, Artefakte (7, 8, 10.8, 12.8) ----------
RARITIES = ["gewoehnlich", "ungewoehnlich", "selten", "episch", "legendaer"]
SLOT_IDS = ["waffe", "ruestung", "nebenhand", "helm", "handschuhe", "umhang", "stiefel"]
STAGE_RARITY = {  # 12.8
    "1": {"gewoehnlich": 60, "ungewoehnlich": 30, "selten": 10},
    "2": {"gewoehnlich": 40, "ungewoehnlich": 35, "selten": 20, "episch": 5},
    "3": {"gewoehnlich": 25, "ungewoehnlich": 35, "selten": 30, "episch": 10},
    "4": {"gewoehnlich": 15, "ungewoehnlich": 30, "selten": 35, "episch": 20},
    "5": {"gewoehnlich": 10, "ungewoehnlich": 25, "selten": 40, "episch": 25},
    "6": {"gewoehnlich": 5, "ungewoehnlich": 20, "selten": 40, "episch": 35}}
GEM_STATS = {"granat": "leb", "rubin": "kra", "onyx": "rue", "aquamarin": "res",
             "topas": "tmp", "saphir": "krt", "smaragd": "ksd"}                       # 7.2
GEM_POINTS = [5, 9, 14, 19, 25]                                                        # 7.2
GEM_TIERS = {  # 7.5, Wahrscheinlichkeiten Stufe I bis V
    "1": [80, 20, 0, 0, 0], "2": [40, 50, 10, 0, 0], "3": [0, 45, 45, 10, 0],
    "4": [0, 25, 55, 20, 0], "5": [0, 0, 50, 40, 10], "6": [0, 0, 30, 50, 20]}
ART_POINTS, ART_COST = [12, 18, 24, 30, 36], [0, 6, 8, 12, 16]                         # 7.6
ART_UNLOCK = {"amulett": "ignarch", "ring": "voltrax", "relikt": "solaris"}            # 7.6
BALANCE_PATHS = {"balance.combat.potion.pct", "balance.combat.roll.px", "balance.combat.roll.cooldownS",
                 "balance.combat.revive.channelS", "balance.combat.potion.cooldownS"}   # Pfade, die Artefakte ändern dürfen

def resolve_path(path, by_skill, status_by, where):
    if path == "self.buffDurationMs": return                       # E-015: alle eigenen Buffs
    if path.startswith("balance."):
        if path not in BALANCE_PATHS: err(f"{where}: Pfad {path} nicht erlaubt")
        return
    kind, _, rest = path.partition(":")
    target, _, field = rest.partition(".")
    if kind == "skill":
        sk = by_skill.get(target)
        if not sk: return err(f"{where}: Fähigkeit {target} unbekannt")
        if field == "cooldownS": return
        parts = field.split(".")
        if parts[0] != "effects" or len(parts) != 3: return err(f"{where}: Feld {field} unbekannt")
        idx = int(parts[1])
        if idx >= len(sk["effects"]): return err(f"{where}: {target} hat keinen Effekt {idx}")
        if parts[2] not in sk["effects"][idx]: err(f"{where}: Effekt {idx} von {target} hat kein Feld {parts[2]}")
    elif kind == "handler":
        sk = by_skill.get(target)
        if not sk: return err(f"{where}: Fähigkeit {target} unbekannt")
        hs = [e for e in sk["effects"] if e["k"] == "handler"]
        if not hs: return err(f"{where}: {target} hat keinen Handler")
        if not any(field in h["params"] for h in hs): err(f"{where}: Handler von {target} hat keinen Parameter {field}")
    elif kind == "status":
        st = status_by.get(target)
        if not st: return err(f"{where}: Status {target} unbekannt")
        if field not in st and field not in st["params"]: err(f"{where}: Status {target} hat kein Feld {field}")
    else:
        err(f"{where}: unbekannte Pfadart {path}")

def check_phase5(skills):
    by_skill = {s["id"]: s for s in skills}
    status_by = {x["id"]: x for x in json.load(open(ROOT / "status.json", encoding="utf-8"))}
    names = json.load(open(ROOT / "items" / "names.json", encoding="utf-8"))
    if sorted(names["prefixes"]) != sorted(RARITIES): err("names.json: Präfixe je Seltenheit fehlen")
    if any(not v for v in names["prefixes"].values()) or not names["suffixes"]: err("names.json: leere Listen")
    if sorted(names["types"]) != sorted(CLASS_IDS): err("names.json: types unvollständig")
    for c, t in names["types"].items():
        if sorted(t) != sorted(SLOT_IDS): err(f"names.json: {c} hat nicht alle Slots")
    if sorted(names["bossGenitive"]) != sorted(BOSS_SPEC): err("names.json: bossGenitive unvollständig (8.5)")

    sl = json.load(open(ROOT / "loot" / "stage-loot.json", encoding="utf-8"))
    if (sl["itemsPerChest"], sl["eliteItemChance"], sl["gemChance"], sl["splinters"]) != (2, 0.25, 0.5, 2):
        err("stage-loot.json: Truheninhalt weicht von 12.8 ab")
    if sl["slotWeights"] != {"waffe": 16, "ruestung": 14, "nebenhand": 14, "helm": 14,
                             "handschuhe": 14, "umhang": 14, "stiefel": 14}: err("stage-loot.json: Slot-Anteile (12.8)")
    if sum(sl["slotWeights"].values()) != 100: err("stage-loot.json: Slot-Anteile ergeben nicht 100")
    if sl["rarityByChapter"] != STAGE_RARITY: err("stage-loot.json: Seltenheiten weichen von 12.8 ab")
    for c, t in sl["rarityByChapter"].items():
        if sum(t.values()) != 100: err(f"stage-loot.json: Kapitel {c} ergibt {sum(t.values())}")
        if "legendaer" in t: err(f"stage-loot.json: Kapitel {c} darf nichts Legendäres enthalten (8.3)")
    if sum(sl["weaponElement"].values()) != 100 or sl["weaponElement"]["physisch"] != 40:
        err("stage-loot.json: Waffenelemente weichen von 8.4 ab")

    bd = json.load(open(ROOT / "loot" / "boss-drops.json", encoding="utf-8"))
    if (bd["first"]["weapon"], bd["repeat"]["weapon"]) != (100, 20): err("boss-drops.json: Bosswaffe (10.8)")
    if bd["first"]["item"] != {"episch": 85, "legendaer": 15}: err("boss-drops.json: erster Sieg (10.8)")
    if bd["repeat"]["item"] != {"selten": 30, "episch": 60, "legendaer": 10}: err("boss-drops.json: Wiederholung (10.8)")
    for k in ("first", "repeat"):
        if sum(bd[k]["item"].values()) != 100: err(f"boss-drops.json: {k} ergibt nicht 100")
    if (bd["first"]["gem"], bd["repeat"]["gem"]) != (100, 50): err("boss-drops.json: Gem-Chance (7.5)")
    if (bd["first"]["splinters"], bd["repeat"]["splinters"]) != (6, 3): err("boss-drops.json: Splitter (7.6)")
    if (bd["first"]["goldFactor"], bd["repeat"]["goldFactor"]) != (2.0, 1.0): err("boss-drops.json: Gold (12.5)")
    if (bd["first"]["xpFactor"], bd["repeat"]["xpFactor"]) != (1.0, 0.5): err("boss-drops.json: XP (12.2)")
    if sum(bd["itemSlotWeights"].values()) != 100: err("boss-drops.json: Slot-Anteile ergeben nicht 100")
    if bd["elementCoreChance"] != 2: err("boss-drops.json: Elementkern (10.8)")

    g = json.load(open(ROOT / "gems.json", encoding="utf-8"))
    if {k["id"]: k["stat"] for k in g["kinds"]} != GEM_STATS: err("gems.json: Arten oder Werte (7.2)")
    if g["tierPoints"] != GEM_POINTS: err("gems.json: Punkte je Stufe (7.2)")
    if len(g["tierNames"]) != 5: err("gems.json: Stufennamen")
    if (g["combineCostMult"], g["swapCostMult"], g["bossTierOffset"]) != (60, 40, 1): err("gems.json: Kosten oder Boss-Stufe (7.4, 7.5)")
    if g["slotUnlockLevels"] != [3 * k for k in range(1, 10)]: err("gems.json: Freischaltstufen (7.3)")
    if g["chestTierByChapter"] != GEM_TIERS: err("gems.json: Beutetabelle weicht von 7.5 ab")
    for c, t in g["chestTierByChapter"].items():
        if sum(t) != 100: err(f"gems.json: Kapitel {c} ergibt {sum(t)}")
    max_ksd = 9 * GEM_POINTS[-1] * 0.4 + 150            # 7.2: 9 Smaragde Stufe V
    if max_ksd > 250: err(f"gems.json: Krit-Schaden erreicht {max_ksd} über der Obergrenze 250 (5.1)")

    arts = json.load(open(ROOT / "artifacts.json", encoding="utf-8"))
    if len(arts) != 18: err("artifacts.json: 18 Artefakte erwartet (7.6)")
    seen = set()
    for a in arts:
        i = a["id"]
        if i != f"{a['class']}_{a['slot']}": err(f"{i}: ID folgt nicht dem Schema (15.5)")
        if a["class"] not in CLASS_IDS or a["slot"] not in ART_UNLOCK: err(f"{i}: Klasse oder Slot")
        if a["unlockBoss"] != ART_UNLOCK[a["slot"]]: err(f"{i}: Freischaltung weicht von 7.6 ab")
        if a["rankPoints"] != ART_POINTS or a["rankCost"] != ART_COST: err(f"{i}: Ränge oder Kosten (7.6)")
        e = a["effect"]
        if e["k"] != "handler" or e["id"] != "modifyValue": err(f"{i}: Effekt ist kein modifyValue")
        else:
            p = e["params"]
            if "path" not in p or not ({"add", "mult", "set"} & set(p)): err(f"{i}: modifyValue braucht path und add/mult/set")
            else:
                resolve_path(p["path"], by_skill, status_by, i)
                if p["path"].startswith("skill:") or p["path"].startswith("handler:"):
                    owner = p["path"].split(":")[1].split(".")[0]
                    if not owner.startswith(a["class"]): err(f"{i}: ändert Fähigkeit einer anderen Klasse")
        seen.add((a["class"], a["slot"]))
    if len(seen) != 18: err("artifacts.json: nicht jede Klasse hat Amulett, Ring und Relikt")
    print(f"  Phase 5: Namen, Beutetabellen, {len(g['kinds'])} Gem-Arten, {len(arts)} Artefakte")

# ---------- Phase 6: Werte, Texte, Oberfläche (3, 14, 15.5) ----------
BALANCE_REQUIRED = {  # Startwerte aus 15.5, stichprobenartig gegen die Formeln der Abschnitte 5 bis 12
    "stats.perPoint.leb": 6, "stats.perPoint.kra": 0.5, "stats.perPoint.tmp": 0.15, "stats.perPoint.ksd": 0.4,
    "stats.caps.tmp": 40, "stats.caps.krt": 60, "stats.caps.ksd": 250, "stats.caps.ele": 15, "stats.maxLevel": 30,
    "items.budget.base": 8, "items.budget.perIlvl": 2.2, "items.maxIlvl": 34, "items.reqOffset": 4,
    "items.slotWeights.waffe": 2.0, "items.rarity.legendaer": 1.75, "items.sellDivisor": 4,
    "weapon.xp.mult": 300, "weapon.xp.exp": 1.4, "weapon.xp.share": 0.5, "weapon.bonusPerLevel": 0.03,
    "weapon.maxLevel": 10, "weapon.enchant.goldPerRankSq": 100,
    "combat.tickRate": 20, "combat.mitigation.base": 40, "combat.mitigation.perLevel": 12,
    "combat.potion.charges": 4, "combat.potion.pct": 35, "combat.roll.px": 160, "combat.meleeSlots": 4,
    "enemy.life.base": 60, "enemy.life.perLevel": 38, "enemy.damage.base": 1, "enemy.damage.perLevel": 0.35,
    "party.life.perExtra": 0.75, "party.spawnCount.perExtra": 0.5, "party.maxSize": 6,
    "boss.damage.base": 0.25, "boss.damage.perExtra": 0.15, "boss.kampfstufeProzent": 5, "boss.levelPerChapter": 5,
    "boss.enrage.seconds": 480, "progression.xpCurve.mult": 100, "progression.xpCurve.exp": 1.5,
    "gold.stage.perPoint": 66, "gold.stage.base": 2, "gold.stage.perStage": 0.6,
    "artifacts.splinters.stage": 2, "artifacts.splinters.bossFirst": 6, "artifacts.splinters.bossRepeat": 3,
    "net.disconnectGraceS": 90, "net.maxRuns": 10}
I18N_GROUPS = ["app", "auth", "hero", "class", "role", "stat", "slot", "rarity", "element", "camp", "smith",
               "jeweler", "archive", "boss", "party", "stageSelect", "hud", "ping", "chat", "loot",
               "progress", "settings", "error"]
ERROR_CODES = ["BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "HERO_IN_RUN",
               "NOT_ENOUGH_GOLD", "NOT_ENOUGH_SPLINTERS", "INVENTORY_FULL", "REQUIREMENT_NOT_MET",
               "NAME_TAKEN", "RATE_LIMITED", "SERVER_BUSY"]                                   # 15.2

def dig(d, path):
    for part in path.split("."):
        if not isinstance(d, dict) or part not in d: return None
        d = d[part]
    return d

def check_phase6(classes, bosses_ids):
    b = json.load(open(ROOT / "balance.json", encoding="utf-8"))
    for path, want in BALANCE_REQUIRED.items():
        got = dig(b, path)
        if got != want: err(f"balance.json: {path} = {got} statt {want}")
    if dig(b, "boss.refLife") != [407, 611, 815, 1019, 1223, 1427]: err("balance.json: refLife weicht von 13.3 ab")
    if dig(b, "boss.timersMinutes") != [15, 25, 40, 60, 90, 120]: err("balance.json: Boss-Timer (10.9)")
    if sum(dig(b, "stage.encounterPoints")) != 66: err("balance.json: Begegnungspunkte ergeben nicht 66")
    if dig(b, "stage.encounterX") != [1800, 3600, 5400, 7200, 9000, 10800]: err("balance.json: Begegnungspositionen")
    sw = dig(b, "items.slotWeights")
    if abs(sum(sw.values()) - 8.0) > 1e-9: err(f"balance.json: Slotgewichte ergeben {sum(sw.values())} statt 8,0 (5.3)")
    if sorted(sw) != sorted(SLOT_IDS): err("balance.json: Slotgewichte unvollständig")
    if sorted(dig(b, "items.rarity")) != sorted(RARITIES): err("balance.json: Seltenheiten unvollständig")
    for path in sorted(BALANCE_PATHS):                      # Artefakt-Pfade müssen existieren
        if dig(b, path[len("balance."):]) is None: err(f"balance.json: Pfad {path} fehlt, wird aber von Artefakten genutzt")
    xp = lambda L: round(100 * L ** 1.5, -1)
    if sum(xp(L) for L in range(1, dig(b, "stats.maxLevel"))) != 189040: err("balance.json: XP-Kurve ergibt nicht 189.040 (12.1)")
    # Querprüfung mit den Gegner- und Stage-Dateien
    stage = json.load(open(ROOT / "levels" / "stage-07.json", encoding="utf-8"))
    if [e["points"] for e in stage["encounters"]] != dig(b, "stage.encounterPoints"):
        err("balance.json und Stage-Dateien stimmen bei den Begegnungspunkten nicht überein")

    seen_intros, seen_dialogs = set(), set()
    for c in range(1, 7):
        d = json.load(open(ROOT / "story" / f"kapitel{c}.json", encoding="utf-8"))
        if d["chapter"] != c: err(f"kapitel{c}.json: falsches Kapitel")
        want = {f"stage-{5 * (c - 1) + k:02d}" for k in range(1, 6)}
        if set(d["stageIntros"]) != want: err(f"kapitel{c}.json: Stage-Texte {sorted(set(d['stageIntros']))}")
        for k, v in d["stageIntros"].items():
            if len(v) < 40: err(f"{k}: Einleitungstext zu kurz")
        seen_intros |= set(d["stageIntros"])
        boss = bosses_ids[c - 1]
        if set(d["dialogs"]) != {f"{boss}_before", f"{boss}_after"}: err(f"kapitel{c}.json: Dialoge für {boss} fehlen")
        for k, lines in d["dialogs"].items():
            if not lines: err(f"{k}: Dialog ist leer")
            for ln in lines:
                if set(ln) != {"speaker", "text"} or not ln["text"]: err(f"{k}: Zeile ohne speaker oder text")
        seen_dialogs |= set(d["dialogs"])
        if (c == 6) != ("epilogue" in d): err(f"kapitel{c}.json: Epilog nur in Kapitel 6 (3.2)")
    if len(seen_intros) != 30: err(f"story: {len(seen_intros)} Stage-Texte statt 30")
    for s in range(1, 31):                                   # jeder introId aus den Stages muss einen Text haben
        st = json.load(open(ROOT / "levels" / f"stage-{s:02d}.json", encoding="utf-8"))
        if st["introId"] not in seen_intros: err(f"stage-{s:02d}: introId ohne Text")
    for b2 in json.load(open(ROOT / "bosses.json", encoding="utf-8")):
        for k in b2["dialog"].values():
            if k not in seen_dialogs: err(f"{b2['id']}: Dialog {k} fehlt in der Story")

    t = json.load(open(ROOT / "i18n" / "de.json", encoding="utf-8"))
    if sorted(t) != sorted(I18N_GROUPS): err(f"de.json: Gruppen {sorted(set(I18N_GROUPS) ^ set(t))}")
    for group, ids in (("class", CLASS_IDS), ("role", CLASS_IDS), ("rarity", RARITIES),
                       ("element", [e for e in ELEMENT_COLORS] + ["physisch"]),
                       ("stat", ["leb", "kra", "rue", "res", "tmp", "krt", "ksd", "ele"])):
        missing = [i for i in ids if i not in t.get(group, {})]
        if missing: err(f"de.json: {group} fehlt {missing}")
    for i in SLOT_IDS + ["amulett", "ring", "relikt"]:
        if i not in t["slot"]: err(f"de.json: slot.{i} fehlt")
    for code in ERROR_CODES:
        if code not in t["error"]: err(f"de.json: Fehlertext {code} fehlt (15.2)")
    for g, v in t.items():
        for k, x in v.items():
            if not isinstance(x, str) or not x.strip(): err(f"de.json: {g}.{k} ist leer")
    print(f"  Phase 6: balance.json, 30 Stage-Texte, {len(seen_dialogs)} Dialoge, "
          f"{sum(len(v) for v in t.values())} Oberflächentexte")

def main():
    classes = json.load(open(ROOT / "classes.json", encoding="utf-8"))
    skills = json.load(open(ROOT / "skills.json", encoding="utf-8"))
    by_id = {s["id"]: s for s in skills}
    if len(by_id) != len(skills): err("doppelte Skill-IDs")
    if [c["id"] for c in classes] != CLASS_IDS: err("Klassen-IDs oder Reihenfolge weichen von 15.5 ab")
    for c in classes:
        if abs(sum(c["shares"].values()) - 1) > 1e-9: err(f"{c['id']}: Anteile ergeben {sum(c['shares'].values())}")
        own = [by_id[i] for i in c["skills"] if i in by_id]
        if len(own) != len(c["skills"]): err(f"{c['id']}: Skill-Liste verweist auf unbekannte IDs")
        if [s["slot"] for s in own] != SLOTS: err(f"{c['id']}: Slots {[s['slot'] for s in own]}")
        if [s["cooldownS"] for s in own[:5]] != COOLDOWNS[c["id"]]: err(f"{c['id']}: Abklingzeiten weichen von Abschnitt 4 ab")
        k = k_value(own)
        note = ""
        if c["id"] == "schurke":   # 13.2: plus Blutdurst, Meucheln-Bonus und Tarnung, nur per Simulation messbar
            note = " (ohne Blutdurst, Meucheln-Bonus, Tarnung; Modell 1,62 wird in M2 gemessen)"
        elif abs(k - K_SPEC[c["id"]]) > 0.02: err(f"{c['id']}: K aus Daten {k:.3f} statt {K_SPEC[c['id']]}")
        print(f"  K {c['id']:11s} Daten {k:.3f}  Spezifikation {K_SPEC[c['id']]:.2f}{note}")
    for s in skills:
        w = s["id"]
        if not w.startswith(s["class"] + "_"): err(f"{w}: Präfix passt nicht zur Klasse")
        if s["unlockLevel"] != UNLOCK[s["slot"]]: err(f"{w}: unlockLevel {s['unlockLevel']}")
        if s["target"] not in TARGETS: err(f"{w}: target {s['target']}")
        if s["slot"] == "passive":
            if "autoCast" in s or s["cooldownS"] != 0: err(f"{w}: Passiv mit autoCast oder Abklingzeit")
        else:
            if "autoCast" not in s: err(f"{w}: autoCast fehlt")
            elif s["autoCast"]["default"] != (s["slot"] != "ult"): err(f"{w}: autoCast.default falsch (4.4)")
            else: check_rule(s["autoCast"]["rule"], w)
        for i, e in enumerate(s["effects"]): check_effect(e, f"{w}.effects[{i}]")
    check_phase2(skills)
    check_phase3()
    check_phase4(json.load(open(ROOT / 'elements.json', encoding='utf-8')))
    check_phase5(skills)
    check_phase6(classes, list(BOSS_SPEC))
    if ERR:
        print("\nFEHLER:"); [print("  - " + e) for e in ERR]; sys.exit(1)
    print(f"\nOK: {len(classes)} Klassen, {len(skills)} Fähigkeiten, Statuseffekte, Elemente, Gegner, Stages, Bosse, Beute, Gems, Artefakte, Werte und Texte geprüft.")

if __name__ == "__main__":
    main()
