import { connect } from "node:net";

// Vidno za gostiteljski most (deploy/sms-gateway/gateway.py) prek Unix socketa -- glej
// docker-compose.yml, kjer je ta pot vklopljena v vsebnik. Sam vsebnik nima dostopa do
// modema, samo do tega socketa.
const SOCKET_PATH = process.env.SMS_GATEWAY_SOCKET ?? "/run/sledenje-sms.sock";

export type SmsResult = { ok: true } | { ok: false; error: string };

export function sendSms(to: string, text: string): Promise<SmsResult> {
  return new Promise((resolve) => {
    let settled = false;
    function finish(result: SmsResult) {
      if (settled) return;
      settled = true;
      resolve(result);
    }

    const socket = connect(SOCKET_PATH);
    let data = "";

    socket.setTimeout(15_000);
    socket.on("timeout", () => {
      socket.destroy();
      finish({ ok: false, error: "Časovna omejitev pri povezavi s SMS prehodom." });
    });
    socket.on("error", (err) => {
      finish({ ok: false, error: `SMS prehod ni dosegljiv: ${err.message}` });
    });
    socket.on("connect", () => {
      socket.write(JSON.stringify({ to, text }) + "\n");
    });
    socket.on("data", (chunk) => {
      data += chunk.toString();
    });
    socket.on("close", () => {
      if (settled) return;
      try {
        finish(JSON.parse(data));
      } catch {
        finish({ ok: false, error: "Neveljaven odgovor SMS prehoda." });
      }
    });
  });
}
