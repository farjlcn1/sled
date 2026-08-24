import "server-only";
import nodemailer from "nodemailer";

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP ni nastavljen (manjka SMTP_HOST).");

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    // Rele uporablja samo-podpisan certifikat (glej deploy/mail-relay/) -- v redu je, ker je ta
    // povezava zaupana po omrežni poti (Docker bridge, ne internet), ne po identiteti
    // certifikata. Node privzeto (tudi pri opportunistic STARTTLS) zavrne samo-podpisan
    // certifikat, zato tu preverjanje verige izklopimo samo za TA lokalni rele.
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}
