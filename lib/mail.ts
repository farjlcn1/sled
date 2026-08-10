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
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}
