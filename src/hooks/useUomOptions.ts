"use client";
import { useEffect, useState } from "react";
import { fetchAllUoms } from "@/app/inventory/uom/server";

/**
 * The units of measure an item form may offer.
 *
 * Units live in the Item_UOM table (Inventory → UOM), so adding one is an entry
 * the office makes rather than a code change. This list is the fallback used
 * until that fetch lands — and if it fails, or the table has not been created
 * yet, the form still works with the units the app shipped with.
 */
export const DEFAULT_UOM_OPTIONS = [
  { value: "Pcs", label: "Pcs" },
  { value: "Cup", label: "Cup" },
  { value: "gm", label: "gm" },
  { value: "KG", label: "KG" },
  { value: "LT", label: "LT" },
  { value: "ml", label: "ml" },
  { value: "Box", label: "Box" },
];

/**
 * Options for a UOM dropdown, from the table with the built-in list as backstop.
 *
 * The label is the code, not the name: the code is the string that lands on the
 * item and prints on every document, so that is what the picker must show. The
 * name is a description, and only the UOM screen displays it.
 */
export function useUomOptions(): { value: string; label: string }[] {
  const [options, setOptions] = useState(DEFAULT_UOM_OPTIONS);

  useEffect(() => {
    fetchAllUoms()
      .then((rows) => {
        if (rows.length) setOptions(rows.map((u) => ({ value: u.code, label: u.code })));
      })
      .catch(() => {}); // keep the built-in list
  }, []);

  return options;
}
