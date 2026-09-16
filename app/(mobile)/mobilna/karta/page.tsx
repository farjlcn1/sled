import { KartaClient } from "./karta-client";

export default async function KartaPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;
  return <KartaClient initialVehicleId={vehicleId ?? null} />;
}
