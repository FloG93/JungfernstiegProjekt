#!/usr/bin/env bash
# Aethra auf einem Raspberry Pi (oder einem anderen Debian-Rechner) einrichten oder aktualisieren (OPEN-048).
#
#   sudo ./install.sh             einrichten bzw. aktualisieren, fragt am Ende nach Tailscale Funnel
#   sudo ./install.sh --funnel    zusätzlich ohne Rückfrage Tailscale Funnel einrichten (öffentliche HTTPS-Adresse)
#   sudo ./install.sh --no-funnel ohne Rückfrage, nur im Heimnetz
#
# Legt an: Programm in /opt/aethra (mit eigenem Node.js), Daten und Sicherungen in /var/lib/aethra,
# Einstellungen in /etc/aethra/aethra.env, Dienst „aethra“ (startet nach Stromausfall von selbst).
# Ein erneuter Aufruf mit einem neuen Paket aktualisiert das Spiel; Daten und Einstellungen bleiben.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/aethra
DATA=/var/lib/aethra
CONF=/etc/aethra
ENV_FILE=$CONF/aethra.env
SERVICE=aethra
RUN_USER=aethra
FUNNEL=ask

for arg in "$@"; do
  case "$arg" in
    --funnel) FUNNEL=yes ;;
    --no-funnel) FUNNEL=no ;;
    *) echo "Unbekannte Option: $arg"; exit 2 ;;
  esac
done

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mFehler: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Bitte mit sudo starten: sudo ./install.sh"
[ -f "$SRC/dist/main.js" ] || die "dist/main.js fehlt. Bitte im entpackten Ordner aethra starten."
command -v apt-get >/dev/null || die "Das Skript braucht ein Debian-System wie Raspberry Pi OS."

# Node.js passend zum Betriebssystem: 32-Bit-ARM (Raspberry Pi 2) bekommt Node 22, Node 24 gibt es dafür nicht mehr.
case "$(dpkg --print-architecture)" in
  armhf)
    [ "$(uname -m)" != armv6l ] || die "Raspberry Pi 1 und Zero (ARMv6) unterstützt Node.js nicht mehr."
    NODE_ARCH=armv7l; NODE_LINE=22 ;;
  arm64) NODE_ARCH=arm64; NODE_LINE=24 ;;
  amd64) NODE_ARCH=x64; NODE_LINE=24 ;;
  *) die "Nicht unterstützte Architektur: $(dpkg --print-architecture)" ;;
esac
NODE_LINE="${AETHRA_NODE_LINE:-$NODE_LINE}"
NODE="$APP/node/bin/node"
NPM="$APP/node/bin/npm"

