/**
 * Multi-provider AI config — keys live in PlatformSetting (Super Admin),
 * with env fallbacks for local/dev.
 */
import { getPlatformSetting, setPlatformSetting, PLATFORM_KEYS } from "../platform";

export type AiProviderId = "openai" | "groq" | "gemini" | "claude";

export type AiTaskId =
  | "claim_assist"
  | "classify"
  | "summarize"
  | "draft_reply"
  | "general";

export type AiProviderConfig = {
  id: AiProviderId;
  label: string;
  apiKey: string | null;
  /** Key is set via platform DB or env (never return full key to clients). */
  keySource: "platform" | "env" | "none";
  keyHint: string | null;
  model: string;
  enabled: boolean;
};

export type AiPlatformConfig = {
  providers: AiProviderConfig[];
  /** Preferred order per task; first available+enabled wins, then rest as fallback. */
  taskRoutes: Record<AiTaskId, AiProviderId[]>;
};

/** Default task → provider preference (speed/cost/quality). */
export const DEFAULT_TASK_ROUTES: Record<AiTaskId, AiProviderId[]> = {
  // Fast JSON triage — Groq first
  claim_assist: ["groq", "openai", "gemini", "claude"],
  classify: ["groq", "gemini", "openai", "claude"],
  summarize: ["openai", "claude", "gemini", "groq"],
  // Writing quality — Claude first
  draft_reply: ["claude", "openai", "gemini", "groq"],
  general: ["openai", "groq", "gemini", "claude"],
};

export const DEFAULT_MODELS: Record<AiProviderId, string> = {
  openai: "gpt-4o-mini",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  claude: "claude-3-5-haiku-latest",
};

const PROVIDER_META: Record<AiProviderId, { label: string; envKey: string; envModel: string }> = {
  openai: { label: "OpenAI", envKey: "OPENAI_API_KEY", envModel: "OPENAI_MODEL" },
  groq: { label: "Groq", envKey: "GROQ_API_KEY", envModel: "GROQ_MODEL" },
  gemini: { label: "Google Gemini", envKey: "GEMINI_API_KEY", envModel: "GEMINI_MODEL" },
  claude: { label: "Anthropic Claude", envKey: "ANTHROPIC_API_KEY", envModel: "ANTHROPIC_MODEL" },
};

const KEY_PLATFORM: Record<AiProviderId, string> = {
  openai: PLATFORM_KEYS.AI_OPENAI_API_KEY,
  groq: PLATFORM_KEYS.AI_GROQ_API_KEY,
  gemini: PLATFORM_KEYS.AI_GEMINI_API_KEY,
  claude: PLATFORM_KEYS.AI_CLAUDE_API_KEY,
};

const MODEL_PLATFORM: Record<AiProviderId, string> = {
  openai: PLATFORM_KEYS.AI_OPENAI_MODEL,
  groq: PLATFORM_KEYS.AI_GROQ_MODEL,
  gemini: PLATFORM_KEYS.AI_GEMINI_MODEL,
  claude: PLATFORM_KEYS.AI_CLAUDE_MODEL,
};

const ENABLED_PLATFORM: Record<AiProviderId, string> = {
  openai: PLATFORM_KEYS.AI_OPENAI_ENABLED,
  groq: PLATFORM_KEYS.AI_GROQ_ENABLED,
  gemini: PLATFORM_KEYS.AI_GEMINI_ENABLED,
  claude: PLATFORM_KEYS.AI_CLAUDE_ENABLED,
};

export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length < 8) return "••••";
  return `••••${v.slice(-4)}`;
}

async function resolveKey(provider: AiProviderId): Promise<{
  apiKey: string | null;
  keySource: "platform" | "env" | "none";
}> {
  const stored = await getPlatformSetting(KEY_PLATFORM[provider]);
  if (stored && stored.trim()) return { apiKey: stored.trim(), keySource: "platform" };
  const env = process.env[PROVIDER_META[provider].envKey]?.trim();
  if (env) return { apiKey: env, keySource: "env" };
  // Legacy alias for OpenAI
  if (provider === "openai") {
    const legacy = process.env.OPENAI_API_KEY?.trim();
    if (legacy) return { apiKey: legacy, keySource: "env" };
  }
  return { apiKey: null, keySource: "none" };
}

async function resolveModel(provider: AiProviderId): Promise<string> {
  const stored = await getPlatformSetting(MODEL_PLATFORM[provider]);
  if (stored && stored.trim()) return stored.trim();
  const env = process.env[PROVIDER_META[provider].envModel]?.trim();
  if (env) return env;
  return DEFAULT_MODELS[provider];
}

