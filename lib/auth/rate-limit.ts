// Preprost, v pomnilniku hranjen števec neuspelih prijav po emailu -- brez tega bi lahko
// nekdo neomejeno avtomatizirano preizkušal gesla (npr. uhajala iz drugih vdorov) proti
// enemu znanemu emailu. Namerno preverjeno PRED poizvedbo v bazo, da se ista zaklenitev
// uporabi ne glede na to, ali email sploh pripada obstoječemu uporabniku (ne razkrije obstoja
// računa). V pomnilniku (ne v bazi) je dovolj -- aplikacija teče kot en sam proces, zaklenitev
// pa se ob morebitnem restartu preprosto ponastavi, kar je sprejemljivo za ta namen.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const attempts = new Map<string, { count: number; lockedUntil: number | null }>();

export function checkLoginRateLimit(email: string): { blocked: boolean; message?: string } {
  const entry = attempts.get(email);
  if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    return { blocked: true, message: `Preveč neuspelih poskusov prijave. Poskusi znova čez ${minutesLeft} min.` };
  }
  return { blocked: false };
}

export function recordLoginFailure(email: string): void {
  const entry = attempts.get(email) ?? { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
  }
  attempts.set(email, entry);
}

export function recordLoginSuccess(email: string): void {
  attempts.delete(email);
}
