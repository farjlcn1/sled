#!/bin/bash
# En-samkraten setup skript za samostojen odhodni mail rele (Postfix + OpenDKIM) za sled/teren.
# Zagnati z: sudo bash setup.sh
# (sudo v tem okolju zahteva pravi terminal -- glej AGENTS.md/memory, zato tega ne more pognati Claude sam.)
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Zaženi s sudo: sudo bash setup.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== Namescam pakete (postfix, opendkim) =="
debconf-set-selections <<< "postfix postfix/main_mailer_type select No configuration"
debconf-set-selections <<< "postfix postfix/mailname string mail.farjolcn.com"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postfix opendkim opendkim-tools

echo "== Namescam Postfix konfiguracijo =="
cp "$SCRIPT_DIR/main.cf" /etc/postfix/main.cf
cp "$SCRIPT_DIR/mail.farjolcn.com.crt" /etc/postfix/mail.farjolcn.com.crt
cp "$SCRIPT_DIR/mail.farjolcn.com.key" /etc/postfix/mail.farjolcn.com.key
chmod 644 /etc/postfix/mail.farjolcn.com.crt
chmod 600 /etc/postfix/mail.farjolcn.com.key
chown root:root /etc/postfix/mail.farjolcn.com.key

echo "== Namescam OpenDKIM konfiguracijo in kljuc =="
mkdir -p /etc/opendkim/keys/farjolcn.com
cp "$SCRIPT_DIR/opendkim.conf" /etc/opendkim.conf
cp "$SCRIPT_DIR/TrustedHosts" /etc/opendkim/TrustedHosts
cp "$SCRIPT_DIR/KeyTable" /etc/opendkim/KeyTable
cp "$SCRIPT_DIR/SigningTable" /etc/opendkim/SigningTable
cp "$SCRIPT_DIR/dkim-keys/mail.private" /etc/opendkim/keys/farjolcn.com/mail.private
chown -R opendkim:opendkim /etc/opendkim/keys
chmod 700 /etc/opendkim/keys/farjolcn.com
chmod 600 /etc/opendkim/keys/farjolcn.com/mail.private

# Postfix (uporabnik "postfix") mora dostopati do OpenDKIM socketa -- pri inet:127.0.0.1:8891
# (ne unix socket) to ni vprasanje datotecnih pravic, samo da OpenDKIM dejansko poslusa tam.

echo "== Omogocam in zaganjam storitve =="
# restart (ne samo "enable --now") -- da se ob morebitnem ponovnem zagonu tega skripta zares
# naloži sveže skopirana konfiguracija, tudi če je storitev od prej že tekla.
systemctl enable opendkim postfix
systemctl restart opendkim
systemctl restart postfix

echo ""
echo "== Preverjanje =="
postfix check && echo "postfix check: OK"
systemctl is-active --quiet postfix && echo "postfix: aktiven" || echo "POZOR: postfix ni aktiven, preveri: journalctl -u postfix -n 50"
systemctl is-active --quiet opendkim && echo "opendkim: aktiven" || echo "POZOR: opendkim ni aktiven, preveri: journalctl -u opendkim -n 50"

echo ""
echo "== DDNS za mail.farjolcn.com (Cloudflare) =="
read -rsp "Vnesi Cloudflare API žeton (Zone:DNS:Edit za farjolcn.com), ali pusti prazno za preskok: " CF_TOKEN
echo ""
if [ -n "$CF_TOKEN" ]; then
  mkdir -p /etc/mail-ddns
  printf '%s' "$CF_TOKEN" > /etc/mail-ddns/cloudflare-token
  chmod 600 /etc/mail-ddns/cloudflare-token
  mkdir -p /opt/mail-ddns
  cp "$SCRIPT_DIR/mail-ddns-update.py" /opt/mail-ddns/mail-ddns-update.py
  cp "$SCRIPT_DIR/mail-ddns.service" /etc/systemd/system/mail-ddns.service
  cp "$SCRIPT_DIR/mail-ddns.timer" /etc/systemd/system/mail-ddns.timer
  systemctl daemon-reload
  systemctl enable --now mail-ddns.timer
  systemctl start mail-ddns.service
  sleep 2
  systemctl status --no-pager mail-ddns.service | head -15
else
  echo "Preskočeno -- mail.farjolcn.com A-zapis boš moral vnesti/vzdrževati ročno v Cloudflareu."
fi

echo ""
echo "=================================================================="
echo "Postfix + OpenDKIM nastavljena. Naslednji koraki (NISO del tega skripta):"
echo ""
echo "1. V Cloudflare DNS za farjolcn.com dodaj TXT zapis:"
echo "   Ime:  mail._domainkey"
echo "   Vsebina:"
echo -n "   v=DKIM1; k=rsa; p="
cat "$SCRIPT_DIR/dkim-keys/mail.pub.b64"
echo ""
echo "2. V Cloudflare DNS za farjolcn.com dodaj še TXT zapis (SPF):"
echo "   Ime:  @"
echo "   Vsebina:  v=spf1 a:mail.farjolcn.com ~all"
echo ""
echo "3. In TXT zapis (DMARC, začni z p=none dokler ne preveriš, da vse dela):"
echo "   Ime:  _dmarc"
echo "   Vsebina:  v=DMARC1; p=none; rua=mailto:TVOJ-OBSTOJEC-EMAIL"
echo "   (TVOJ-OBSTOJEC-EMAIL naj bo pravi, dosegljiv naslov (npr. tvoj Gmail) -- na farjolcn.com"
echo "   se noben mail ne SPREJEMA, zato bi postmaster@farjolcn.com samo tiho spodletel.)"
echo ""
echo "4. Pri ponudniku interneta (Mega M) uredi PTR (obratni DNS) zapis za tvoj javni IP,"
echo "   naj kaže na mail.farjolcn.com -- brez tega bo Gmail/Outlook pošto verjetno zavračal"
echo "   ne glede na SPF/DKIM/DMARC. Vprašaj tudi, ali imaš (ali lahko dobiš) stalen (static) IP."
echo "=================================================================="
