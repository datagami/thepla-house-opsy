/**
 * Provider-agnostic grooming check.
 *
 * Default provider: Azure AI Foundry, GPT-4o vision deployment (confirmed 2026-05-26).
 * The function shape is the only contract — switching to e.g. Claude vision is a
 * matter of swapping the call inside `callVisionProvider` (or branching on env).
 *
 * Never throws. Each photo:
 *   - PASS  / FAIL with reason + confidence
 *   - PENDING on per-call AbortController timeout
 *   - ERROR  on non-2xx, unparseable JSON, or unexpected shape
 *
 * Both photos run in parallel via Promise.all.
 */

import type { GroomingCheckStatus } from "@prisma/client";

export interface GroomingVerdict {
  status: GroomingCheckStatus; // PASS / FAIL / PENDING / ERROR
  reason: string | null;
  confidence: number | null;
  rawResponse: string | null; // for audit
}

export interface GroomingResult {
  uniform: GroomingVerdict;
  nails: GroomingVerdict;
  overallPass: boolean; // true only when BOTH are PASS
}

type CheckKind = "uniform" | "nails";

const SYSTEM_PROMPT_UNIFORM =
  "You are an attendance kiosk vision checker. Given a single photograph of an employee from the chest up, decide whether they are in clean, presentable uniform: shirt is the correct uniform shirt, tucked or worn neatly, free of obvious stains or damage. Respond strictly as JSON: {\"pass\": boolean, \"reason\": string (<=120 chars), \"confidence\": number 0..1}. Do not include any other text.";

const SYSTEM_PROMPT_NAILS =
  "You are an attendance kiosk vision checker. Given a single photograph of an employee's hand(s), decide whether their fingernails are trimmed short and clean (no long nails, no visible dirt). Respond strictly as JSON: {\"pass\": boolean, \"reason\": string (<=120 chars), \"confidence\": number 0..1}. Do not include any other text.";

function timeoutMs(): number {
  const raw = process.env.AZURE_AI_FOUNDRY_TIMEOUT_MS;
  const n = raw ? parseInt(raw, 10) : 8000;
  return Number.isFinite(n) && n > 0 ? n : 8000;
}

function endpointUrl(): string {
  const base = process.env.AZURE_AI_FOUNDRY_ENDPOINT?.replace(/\/+$/, "");
  const deployment = process.env.AZURE_AI_FOUNDRY_DEPLOYMENT;
  if (!base || !deployment) {
    throw new Error("AZURE_AI_FOUNDRY_ENDPOINT and AZURE_AI_FOUNDRY_DEPLOYMENT must be set");
  }
  // Azure OpenAI chat completions endpoint convention; api-version is the contract-stable one.
  return `${base}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;
}

async function callVisionProvider(
  kind: CheckKind,
  photoUrl: string
): Promise<GroomingVerdict> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs());

  const systemPrompt =
    kind === "uniform" ? SYSTEM_PROMPT_UNIFORM : SYSTEM_PROMPT_NAILS;

  try {
    const res = await fetch(endpointUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.AZURE_AI_FOUNDRY_KEY ?? "",
      },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Evaluate this photo." },
              { type: "image_url", image_url: { url: photoUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "ERROR", reason: `HTTP ${res.status}`, confidence: null, rawResponse: body || null };
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: { pass?: unknown; reason?: unknown; confidence?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return { status: "ERROR", reason: "Unparseable JSON", confidence: null, rawResponse: content };
    }

    if (typeof parsed.pass !== "boolean") {
      return { status: "ERROR", reason: "Missing 'pass' field", confidence: null, rawResponse: content };
    }
    const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 240) : null;
    const confidence =
      typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : null;

    return {
      status: parsed.pass ? "PASS" : "FAIL",
      reason,
      confidence,
      rawResponse: content,
    };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    if (err?.name === "AbortError") {
      return { status: "PENDING", reason: "Timeout", confidence: null, rawResponse: null };
    }
    return { status: "ERROR", reason: err?.message ?? "Unknown error", confidence: null, rawResponse: null };
  } finally {
    clearTimeout(t);
  }
}

export async function checkGrooming(
  uniformUrl: string | null,
  nailsUrl: string | null
): Promise<GroomingResult> {
  const tasks: Array<Promise<GroomingVerdict>> = [
    uniformUrl
      ? callVisionProvider("uniform", uniformUrl)
      : Promise.resolve<GroomingVerdict>({ status: "ERROR", reason: "No photo URL", confidence: null, rawResponse: null }),
    nailsUrl
      ? callVisionProvider("nails", nailsUrl)
      : Promise.resolve<GroomingVerdict>({ status: "ERROR", reason: "No photo URL", confidence: null, rawResponse: null }),
  ];
  const [uniform, nails] = await Promise.all(tasks);
  return {
    uniform,
    nails,
    overallPass: uniform.status === "PASS" && nails.status === "PASS",
  };
}
