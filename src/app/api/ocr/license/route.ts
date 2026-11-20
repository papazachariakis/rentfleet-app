import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { canWriteOps } from "@/lib/permissions";
import { ocrDriversLicense } from "@/lib/ocr-license";
import { publicOptions, withPublicCors } from "@/lib/public-cors";

const schema = z.object({
  imageDataUrl: z.string().min(32).max(6_000_000).optional(),
  frontImageDataUrl: z.string().min(32).max(6_000_000).optional(),
  backImageDataUrl: z.string().min(32).max(6_000_000).optional().nullable(),
});

export async function OPTIONS(req: Request) {
  return publicOptions(req);
}

export async function POST(req: Request) {
  const session = await getSession();
  const body = await req.json().catch(() => null);
  const isPublic = Boolean(body?.public);

  if (!isPublic) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWriteOps(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (process.env.OPENAI_PUBLIC_OCR !== "1") {
    return withPublicCors(
      req,
      NextResponse.json(
        { error: "Το OCR στο δημόσιο booking δεν είναι ενεργό" },
        { status: 403 }
      )
    );
  }

  try {
    const parsed = schema.parse(body);
    const front =
      parsed.frontImageDataUrl || parsed.imageDataUrl || "";
    const back = parsed.backImageDataUrl || null;

    if (!front.startsWith("data:image/")) {
      return withPublicCors(
        req,
        NextResponse.json(
          { error: "Απαιτείται φωτογραφία μπροστινής όψης" },
          { status: 400 }
        )
      );
    }
    if (back && !back.startsWith("data:image/")) {
      return withPublicCors(
        req,
        NextResponse.json(
          { error: "Μη έγκυρη φωτογραφία πίσω όψης" },
          { status: 400 }
        )
      );
    }

    const result = await ocrDriversLicense(front, back);
    return withPublicCors(
      req,
      NextResponse.json({ ok: true, fields: result })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NO_OPENAI_KEY") {
      return withPublicCors(
        req,
        NextResponse.json(
          {
            error:
              "Λείπει OPENAI_API_KEY στο Vercel — ο διαχειριστής πλατφόρμας πρέπει να το ορίσει",
          },
          { status: 503 }
        )
      );
    }
    if (msg === "NO_JSON" || msg === "OCR_EMPTY_RESPONSE") {
      return withPublicCors(
        req,
        NextResponse.json(
          {
            error:
              "Το μοντέλο δεν επέστρεψε αναγνώσιμα πεδία. Δοκίμασε πιο καθαρή φωτογραφία ή έλεγξε το OPENAI_VISION_MODEL (για Groq: qwen/qwen3.8-27b).",
          },
          { status: 422 }
        )
      );
    }
    if (msg.startsWith("OCR_HTTP_")) {
      const detail = msg.replace(/^OCR_HTTP_\d+:/, "").trim();
      return withPublicCors(
        req,
        NextResponse.json(
          {
            error: detail
              ? `OCR αποτυχία: ${detail}`
              : "Αποτυχία κλήσης Vision API — έλεγξε key / model / BASE_URL",
          },
          { status: 502 }
        )
      );
    }
    console.error("ocr license", e);
    return withPublicCors(
      req,
      NextResponse.json(
        { error: "Αποτυχία ανάγνωσης διπλώματος" },
        { status: 400 }
      )
    );
  }
}
