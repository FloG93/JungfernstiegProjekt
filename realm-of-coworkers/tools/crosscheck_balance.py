"""Phase 7: rechnet die Inhaltsdateien gegen das Referenzmodell (Abschnitt 13) nach.
Aufruf: python3 tools/crosscheck_balance.py   (Exit-Code 1 bei Abweichung)"""
import json, sys, pathlib, importlib.util
ROOT = pathlib.Path(__file__).resolve().parents[1]
C = ROOT / "packages" / "content"
spec = importlib.util.spec_from_file_location("ref", ROOT / "tools" / "balance" / "reference" / "ref_model.py")
ref = importlib.util.module_from_spec(spec); spec.loader.exec_module(ref)
load = lambda p: json.load(open(C / p, encoding="utf-8"))
ERR = []
def chk(cond, msg):
    if not cond: ERR.append(msg)

b = load("balance.json"); classes = load("classes.json"); bosses = load("bosses.json")
ID2NAME = {"krieger": "Krieger", "magier": "Magier", "waldlaeufer": "Waldläufer",
           "schurke": "Schurke", "kleriker": "Kleriker", "runenweber": "Runenweber"}

print("1) Formelkonstanten gegen das Referenzmodell")
chk(b["stats"]["perPoint"] == {"leb": 6, "kra": 0.5, "rue": 1, "res": 1, "tmp": 0.15, "krt": 0.10, "ksd": 0.4},
    "Umrechnung Punkte in Werte weicht ab")
for k, v in ref.CONV.items():
    chk(b["stats"]["perPoint"][k.lower()] == v, f"perPoint.{k.lower()}")
for sid, w in b["items"]["slotWeights"].items():
    name = {"waffe": "Waffe", "ruestung": "Rüstung", "nebenhand": "Nebenhand", "helm": "Helm",
            "handschuhe": "Handschuhe", "umhang": "Umhang", "stiefel": "Stiefel"}[sid]
    chk(ref.SLOTW[name] == w, f"Slotgewicht {sid}")
for rid, f in b["items"]["rarity"].items():
    name = {"gewoehnlich": "Gewöhnlich", "ungewoehnlich": "Ungewöhnlich", "selten": "Selten",
            "episch": "Episch", "legendaer": "Legendär"}[rid]
    chk(ref.RAR[name] == f, f"Seltenheitsfaktor {rid}")
chk((b["enemy"]["life"]["base"], b["enemy"]["life"]["perLevel"]) == (60, 38), "Gegner-Leben")
chk((b["enemy"]["damage"]["base"], b["enemy"]["damage"]["perLevel"]) == (1, 0.35), "Gegner-Schaden")
chk((b["combat"]["mitigation"]["base"], b["combat"]["mitigation"]["perLevel"]) == (40, 12), "Mitigation")
chk(b["party"]["life"]["perExtra"] == 0.75 and b["boss"]["damage"] == {"base": 0.25, "perExtra": 0.15}, "F(n) oder M(n)")

print("2) Klassenanteile und Lebensfaktoren")
for c in classes:
    n = ID2NAME[c["id"]]
    for k, v in c["shares"].items():
        chk(abs(ref.SHARE[n][k.upper()] - v) < 1e-9, f"{c['id']}: Anteil {k}")
    chk(ref.HPMOD[n] == c["hpFactor"], f"{c['id']}: Lebensfaktor")
    chk(ref.SOLO[n] == c["solo"], f"{c['id']}: Einzelkämpfer-Faktor")

print("3) RefLeben aus den Daten")
for c in range(1, 7):
    computed = sum(ref.Hs(ID2NAME[x["id"]], c)["LEB"] for x in classes) / 6
    chk(abs(round(computed) - b["boss"]["refLife"][c - 1]) <= 1,
        f"RefLeben Kapitel {c}: {round(computed)} statt {b['boss']['refLife'][c-1]}")
print("   RefLeben:", [round(sum(ref.Hs(ID2NAME[x['id']], c)['LEB'] for x in classes) / 6) for c in range(1, 7)])

print("4) Boss-Leben aus den Daten (13.4: 150 s mal mittlerer Schadensklassen-DPS)")
for bo in bosses:
    want = round(150 * sum(ref.D(x, bo["chapter"]) for x in ref.DPS_CLASSES) / 3, -2)
    chk(abs(bo["hpBase"] - want) <= 100, f"{bo['id']}: {bo['hpBase']} statt {want:.0f}")
    print(f"   {bo['id']:9s} {bo['hpBase']:6d}  Modell {want:.0f}")

print("5) Kampfdauer je Klasse gegen die Grenzen aus 13.9")
for c in classes:
    n = ID2NAME[c["id"]]
    times = [ref.ttk([n], ch) for ch in range(1, 7)]
    chk(all(130 <= t <= 210 for t in times), f"{c['id']}: Solo-Kampfdauer {[round(t) for t in times]}")
    print(f"   {c['id']:11s} {[round(t) for t in times]}")
spread = max(ref.ttk([ID2NAME[c['id']]], 6) for c in classes) / min(ref.ttk([ID2NAME[c['id']]], 6) for c in classes)
chk(spread <= 1.45, f"Spanne der Klassen {spread:.2f} über 1,45")
print(f"   Spanne schnellste zu langsamster Klasse: {spread:.2f}")

print("6) XP- und Gold-Kurve aus balance.json")
xp = lambda L: round(b["progression"]["xpCurve"]["mult"] * L ** b["progression"]["xpCurve"]["exp"], -1)
total = sum(xp(L) for L in range(1, b["stats"]["maxLevel"]))
chk(total == 189040, f"XP bis Stufe 30: {total}")
g = b["gold"]["stage"]
G = lambda s: g["perPoint"] * (g["base"] + g["perStage"] * s)
gold = sum(G(s) * b["gold"]["bossStagePoints"] / 66 + b["gold"]["bossFirst"] * G(s) if s % 5 == 0 else G(s)
           for s in range(1, 31))
chk(25000 <= gold <= 32000, f"Kampagnen-Gold {gold:.0f} außerhalb 25.000 bis 32.000")
print(f"   XP bis Stufe 30: {total}, Kampagnen-Gold: {gold:.0f}")

print("7) Gem- und Artefaktpunkte gegen die Obergrenzen (5.1, 7.1)")
gems = load("gems.json"); arts = load("artifacts.json")
max_gem = len(gems["slotUnlockLevels"]) * gems["tierPoints"][-1]
max_art = 3 * arts[0]["rankPoints"][-1]
chk(max_gem == 225 and max_art == 108, f"Höchstbudget Gems {max_gem}, Artefakte {max_art}")
ksd = b["stats"]["base"]["ksd"] + max_gem * b["stats"]["perPoint"]["ksd"]
chk(ksd <= b["stats"]["caps"]["ksd"], f"Krit-Schaden erreicht {ksd} über {b['stats']['caps']['ksd']}")
print(f"   Gems {max_gem} Punkte, Artefakte {max_art} Punkte, Krit-Schaden höchstens {ksd:.0f} %")

if ERR:
    print("\nABWEICHUNGEN:"); [print("  - " + e) for e in ERR]; sys.exit(1)
print("\nOK: Inhaltsdateien und Referenzmodell stimmen überein.")
