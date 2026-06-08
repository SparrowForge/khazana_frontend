"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import { fetchVatOrders, type VatOrder } from "./server";
import { formatDate } from "@/lib/utils";

export default function VatOrdersPage() {
  const [orders, setOrders] = useState<VatOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVatOrders().then(setOrders).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <PageHeader title="VAT Orders" subtitle="Pre-orders with VAT" />
      <Table loading={loading} data={orders}
        columns={[
          { key: "serialNo", header: "Order No" },
          { key: "clientCode", header: "Customer" },
          { key: "orderDate", header: "Order Date", render: (r) => formatDate(r.orderDate) },
          { key: "deliveryDate", header: "Delivery Date", render: (r) => formatDate(r.deliveryDate) },
        ]}
      />
    </AppLayout>
  );
}
