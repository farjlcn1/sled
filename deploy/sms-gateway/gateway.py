#!/usr/bin/env python3
"""Unix-socket most med sledenje app (v Dockerju) in ModemManager na gostitelju.

Aplikacija nima in ne sme imeti neposrednega dostopa do /dev/ttyUSB* ali D-Bus vodila --
namesto tega odpre ta socket, pošlje eno vrstico JSON {"to": ..., "text": ...} in prejme
eno vrstico JSON nazaj. Ta proces sam govori z modemom prek `mmcli` (ModemManager že drži
napravo in pozna pravilna vrata), zato aplikacijski vsebnik ne potrebuje nobenih posebnih
pravic za strojno opremo.
"""
import asyncio
import json
import logging
import os
import re
import subprocess

SOCKET_PATH = "/run/sledenje-sms.sock"
MODEM_INDEX = "0"
LOG_PATH = "/var/log/sledenje-sms-gateway.log"

logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

send_lock = asyncio.Lock()


def normalize_number(raw: str) -> str:
    n = re.sub(r"[\s\-]", "", raw)
    if n.startswith("00"):
        n = "+" + n[2:]
    elif n.startswith("0"):
        # slovenska mobilna številka v lokalni obliki (npr. 051444489) -> E.164
        n = "+386" + n[1:]
    if not re.fullmatch(r"\+\d{8,15}", n):
        raise ValueError(f"neveljavna številka: {raw!r}")
    return n


def send_sms(number: str, text: str) -> None:
    escaped = text.replace("\\", "\\\\").replace("'", "'\\''")
    create = subprocess.run(
        ["mmcli", "-m", MODEM_INDEX, f"--messaging-create-sms=text='{escaped}',number='{number}'"],
        capture_output=True,
        text=True,
        timeout=20,
    )
    if create.returncode != 0:
        raise RuntimeError(f"create-sms ni uspel: {create.stderr.strip() or create.stdout.strip()}")

    match = re.search(r"/SMS/(\d+)", create.stdout)
    if not match:
        raise RuntimeError(f"nepričakovan izpis mmcli: {create.stdout.strip()}")
    sms_index = match.group(1)

    sent = subprocess.run(
        ["mmcli", "-s", sms_index, "--send"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if sent.returncode != 0 or "successfully sent" not in sent.stdout.lower():
        raise RuntimeError(f"pošiljanje ni uspelo: {sent.stderr.strip() or sent.stdout.strip()}")


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    raw = b""
    try:
        raw = await asyncio.wait_for(reader.readline(), timeout=5)
        req = json.loads(raw)
        number = normalize_number(str(req["to"]))
        text = str(req["text"])

        async with send_lock:
            await asyncio.get_running_loop().run_in_executor(None, send_sms, number, text)

        logging.info("poslano na %s (%d znakov)", number, len(text))
        response = {"ok": True}
    except Exception as e:
        logging.error("napaka za zahtevo %r: %s", raw, e)
        response = {"ok": False, "error": str(e)}

    try:
        writer.write((json.dumps(response) + "\n").encode())
        await writer.drain()
    finally:
        writer.close()


async def main() -> None:
    if os.path.exists(SOCKET_PATH):
        os.remove(SOCKET_PATH)
    server = await asyncio.start_unix_server(handle_client, path=SOCKET_PATH)
    # Aplikacijski vsebnik teče kot druga (ne-root) uporabniška enota kot ta proces,
    # zato mora biti socket dostopen vsem lokalnim procesom.
    os.chmod(SOCKET_PATH, 0o666)
    logging.info("SMS gateway posluša na %s", SOCKET_PATH)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
