# Aethra auf dem Raspberry Pi

Dieses Paket enthält den fertig gebauten Spielserver. Auf dem Pi wird nichts kompiliert außer, falls nötig, der
SQLite-Baustein. Getestet für Raspberry Pi OS Lite; läuft auch auf anderen Debian-Rechnern (64 Bit mit Node 24,
32-Bit-ARM wie dem Raspberry Pi 2 mit Node 22).

## Einrichten

```bash
tar xzf aethra-pi.tar.gz
sudo ./aethra/install.sh
```

Das Skript lädt Node.js (mit Prüfsumme), installiert die Laufzeit-Pakete, legt Einstellungen mit einem zufälligen
Einladungscode an und richtet den Dienst `aethra` ein. Am Ende fragt es, ob das Spiel über **Tailscale Funnel**
von überall erreichbar sein soll (feste HTTPS-Adresse, keine Portfreigabe in der Fritzbox nötig).

## Aktualisieren

Neues Paket auf den Pi kopieren, den alten entpackten Ordner löschen und neu einrichten:

```bash
rm -rf aethra && tar xzf aethra-pi.tar.gz && sudo ./aethra/install.sh
```

Spielstände und Einstellungen bleiben, beim Start legt der Server eine Sicherung an.

## Nützliche Befehle

| Befehl | Zweck |
| --- | --- |
| `systemctl status aethra` | läuft der Server? |
| `journalctl -u aethra -f` | Protokoll ansehen |
| `sudo systemctl restart aethra` | neu starten, z. B. nach Änderungen in `/etc/aethra/aethra.env` |
| `sudo aethra-admin help` | Verwaltung, z. B. `sudo aethra-admin reset-password lea neues-passwort` |
| `sudo tailscale funnel status` | öffentliche Adresse anzeigen |

Daten und Sicherungen liegen in `/var/lib/aethra` (Sicherung beim Start und jede Nacht, 14 Tage).
