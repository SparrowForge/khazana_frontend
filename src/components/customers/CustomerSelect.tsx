"use client";
import { useMemo } from "react";
import Select, { type SelectOption } from "@/components/ui/Select";

/** The shape every screen's customer type already satisfies — the pickers only
 *  ever need the three fields a customer is identified by, plus the address for
 *  the line shown under the field once one is picked. */
export interface CustomerLike {
  id: string | number;
  code: string;
  name: string;
  mobile?: string | null;
  address?: string | null;
}

interface Props {
  customers: readonly CustomerLike[];
  value: string;
  onChange: (value: string) => void;
  /** Which field the form holds. Most screens store the customer uuid; the VAT
   *  credit sale and the customer statement still key on the code. */
  valueBy?: "id" | "code";
  label?: string;
  placeholder?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * The one customer picker, used by every screen that bills, credits or reports
 * on a customer.
 *
 * Search matches the code, the name AND the contact no, because those are the
 * three things a customer is identified by at the counter — most often the
 * phone number, which is the only one they know by heart. The number is not in
 * the label (it would crowd the closed field on a till screen) but sits on the
 * row while the list is open, which is also what tells two Rahims apart.
 *
 * Always `searchable`, never the native dropdown: a customer book is long
 * enough that scrolling it is the wrong interaction even when the branch
 * currently has six rows in it.
 */
export default function CustomerSelect({
  customers, value, onChange, valueBy = "id", label = "Customer",
  placeholder = "Search by contact no, code or name...", error, className, disabled,
}: Props) {
  const options: SelectOption[] = useMemo(
    () =>
      customers.map((c) => {
        const mobile = c.mobile?.trim();
        const address = c.address?.trim();
        return {
          value: valueBy === "code" ? c.code : String(c.id),
          label: `${c.code} — ${c.name}`,
          // Contact no first: it is the most likely thing being typed, and the
          // most useful thing to read back when two rows share a name.
          hint: [mobile, address].filter(Boolean).join(" · ") || undefined,
          search: mobile,
        };
      }),
    [customers, valueBy],
  );

  return (
    <Select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      searchable
      options={options}
      placeholder={placeholder}
      error={error}
      className={className}
      disabled={disabled}
    />
  );
}
