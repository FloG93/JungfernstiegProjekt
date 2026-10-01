"""Referenzmodell Aethra (Abschnitt 13). Reproduziert alle Soll-Tabellen.
Aufruf: python3 ref_model.py  -> gibt alle Tabellen aus. Nur Standardbibliothek."""
import random, statistics as S, itertools

# ---------- Konstanten (Abschnitte 4, 5, 9, 10) ----------
CLASSES = ["Krieger", "Magier", "Waldläufer", "Schurke", "Kleriker", "Runenweber"]
DPS_CLASSES = {"Magier", "Waldläufer", "Schurke"}
SLOTW = {"Waffe": 2.0, "Rüstung": 1.4, "Nebenhand": 1.2, "Helm": 1.0, "Handschuhe": .8, "Umhang": .8, "Stiefel": .8}
RAR = {"Gewöhnlich": 1.00, "Ungewöhnlich": 1.12, "Selten": 1.28, "Episch": 1.48, "Legendär": 1.75}
SHARE = {  # 5.4
    "Krieger":    dict(LEB=.28, KRA=.28, RUE=.22, RES=.08, TMP=.06, KRT=.08),
    "Magier":     dict(LEB=.14, KRA=.42, RUE=.06, RES=.10, TMP=.14, KRT=.14),
    "Waldläufer": dict(LEB=.16, KRA=.40, RUE=.08, RES=.08, TMP=.14, KRT=.14),
    "Schurke":    dict(LEB=.18, KRA=.38, RUE=.10, RES=.06, TMP=.14, KRT=.14),
    "Kleriker":   dict(LEB=.24, KRA=.30, RUE=.14, RES=.14, TMP=.10, KRT=.08),
    "Runenweber": dict(LEB=.20, KRA=.32, RUE=.10, RES=.12, TMP=.16, KRT=.10)}
CONV = dict(LEB=6.0, KRA=0.5, RUE=1.0, RES=1.0, TMP=0.15, KRT=0.10)
HPMOD = {"Krieger": 1.30, "Magier": .80, "Waldläufer": .95, "Schurke": .90, "Kleriker": 1.05, "Runenweber": .90}
K = {"Krieger": 1.11, "Magier": 1.64, "Waldläufer": 1.63, "Schurke": 1.62, "Kleriker": 0.65, "Runenweber": 0.78}  # 13.2
SOLO = {"Krieger": 1.6, "Magier": 1.0, "Waldläufer": 1.0, "Schurke": 1.0, "Kleriker": 2.4, "Runenweber": 2.0}
BOSS_MIT = 0.25      # Referenz-Mitigation Boss (neutrales Element)
TRASH_MIT = 0.15     # mittlere Mitigation normaler Gegner
RUNE = 0.128         # Runenweber-Team-Bonus auf Schaden der anderen
AOE = {"Krieger": 1.10, "Magier": 1.8, "Waldläufer": 1.3, "Schurke": 1.0, "Kleriker": 1.05, "Runenweber": 1.0}
F = lambda n: 1 + 0.75 * (n - 1)
M = lambda n: 0.25 + 0.15 * (n - 1)
B = {1: 11400, 2: 18600, 3: 26300, 4: 34300, 5: 42700, 6: 51600}   # Boss-Leben n=1 (gerundet, 10.3)
hpe = lambda lv: 60 + 38 * lv            # Gegner-Leben 9.4
dpe = lambda lv: 1 + 0.35 * lv           # Gegner-Schaden/s 9.4
mit = lambda w, lv: w / (w + 40 + 12 * lv)  # 5.6
# Annahmen des Überlebensmodells (13.6)
TELE_HIT = 0.30      # Anteil getroffener Telegraphen (solo und Tank mit Heiler)
TELE_HIT_TANK = 0.25 # Tank ohne Heiler
TELE_HIT_GROUP = 0.15  # Nicht-Tank in Gruppe
SIG_ACTIVE = 0.66    # Signaturangriff ab Phase 2 = 2/3 der Kampfdauer
RAGE_ON_TANK = 0.73  # Anteil Standardangriffe auf den Tank trotz Wutwechsel
TANK_TOOLS = 0.84    # Spott -12 %, Bollwerk -4 %

def item_budget(slot, ilvl, rar): return SLOTW[slot] * (8 + 2.2 * ilvl) * RAR[rar]
def base_stats(cl, L):
    return dict(LEB=(120 + 14 * (L - 1)) * HPMOD[cl], KRA=10 + 2.2 * (L - 1), RUE=10 + 2.4 * (L - 1),
                RES=8 + 2.0 * (L - 1), TMP=0.0, KRT=5.0)
