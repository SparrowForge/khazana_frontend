"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchOrder, fetchItems, fetchBranches, fetchCustomers,
  type OrderRecord, type AvailableItem, type BranchInfo, type Customer,
} from "@/app/orders/server";
import { buildOrderInvoiceData } from "@/lib/invoice/orderInvoice";
import type { OrderInvoiceData } from "@/lib/export/orderInvoiceDocument";
import { OrderCorporateInvoice } from "@/components/orders/OrderInvoiceDocument";
import { InvoicePrintStyles } from "@/components/sales/CreditInvoiceDocument";

export default function OrderInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<OrderInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchOrder(id), fetchItems(), fetchBranches(), fetchCustomers()])
      .then(([order, items, branches, customers]: [OrderRecord, AvailableItem[], BranchInfo[], Customer[]]) => {
        if (cancelled) return;
        setInv(buildOrderInvoiceData(order, { items, branches, customers }));
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100">
        <div className="text-gray-400 text-sm">Loading invoice…</div>
      </div>
    );
  }

  if (error || !inv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100">
        <div className="text-center">
          <p className="text-gray-500 mb-3">Order invoice not found.</p>
          <button onClick={() => router.push("/orders")} className="text-primary-700 underline text-sm">
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <InvoicePrintStyles format="corporate" />

      <div className="min-h-screen bg-sage-200 flex flex-col">
        <div className="no-print bg-white border-b border-sage-300 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => router.push("/orders")}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← Back to Orders
          </button>

          <h1 className="font-semibold text-gray-800">Advance Order Invoice — {inv.serialNo}</h1>

          <button
            onClick={() => window.print()}
            className="bg-primary-800 hover:bg-primary-700 text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors"
          >
            🖨 Print
          </button>
        </div>

        <div className="flex-1 flex items-start justify-center py-10 overflow-x-auto">
          <div className="shadow-2xl rounded-sm">
            <OrderCorporateInvoice inv={inv} />
          </div>
        </div>
      </div>
    </>
  );
}
