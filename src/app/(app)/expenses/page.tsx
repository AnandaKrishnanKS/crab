import { db } from "@/lib/db";
import { toISTDateString, toNumber } from "@/lib/format";
import { ExpensesManager, type ExpenseRow } from "@/components/expenses-manager";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [params, rawExpenses] = await Promise.all([
    searchParams,
    db.expense.findMany({ orderBy: { date: "desc" } }),
  ]);

  const now = new Date();
  const expenses: ExpenseRow[] = rawExpenses.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    ymKey: toISTDateString(e.date).slice(0, 7),
    category: e.category,
    amount: toNumber(e.amount),
    notes: e.notes,
  }));

  return (
    <ExpensesManager
      expenses={expenses}
      defaultDateYmd={toISTDateString(now)}
      initialOpenNew={params.new === "1"}
    />
  );
}