apt_install() {
  local missing=()
  for pkg in "$@"; do dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg"); done
  [ ${#missing[@]} -eq 0 ] && return 0
  say "Systempakete installieren: ${missing[*]}"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "${missing[@]}"
}

install_node() {
  local base="https://nodejs.org/dist/latest-v${NODE_LINE}.x" sums file want have tmp
  sums="$(curl -fsSL "$base/SHASUMS256.txt")" || die "Die Node.js-Seite ist nicht erreichbar ($base)."
  file="$(printf '%s\n' "$sums" | awk '{print $2}' | grep -E "^node-v[0-9.]+-linux-${NODE_ARCH}\.tar\.xz$" | head -n 1 || true)"
  [ -n "$file" ] || die "Kein Node.js $NODE_LINE für $NODE_ARCH gefunden."
  want="${file#node-}"
  want="${want%%-linux-*}"
  have="$("$NODE" -v 2>/dev/null || true)"
  if [ "$have" = "$want" ]; then
    echo "Node.js $have ist aktuell."
    return 0
  fi
  say "Node.js $want ($NODE_ARCH) laden"
  tmp="$(mktemp -d)"
  curl -fsSL "$base/$file" -o "$tmp/$file"
  (cd "$tmp" && printf '%s\n' "$sums" | grep " $file\$" | sha256sum -c --quiet -) || die "Prüfsumme von $file stimmt nicht."
  rm -rf "$APP/node.neu"
  mkdir -p "$APP/node.neu"
  tar -xJf "$tmp/$file" -C "$APP/node.neu" --strip-components=1
  rm -rf "$APP/node" "$tmp"
  mv "$APP/node.neu" "$APP/node"
}

install_packages() {
  # Nur neu installieren, wenn sich Paketliste oder Node-Version geändert haben (better-sqlite3 kompiliert auf dem Pi lange).
  local stamp
  stamp="$("$NODE" -v) $(sha256sum "$SRC/package-lock.json" | cut -d' ' -f1)"
  if [ -d "$APP/node_modules" ] && [ "$(cat "$APP/.pakete" 2>/dev/null || true)" = "$stamp" ]; then
    echo "Laufzeit-Pakete sind aktuell."
    return 0
  fi
  say "Laufzeit-Pakete installieren (auf dem Raspberry Pi 2 beim ersten Mal bis zu 20 Minuten)"
  if ! (cd "$APP" && PATH="$APP/node/bin:$PATH" "$NPM" ci --omit=dev --no-audit --no-fund); then
    say "Kein fertiges Paket für diese Plattform, Werkzeuge zum Kompilieren installieren"
    apt_install build-essential python3
    (cd "$APP" && PATH="$APP/node/bin:$PATH" "$NPM" ci --omit=dev --no-audit --no-fund) || die "Die Installation der Pakete ist fehlgeschlagen."
  fi
  echo "$stamp" > "$APP/.pakete"
}

set_env() {
  if grep -q "^$1=" "$ENV_FILE"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else
    echo "$1=$2" >> "$ENV_FILE"
  fi
}

get_env() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1; }

has_systemd() { [ -d /run/systemd/system ]; }

wait_healthy() {
  local port _
  port="$(get_env PORT)"
  # Der Raspberry Pi 2 braucht für Inhalte, Migration und Start-Sicherung deutlich länger als ein PC
  for _ in $(seq 1 180); do
    curl -fsS "http://127.0.0.1:${port:-3000}/api/health" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

setup_funnel() {
  local port dns
  port="$(get_env PORT)"
  port="${port:-3000}"
  if ! command -v tailscale >/dev/null; then
    say "Tailscale installieren"
    curl -fsSL https://tailscale.com/install.sh | sh
  fi
  if ! tailscale status >/dev/null 2>&1; then
    say "Bei Tailscale anmelden: den folgenden Link im Browser öffnen (kostenloses Konto genügt)"
    tailscale up
  fi
  say "Funnel einschalten: Port $port wird unter einer festen HTTPS-Adresse erreichbar"
  echo "Erscheint ein Link zum Freischalten von Funnel oder HTTPS, ihn öffnen und bestätigen."
  tailscale funnel --bg "$port"
  dns="$(tailscale status --json | "$NODE" -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>console.log(JSON.parse(s).Self.DNSName.replace(/\.$/,"")))')"
  [ -n "$dns" ] || die "Tailscale-Adresse nicht gefunden (tailscale status)."
  set_env ALLOWED_ORIGINS "https://$dns"
  set_env COOKIE_SECURE 1
  PUBLIC_URL="https://$dns"
}

PUBLIC_URL=""

say "Aethra einrichten: $(cat "$SRC/VERSION" 2>/dev/null || echo unbekannte Version)"
apt_install ca-certificates curl xz-utils
id -u "$RUN_USER" >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin "$RUN_USER"
mkdir -p "$APP" "$DATA" "$CONF"
chown "$RUN_USER:$RUN_USER" "$DATA"
chmod 750 "$DATA"

install_node

if has_systemd && systemctl is-active --quiet "$SERVICE"; then
  say "Laufenden Dienst anhalten (laufende Runs enden, Fortschritt bleibt)"
  systemctl stop "$SERVICE"
fi
say "Programmdateien kopieren"
rm -rf "$APP/dist" "$APP/public" "$APP/content"
cp -r "$SRC/dist" "$SRC/public" "$SRC/content" "$APP/"
cp "$SRC/package.json" "$SRC/package-lock.json" "$APP/"
cp "$SRC/VERSION" "$APP/" 2>/dev/null || true
install -m 755 "$SRC/aethra-admin" /usr/local/bin/aethra-admin
install_packages

if [ ! -f "$ENV_FILE" ]; then
  say "Einstellungen mit neuem Einladungscode anlegen ($ENV_FILE)"
  code="$("$NODE" -e "const a='ABCDEFGHJKMNPQRSTUVWXYZ23456789';console.log(Array.from({length:8},()=>a[require('crypto').randomInt(a.length)]).join(''))")"
  secret="$("$NODE" -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  cat > "$ENV_FILE" <<EOF
# Aethra-Einstellungen (README, Abschnitt Umgebungsvariablen). Werte ohne Leerzeichen.
# Nach Änderungen: sudo systemctl restart aethra
INVITE_CODE=$code
SESSION_SECRET=$secret
PORT=3000
DB_PATH=$DATA/aethra.db
BACKUP_DIR=$DATA/backups
PUBLIC_DIR=$APP/public
CONTENT_DIR=$APP/content
LOG_LEVEL=info
EOF
fi
chown "root:$RUN_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

if [ "$FUNNEL" = ask ]; then
  if [ -n "$(get_env ALLOWED_ORIGINS)" ]; then
    FUNNEL=no
    PUBLIC_URL="$(get_env ALLOWED_ORIGINS)"
  elif [ -t 0 ]; then
    read -r -p $'\nSoll das Spiel über Tailscale Funnel von überall erreichbar sein (Büro, mobile Daten)? [J/n] ' answer
    case "${answer:-j}" in [nN]*) FUNNEL=no ;; *) FUNNEL=yes ;; esac
  else
    FUNNEL=no
  fi
fi
[ "$FUNNEL" = yes ] && setup_funnel

if has_systemd; then
  say "Dienst einrichten und starten"
  install -m 644 "$SRC/aethra.service" "/etc/systemd/system/$SERVICE.service"
  systemctl daemon-reload
  systemctl enable --quiet "$SERVICE"
  systemctl restart "$SERVICE"
  wait_healthy || die "Der Server antwortet nicht. Protokoll ansehen: journalctl -u $SERVICE -n 50"
else
  say "Kein systemd gefunden: Server bitte von Hand starten"
  echo "  sudo -u $RUN_USER env \$(grep -v '^#' $ENV_FILE | xargs) $NODE $APP/dist/main.js"
fi

port="$(get_env PORT)"
lan="$(hostname -I 2>/dev/null | awk '{print $1}')"
line="────────────────────────────────────────────────────────────────"
printf '\n%s\n  Aethra ist eingerichtet.\n' "$line"
if [ -n "$PUBLIC_URL" ]; then
  echo "  Adresse:        $PUBLIC_URL   (überall, auch im Heimnetz diese benutzen)"
else
  echo "  Adresse:        http://$(hostname).local:${port:-3000}   (nur im Heimnetz)"
  [ -n "$lan" ] && echo "                  http://$lan:${port:-3000}"
fi
echo "  Einladungscode: $(get_env INVITE_CODE)"
echo "  Protokoll:      journalctl -u $SERVICE -f"
echo "  Verwaltung:     sudo aethra-admin help"
printf '%s\n\n' "$line"
