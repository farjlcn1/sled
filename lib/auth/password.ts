import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomInt } from "crypto";

const BCRYPT_ROUNDS = 12;

export function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;

  const pick = (chars: string) => chars[randomInt(chars.length)];

  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 10 }, () => pick(all));
  const combined = [...required, ...rest];

  for (let i = combined.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Vsaj 8 znakov, vsaj 1 velika začetnica, vsaj 1 številka, vsaj 1 poseben znak.
export const passwordSchema = z
  .string()
  .min(8, "Geslo mora imeti vsaj 8 znakov")
  .regex(/[A-Z]/, "Geslo mora vsebovati vsaj eno veliko črko")
  .regex(/[0-9]/, "Geslo mora vsebovati vsaj eno številko")
  .regex(/[^A-Za-z0-9]/, "Geslo mora vsebovati vsaj en poseben znak");
