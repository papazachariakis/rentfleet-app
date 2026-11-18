"use client";

import { Button, Input, Label } from "@/components/ui";
import {
  formatLicenseCategoriesSummary,
  parseLicenseCategories,
  type ParsedLicenseCategory,
} from "@/lib/license-categories";

const EMPTY_ROW: ParsedLicenseCategory = {
  code: "",
  expiry: "",
  codes: [],
};

function rowsFromValue(value: string): ParsedLicenseCategory[] {
  const parsed = parseLicenseCategories(value);
  return parsed.length ? parsed : [{ ...EMPTY_ROW }];
}

export function LicenseCategoriesEditor({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
}) {
  const rows = rowsFromValue(value);

  function commit(next: ParsedLicenseCategory[]) {
    const cleaned = next
      .map((r) => ({
        code: r.code.trim().toUpperCase().replace(/\s+/g, ""),
        expiry: r.expiry?.trim() || undefined,
        codes: (r.codes || [])
          .map((c) => String(c).replace(/\D/g, ""))
          .filter(Boolean),
        automaticOnly: (r.codes || []).includes("78"),
      }))
      .filter((r) => r.code);
    onChange(formatLicenseCategoriesSummary(cleaned));
  }

  function updateRow(
    index: number,
    patch: Partial<ParsedLicenseCategory> & { codesText?: string }
  ) {
    const next = rows.map((r, i) => {
      if (i !== index) return r;
      const codes =
        patch.codesText !== undefined
          ? patch.codesText
              .split(/[,;\s]+/)
              .map((c) => c.replace(/\D/g, ""))
              .filter(Boolean)
          : r.codes;
      return {
        ...r,
        ...patch,
        codes,
      };
    });
    commit(next);
  }

  function addRow() {
    commit([...rows, { ...EMPTY_ROW }]);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    commit(next.length ? next : []);
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Κατηγορίες διπλώματος (επεξεργάσιμα)</Label>
        <Button type="button" variant="secondary" onClick={addRow}>
          + Κατηγορία
        </Button>
      </div>
      <p className="text-xs text-muted">
        Μετά το OCR μπορείς να διορθώσεις χειροκίνητα κωδικό, λήξη (ΕΕΕΕ-ΜΜ-ΗΗ)
        και κωδικούς στήλης 12 (π.χ. 78, 121).
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={`${i}-${row.code || "new"}`}
            className="grid gap-2 rounded-lg border border-border bg-surface/50 p-2 sm:grid-cols-[5.5rem_1fr_1fr_auto]"
          >
            <div>
              <Label>Κωδ.</Label>
              <Input
                value={row.code}
                onChange={(e) =>
                  updateRow(i, { code: e.target.value.toUpperCase() })
                }
                placeholder="B"
              />
            </div>
            <div>
              <Label>Λήξη</Label>
              <Input
                type="date"
                value={row.expiry || ""}
                onChange={(e) => updateRow(i, { expiry: e.target.value })}
              />
            </div>
            <div>
              <Label>Κωδ. 12</Label>
              <Input
                value={(row.codes || []).join(",")}
                onChange={(e) => updateRow(i, { codesText: e.target.value })}
                placeholder="78,121"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => removeRow(i)}
              >
                ✕
              </Button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
