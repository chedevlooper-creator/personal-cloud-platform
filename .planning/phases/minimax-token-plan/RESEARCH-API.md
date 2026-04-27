# MiniMax API Surface Research

**Researched:** 2026-04-26 (revised 2026-04-27 — see §1 OAuth, §9c quota endpoint, §9e additional undocumented endpoints, all extracted from `mmx-cli@1.0.12`)
**Domain:** MiniMax Open Platform HTTP APIs (Token Plan tier) — text, speech, image, video, music, file management
**Scope:** Document every endpoint we'd call from a server-side TypeScript backend. NO integration code.

> **Sourcing methodology.** The MiniMax docs site (`platform.minimax.io/docs`) is a CSR Next.js app — `webfetch` returns only the marketing shell. However the raw OpenAPI/AsyncAPI JSON is publicly fetchable at predictable paths under each `api-reference/<area>/api/*.json`. We downloaded 17 such specs into `/tmp/mmx/openapi/` and 7 prose pages (rendered RSC payload extracted to text) into `/tmp/mmx/text/`. Every claim below is tagged:
>
> - `[VERIFIED]` — confirmed against the OpenAPI/AsyncAPI JSON or rendered docs prose this session
> - `[VERIFIED-via-implementation]` — extracted from the official `mmx-cli` npm package (`mmx-cli@1.0.12`, decompiled bundle at `/tmp/mmx/cli/package/dist/mmx.mjs`). Real and shipping, but **NOT in any public OpenAPI** — MiniMax may change without notice.
> - `[PRIOR-SESSION]` — carried from earlier research summary, not re-verified this session
> - `[INFERRED]` — derived from another verified fact; the inference target is named
> - `UNKNOWN:` — explicit gap, needs human-driven verification before we depend on it

---

## Verification status

| Area                                                            | Status                                                                     | Source on disk                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Auth, base URLs                                                 | `[VERIFIED]`                                                               | every OpenAPI's `servers[0].url` + `securitySchemes.bearerAuth` |
| Text — Anthropic-compat                                         | `[VERIFIED]` (full schema, request + streaming response)                   | `openapi/api-reference_text_api_openapi-chat-anthropic.json`    |
| Text — OpenAI-compat                                            | `[VERIFIED]` for documented schema; **doc/reality mismatch** on `tools`    | `openapi/api-reference_text_api_openapi-chat-openai.json`       |
| Text — Native v2 (`chatcompletion_v2`)                          | `[VERIFIED]`                                                               | `openapi/api-reference_text_api_openapi.json`                   |
| Speech 2.8 — sync TTS (`/v1/t2a_v2`)                            | `[VERIFIED]`                                                               | `openapi/api-reference_speech_t2a_api_openapi.json`             |
| Speech — async TTS, voice clone, voice design, voice management | `[VERIFIED]`                                                               | `openapi/api-reference_speech_*`                                |
| Speech — WebSocket TTS                                          | `[VERIFIED]` exists; not deeply read                                       | `openapi/api-reference_speech_t2a_api_asyncapi.json`            |
| Image (`image-01`)                                              | `[VERIFIED]`                                                               | `openapi/api-reference_image_generation_api_*.json`             |
| Video (Hailuo-2.3 + variants)                                   | `[VERIFIED]`                                                               | `openapi/api-reference_video_generation_api_*.json`             |
| Music (`music-2.6`)                                             | `[VERIFIED]`                                                               | `openapi/api-reference_music_api_openapi.json`                  |
| File management                                                 | `[VERIFIED]`                                                               | `openapi/api-reference_file_management_api_openapi.json`        |
| Rate limits                                                     | `[VERIFIED]`                                                               | `text/guides_rate-limits.txt`                                   |
| Token Plan quotas                                               | `[VERIFIED]`                                                               | `text/token-plan_intro.txt`                                     |
| Error codes                                                     | `[VERIFIED]`                                                               | `text/api-reference_errorcode.txt`                              |
| `mmx-cli`                                                       | `[VERIFIED]` (install/auth/usage names); deeper command schema not fetched | `text/token-plan_minimax-cli.txt`                               |
| **Quota-read endpoint** `GET /v1/token_plan/remains`            | `[VERIFIED-via-implementation]` (mmx-cli source) — see §9c                 | `cli/package/dist/mmx.mjs`                                      |
| **OAuth device flow** + **`coding_plan/{search,vlm}`**          | `[VERIFIED-via-implementation]` — see §1, §9e                              | `cli/package/dist/mmx.mjs`                                      |
| Token Plan MCP tools (web_search, image understanding)          | endpoints exist (see §9e); **request shapes** still `UNKNOWN:`             | —                                                               |
| Lyrics generation                                               | **no published OpenAPI** — prose-docs only or not yet a public endpoint    | n/a                                                             |
| Video templates                                                 | covered by the single `video/generation` spec, not a separate file         | `openapi/api-reference_video_generation_api_*.json`             |

---

## 1. Auth & base URLs

| Item                                   | Value                                                                                                                                                                                                         | Status                                                                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Global base URL** (international)    | `https://api.minimax.io`                                                                                                                                                                                      | `[VERIFIED]` — present as `servers[0].url` in every fetched OpenAPI doc                                                                                                                                                                                            |
| **Global US-West alt**                 | `https://api-uw.minimax.io`                                                                                                                                                                                   | `[VERIFIED]` — `mmx-cli` accepts it as a `--base-url` example; same surface as global, lower US latency                                                                                                                                                            |
| **China base URL**                     | `https://api.minimaxi.com`                                                                                                                                                                                    | `[VERIFIED]` — referenced repeatedly in `guides_text-m2-function-call.txt` as the `.com` mirror of `.io`                                                                                                                                                           |
| **Anthropic-compat base**              | `https://api.minimax.io/anthropic`                                                                                                                                                                            | `[VERIFIED]` — sole path under that server is `/anthropic/v1/messages`                                                                                                                                                                                             |
| **OpenAI-compat base**                 | `https://api.minimax.io/v1` (set as `OPENAI_BASE_URL`)                                                                                                                                                        | `[VERIFIED]`                                                                                                                                                                                                                                                       |
| **Auth scheme**                        | HTTP `Authorization: Bearer <api_key>`; `bearerFormat: JWT`                                                                                                                                                   | `[VERIFIED]` — `securitySchemes.bearerAuth` in every spec                                                                                                                                                                                                          |
| **Auth scheme (alt)**                  | `x-api-key: <api_key>` header (no `Bearer` prefix)                                                                                                                                                            | `[VERIFIED]` — `mmx-cli` falls back to this when `Authorization: Bearer` is rejected; both work                                                                                                                                                                    |
| **OAuth device flow** (alt to API key) | clientId `mmx-cli`, authorize `https://platform.minimax.io/oauth/authorize`, token `https://api.minimax.io/v1/oauth/token`, device-code `https://api.minimax.io/v1/oauth/device/code`, scope `api`, PKCE S256 | `[VERIFIED]` — extracted from `mmx-cli` v1.0.12 bundle. Token issuance returns `{access_token, expires_in, account}`; the access_token is a Bearer token usable on **all** API endpoints (not just CLI). Useful if a user prefers OAuth over a long-lived API key. |
| **Token Plan key prefix**              | `sk-cp-…` (per CLI install prompt); pay-as-you-go uses `sk-…`                                                                                                                                                 | `[VERIFIED]` (CLI doc)                                                                                                                                                                                                                                             |
| **Token Plan vs PAYG**                 | Same HTTP surface; key type just changes which quota counter is hit. On Token Plan exhaustion, switch to a PAYG key OR wait.                                                                                  | `[VERIFIED]` (`token-plan_intro.txt`)                                                                                                                                                                                                                              |

