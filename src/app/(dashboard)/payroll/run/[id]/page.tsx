import { getPayrollRun } from "@/lib/actions/payroll";
import { notFound } from "next/navigation";
import { PayrollRunClient } from "./PayrollRunClient";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getPayrollRun(id);
  if (!run) notFound();
  return <PayrollRunClient run={run} />;
}
