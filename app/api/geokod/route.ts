import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { formatLabel, type PhotonFeature } from "@/lib/photon";

const PHOTON_URL = process.env.PHOTON_URL || "http://photon:2322";

// Notranji proxy do Photon geokodera (samostojen Docker servis, brez zunanjega API-ja) —
// brskalnik ne kliče Photon-a neposredno, ker ni izpostavljen izven docker omrežja.
export async function GET(req: NextRequest) {
  await requireUser();

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ results: [] });

  try {
    const url = `${PHOTON_URL}/api?q=${encodeURIComponent(q)}&lang=sl&limit=8&lat=46.05&lon=14.5&zoom=8`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = (await res.json()) as { features?: PhotonFeature[] };
    const results = (data.features ?? [])
      .map((f) => formatLabel(f.properties))
      .filter((label) => label.length > 0);

    return NextResponse.json({ results });
  } catch {
    // Photon je lahko sredi prvega uvoza podatkov ali začasno nedosegljiv — polje naj
    // v tem primeru ostane navadno besedilno, ne pokvari cele forme.
    return NextResponse.json({ results: [] });
  }
}