> **Operational implication.** A single `MINIMAX_API_KEY` env var + `MINIMAX_BASE_URL` (default `https://api.minimax.io`) is enough; the China base URL only matters if the user re-issues from a Chinese account.

---

## 2. Text — M2.7

MiniMax exposes **three** text endpoints — pick one per call site, do not multiplex unnecessarily:

| Endpoint          | Path                              | Wire format             | Tool calls                                                                                | Multimodal input                                                           | Streaming                                                         | Recommended use                                                                               |
| ----------------- | --------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Anthropic-compat  | `POST /anthropic/v1/messages`     | Anthropic Messages API  | not in schema (`UNKNOWN:` whether unlisted)                                               | text only                                                                  | yes (`message_start`/`content_block_delta`/`message_stop` events) | **Token Plan default** — official quickstart uses this                                        |
| OpenAI-compat     | `POST /v1/chat/completions`       | OpenAI Chat Completions | **see discrepancy below**                                                                 | text only (per schema)                                                     | yes (`chat.completion.chunk` SSE)                                 | When you already have an OpenAI SDK and need to swap base URL                                 |
| MiniMax native v2 | `POST /v1/text/chatcompletion_v2` | OpenAI-shaped + extras  | **yes** — `tools`, `tool_choice`, `tool_calls` in messages, `finish_reason: "tool_calls"` | **yes** — `content` may be array of `{type:"text"}` / `{type:"image_url"}` | yes                                                               | When you need tools, structured `response_format`, multimodal input, or `mask_sensitive_info` |

### 2a. Models (text)

`[VERIFIED]` — `model` enum across the three text specs:

```
MiniMax-M2.7              # Token Plan default
MiniMax-M2.7-highspeed    # Highspeed-tier plans
MiniMax-M2.5
MiniMax-M2.5-highspeed    # native v2 only
MiniMax-M2.1
MiniMax-M2                # native v2 only
MiniMax-Text-01           # mentioned for response_format json_schema (native v2 only)
```

### 2b. Anthropic-compat — `POST /anthropic/v1/messages` `[VERIFIED]`

```ts
// Request — CreateMessageReq
{
  model: "MiniMax-M2.7" | "MiniMax-M2.7-highspeed" | "MiniMax-M2.5" | "MiniMax-M2.1",
  messages: Array<{
    role: "user" | "assistant" | "user_system" | "group" | "sample_message_user" | "sample_message_ai",
    content: string | Array<{ type: "text" | "thinking", text?: string, thinking?: string, signature?: string }>
  }>,
  system?: string | Array<{ type: "text", text: string }>,
  stream?: boolean,                        // default false
  max_tokens?: number,                     // max 2048 per spec
  temperature?: number,                    // (0, 1], default 1
  top_p?: number                           // (0, 1], default 0.95
}
```

```ts
// Non-stream response — CreateMessageResp
{
  id: string,
  type: "message",
  role: "assistant",
  model: string,
  content: Array<
    | { type: "thinking", thinking: string, signature: string }
    | { type: "text", text: string }
  >,
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence",
  usage: {
    input_tokens: number,
    output_tokens: number,
    cache_creation_input_tokens?: number,  // present in examples
    cache_read_input_tokens?: number       // present in examples
  },
  base_resp: { status_code: number, status_msg: string }
}
```

Streaming events `[VERIFIED]` (Anthropic-compatible SSE):
`message_start` → `ping` → `content_block_start` (per block) → `content_block_delta` (`text_delta` | `thinking_delta` | `signature_delta`) → `content_block_stop` → `message_delta` (with final `stop_reason` + `usage`) → `message_stop`.

> **Important.** `thinking` blocks come back as a _separate first content block_ with their own `signature`. Any UI that renders only `text` blocks will silently drop the chain-of-thought; the signature is required if we ever want to feed it back into a follow-up call (Anthropic compatibility convention).

```bash
curl -sS https://api.minimax.io/anthropic/v1/messages \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-M2.7",
    "max_tokens": 1000,
    "system": "You are a helpful assistant.",
    "messages": [{ "role": "user", "content": "Hi" }]
  }'
```

### 2c. OpenAI-compat — `POST /v1/chat/completions` `[VERIFIED]` schema, **discrepancy** on tools

Documented request fields (per OpenAPI):

```ts
{
  model: "MiniMax-M2.7" | "MiniMax-M2.7-highspeed" | "MiniMax-M2.5" | "MiniMax-M2.1",
  messages: Array<{
    role: "system" | "user" | "assistant" | "user_system" | "group" | "sample_message_user" | "sample_message_ai",
    name?: string,
    content: string
  }>,
  stream?: boolean,
  max_completion_tokens?: number,   // max 2048
  temperature?: number,             // (0, 1]
  top_p?: number                    // (0, 1], default 0.95
}
```

Response (`ChatCompletionResp`):

```ts
{
  id: string,
  choices: Array<{
    finish_reason: "stop" | "length",
    index: number,
    message: { content: string, role: "assistant", name?: string, audio_content?: string }
  }>,
  created: number,         // unix seconds
  model: string,
  object: "chat.completion" | "chat.completion.chunk",
  usage: {
    total_tokens: number, total_characters: number,
    prompt_tokens: number, completion_tokens: number,
    completion_tokens_details: { reasoning_tokens: number }
  },
  input_sensitive: boolean, output_sensitive: boolean,
  input_sensitive_type: number, output_sensitive_type: number,
  base_resp: { status_code: number, status_msg: string }
}
```

