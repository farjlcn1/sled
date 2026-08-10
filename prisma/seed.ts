import "dotenv/config";
import { randomInt } from "crypto";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function generateStrongPassword(): string {
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

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) {
    console.error("SEED_ADMIN_EMAIL ni nastavljen — glej .env.example.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Uporabnik ${email} že obstaja, preskačem seed.`);
    return;
  }

  const password = generateStrongPassword();
  const passwordHash = await hashPassword(password);

  // Prvi uporabnik je uporabnik administracije (brez tenantId) - upravlja vsa podjetja/naprave.
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: "Admin",
      isActive: true,
      canManagePlatform: true,
      canManageUsers: true,
      canManageVehicles: true,
      canManageDrivers: true,
      canViewReports: true,
    },
  });

  console.log("Ustvarjen prvi superuser administracije:");
  console.log(`  email:  ${user.email}`);
  console.log(`  geslo:  ${password}`);
  console.log("Geslo si shrani in ga po prvi prijavi zamenjaj.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
