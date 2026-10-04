# AI assistant (suggest-only)

Market-aligned claim AI for AfterSale (M6 / §6.6):

- Summary, classification, missing-info prompts, draft reply
- **Suggest-only** — never changes claim status
- Credit metering + `ai_processing_logs`
- **Multi-provider failover:** OpenAI → Groq → Gemini → Claude (order per task)

## Providers & task routing

| Task | Default preference (why) |
|------|---------------------------|
| `claim_assist` | Groq → OpenAI → Gemini → Claude (fast JSON triage) |
| `classify` | Groq → Gemini → OpenAI → Claude (cheap/fast labels) |
| `summarize` | OpenAI → Claude → Gemini → Groq (balanced summary) |
| `draft_reply` | Claude → OpenAI → Gemini → Groq (writing quality) |
| `general` | OpenAI → Groq → Gemini → Claude |

If the preferred provider fails (bad key, outage, rate limit), the next enabled provider with a key is tried automatically.

## Super Admin key control

**Super Admin → Settings → AI providers**

- Paste / replace API keys (stored in `platform_settings`, masked when loaded)
- Toggle each provider on/off
- Edit model IDs
- Reorder failover chains per task
- Clear a platform key (falls back to env)

API: `GET/POST /api/ai-settings` (admin bearer token).

## Env fallbacks (optional)

| Env | Provider |
|-----|----------|
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | OpenAI |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Google Gemini |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Claude |

Platform keys override env when set.

## Merchant UX

Claim detail → **AI assist → Analyze claim**

Staff must apply category / use draft reply manually.

## Heuristic fallback

If **no** providers are configured (or all fail), a local heuristic still returns triage suggestions so demos work. Runs still consume 1 AI credit.
