import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const bdn = await prisma.bunkerDeliveryNote.findFirst({
    where: { deliveryId: id, delivery: { site: { organizationId: user.organizationId } } },
  });
  if (!bdn?.pdfBlob) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(Buffer.from(bdn.pdfBlob), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bdn.number}.pdf"`,
    },
  });
}
