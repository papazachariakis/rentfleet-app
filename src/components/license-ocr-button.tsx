"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";

export type LicenseOcrFields = {
  firstName?: string;
  lastName?: string;
  licenseNumber?: string;
  licenseCountry?: string;
  idDocumentNo?: string;
  afm?: string;
  licenseCategories?: string;
  licenseCategoryDetails?: {
    code: string;
    issued?: string;
    expiry?: string;
  }[];
  dateOfBirth?: string;
  licenseExpiry?: string;
  confidence?: string;
};

/** Συμπίεση σε JPEG ≤ maxEdge px / quality — αποφεύγει 413 & Groq 4MB base64. */
async function compressImageFile(
  file: File,
  maxEdge = 1600,
  quality = 0.72
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("NO_CANVAS");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  // Στόχος < ~1.2MB data URL (~0.9MB binary)
  while (dataUrl.length > 1_600_000 && q > 0.4) {
    q -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

export function LicenseOcrButton({
  onResult,
  onImages,
  publicMode = false,
}: {
  onResult: (fields: LicenseOcrFields) => void;
  /** Κρατάει τις φωτογραφίες για αποθήκευση PDF στην κράτηση */
  onImages?: (images: {
    frontImageDataUrl: string;
    backImageDataUrl: string;
  }) => void;
  publicMode?: boolean;
}) {
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function onPick(side: "front" | "back", file: File | undefined) {
    if (!file) return;
    if (file.size > 12_000_000) {
      setMsg("Μέγιστο 12MB ανά φωτογραφία");
      return;
    }
    try {
      setMsg(side === "front" ? "Συμπίεση μπροστά…" : "Συμπίεση πίσω…");
      const dataUrl = await compressImageFile(file);
      const nextFront = side === "front" ? dataUrl : frontUrl;
      const nextBack = side === "back" ? dataUrl : backUrl;
      if (side === "front") setFrontUrl(dataUrl);
      else setBackUrl(dataUrl);
      onImages?.({
        frontImageDataUrl: nextFront,
        backImageDataUrl: nextBack,
      });
      setMsg("");
    } catch {
      setMsg("Σφάλμα ανάγνωσης/συμπίεσης φωτογραφίας");
    }
  }

  async function runOcr() {
    if (!frontUrl) {
      setMsg("Βάλε πρώτα τη μπροστινή όψη");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/ocr/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontImageDataUrl: frontUrl,
          backImageDataUrl: backUrl || null,
          public: publicMode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || `Αποτυχία OCR (${res.status})`);
        return;
      }
      onResult(data.fields || {});
      onImages?.({
        frontImageDataUrl: frontUrl,
        backImageDataUrl: backUrl,
      });
      const cats = data.fields?.licenseCategories;
      const hasIdentity =
        data.fields?.firstName ||
        data.fields?.lastName ||
        data.fields?.licenseNumber ||
        data.fields?.afm;
      if (!hasIdentity && !cats) {
        setMsg(
          "Δεν διαβάστηκαν πεδία — δοκίμασε πιο καθαρή φωτογραφία με καλό φως"
        );
        return;
      }
      setMsg(
        cats
          ? `OK · ${cats} — διόρθωσε χειροκίνητα αν χρειάζεται`
          : `OK · συμπληρώθηκαν στοιχεία — έλεγξε/διόρθωσε τα πεδία${
              backUrl ? "" : " · βάλε και πίσω όψη για κατηγορίες/λήξεις"
            }`
      );
    } catch {
      setMsg("Σφάλμα δικτύου κατά την ανάγνωση");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={frontRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onPick("front", e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={backRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onPick("back", e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => frontRef.current?.click()}
        >
          {frontUrl ? "✓ Μπροστά" : "1. Μπροστά"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => backRef.current?.click()}
        >
          {backUrl ? "✓ Πίσω" : "2. Πίσω (κατηγορίες)"}
        </Button>
        <Button
          type="button"
          disabled={loading || !frontUrl}
          onClick={() => void runOcr()}
        >
          {loading ? "Ανάγνωση…" : "Ανάγνωση διπλώματος"}
        </Button>
      </div>
      {msg ? (
        <p
          className={
            msg.startsWith("OK")
              ? "text-xs text-emerald-700"
              : msg.includes("Συμπίεση")
                ? "text-xs text-muted"
                : "text-xs text-red-600"
          }
        >
          {msg}
        </p>
      ) : (
        <p className="text-xs text-muted">
          Μπροστά για στοιχεία · πίσω για κατηγορίες και λήξη κάθε κατηγορίας
        </p>
      )}
    </div>
  );
}