def hero(cl, L, ilvl, rar="Selten", extra_pts=0.0):
    b = base_stats(cl, L); tot = sum(item_budget(s, ilvl, rar) for s in SLOTW) + extra_pts
    return {k: b[k] + tot * SHARE[cl][k] * CONV[k] for k in b}, tot
def dps(cl, st, target_mit):  # 13.2
    return st["KRA"] * K[cl] * (1 + st["TMP"] / 100) * (1 + min(st["KRT"], 75) / 100 * 0.5) * (1 - target_mit)
def hps_kleriker(st):  # Heilendes Licht + Segensaura (1 Ziel) + Läuterung
    P = st["KRA"]; return (2.0 * P / 6 + 0.25 * P * (8 / 14) + 1.2 * P / 16) * (1 + st["TMP"] / 100)
def Hs(cl, c): return hero(cl, 5 * c, 5 * c)[0]
def D(cl, c): return dps(cl, Hs(cl, c), BOSS_MIT)
REF = {c: S.mean(Hs(x, c)["LEB"] for x in CLASSES) for c in range(1, 7)}
def team_dps(comp, c):
    if len(comp) == 1: return D(comp[0], c) * SOLO[comp[0]]
    base = sum(D(x, c) for x in comp); oth = sum(D(x, c) for x in comp if x != "Runenweber")
    return base + (RUNE * oth if "Runenweber" in comp else 0)
def ttk(comp, c, ratio=1.0, elem=1.0): return B[c] * F(len(comp)) / (team_dps(comp, c) * ratio * elem)

def boss_parts(st, c, armor_mult=1.0):
    r = REF[c]; am = mit(st["RUE"] * armor_mult, 5 * c); rm = mit(st["RES"], 5 * c)   # Boss-Stufe = 5 x Kapitel
    return dict(std=0.11 * r * (1 - am) / 2.5, puls=0.08 * r * (1 - rm) / 12,
                tel=0.30 * r * (1 - rm) / 20, sig=0.20 * r * (1 - rm) / 30)

