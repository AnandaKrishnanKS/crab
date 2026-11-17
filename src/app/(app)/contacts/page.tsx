import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import {
  ContactsManager,
  type BuyerRow,
  type SupplierRow,
} from "@/components/contacts-manager";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const [rawSuppliers, rawBuyers] = await Promise.all([
    db.supplier.findMany({
      include: {
        batches: {
          orderBy: { purchaseDate: "desc" },
          include: {
            crabs: { select: { purchaseCost: true } },
          },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.buyer.findMany({
      include: {
        sales: {
          orderBy: { date: "desc" },
          include: {
            crab: { select: { id: true, code: true } },
          },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);

  const suppliers: SupplierRow[] = rawSuppliers.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    location: s.location,
    notes: s.notes,
    active: s.active,
    batches: s.batches.map((b) => ({
      id: b.id,
      letter: b.letter,
      purchaseDate: b.purchaseDate.toISOString(),
      pricePerKg: b.pricePerKg !== null ? toNumber(b.pricePerKg) : null,
      crabCount: b.crabs.length,
      totalSpend: b.crabs.reduce((sum, c) => sum + toNumber(c.purchaseCost), 0),
    })),
  }));

  const buyers: BuyerRow[] = rawBuyers.map((b) => ({
    id: b.id,
    name: b.name,
    phone: b.phone,
    location: b.location,
    notes: b.notes,
    active: b.active,
    sales: b.sales.map((sale) => ({
      id: sale.id,
      crabId: sale.crab.id,
      crabCode: sale.crab.code,
      date: sale.date.toISOString(),
      weightG: sale.weightG,
      pricePerKg: toNumber(sale.pricePerKg),
      totalAmount: toNumber(sale.totalAmount),
      paymentStatus: sale.paymentStatus,
    })),
  }));

  return <ContactsManager suppliers={suppliers} buyers={buyers} />;
}
