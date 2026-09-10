import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { number: true } });
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  const buffer = await generateInvoicePdf(id);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="racun-${invoice.number}.pdf"`,
    },
  });
}
