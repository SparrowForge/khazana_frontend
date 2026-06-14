"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import { posSalesApi, type PosSale } from "@/lib/services/pos.service";
import toast from "react-hot-toast";

function formatDT(iso: string) {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${h}:${min} ${ampm}`;
}

export default function PosSalesListPage() {
  const router = useRouter();
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    posSalesApi.getAll()
      .then(setSales)
      .catch(() => toast.error("Failed to load sales"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <PageHeader title="POS Sales" subtitle="All billing transactions" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
        ) : sales.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No sales yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Invoice No</th>
                <th className="px-5 py-3 text-left font-medium">Date & Time</th>
                <th className="px-5 py-3 text-left font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">VAT</th>
                <th className="px-5 py-3 text-right font-medium">Payable</th>
                <th className="px-5 py-3 text-left font-medium">Served By</th>
                <th className="px-5 py-3 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono font-bold text-primary-700">{s.invoiceNo}</td>
                  <td className="px-5 py-3 text-gray-600">{formatDT(s.dateTime)}</td>
                  <td className="px-5 py-3 text-gray-600">{s.salesType}</td>
                  <td className="px-5 py-3 text-right text-gray-700">৳{Number(s.totalAmount).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">৳{Number(s.vatAmount).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800">৳{Number(s.payableAmount).toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-600">{s.servedBy}</td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => router.push(`/pos/invoice/${s.id}`)}
                      className="text-primary-700 hover:underline text-xs font-medium"
                    >
                      View Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