> **⚠️ Doc/reality discrepancy.** The published OpenAI-compat OpenAPI **does not** list `tools`, `tool_choice`, or `response_format`. However the official "M2 Tool Use & Interleaved Thinking" guide (`text-m2-function-call.txt`, lines 595–720, 1054–1130) shows the OpenAI Python SDK using `client.chat.completions.create({ model: "MiniMax-M2.7", tools, extra_body: { reasoning_split: true } })` against `OPENAI_BASE_URL=https://api.minimax.io/v1`. So `tools` works against `/v1/chat/completions` in practice; the OpenAPI is just incomplete. **Treat the OpenAI-compat tool-calling schema as identical to the native v2 schema in §2d, plus the proprietary `reasoning_split` / `reasoning_details` extras.** `[VERIFIED]` from prose; schema-level confirmation `UNKNOWN:`.
>
> Reasoning content surfaces in two modes:
>
> - `extra_body: { reasoning_split: false }` (default-ish): thinking is wrapped inside `<think>...</think>` inside `choices[0].message.content` (schema-confirmed; e.g. `"<think>The user just says 'Hello'…</think>\n\nHello! How can I help you today?"`).
> - `extra_body: { reasoning_split: true }`: thinking moves to `choices[0].message.reasoning_details` and `content` is clean. `UNKNOWN:` exact JSON shape of `reasoning_details` (not in OpenAPI).

The OpenAI-compat schema also reports `input_sensitive_type` (`1` severe / `2` porn / `3` ad / `4` prohibited / `5` abuse / `6` violence / `7` other) and an `output_sensitive_type` for content-safety triggers. Use to surface a friendly "blocked by safety" error rather than letting empty content propagate.

### 2d. Native v2 — `POST /v1/text/chatcompletion_v2` `[VERIFIED]`

Superset endpoint. Use when you need any of: tool calling, structured JSON output, multimodal (image) input, PII masking.

```ts
// Request — ChatCompletionReq
{
  model: "MiniMax-M2.7" | "MiniMax-M2.7-highspeed" | "MiniMax-M2.5" | "MiniMax-M2.5-highspeed" | "MiniMax-M2.1" | "MiniMax-M2" | "MiniMax-Text-01",
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool",
    name?: string,
    content: string | Array<
      | { type: "text", text: string }
      | { type: "image_url", image_url: { url: string /* http(s) URL or base64 data: URL */ } }
    >,
    tool_calls?: Array<{
      id: string,
      type: "function",
      function: { name: string, arguments: string /* JSON string */ }
    }>
  }>,
  stream?: boolean,
  stream_options?: { include_usage?: boolean },
  max_tokens?: number,             // deprecated
  max_completion_tokens?: number,
  temperature?: number,            // (0, 1]
  top_p?: number,                  // (0, 1], default 0.95
  tool_choice?: "none" | "auto",   // default auto
  tools?: Array<{
    type: "function",
    function: { name: string, description: string, parameters: object /* JSON Schema */ }
  }>,
  response_format?: {              // MiniMax-Text-01 only per spec
    type: "json_schema",
    json_schema: {
      name: string,                // ≤64 chars, /^\w+$/
      description?: string,
      schema: { type: "object", properties: object, required?: string[], additionalProperties?: boolean }
    }
  },
  mask_sensitive_info?: boolean    // replaces emails/phones/addresses with *** in output
}
```

```ts
// Response — ChatCompletionResp (delta stream uses identical shape with object="chat.completion.chunk")
{
  id: string,
  choices: Array<{
    finish_reason: "stop" | "length" | "tool_calls",
    index: number,
    message: {
      content: string,
      role: "assistant",
      tool_calls?: Array<{ id: string, type: "function", function: { name: string, arguments: string } }>,
      // reasoning_content also appears in examples ("...omitted") — `[INFERRED]` always-present for M2.7
    }
  }>,
  created: number, model: string, object: "chat.completion" | "chat.completion.chunk",
  usage: { total_tokens, total_characters, prompt_tokens, completion_tokens, completion_tokens_details: { reasoning_tokens } },
  input_sensitive, output_sensitive, input_sensitive_type, output_sensitive_type,
  base_resp: { status_code, status_msg }
}
```

> Multimodal note: only `text` and `image_url` parts are listed; **no audio/video input parts** in this schema. For audio understanding/ASR we'd need a different endpoint (`UNKNOWN:` whether one exists — not in the 17 specs we collected).

---

## 3. Speech — `speech-2.8-*`

Five endpoints. All under `https://api.minimax.io`, all bearer-auth.

| Endpoint         | Path                                                         | Purpose                                                    |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Sync TTS         | `POST /v1/t2a_v2`                                            | Text → audio in one shot, optionally SSE-streamed          |
| Async TTS        | `POST /v1/t2a_async_v2` + `GET /v1/query/t2a_async_query_v2` | Long-form TTS (uses `text_file_id` from File API as input) |
| WebSocket TTS    | `wss://api.minimax.io` (AsyncAPI `t2a_v2_websocket`)         | Bidirectional low-latency TTS                              |
| Voice cloning    | `POST /v1/voice_clone`                                       | Register a custom `voice_id` from an uploaded sample       |
| Voice design     | `POST /v1/voice_design`                                      | Generate a brand-new voice from a text description         |
| Voice management | `POST /v1/get_voice`, `POST /v1/delete_voice`                | Inventory / delete                                         |

### 3a. Models `[VERIFIED]`

`speech-2.8-hd`, `speech-2.8-turbo`, `speech-2.6-hd`, `speech-2.6-turbo`, `speech-02-hd`, `speech-02-turbo`, `speech-01-hd`, `speech-01-turbo`. **Token Plan limits speech to `speech-2.8-*` quota** (other models are PAYG only — `[INFERRED]` from quota table).

### 3b. Sync TTS — `POST /v1/t2a_v2` `[VERIFIED]`

