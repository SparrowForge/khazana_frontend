"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/api";
import { createCustomer, type Customer } from "@/app/customers/server";

const emptyForm = { name: "", mobile: "", email: "", address: "", defaultDiscount: "0" };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Receives the saved customer so the caller can select it straight away. */
  onCreated?: (customer: Customer) => void | Promise<void>;
}

/**
 * Registers a walk-in customer from the invoice screen. The code is allocated
 * server-side (C-nnnn), so it isn't asked for — same as the Customers page.
 */
export default function CustomerQuickAddModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(emptyForm); }, [open]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.mobile.trim()) {
      toast.error("Name and mobile are required");
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomer({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        // Standing discount for this customer — the invoice this modal was
        // opened from picks it up as soon as the new customer is selected.
        defaultDiscount: Math.min(Math.max(parseFloat(form.defaultDiscount || "0") || 0, 0), 100),
      });
      toast.success(`${form.name.trim()} added`);
      onClose();
      await onCreated?.(created);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create customer"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Customer">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Code" value="" placeholder="Auto-generated" disabled readOnly />
        <Input label="Name *" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Mobile *" value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        <Input label="Email" type="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Address" value={form.address} className="col-span-2"
          onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <Input label="Default Discount (%)" type="number" min={0} max={100} step="0.01"
          value={form.defaultDiscount}
          onChange={(e) => setForm({ ...form, defaultDiscount: e.target.value })} />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Create Customer</Button>
      </div>
    </Modal>
  );
}
