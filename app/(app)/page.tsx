import { requireUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <div className="flex-1 p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Pozdravljen, {user.fullName}
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Temelj aplikacije Sledenje je postavljen — zavihki (Vozila, Vozniki, Poročila, Uporabniki) sledijo.
      </p>
    </div>
  );
}