```ts
// T2aV2Req
{
  model: "speech-2.8-hd" | "speech-2.8-turbo" | "speech-2.6-hd" | "speech-2.6-turbo" | "speech-02-hd" | "speech-02-turbo" | "speech-01-hd" | "speech-01-turbo",
  text: string,                    // max length not stated in schema; see `usage_characters` in response
  stream?: boolean,
  stream_options?: { exclude_aggregated_audio?: boolean },
  output_format?: "url" | "hex",   // default "hex"; "url" only valid for non-streaming, expires in 24h
  voice_setting?: {
    voice_id: string,              // required if voice_setting present; system or cloned/designed voice
    speed?: number,                // [0.5, 2], default 1
    vol?: number,                  // (0, 10], default 1
    pitch?: number,                // [-12, 12] integer, default 0
    emotion?: "happy" | "sad" | "angry" | "fearful" | "disgusted" | "surprised" | "calm" | "fluent" | "whisper",
    text_normalization?: boolean,
    latex_read?: boolean
  },
  audio_setting?: {
    sample_rate?: 8000 | 16000 | 22050 | 24000 | 32000 | 44100,
    bitrate?: 32000 | 64000 | 128000 | 256000,    // mp3 only
    format?: "mp3" | "pcm" | "flac" | "wav",       // wav non-streaming only
    channel?: 1 | 2,
    force_cbr?: boolean                            // streamed mp3 only
  },
  pronunciation_dict?: { tone?: string[] },        // e.g. ["Omg/Oh my god"]
  timbre_weights?: Array<{ voice_id: string, weight: number /* 1..100 */ }>,  // legacy mixing
  language_boost?: "auto" | "Chinese" | "English" | /* 40 total — see spec */ string,
  voice_modify?: {
    pitch?: number,        // [-100, 100]
    intensity?: number,    // [-100, 100]
    timbre?: number,       // [-100, 100]
    sound_effects?: "spacious_echo" | "auditorium_echo" | "lofi_telephone" | "robotic"
  },
  subtitle_enable?: boolean
}
```

```ts
// T2aV2Resp (one body for non-stream, one body per chunk for stream)
{
  data: {
    audio: string,         // hex-encoded audio (per output_format); url-mode returns a string URL
    subtitle_file?: string, // download URL of timed JSON, sentence-aligned ≤50 chars
    status: 1 | 2          // 1 = synthesizing, 2 = synthesis completed (final chunk only)
  } | null,                 // CAN BE NULL — must null-check
  trace_id: string,
  extra_info?: {           // present only on final/non-stream chunk
    audio_length: number,        // ms
    audio_sample_rate: number,
    audio_size: number,          // bytes
    bitrate: number,
    audio_format: "mp3" | "pcm" | "flac",
    audio_channel: number,
    invisible_character_ratio: number,  // ≤ 0.10 OK; > 0.10 returns error 1042
    usage_characters: number,           // billable count
    word_count: number
  },
  base_resp: { status_code: number, status_msg: string }
}
```

> **Streaming gotcha.** `data` may be `null` on intermediate keepalive frames; only the chunk with `extra_info` is final. `output_format: "url"` does NOT work in streaming mode.
>
> **File output lifetime.** `output_format: "url"` returns links valid for **24 h** (`[VERIFIED]` description text) — must download and re-host if we need persistence.

### 3c. Async TTS — `POST /v1/t2a_async_v2` + `GET /v1/query/t2a_async_query_v2` `[VERIFIED]`

Submits text (inline or via `text_file_id` from File API). Response shape (sync part):

```ts
{
  task_id: number, task_token: string, file_id: number, usage_characters: number,
  base_resp: { status_code, status_msg }
}
```

Poll `GET /v1/query/t2a_async_query_v2?task_id=…` for status; final audio is fetched via the File API (`file_id` → `/v1/files/retrieve`). Full request schema mirrors §3b minus `stream`/`stream_options`. `UNKNOWN:` exact polling response shape — not deeply read this session.

### 3d. WebSocket TTS — `wss://api.minimax.io` `[VERIFIED]` exists

AsyncAPI document `api-reference_speech_t2a_api_asyncapi.json` describes a `t2a_v2_websocket` channel with `wss://`, `bearer JWT` auth. Streaming TTS over WS instead of SSE. **Not deeply read this session** — only relevant if we need sub-chunk latency below SSE delivery. Recommend deferring until we have a measured latency need.

### 3e. Voice cloning — `POST /v1/voice_clone` `[VERIFIED]`

Two-step: (1) upload sample via `POST /v1/files/upload` with `purpose: "voice_clone"` (≤8 s for `prompt_audio`), receive `file_id`. (2) call `/v1/voice_clone`:

```ts
{
  file_id: number,                          // required, the uploaded sample
  voice_id: string,                         // required, your custom ID
  clone_prompt?: { prompt_audio: number, prompt_text: string },  // file_id of optional 2nd sample + transcript
  text?: string,                            // generates demo audio if provided
  model?: "speech-2.8-hd" | …,              // required if `text` set
  language_boost?: "auto" | "English" | …,
  need_noise_reduction?: boolean,           // default false
  need_volume_normalization?: boolean       // default false
}
```

Response: `{ input_sensitive: { type: number }, demo_audio?: string /* URL when text+model provided */, base_resp }`.

Errors specific to clone: **1043** ASR similarity fail, **1044** clone-prompt similarity fail, **2037** voice duration, **2039** duplicate voice_id, **2042** no voice_id access, **2048** prompt audio too long, **20132** invalid samples/voice_id.

### 3f. Voice design — `POST /v1/voice_design` `[VERIFIED]`

Pure text → new voice. **Carries an extra cost note in spec: "Generating preview audio incurs a fee of $30 per 1M characters."** — applies even on Token Plan? `UNKNOWN:`.

```ts
// Request
{ prompt: string, preview_text: string /* ≤500 */, voice_id?: string }
// Response
{ voice_id: string, trial_audio: string /* hex */, base_resp }
```

### 3g. Voice management — `POST /v1/get_voice`, `POST /v1/delete_voice` `[VERIFIED]`

```ts
// get_voice
POST /v1/get_voice  { voice_type: "system" | "voice_cloning" | "voice_generation" | "all" }
// → { system_voice: SystemVoiceInfo[], voice_cloning: VoiceCloningInfo[], voice_generation: VoiceGenerationInfo[], base_resp }
```

`delete_voice` takes `{ voice_type, voice_id }`. (`UNKNOWN:` exact `voice_type` enum on delete — likely the same.)

---

## 4. Image — `image-01`

Single endpoint `POST /v1/image_generation`, served as **two logical OpenAPI specs** (`text-to-image` and `image-to-image`) that differ in the optional `subject_reference` field. Same path, same response shape.

### 4a. Models `[VERIFIED]`

`image-01`, `image-01-live` (only the i2i spec lists `image-01-live`).

### 4b. Request `[VERIFIED]`

```ts
{
  model: "image-01" | "image-01-live",
  prompt: string,                                  // ≤1500 chars, required
  subject_reference?: Array<{ type: "character", image_file: string /* URL or data URL */ }>,
  aspect_ratio?: "1:1" | "16:9" | "4:3" | "3:2" | "2:3" | "3:4" | "9:16" | "21:9",
  width?: number,                                  // image-01 only; mutually exclusive feel with aspect_ratio (`UNKNOWN:` precedence)
  height?: number,                                 // image-01 only
  response_format?: "url" | "base64",              // default "url"; URLs expire in 24h
  seed?: number,                                   // reproducibility
  n?: number,                                      // [1, 9], default 1
  prompt_optimizer?: boolean                       // default false
}
```