def main():
    print("13.3 Standard-DPS:", {cl: [round(D(cl, c)) for c in range(1, 7)] for cl in CLASSES})
    print("13.3 Leben:", {cl: [round(Hs(cl, c)["LEB"]) for c in range(1, 7)] for cl in CLASSES})
    print("13.3 RefLeben:", {c: round(v) for c, v in REF.items()})
    print("13.3 Kleriker-HPS:", [round(hps_kleriker(Hs("Kleriker", c)), 1) for c in range(1, 7)])
    print("13.4 B berechnet:", {c: round(150 * S.mean(D(x, c) for x in DPS_CLASSES), -2) for c in range(1, 7)})
    print("13.5 Solo:", {cl: [round(ttk([cl], c)) for c in (1, 3, 6)] for cl in CLASSES})
    comps = {"6 Klassen": CLASSES, "5 ohne Heiler": ["Krieger", "Magier", "Waldläufer", "Schurke", "Runenweber"],
             "Kr,Kl,Mag,Sch": ["Krieger", "Kleriker", "Magier", "Schurke"], "Mag,Wal,Sch": ["Magier", "Waldläufer", "Schurke"],
             "Mag,Wal": ["Magier", "Waldläufer"], "6x Magier": ["Magier"] * 6, "Kr,Kl": ["Krieger", "Kleriker"],
             "4 Kl+2 Kr": ["Kleriker"] * 4 + ["Krieger"] * 2, "3 Kl": ["Kleriker"] * 3}
    print("13.5 Gruppen:", {k: (round(ttk(v, 3)), round(ttk(v, 6))) for k, v in comps.items()})
    random.seed(3)
    for n in range(1, 7):
        v = sorted(ttk([random.choice(CLASSES) for _ in range(n)], 3) for _ in range(6000))
        print(f"13.5 Zufall n={n}: Ø {S.mean(v):.0f} P10 {v[600]:.0f} P90 {v[5400]:.0f}")
    for c in (3, 6):
        w = [ttk(list(cp), c) for n in range(1, 7) for cp in itertools.combinations_with_replacement(CLASSES, n) if DPS_CLASSES & set(cp)]
        print(f"13.5 alle Zusammensetzungen mit Schadensklasse Kap{c}: ≤200s {sum(t<=200 for t in w)/len(w):.2f}, max {max(w):.0f}")
    ratio = {3: 1.22, 6: 1.42}   # erwartete Stärke aus 13.8
    for nm, cp in (("Solo Magier", ["Magier"]), ("Solo Krieger", ["Krieger"]), ("Solo Kleriker", ["Kleriker"]),
                   ("Kr,Kl,Mag,Sch", comps["Kr,Kl,Mag,Sch"]), ("6 Klassen", CLASSES), ("Kr,Kl", comps["Kr,Kl"])):
        for c in (3, 6):
            r = ratio[c]
            print(f"13.5 realistisch {nm} Kap{c}: Ref {ttk(cp,c):.0f} schlecht {ttk(cp,c,r*.70,.7):.0f} "
                  f"typisch {ttk(cp,c,r*.75,1.25):.0f} gut {ttk(cp,c,r*.85,1.45):.0f}")
    for c in range(1, 7):  # 13.6 Tank vs Heiler
        p = boss_parts(Hs("Krieger", c), c, 1.15); h = hps_kleriker(Hs("Kleriker", c))
        tot = p["std"] + p["puls"] + p["tel"] * TELE_HIT
        print(f"13.6 Kap{c}: Tank {tot:.1f}/s HPS {h:.1f} Verh {tot/h:.2f} nur Std {p['std']/h:.2f} n=3 {M(3)*tot/h:.2f}")
    for cl in CLASSES:  # 13.6 Solo-Druck
        row = []
        for c in (1, 3, 6):
            st = Hs(cl, c); p = boss_parts(st, c, 1.15 if cl == "Krieger" else 1.0)
            inc = M(1) * (p["std"] + p["puls"] + p["tel"] * TELE_HIT + p["sig"] * TELE_HIT * SIG_ACTIVE)
            row.append(round(inc * ttk([cl], c) / st["LEB"] * 100))
        print(f"13.6 Solo-Druck {cl}: {row} %")
    for nm, cp in (("5 ohne Heiler", comps["5 ohne Heiler"]), ("Kr,Mag,Wal,Sch", ["Krieger", "Magier", "Waldläufer", "Schurke"]),
                   ("Kr,Wal", ["Krieger", "Waldläufer"])):
        n = len(cp); row = []
        for c in (3, 6):
            st = Hs("Krieger", c); p = boss_parts(st, c, 1.15)
            inc = M(n) * (p["std"] * RAGE_ON_TANK + p["puls"] + p["tel"] * TELE_HIT_TANK + p["sig"] * TELE_HIT_TANK * SIG_ACTIVE) * TANK_TOOLS
            row.append(round(inc * ttk(cp, c) / st["LEB"] * 100))
        print(f"13.6 Tank ohne Heiler {nm}: {row} %")
    for c in (1, 3, 6):
        st = Hs("Magier", c); p = boss_parts(st, c); t = ttk(comps["5 ohne Heiler"], c)
        inc = M(5) * (p["puls"] + p["tel"] * TELE_HIT_GROUP + p["sig"] * TELE_HIT_GROUP) * t
        print(f"13.6 Magier-Pulse ohne Heiler Kap{c}: {inc/st['LEB']*100:.0f} %")
    for s in (4, 9, 14, 19, 24, 29):  # 13.7 Tank normal
        st = hero("Krieger", s, s)[0]; dmg = 4 * dpe(s) * (1 - mit(st["RUE"] * 1.15, s)); h = hps_kleriker(hero("Kleriker", s, s)[0])
        print(f"13.7 Stage {s}: Tank {dmg:.1f}/s HP {st['LEB']:.0f} HPS {h:.1f} Verh {dmg/h:.2f}")
    for s in (9, 19, 29):  # 13.7 Solo pro Begegnung
        out = {}
        for cl in CLASSES:
            st = hero(cl, s, s)[0]; m = mit(st["RUE"] * (1.15 if cl == "Krieger" else 1), s)
            t = 66 * hpe(s) / (dps(cl, st, TRASH_MIT) * SOLO[cl] * AOE[cl])
            out[cl] = round(3 * dpe(s) * (1 - m) * t / st["LEB"] * 100 / 6)
        print(f"13.7 Solo pro Begegnung Stage {s}: {out}")
    for s in (10, 30):  # 13.7 Kampfzeit
        solo = {cl: round(66 * hpe(s) / (dps(cl, hero(cl, s, s)[0], TRASH_MIT) * SOLO[cl] * AOE[cl])) for cl in CLASSES}
        tdps = sum(dps(x, hero(x, s, s)[0], TRASH_MIT) * AOE[x] for x in CLASSES) * (1 + RUNE * 0.9)
        print(f"13.7 Kampfzeit Stage {s}: {solo} n=6 {66*hpe(s)*F(6)/tdps:.0f}")
    gear = {1: .77, 2: .89, 3: .96, 4: 1.01, 5: 1.05, 6: 1.07}; gem = {1: 9, 2: 37, 3: 70, 4: 99, 5: 152, 6: 178}
    art = {1: 24, 2: 30, 3: 54, 4: 60, 5: 84, 6: 90}; WL = {1: 3, 2: 6, 3: 8, 4: 10, 5: 10, 6: 10}
    ench = {1: 0, 2: 0, 3: 0, 4: .05, 5: .10, 6: .15}
    for c in range(1, 7):  # 13.8
        row = []
        for cl in ("Krieger", "Magier", "Kleriker"):
            st0, tot0 = hero(cl, 5 * c, 5 * c); wref = 2.0 * (8 + 2.2 * 5 * c) * 1.28
            tot = tot0 * gear[c] + wref * 0.03 * (WL[c] - 1) + gem[c] + art[c]
            b = base_stats(cl, 5 * c); st = {k: b[k] + tot * SHARE[cl][k] * CONV[k] for k in b}
            r = dps(cl, st, BOSS_MIT) / dps(cl, st0, BOSS_MIT); row.append((round(r, 2), round(r * (1 + ench[c]), 2)))
        print(f"13.8 Kap{c} Punkte/Ref {tot/tot0:.2f} Krieger/Magier/Kleriker {row}")
    for cl in ("Magier", "Krieger"):
        for nm, il, rar, ele, kra in (("A", 30, "Episch", 0, False), ("B", 34, "Legendär", .05, False), ("B Kraft", 34, "Legendär", .05, True)):
            b = base_stats(cl, 30); g = sum(item_budget(s, il, rar) for s in SLOTW) + SLOTW["Waffe"] * (8 + 2.2 * il) * 1.75 * 0.27
            if rar == "Episch": g += SLOTW["Waffe"] * (8 + 2.2 * il) * (1.75 - 1.48)
            if kra: st = {k: b[k] + (g + 108) * SHARE[cl][k] * CONV[k] for k in b}; st["KRA"] += 225 * CONV["KRA"]
            else: st = {k: b[k] + (g + 333) * SHARE[cl][k] * CONV[k] for k in b}
            st["TMP"] = min(st["TMP"], 40); st["KRT"] = min(st["KRT"], 60)
            print(f"13.8 Endspiel {cl} {nm}: {dps(cl, st, BOSS_MIT)*1.19*(1+ele)/D(cl, 6):.2f}")
    xp = lambda L: int(round(100 * L ** 1.5, -1)); G = lambda s: 66 * (2 + 0.6 * s)
    print("12.1 XP bis 30:", sum(xp(L) for L in range(1, 30)))
    print("12.2 Kampagne XP:", round(sum(1.4 * xp(s) if s % 5 == 0 else xp(s) for s in range(1, 31))))
    print("12.5 Kampagne Gold:", round(sum(G(s) * 18 / 66 + 2 * G(s) if s % 5 == 0 else G(s) for s in range(1, 31))))
    loot_mc()

