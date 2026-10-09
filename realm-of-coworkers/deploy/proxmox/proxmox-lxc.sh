#!/usr/bin/env bash
# Aethra in einem eigenen LXC-Container auf Proxmox VE einrichten oder aktualisieren (OPEN-050).
# Auf dem Proxmox-Host als root, im Ordner mit dem Paket:
#
#   tar xzf aethra-pi.tar.gz && ./aethra/proxmox-lxc.sh             neuen Container anlegen und einrichten
#   tar xzf aethra-pi.tar.gz && ./aethra/proxmox-lxc.sh --update 105 bestehenden Container 105 aktualisieren
#
# Legt an: unprivilegierter Debian-Container „aethra“ (2 Kerne, 1 GB RAM, 8 GB Platte, DHCP an vmbr0, startet mit dem
# Host), darin das Spiel per install.sh als systemd-Dienst. Für Tailscale Funnel wird /dev/net/tun durchgereicht.
# Anpassen über Umgebungsvariablen: CTID, CT_HOSTNAME, STORAGE, TEMPLATE_STORAGE, BRIDGE, CORES, MEMORY, SWAP, DISK,
# FUNNEL=yes|no (sonst wird gefragt).
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mFehler: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Bitte als root auf dem Proxmox-Host ausführen."
command -v pct >/dev/null || die "pct fehlt: Das Skript läuft auf dem Proxmox-Host, nicht in einer VM oder einem Container."
[ -x "$SRC/install.sh" ] || die "install.sh fehlt neben diesem Skript. Bitte das ganze Paket entpacken."

UPDATE=""
if [ "${1:-}" = "--update" ]; then
  UPDATE="${2:-}"
  [ -n "$UPDATE" ] || die "Bitte die Container-ID angeben: ./aethra/proxmox-lxc.sh --update 105"
  pct status "$UPDATE" >/dev/null 2>&1 || die "Container $UPDATE gibt es nicht."
elif [ -n "${1:-}" ]; then
  die "Unbekannte Option: $1"
fi

push_and_install() {
  local ct="$1" flag="$2" tmp
  say "Paket in Container $ct kopieren"
  tmp="$(mktemp --suffix=.tar.gz)"
  tar -czf "$tmp" -C "$(dirname "$SRC")" "$(basename "$SRC")"
  pct exec "$ct" -- rm -rf /root/aethra /root/aethra.tar.gz
  pct push "$ct" "$tmp" /root/aethra.tar.gz
  rm -f "$tmp"
  pct exec "$ct" -- tar -xzf /root/aethra.tar.gz -C /root
  say "Aethra im Container einrichten (dauert ein paar Minuten)"
  pct exec "$ct" -- /root/aethra/install.sh "$flag"
}

if [ -n "$UPDATE" ]; then
  [ "$(pct status "$UPDATE" | awk '{print $2}')" = running ] || pct start "$UPDATE"
  push_and_install "$UPDATE" --no-funnel
  exit 0
fi

CTID="${CTID:-$(pvesh get /cluster/nextid)}"
CT_HOSTNAME="${CT_HOSTNAME:-aethra}"
BRIDGE="${BRIDGE:-vmbr0}"
CORES="${CORES:-2}"
MEMORY="${MEMORY:-1024}"
SWAP="${SWAP:-512}"
DISK="${DISK:-8}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
STORAGE="${STORAGE:-$(pvesm status --content rootdir 2>/dev/null | awk 'NR > 1 && $3 == "active" { print $1; exit }')}"
[ -n "$STORAGE" ] || die "Kein Speicher für Container gefunden. Bitte angeben, z. B. STORAGE=local-lvm ./aethra/proxmox-lxc.sh"

FUNNEL="${FUNNEL:-}"
if [ -z "$FUNNEL" ]; then
  if [ -t 0 ]; then
    read -r -p $'Soll das Spiel über Tailscale Funnel von überall erreichbar sein (Büro, mobile Daten)? [J/n] ' answer
    case "${answer:-j}" in [nN]*) FUNNEL=no ;; *) FUNNEL=yes ;; esac
  else
    FUNNEL=no
  fi
fi

say "Debian-Vorlage suchen"
pveam update >/dev/null || true
TEMPLATE="$(pveam available --section system | awk '{print $2}' | grep -E '^debian-1[2-9]-standard_.*_amd64\.tar\.(zst|xz|gz)$' | sort -V | tail -n 1 || true)"
[ -n "$TEMPLATE" ] || die "Keine Debian-Vorlage gefunden (pveam available --section system)."
if ! pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE"; then
  say "Vorlage $TEMPLATE laden"
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

say "Container $CTID ($CT_HOSTNAME) anlegen: $CORES Kerne, $MEMORY MB RAM, $DISK GB auf $STORAGE, Netz $BRIDGE (DHCP)"
pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE" \
  --hostname "$CT_HOSTNAME" --cores "$CORES" --memory "$MEMORY" --swap "$SWAP" \
  --rootfs "$STORAGE:$DISK" --net0 "name=eth0,bridge=$BRIDGE,ip=dhcp" \
  --unprivileged 1 --features nesting=1 --onboot 1 \
  --description "Aethra – Die Splitterchroniken (Spielserver)"
# Tailscale braucht das TUN-Gerät des Hosts (Anleitung von Tailscale für unprivilegierte LXC-Container)
cat >> "/etc/pve/lxc/$CTID.conf" <<'EOF'
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
EOF

say "Container starten und auf das Netz warten"
pct start "$CTID"
pct exec "$CTID" -- sh -c 'for i in $(seq 1 60); do getent hosts deb.debian.org >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1' \
  || die "Container $CTID bekommt kein Netz. DHCP an $BRIDGE prüfen (pct enter $CTID, ip a)."

if [ "$FUNNEL" = yes ]; then flag=--funnel; else flag=--no-funnel; fi
push_and_install "$CTID" "$flag"

say "Fertig: Container $CTID startet mit dem Proxmox-Host automatisch"
echo "  Konsole im Container:  pct enter $CTID"
echo "  Aktualisieren:         ./aethra/proxmox-lxc.sh --update $CTID   (mit neuem Paket)"
echo "  Sicherung:             im Proxmox-Webinterface Container $CTID in einen Backup-Job aufnehmen"
