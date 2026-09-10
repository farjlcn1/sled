// Mesečni obračun -- teče prek sledenje-billing.timer (glej deploy/billing/), enkrat na mesec.
// Ustvari (ali, če za to obdobje še ni bil poslan, posodobi) račun za vsako aktivno podjetje z
// vsaj enim zaračunljivim vozilom (glej generateInvoiceForTenant) in ga -- če ima podjetje
// autoSendInvoice + vsaj en billingEmails naslov nastavljen (urejeno v zavihku Podjetja) --
// takoj tudi pošlje na VSE te naslove naenkrat. Ročni "Ustvari/prenesi" gumb v zavihku
// Zaračunavanje kliče isto generateInvoiceForTenant funkcijo, zato je vedenje (izbor vozil, kdaj
// se prepiše) povsod enako.
import "dotenv/config";
import { prisma } from "../lib/db";
import { generateInvoiceForTenant } from "../lib/invoice";
import { generateInvoicePdf } from "../lib/invoice-pdf";
import { sendMail, isMailConfigured } from "../lib/mail";

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const tenants = await prisma.tenant.findMany({ where: { status: "AKTIVEN" } });
  console.log(`Mesečni obračun ${year}-${String(month).padStart(2, "0")}: ${tenants.length} aktivnih podjetij.`);

  for (const tenant of tenants) {
    const result = await generateInvoiceForTenant(tenant.id, year, month);
    if ("error" in result) {
      console.log(`${tenant.name}: preskočeno -- ${result.error}`);
      continue;
    }
    console.log(
      result.status === "created"
        ? `${tenant.name}: ustvarjen račun (${result.invoiceId}).`
        : `${tenant.name}: račun za to obdobje že obstaja, posodobljen glede na trenutno stanje vozil (${result.invoiceId}).`
    );

    if (!tenant.autoSendInvoice || tenant.billingEmails.length === 0) continue;
    if (!isMailConfigured()) {
      console.log(`${tenant.name}: SMTP ni nastavljen, e-pošta ni bila poslana.`);
      continue;
    }

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: result.invoiceId },
      select: { number: true },
    });
    const pdf = await generateInvoicePdf(result.invoiceId);
    await sendMail({
      to: tenant.billingEmails.join(", "),
      subject: `Račun ${invoice.number} -- ${tenant.name}`,
      text: "V prilogi je mesečni račun za storitev sledenja vozil.",
      attachments: [{ filename: `racun-${invoice.number}.pdf`, content: pdf }],
    });
    await prisma.invoice.update({ where: { id: result.invoiceId }, data: { sentAt: new Date() } });
    console.log(`${tenant.name}: račun poslan na ${tenant.billingEmails.join(", ")}.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