def loot_mc(runs=3000, seed=1):  # 12.9
    slotp = {"Waffe": 16, "Rüstung": 14, "Nebenhand": 14, "Helm": 14, "Handschuhe": 14, "Umhang": 14, "Stiefel": 14}
    tab = {1: dict(Gewöhnlich=60, Ungewöhnlich=30, Selten=10), 2: dict(Gewöhnlich=40, Ungewöhnlich=35, Selten=20, Episch=5),
           3: dict(Gewöhnlich=25, Ungewöhnlich=35, Selten=30, Episch=10), 4: dict(Gewöhnlich=15, Ungewöhnlich=30, Selten=35, Episch=20),
           5: dict(Gewöhnlich=10, Ungewöhnlich=25, Selten=40, Episch=25), 6: dict(Gewöhnlich=5, Ungewöhnlich=20, Selten=40, Episch=35)}
    def roll(d):
        r = random.random() * sum(d.values()); a = 0
        for k, v in d.items():
            a += v
            if r <= a: return k
    random.seed(seed); res = []
    for _ in range(runs):
        best = {s: 0 for s in SLOTW}; out = []
        for c in range(1, 7):
            for k in range(1, 5):
                s = 5 * (c - 1) + k
                elite = (0, 0, .25, .5)[k - 1]   # Elite-Zusatzgegenstand (Näherung)
                n_items = 2 + (1 if random.random() < elite else 0)
                if k == 4: random.random()        # Stage 4: zwei Elites à 25 % als eine Probe mit 50 %; zweiter Zufallswert verworfen (gleiche Folge wie Originalmodell)
                for _ in range(n_items):
                    sl = roll(slotp); best[sl] = max(best[sl], item_budget(sl, s, roll(tab[c])))
            best["Waffe"] = max(best["Waffe"], item_budget("Waffe", 5 * c, "Legendär"))
            sl = roll(slotp); r = "Episch" if random.random() < .85 else "Legendär"
            best[sl] = max(best[sl], item_budget(sl, 5 * c, r))
            out.append(sum(best.values()) / sum(item_budget(x, 5 * c, "Selten") for x in SLOTW))
        res.append(out)
    print("12.9 Ausrüstung/Referenz:", [round(S.mean(r[c] for r in res), 2) for c in range(6)])

if __name__ == "__main__":
    main()
