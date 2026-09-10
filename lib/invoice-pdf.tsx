import "server-only";
import path from "path";
import { Document, Page, View, Text, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { invoicePeriodLabel } from "@/lib/invoice";

// Standardni (ne-registrirani) Helvetica v @react-pdf/renderer tiho POPAČI slovenske šumnike
// (empirično preverjeno: "Račun" se izriše kot "Raun") -- zato registriramo Geist, ki ga Next.js
// že sam vključuje za next/og (ImageResponse) in NIMA te napake. Ista datoteka je registrirana
// pod "normal" in "bold" težo (nima ločene bold različice) -- vizualno torej ni odebeljeno, a
// besedilo ostane pravilno namesto tihe izgube črk, kar je za račun pomembnejše.
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"), fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 46, fontSize: 10.5, fontFamily: "Geist", color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: "bold" },
  subtitle: { fontSize: 10, marginTop: 2, color: "#555" },
  issuerBlock: { alignItems: "flex-end" },
  issuerLine: { fontSize: 9, color: "#555" },
  headerRule: { borderBottomWidth: 2, borderBottomColor: "#111", marginBottom: 14 },
  section: { marginBottom: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 4, padding: 10 },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#333",
  },
  row: { flexDirection: "row", marginBottom: 5 },
  label: { width: 130, color: "#666" },
  value: { flex: 1, fontWeight: "bold" },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#eee" },
  colImei: { width: 160 },
  colPlan: { flex: 1 },
  colPrice: { width: 80, textAlign: "right" },
  tableHeaderText: { fontWeight: "bold", fontSize: 9, color: "#666", textTransform: "uppercase" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#111",
  },
  totalLabel: { fontSize: 12, fontWeight: "bold", marginRight: 16 },
  totalValue: { fontSize: 12, fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#999",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 6,
  },
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function money(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { tenant: true, lines: true },
  });

  const issuerName = process.env.INVOICE_ISSUER_NAME ?? "—";
  const issuerAddress = process.env.INVOICE_ISSUER_ADDRESS ?? "—";
  const issuerTaxId = process.env.INVOICE_ISSUER_TAX_ID ?? "—";
  const issuerIban = process.env.INVOICE_ISSUER_IBAN ?? "—";

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Račun {invoice.number}</Text>
            <Text style={styles.subtitle}>
              Obdobje: {invoicePeriodLabel(invoice.periodYear, invoice.periodMonth)}
            </Text>
            <Text style={styles.subtitle}>Datum izdaje: {invoice.createdAt.toLocaleDateString("sl-SI")}</Text>
          </View>
          <View style={styles.issuerBlock}>
            <Text style={styles.issuerLine}>{issuerName}</Text>
            <Text style={styles.issuerLine}>{issuerAddress}</Text>
            <Text style={styles.issuerLine}>Davčna št.: {issuerTaxId}</Text>
            <Text style={styles.issuerLine}>TRR: {issuerIban}</Text>
          </View>
        </View>
        <View style={styles.headerRule} />

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Prejemnik</Text>
          <Field label="Podjetje" value={invoice.tenant.name} />
          {invoice.tenant.billingAddress && <Field label="Naslov" value={invoice.tenant.billingAddress} />}
          {invoice.tenant.taxId && <Field label="Davčna št." value={invoice.tenant.taxId} />}
          {invoice.tenant.billingEmails.length > 0 && (
            <Field label="E-pošta" value={invoice.tenant.billingEmails.join(", ")} />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Postavke</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={{ ...styles.colImei, ...styles.tableHeaderText }}>IMEI</Text>
            <Text style={{ ...styles.colPlan, ...styles.tableHeaderText }}>Paket</Text>
            <Text style={{ ...styles.colPrice, ...styles.tableHeaderText }}>Cena</Text>
          </View>
          {invoice.lines.map((line) => (
            <View key={line.id} style={styles.tableRow}>
              <Text style={styles.colImei}>{line.deviceImei}</Text>
              <Text style={styles.colPlan}>{line.planName}</Text>
              <Text style={styles.colPrice}>{money(line.priceCents)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Skupaj:</Text>
            <Text style={styles.totalValue}>{money(invoice.totalCents)}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{issuerName}</Text>
          <Text render={({ pageNumber, totalPages }) => `Stran ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
