import "server-only";

const PHOTON_URL = process.env.PHOTON_URL || "http://photon:2322";

export type PhotonFeature = {
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
  };
};

export function formatLabel(p: PhotonFeature["properties"]): string {
  const streetPart = [p.street ?? p.name, p.housenumber].filter(Boolean).join(" ");
  return [streetPart, p.postcode, p.city].filter(Boolean).join(", ");
}

// Zaokroži na ~11 m natančnosti -- veliko zaporednih GPS točk (npr. mirujoče vozilo) pade na isto
// zaokroženo koordinato, zato jih reverseGeocodeMany obravnava kot en sam klic Photon-u.
export function reverseGeocodeKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `${PHOTON_URL}/reverse?lat=${lat}&lon=${lon}&lang=sl`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;

    const data = (await res.json()) as { features?: PhotonFeature[] };
    const label = data.features?.[0] ? formatLabel(data.features[0].properties) : "";
    return label.length > 0 ? label : null;
  } catch {
    // Photon je lahko sredi prvega uvoza podatkov ali začasno nedosegljiv — naslov naj v tem
    // primeru manjka, ne pokvari cele strani.
    return null;
  }
}

// Vzporedno pridobi naslove za več točk hkrati, z dedupliciranjem po zaokroženi koordinati.
export async function reverseGeocodeMany(points: { lat: number; lon: number }[]): Promise<Map<string, string>> {
  const uniqueByKey = new Map<string, { lat: number; lon: number }>();
  for (const p of points) {
    const key = reverseGeocodeKey(p.lat, p.lon);
    if (!uniqueByKey.has(key)) uniqueByKey.set(key, p);
  }

  const entries = await Promise.all(
    Array.from(uniqueByKey.entries()).map(async ([key, p]) => [key, await reverseGeocode(p.lat, p.lon)] as const)
  );

  const result = new Map<string, string>();
  for (const [key, address] of entries) {
    if (address) result.set(key, address);
  }
  return result;
}
