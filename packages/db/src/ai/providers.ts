/**
 * Provider adapters + failover router.
 * OpenAI / Groq (OpenAI-compatible), Gemini, Claude.
 */
import {
  getProviderChainForTask,
  type AiProviderId,
  type AiTaskId,
} from "./config";

export type ChatJsonResult = {
  content: string;
  provider: AiProviderId;
  model: string;
  attempts: Array<{ provider: AiProviderId; ok: boolean; error?: string }>;
};

async function callOpenAiCompatible(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const res = await fetch(`${params.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body.slice(0, 280)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response");
  return content;
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const model = params.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.system }] },
      contents: [{ role: "user", parts: [{ text: params.user }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body.slice(0, 280)}`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!content) throw new Error("Empty Gemini response");
  return content;
}

async function callClaude(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model || "claude-3-5-haiku-latest",
      max_tokens: 2048,
      temperature: 0.2,
      system: params.system,
      messages: [{ role: "user", content: `${params.user}\n\nRespond with valid JSON only.` }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body.slice(0, 280)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = json.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
  if (!content) throw new Error("Empty Claude response");
  return content;
}

async function callProvider(
  id: AiProviderId,
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  switch (id) {
    case "openai":
      return callOpenAiCompatible({
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        apiKey,
        model,
        system,
        user,
      });
    case "groq":
      return callOpenAiCompatible({
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey,
        model,
        system,
        user,
      });
    case "gemini":
      return callGemini({ apiKey, model, system, user });
    case "claude":
      return callClaude({ apiKey, model, system, user });
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}

/**
 * Run a JSON chat completion with task-based provider preference + failover.
 */
export async function chatJsonWithFailover(params: {
  task: AiTaskId;
  system: string;
  user: string;
}): Promise<ChatJsonResult> {
  const chain = await getProviderChainForTask(params.task);
  if (chain.length === 0) {
    throw new Error(
      "No AI providers configured. Add keys in Super Admin → Settings → AI providers.",
    );
  }

  const attempts: ChatJsonResult["attempts"] = [];
  let lastError = "All providers failed";

  for (const p of chain) {
    try {
      const content = await callProvider(p.id, p.apiKey, p.model, params.system, params.user);
      attempts.push({ provider: p.id, ok: true });
      return { content, provider: p.id, model: p.model, attempts };
    } catch (e) {
      const error = e instanceof Error ? e.message : "failed";
      lastError = error;
      attempts.push({ provider: p.id, ok: false, error });
    }
  }

  throw new Error(`AI failover exhausted: ${lastError}`);
}
