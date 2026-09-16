import { formatDeliveryTime, type AvailableItem, type BranchInfo, type Customer, type OrderRecord } from "@/app/orders/server";
import type { OrderInvoiceData, OrderInvoiceLine } from "@/lib/export/orderInvoiceDocument";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Builds the invoice payload from a loaded order — the same shape the
 *  thermal receipt, the A4 corporate print and the Excel export all read
 *  from, so a figure never has to be worked out twice. */
export function buildOrderInvoiceData(
  order: OrderRecord,
  { items, branches, customers }: { items: AvailableItem[]; branches: BranchInfo[]; customers: Customer[] },
): OrderInvoiceData {
  const branch = branches.find((b) => b.id === order.branchId);
  const customer = customers.find((c) => c.id === order.clientId);
  const grandTotal = order.totalPrice ?? 0;
  const discPercent = order.discount ?? 0;
  const orderItems: OrderInvoiceLine[] = (order.details ?? []).map((d) => {
    const item = items.find((it) => it.id === d.itemId);
    const itemVat = d.qty * (d.unitPrice ?? 0) * ((item?.vatPercentage ?? 0) / 100);
    return {
      itemName: item?.itmName ?? d.itemId ?? "-",
      qty: d.qty,
      rate: d.unitPrice ?? 0,
      vat: itemVat,
      total: d.qty * (d.unitPrice ?? 0),
    };
  });
  const vatAmount = r2(orderItems.reduce((s, i) => s + i.vat, 0));
  // Discount applies to the VAT-inclusive gross — same basis the order form uses.
  const gross = r2(grandTotal + vatAmount);
  const discAmount = Math.min(r2(gross * (discPercent / 100)), gross);
  const totalPayable = r2(gross - discAmount);
  const advance = order.advance ?? 0;
  return {
    branchName: branch?.branchName,
    branchAddress: branch?.address,
    branchVatNo: branch?.vatNo,
    branchMobile: branch?.mobileNo,
    orderDate: order.orderDate ?? new Date().toISOString(),
    deliveryDate: order.deliveryDate,
    deliveryTime: formatDeliveryTime(order.deliveryTime),
    deliveryAddress: order.deliveryAddress,
    remarks: order.remarks,
    serialNo: order.serialNo ?? String(order.id),
    customerName: customer?.name ?? order.clientId ?? "-",
    servedBy: order.createBy,
    items: orderItems,
    totalAmount: grandTotal,
    vatAmount,
    discountPercent: discPercent,
    discountAmount: discAmount,
    totalPayable,
    advance,
    totalDue: totalPayable - advance,
  };
}