async function resolveEnabled(provider: AiProviderId, hasKey: boolean): Promise<boolean> {
  const stored = await getPlatformSetting(ENABLED_PLATFORM[provider]);
  if (stored === "false") return false;
  if (stored === "true") return hasKey;
  // Default: enabled when a key exists
  return hasKey;
}

export async function loadAiPlatformConfig(): Promise<AiPlatformConfig> {
  const ids = Object.keys(PROVIDER_META) as AiProviderId[];
  const providers: AiProviderConfig[] = [];
  for (const id of ids) {
    const { apiKey, keySource } = await resolveKey(id);
    const model = await resolveModel(id);
    const enabled = await resolveEnabled(id, Boolean(apiKey));
    providers.push({
      id,
      label: PROVIDER_META[id].label,
      apiKey,
      keySource,
      keyHint: maskSecret(apiKey),
      model,
      enabled,
    });
  }

  let taskRoutes = { ...DEFAULT_TASK_ROUTES };
  const routesRaw = await getPlatformSetting(PLATFORM_KEYS.AI_TASK_ROUTES);
  if (routesRaw) {
    try {
      const parsed = JSON.parse(routesRaw) as Partial<Record<AiTaskId, AiProviderId[]>>;
      taskRoutes = { ...DEFAULT_TASK_ROUTES, ...parsed };
    } catch {
      /* keep defaults */
    }
  }

  return { providers, taskRoutes };
}

/** Public-safe config for admin UI (keys masked). */
export async function getAiPlatformConfigPublic() {
  const cfg = await loadAiPlatformConfig();
  return {
    providers: cfg.providers.map((p) => ({
      id: p.id,
      label: p.label,
      keySource: p.keySource,
      keyHint: p.keyHint,
      model: p.model,
      enabled: p.enabled,
      configured: Boolean(p.apiKey),
    })),
    taskRoutes: cfg.taskRoutes,
    defaultTaskRoutes: DEFAULT_TASK_ROUTES,
    defaultModels: DEFAULT_MODELS,
  };
}

export type AiSettingsUpdate = {
  providers?: Array<{
    id: AiProviderId;
    apiKey?: string | null;
    /** If true, wipe stored platform key (fall back to env). */
    clearKey?: boolean;
    model?: string;
    enabled?: boolean;
  }>;
  taskRoutes?: Partial<Record<AiTaskId, AiProviderId[]>>;
};

export async function updateAiPlatformConfig(update: AiSettingsUpdate) {
  if (update.providers) {
    for (const p of update.providers) {
      if (!PROVIDER_META[p.id]) continue;
      if (p.clearKey) {
        await setPlatformSetting(KEY_PLATFORM[p.id], "");
      } else if (typeof p.apiKey === "string" && p.apiKey.trim() && !p.apiKey.includes("••••")) {
        await setPlatformSetting(KEY_PLATFORM[p.id], p.apiKey.trim());
      }
      if (typeof p.model === "string" && p.model.trim()) {
        await setPlatformSetting(MODEL_PLATFORM[p.id], p.model.trim());
      }
      if (typeof p.enabled === "boolean") {
        await setPlatformSetting(ENABLED_PLATFORM[p.id], p.enabled ? "true" : "false");
      }
    }
  }
  if (update.taskRoutes) {
    const current = await loadAiPlatformConfig();
    const next = { ...current.taskRoutes, ...update.taskRoutes };
    await setPlatformSetting(PLATFORM_KEYS.AI_TASK_ROUTES, JSON.stringify(next));
  }
  return getAiPlatformConfigPublic();
}

/** Ordered provider chain for a task (enabled + has key only). */
export async function getProviderChainForTask(task: AiTaskId): Promise<
  Array<{ id: AiProviderId; apiKey: string; model: string }>
> {
  const cfg = await loadAiPlatformConfig();
  const preferred = cfg.taskRoutes[task] ?? DEFAULT_TASK_ROUTES.general;
  const byId = new Map(cfg.providers.map((p) => [p.id, p]));
  const chain: Array<{ id: AiProviderId; apiKey: string; model: string }> = [];
  const seen = new Set<AiProviderId>();

  for (const id of preferred) {
    const p = byId.get(id);
    if (!p || !p.enabled || !p.apiKey || seen.has(id)) continue;
    seen.add(id);
    chain.push({ id, apiKey: p.apiKey, model: p.model });
  }
  // Append any other enabled providers not already listed
  for (const p of cfg.providers) {
    if (!p.enabled || !p.apiKey || seen.has(p.id)) continue;
    seen.add(p.id);
    chain.push({ id: p.id, apiKey: p.apiKey, model: p.model });
  }
  return chain;
}
