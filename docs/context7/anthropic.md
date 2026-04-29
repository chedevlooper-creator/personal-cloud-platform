# Anthropic SDK (TypeScript) — services/agent/llm

## Stream messages

```ts
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

const stream = client.messages
  .stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello' }],
  })
  .on('text', (t) => process.stdout.write(t))
  .on('message', (m) => console.log('done', m.id));

const final = await stream.finalMessage();
console.log('tokens:', final.usage.input_tokens + final.usage.output_tokens);
```

## Tool runner (auto tool execution)

```ts
const calculatorTool = {
  name: 'calc',
  description: 'add two numbers',
  input_schema: {
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  } as const,
  run: async ({ a, b }: { a: number; b: number }) => String(a + b),
};

const runner = client.beta.messages.toolRunner({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'What is 123+456?' }],
  tools: [calculatorTool],
  max_iterations: 5,
});

for await (const message of runner) {
  console.log('msg:', message);
}
const finalMsg = await runner;
```

## Tool runner + streaming

```ts
const runner = client.beta.messages.toolRunner({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'weather?' }],
  tools: [weatherTool],
  stream: true,
});

for await (const ms of runner) {
  for await (const event of ms) {
    /* token deltas */
  }
}
```

## pushMessages (orchestrator)

```ts
runner.pushMessages(
  { role: 'user', content: 'Also consider X' },
  { role: 'assistant', content: 'Got it' },
);
```

## runUntilDone / abort

```ts
const final = await runner.runUntilDone();
// abort: pass AbortSignal to setRequestOptions or generateToolResponse(signal)
```

## Web search built-in tool

```ts
const msg = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'latest in quantum computing?' }],
  tools: [{ name: 'web_search', type: 'web_search_20250305' }],
});
```

## Prompt caching (önerilir)

```ts
await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  system: [
    { type: 'text', text: 'You are CloudMind agent.' },
    {
      type: 'text',
      text: longSystemContext,
      cache_control: { type: 'ephemeral' }, // cache hit ile token tasarrufu
    },
  ],
  messages: [{ role: 'user', content: 'Hi' }],
});
```

## Proje notları
- `services/agent/src/llm/provider.ts` adapter'ı altında Anthropic ve diğerleri ortak interface ile.
- Sistem promptlarını ve tool tanımlarını `cache_control: ephemeral` ile cache'le.
- Tool runner orchestrator'unu mevcut custom orchestrator'la kademeli replace edebilirsiniz.
