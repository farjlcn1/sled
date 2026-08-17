#!/usr/bin/env python3
"""Posodobi DNS A-zapis gps.farjolcn.com na Cloudflaru, če se je javni IP spremenil.

GPS naprave se bodo povezovale na to ime namesto na goli IP, ker domača linija nima
statičnega naslova. Teče periodično prek sledenje-ddns.timer -- ni trajen proces, zato
ni notranje zanke/retry logike; naslednji tik timerja pokrije morebiten prehoden izpad.
"""
import json
import logging
import os
import urllib.request

ZONE_NAME = "farjolcn.com"
RECORD_NAME = "gps.farjolcn.com"
API_BASE = "https://api.cloudflare.com/client/v4"

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def read_token() -> str:
    cred_dir = os.environ["CREDENTIALS_DIRECTORY"]
    with open(os.path.join(cred_dir, "cf-token")) as f:
        return f.read().strip()


def cf_request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{API_BASE}{path}", data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.load(resp)
    if not result.get("success"):
        raise RuntimeError(f"Cloudflare API napaka za {method} {path}: {result.get('errors')}")
    return result


def current_public_ip() -> str:
    with urllib.request.urlopen("https://api.ipify.org?format=json", timeout=10) as resp:
        return json.load(resp)["ip"]


def main() -> None:
    token = read_token()
    ip = current_public_ip()

    zones = cf_request("GET", f"/zones?name={ZONE_NAME}", token)["result"]
    if not zones:
        raise RuntimeError(f"cona {ZONE_NAME} ni najdena za ta API žeton")
    zone_id = zones[0]["id"]

    records = cf_request("GET", f"/zones/{zone_id}/dns_records?type=A&name={RECORD_NAME}", token)["result"]

    # proxied=False je nujen -- GPS naprave se povezujejo s surovim TCP na vratih 5027,
    # Cloudflarov proxy pa (poleg tega, da podpira samo HTTP(S)) naslov tako ali tako
    # zamenja s svojim robnim IP-jem, kar bi povezavo do domačega strežnika onemogočilo.
    if not records:
        cf_request(
            "POST",
            f"/zones/{zone_id}/dns_records",
            token,
            {"type": "A", "name": RECORD_NAME, "content": ip, "ttl": 300, "proxied": False},
        )
        logging.info("ustvarjen zapis %s -> %s", RECORD_NAME, ip)
        return

    record = records[0]
    if record["content"] == ip:
        logging.info("%s že kaže na %s, brez spremembe", RECORD_NAME, ip)
        return

    cf_request(
        "PUT",
        f"/zones/{zone_id}/dns_records/{record['id']}",
        token,
        {"type": "A", "name": RECORD_NAME, "content": ip, "ttl": 300, "proxied": False},
    )
    logging.info("posodobljen %s: %s -> %s", RECORD_NAME, record["content"], ip)


if __name__ == "__main__":
    main()