### 4c. Response `[VERIFIED]`

```ts
{
  id: string,                                      // trace ID
  data: {
    image_urls?: string[],     // when response_format = "url"
    image_base64?: string[]    // when response_format = "base64"
  },
  metadata: { success_count: number, failed_count: number /* blocked by safety */ },
  base_resp: { status_code, status_msg }
}
```

Concrete pixel mapping per `aspect_ratio` `[VERIFIED]`: `1:1`→1024×1024, `16:9`→1280×720, `4:3`→1152×864, `3:2`→1248×832, `2:3`→832×1248, `3:4`→864×1152, `9:16`→720×1280, `21:9`→1344×576. **`failed_count > 0` is silent partial success** — must check both counts.

---

## 5. Video — `MiniMax-Hailuo-2.3` (and friends)

Async only. Single submit endpoint `POST /v1/video_generation`, polling endpoint `GET /v1/query/video_generation?task_id=…`, file fetch endpoint `GET /v1/files/retrieve?file_id=…`. Plus optional `callback_url` push notification in the submit body.

The submit endpoint's _request schema is conditional on which generation mode you use_. MiniMax publishes one OpenAPI per mode against the same path:

| Mode                                  | Required body fields                                        | Models `[VERIFIED]`                                                                                              |
| ------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Text-to-video (T2V)                   | `model`, `prompt`                                           | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01`                                           |
| Image-to-video (I2V)                  | `model`, `first_frame_image`                                | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `MiniMax-Hailuo-02`, `I2V-01-Director`, `I2V-01-live`, `I2V-01` |
| Start-end-to-video (first+last frame) | `model`, `last_frame_image` (+ usually `first_frame_image`) | `MiniMax-Hailuo-02` only                                                                                         |
| Subject-reference-to-video (S2V)      | `model`, `subject_reference`                                | `S2V-01` only                                                                                                    |
| Template-to-video                     | (raw OpenAPI failed to parse)                               | `[INFERRED]` exists — `openapi/api-reference_video_generation_api_template-to-video.json` is malformed           |

### 5a. Submit — `POST /v1/video_generation` `[VERIFIED]` (T2V + I2V + start-end + S2V)

```ts
// Common fields
{
  model: string,              // see table above
  prompt?: string,            // ≤2000 chars (S2V), ≤900-ish chars elsewhere; required for T2V
  prompt_optimizer?: boolean, // default true; set false for "exact prompt" runs
  fast_pretreatment?: boolean,// default false; only for Hailuo-2.3 / 2.3-Fast / 02 when prompt_optimizer=true
  duration?: number,          // seconds; values vary per model — `UNKNOWN:` full matrix; T2V example uses 6
  resolution?: "512P" | "720P" | "768P" | "1080P",  // T2V: 720P/768P/1080P; I2V adds 512P; start-end is 768P/1080P only
  callback_url?: string,      // optional push (long description not extracted; `[INFERRED]` POSTs progress events)
  // mode-specific:
  first_frame_image?: string, // I2V — required, http(s) URL or base64 data URL
  last_frame_image?: string,  // start-end — required
  subject_reference?: Array<{ type: "character", image: string[] }>  // S2V — required
}
```

```ts
// VideoGenerationResp
{ task_id: string, base_resp: { status_code, status_msg } }
```

### 5b. Query — `GET /v1/query/video_generation?task_id=…` `[VERIFIED]`

```ts
{
  task_id: string,
  status: "Preparing" | "Queueing" | "Processing" | "Success" | "Fail",
  file_id?: string,        // present on Success
  video_width?: number,    // present on Success
  video_height?: number,   // present on Success
  base_resp: { status_code, status_msg }
}
```

### 5c. File retrieve — `GET /v1/files/retrieve?file_id=…` `[VERIFIED]`

```ts
{
  file: { file_id: number, bytes: number, created_at: number, filename: string, purpose: string, download_url: string },
  base_resp: { status_code, status_msg }
}
```

> **CRITICAL file lifetime:** `download_url` from `/v1/files/retrieve` is valid for **1 hour** (`[VERIFIED]` description: "valid for 1 hour"), unlike image/audio URL outputs which last 24 h. Any video pipeline must download to our own object storage immediately on task completion.

### 5d. Callback push `[INFERRED]`

The submit body accepts `callback_url`. The 1845-char description was truncated by our extractor; spec doesn't include the callback's payload schema. Treat as: server POSTs JSON with at least `task_id` + `status` to the URL on terminal states. Need to verify shape before depending on it. `UNKNOWN:` exact body / signature / retry policy.

---

## 6. Music — `music-2.6`

| Endpoint          | Path                                                       | Purpose                                                      |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| Generate          | `POST /v1/music_generation`                                | Synth song from prompt + lyrics (or instrumental)            |
| Cover preprocess  | `POST /v1/music_cover_preprocess`                          | Extract `cover_feature_id` + structure from a reference song |
| Lyrics generation | `POST /v1/lyrics_generation` (path inferred from filename) | `[INFERRED]` — separate spec failed to parse                 |

### 6a. Generate — `POST /v1/music_generation` `[VERIFIED]`

```ts
// GenerateMusicReq
{
  model: "music-2.6" | "music-2.6-free" | "music-cover" | "music-cover-free",
  prompt?: string,              // ≤2000
  lyrics?: string,              // 1..3500; required unless is_instrumental=true
  stream?: boolean,             // default false
  output_format?: "url" | "hex",// default hex; url valid 24h; stream only supports hex
  is_instrumental?: boolean,    // music-2.6 / music-2.6-free only; lyrics not required when true
  lyrics_optimizer?: boolean,   // default false
  audio_setting?: {
    sample_rate?: 16000 | 24000 | 32000 | 44100,
    bitrate?: 32000 | 64000 | 128000 | 256000,
    format?: "mp3" | "wav" | "pcm"
  },
  // Cover-mode inputs (mutually exclusive with prompt-only mode):
  audio_url?: string,           // reference song URL
  audio_base64?: string,
  cover_feature_id?: string     // from /v1/music_cover_preprocess
}
```

```ts
// GenerateMusicResp (example shows extra_info + analysis_info + trace_id at top level)
{
  data: { status: 1 | 2, audio: string /* hex or url */ },
  trace_id: string,
  extra_info: {
    music_duration: number,     // ms
    music_sample_rate: number, music_channel: number,
    bitrate: number, music_size: number
  },
  analysis_info: object | null, // `UNKNOWN:` shape
  base_resp: { status_code, status_msg }
}
```

> Token Plan free tier observation: `music-2.6-free` / `music-cover-free` exist as separate model IDs. `[VERIFIED]` enum; `[INFERRED]` that Token Plan's "free for 2 weeks" intro likely routes through one of them — confirm via mmx-cli source or by inspecting which billing counter increments. Songs ≤5 min, 100/day across all plan tiers.

### 6b. Cover preprocess — `POST /v1/music_cover_preprocess` `[VERIFIED]`

Input: `{ model: "music-cover", audio_url? | audio_base64? }`.
Output: `{ cover_feature_id, formatted_lyrics, structure_result /* JSON string with segments[].label in {intro,verse,chorus,bridge,outro,inst,silence} */, audio_duration, trace_id, base_resp }`. Use `cover_feature_id` to seed a generate call.

### 6c. Lyrics generation `[INFERRED]`

A separate spec exists at `api-reference_lyrics_api_openapi.json` but it failed to parse this session. Endpoint path _probably_ `POST /v1/lyrics_generation`. **Re-fetch and verify before integration.**

---

## 7. File management — `POST /v1/files/*` `[VERIFIED]`

Used as the substrate for async TTS, voice cloning, and video output.

```ts
POST /v1/files/upload                        // multipart/form-data
  fields: { purpose: "voice_clone" | "prompt_audio" | "t2a_async_input", file: <binary> }
  → { file: FileObject, base_resp }

GET  /v1/files/retrieve?file_id=<id>         // returns metadata + 1h download_url
GET  /v1/files/list                          // lists uploaded files
GET  /v1/files/retrieve_content?file_id=<id> // raw binary stream (Content-Type: application/octet-stream)
POST /v1/files/delete                        // body: { file_id, purpose: "voice_clone"|"prompt_audio"|"t2a_async"|"t2a_async_input"|"video_generation" }
```

```ts
type FileObject = {
  file_id: number;
  bytes: number;
  created_at: number; // unix seconds
  filename: string;
  purpose: string;
  download_url?: string; // present on /retrieve, valid 1 hour
};
```

> Note: `purpose` enum on **upload** does NOT include `video_generation` — videos are _produced by_ the video API and only **retrieved/deleted** via the file API. The delete enum reflects this asymmetry (`video_generation` is delete-only).

---

## 8. CLI — `mmx-cli` `[VERIFIED]` (install/usage names; `UNKNOWN:` per-command flag schema)

```bash
npm install -g mmx-cli
mmx auth login --api-key sk-cp-xxxxx        # Token Plan key prefix sk-cp-
mmx text chat --message "Write a 4-line poem about AI"
mmx image "Cyberpunk city night scene, 16:9"
mmx video generate --prompt "At sunset, a cat sits by the window..."
mmx speech synthesize --text "Welcome..." --out voiceover.mp3
mmx music generate --prompt "Upbeat jazz song" --out jazz.mp3
mmx resources                # quota dashboard
mmx flags                    # ?
mmx usage                    # ?
mmx help
```

Source: <https://github.com/MiniMax-AI/cli> (referenced; not cloned this session). Outputs default to `minimax-output/`. Supports vision understanding (image input) and a built-in `web search` capability — both via Token Plan MCP tools per the docs blurb (`UNKNOWN:` whether these are exposed as standalone HTTP endpoints we could call directly).

> For the personal-cloud-platform integration, the CLI is **not** something we depend on; it's relevant only as a sanity check / smoke-test of an account's quota. We will call the HTTP API directly from a TypeScript service.

---

## 9. Rate limits & quota visibility

### 9a. HTTP-level rate limits `[VERIFIED]` (`guides_rate-limits.txt`)

| API                  | Model(s)               | RPM     | TPM / CONN               |
| -------------------- | ---------------------- | ------- | ------------------------ |
| Text                 | all M2 variants        | **500** | **20,000,000 TPM**       |
| Speech T2A           | all                    | 60      | 20,000 TPM               |
| Speech Voice Cloning | —                      | 60      | —                        |
| Speech Voice Design  | —                      | 20      | —                        |
| Video                | Hailuo 2.3 + 02 series | **5**   | —                        |
| Image                | image-01               | **10**  | 60 TPM                   |
| Music                | music-2.6              | 120     | **20 CONN** (concurrent) |

> These are per-account caps applied separately from quota. **Video at 5 RPM is the binding constraint** for any batch pipeline.

### 9b. Token Plan quotas `[VERIFIED]` (`token-plan_intro.txt`)

**Standard plans:** Starter / Plus / Max
| Resource | Starter | Plus | Max |
|---|---|---|---|
| M2.7 | 1,500 req / 5h | 4,500 req / 5h | 15,000 req / 5h |
| Speech 2.8 | — | 4,000 chars/day | 11,000 chars/day |
| image-01 | — | 50 imgs/day | 120 imgs/day |
| Hailuo-2.3 / -2.3-Fast (768P 6s) | — | — | 2/day each |
| Music-2.6 (≤5 min) | 100/day (free 2 weeks) | 100/day | 100/day |

**Highspeed plans:** Plus-Highspeed / Max-Highspeed / Ultra-Highspeed
| Resource | Plus-HS | Max-HS | Ultra-HS |
|---|---|---|---|
| M2.7-highspeed | 4,500 req / 5h | 15,000 req / 5h | 30,000 req / 5h |
| Speech 2.8 | 9,000 chars/day | 19,000 chars/day | 50,000 chars/day |
| image-01 | 100 imgs/day | 200 imgs/day | 800 imgs/day |
| Hailuo-2.3 / -2.3-Fast (768P 6s) | — | 3/day each | 5/day each |
| Music-2.6 | 100/day | 100/day | 100/day |

> Two distinct windows: **M2.7 = 5-hour rolling**; everything else = **calendar-day**. On exhaustion: switch to PAYG key OR wait for the window to reset. The docs do not say what reset clock the day uses (`UNKNOWN:` UTC vs Asia/Shanghai).

### 9c. Quota visibility — `GET /v1/token_plan/remains` `[VERIFIED]` (undocumented; via `mmx-cli` v1.0.12)

**This endpoint is not in any public OpenAPI spec.** It was extracted from the `mmx-cli` npm bundle (`mmx-cli@1.0.12`, `dist/mmx.mjs`). It powers `mmx quota show` and is also used internally by the CLI for region detection (probes both `api.minimax.io` and `api.minimaxi.com` to discover which one accepts the key).

**Request:**

```
GET https://api.minimax.io/v1/token_plan/remains          # global
GET https://api.minimaxi.com/v1/token_plan/remains        # China
Authorization: Bearer <api_key>                           # OR  x-api-key: <api_key>
Content-Type: application/json
```

No query params, no body. The CLI tries `Authorization: Bearer …` first and falls back to `x-api-key: …` on non-2xx — both work today.

**Response (verified shape, derived from CLI's typed parser):**

```ts
type TokenPlanRemainsResp = {
  base_resp: { status_code: number; status_msg?: string }; // 0 == success
  model_remains: Array<{
    model_name: string; // e.g. "MiniMax-M2", "speech-2.8-hd", "image-01", "MiniMax-Hailuo-2.3", "music-2.6"
    current_interval_total_count: number; // quota cap for the active window
    current_interval_usage_count: number; // consumed; remaining = total - usage
    weekly_start_time: number; // ms-epoch (consumed via `new Date(t)`)
    weekly_end_time: number; // ms-epoch — when the window resets
  }>;
};
```

> The `weekly_*` field naming is misleading: for M2.7 the window is the 5-hour rolling window; for daily-quota models it's the calendar-day window. Trust `weekly_end_time` as the canonical reset timestamp regardless of model.

**Integration implications.**

1. **Proactive metering is now possible.** Before any provider call, fetch `model_remains`, find the matching `model_name`, and refuse / fallback locally if `current_interval_usage_count >= current_interval_total_count`. Cache the result for ~30s to avoid hammering this endpoint.
2. **Reset-time UX.** Surface `weekly_end_time` to the user as "you'll be unblocked at {time}" instead of a vague "quota exceeded — try again later".
3. **Multi-key support.** The same endpoint can validate _which_ region a key belongs to (Lo() in CLI source). When loading a user's key, ping both bases and pick the one that returns `base_resp.status_code === 0` — exactly how mmx-cli does region detection.
4. **Reactive fallback still required.** Quota state changes between the metering call and the actual model call. Always handle 1028/1030/2056/2061 errors below in addition to checking `model_remains`.

> **Stability caveat.** This is an **undocumented internal endpoint** used by an official CLI. It can change without a deprecation notice. Wrap it behind a single repository function so it can be replaced if the shape shifts. Treat as `[VERIFIED-via-implementation]`, not `[VERIFIED-via-public-docs]`.

### 9d. Error code reference `[VERIFIED]`

| Code         | Meaning                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| 1000         | unknown                                                                                               |
| 1001         | timeout                                                                                               |
| 1002         | rate limit (HTTP-level RPM/TPM)                                                                       |
| 1004         | not authorized                                                                                        |
| 1008         | insufficient balance (PAYG)                                                                           |
| 1024         | internal                                                                                              |
| 1026         | input sensitive (hard block, no content returned)                                                     |
| 1027         | output sensitive                                                                                      |
| 1033         | system error                                                                                          |
| 1039         | token limit                                                                                           |
| 1041         | concurrent connection limit                                                                           |
| 1042         | invisible-character ratio >10%                                                                        |
| 1043         | ASR similarity check failed (clone)                                                                   |
| 1044         | clone-prompt similarity check failed                                                                  |
| 2013         | invalid params                                                                                        |
| 20132        | invalid samples / voice_id (clone)                                                                    |
| 2037         | voice duration                                                                                        |
| 2039         | duplicate voice_id                                                                                    |
| 2042         | no voice_id access                                                                                    |
| 2045         | rate growth limit                                                                                     |
| 2048         | prompt audio too long                                                                                 |
| 2049         | invalid api key                                                                                       |
| **2056**     | **usage limit exceeded (Token Plan window or PAYG cap)**                                              |
| **1028**     | **quota exhausted** (Token Plan path; mapped same as 2056 by `mmx-cli`) `[VERIFIED]` from CLI source  |
| **1030**     | **quota exhausted** (Token Plan path; alt code) `[VERIFIED]` from CLI source                          |
| **2061**     | **model not available on current Token Plan tier** (e.g. calling music-2.6 on Plus) `[VERIFIED]`      |
| HTTP 429     | rate limit OR quota — body distinguishes via `base_resp.status_code` (1028/1030 → quota; 1002 → rate) |
| HTTP 401/403 | API key rejected → re-auth                                                                            |
| HTTP 408/504 | timeout                                                                                               |

**Plan-tier requirements** `[VERIFIED]` (from `mmx-cli` model-gate logic). Calling a model your plan doesn't include returns 2061:

| Surface                            | Minimum plan                    |
| ---------------------------------- | ------------------------------- |
| `/v1/t2a_v2`, `/v1/t2a_async_v2`   | Plus                            |
| `/v1/image_generation` (image-01)  | Plus                            |
| `/v1/video_generation` + query     | **Max** (Hailuo-2.3 / 2.3-Fast) |
| `/v1/music_generation` (music-2.6) | **Max**                         |
| `/anthropic/v1/messages` (M2.7)    | Starter (i.e. all tiers)        |

### 9e. Other undocumented endpoints discovered in `mmx-cli` `[VERIFIED-via-implementation]`

Extracted from `mmx-cli@1.0.12` `dist/mmx.mjs`. None of these are in the public OpenAPI specs.

| Path                          | Used by                      | Notes                                                                                                                                                                        |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/token_plan/remains`  | `mmx quota show`             | See §9c above.                                                                                                                                                               |
| `POST /v1/coding_plan/search` | `mmx web-search` CLI command | Web-search MCP tool surfaced as raw HTTP. Schema not extracted. `UNKNOWN:` request shape.                                                                                    |
| `POST /v1/coding_plan/vlm`    | `mmx vision` CLI command     | Vision / image-understanding (VLM) endpoint. `UNKNOWN:` request shape; likely `{model, messages: [{role, content: [{type:"image_url", image_url:{url}}]}]}` based on naming. |
| `POST /v1/oauth/device/code`  | `mmx auth login`             | Device-flow code issuance. See OAuth row in §1.                                                                                                                              |
| `POST /v1/oauth/token`        | `mmx auth login` callback    | Exchanges device/auth code for `{access_token, expires_in, account}`.                                                                                                        |

> **Risk note.** `coding_plan/*` paths are CLI-internal naming and are **not** mentioned in any public docs. Treat as discovery hints only — if you need vision or web-search in the platform, prefer the documented native v2 multimodal `content` array (vision) and an external search provider (web search) until the `coding_plan` endpoints are publicly documented.

---

## 10. OpenAI compatibility matrix (M2.7)

| Feature                                   | Anthropic-compat (`/anthropic/v1/messages`)                                  | OpenAI-compat (`/v1/chat/completions`)                                                                    | Native v2 (`/v1/text/chatcompletion_v2`)                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Auth                                      | Bearer                                                                       | Bearer                                                                                                    | Bearer                                                                              |
| `model` enum                              | M2.7 / -highspeed / 2.5 / 2.1                                                | same                                                                                                      | same + 2.5-highspeed / M2 / Text-01                                                 |
| Streaming                                 | ✅ Anthropic events                                                          | ✅ OpenAI chunks                                                                                          | ✅ OpenAI chunks                                                                    |
| `max_tokens` cap                          | 2048                                                                         | 2048                                                                                                      | unbounded in schema (`max_completion_tokens` superset)                              |
| **Tool calls (`tools`)**                  | not in schema (`UNKNOWN:`)                                                   | not in schema, **but works in practice** (doc/reality mismatch)                                           | ✅ documented                                                                       |
| **Structured output (`response_format`)** | ❌                                                                           | ❌                                                                                                        | ✅ (Text-01 only per spec)                                                          |
| **Multimodal input (`image_url`)**        | ❌ (text/thinking only)                                                      | ❌ (string content only)                                                                                  | ✅                                                                                  |
| **Reasoning visibility**                  | separate `thinking` content blocks with `signature`                          | inline `<think>...</think>` in content; `extra_body.reasoning_split=true` moves it to `reasoning_details` | `reasoning_content` field on message + `completion_tokens_details.reasoning_tokens` |
| **PII masking**                           | ❌                                                                           | ❌                                                                                                        | ✅ `mask_sensitive_info`                                                            |
| **Content-safety flags**                  | only via `base_resp.status_code`                                             | ✅ `input_sensitive` / `output_sensitive` + `_type`                                                       | ✅ same                                                                             |
| **Cache fields in usage**                 | ✅ `cache_creation_input_tokens`, `cache_read_input_tokens`                  | ❌                                                                                                        | ❌                                                                                  |
| **Recommended for**                       | Token Plan default; multi-turn conversation; agentic loops via Anthropic SDK | drop-in replacement for OpenAI-SDK callers                                                                | new code that wants tools + structured output + vision                              |

---

## 11. Open questions / things to verify with the user

These are the gaps that should NOT block planning, but SHOULD be flagged in the plan as "verify in spike before implementing":

1. ~~**Quota-read endpoint.**~~ **RESOLVED** — `GET /v1/token_plan/remains` exists, see §9c. Plan can do **proactive metering** plus reactive 1028/1030/2056/2061 handling. No longer blocking.

2. **OpenAI-compat tool support.** The schema is incomplete; the guide proves `tools` works against `/v1/chat/completions`. Open question: are _all_ native v2 fields silently accepted (`response_format`, `mask_sensitive_info`, multimodal `content` arrays)? Recommend: spike-test by sending a native-v2 body to `/v1/chat/completions` and observe.

3. **`reasoning_split` and `reasoning_details` JSON shape.** Confirmed exists; exact payload shape is undocumented in the OpenAPI. Need a real call to capture.

4. **Voice design billing on Token Plan.** Spec says voice design preview is "$30 per 1M characters". Does this come out of the Token Plan quota or is it billed separately? Worth confirming before exposing voice design in any user-facing UI.

5. **Token Plan day-window timezone.** Daily quotas reset on `UNKNOWN:` UTC vs Asia/Shanghai. Affects when our "you'll be unblocked at X" UX message points to.

6. **Music free-tier model routing.** Are `music-2.6-free` and `music-cover-free` only available during the 2-week intro, or always available with reduced features? `[INFERRED]` from naming only.

7. **Video `callback_url` payload + auth.** The 1.8KB description was truncated in extraction. Need to either re-extract or test live to learn payload shape, retry policy, and whether MiniMax signs the request (HMAC, secret).

8. **WebSocket TTS — when worth it?** AsyncAPI exists; we did not deeply read it. Defer until we have a measurable latency requirement that SSE can't meet.

9. ~~**Lyrics generation + video templates** — both have OpenAPI docs that failed to parse.~~ **RESOLVED (negative result)** — re-checked the docs nav: the only video spec published is `/api-reference/video/generation/api/openapi.json` (covers T2V, I2V, start-end, subject-ref; no separate template spec). Music has a single combined spec at `/api-reference/music/api/openapi.json` covering both `music_generation` and `music_cover_preprocess`; lyrics-generation has **no published OpenAPI spec** at all — it's prose-docs-only, or not yet a public endpoint. No malformed-spec issue; the prior session's "4 malformed JSON" notes were chasing paths that simply don't exist.

10. **Token Plan MCP tools** (web search, image understanding) referenced in CLI docs — `mmx-cli` exposes them as `POST /v1/coding_plan/search` and `POST /v1/coding_plan/vlm` (see §9e). Endpoints are confirmed to exist; **request schemas not extracted** this session. `UNKNOWN:` payload shape — defer until needed and capture from a real CLI run.

11. **ASR / audio understanding endpoint.** The `MiniMax-Audio-01` family (referenced in older marketing) has no OpenAPI in our 17 specs. Either it doesn't exist in the public surface today or it's at a path we didn't probe. `UNKNOWN:` — explicitly out-of-scope for "Token Plan" since the plan covers only TTS, not ASR.

---

## ⚠️ Verification needed before implementation

Claims in this document NOT directly schema-verified by a published OpenAPI:

- That `tools` works against `/v1/chat/completions` despite not being in the OpenAPI (covered in §2c discrepancy box). High confidence — guide explicitly demonstrates it.
- The JSON shape of `reasoning_details` when `reasoning_split: true`.
- That video `callback_url` does what we'd expect (POST with at least `task_id` + status).
- **§9c quota endpoint, §1 OAuth device flow, §9e `coding_plan/*` endpoints**: extracted from `mmx-cli@1.0.12` source, NOT from public OpenAPI. They're real and ship in the official CLI, but **MiniMax can change them without notice**. Wrap each behind a single repository function, log shape mismatches, and treat as `[VERIFIED-via-implementation]` rather than `[VERIFIED-via-public-docs]`.
- **§9d additional error codes (1028, 1030, 2061)**: extracted from CLI's error mapper, not from the published `api-reference/errorcode` page. Likely real but worth confirming on a live quota-exhaustion event.

Everything else in §1–§9 is grounded directly in the downloaded OpenAPI/AsyncAPI/prose under `/tmp/mmx/` (or, for §9c/§9e, in the decompiled `mmx-cli` bundle at `/tmp/mmx/cli/package/dist/mmx.mjs`).
