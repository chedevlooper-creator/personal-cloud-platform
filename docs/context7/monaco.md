# Monaco Editor — apps/web

## Model & editor

```ts
import * as monaco from 'monaco-editor';

const uri = monaco.Uri.parse('file:///main.ts');
const model = monaco.editor.createModel('', 'typescript', uri);

const editor = monaco.editor.create(container, { model, automaticLayout: true });

model.onDidChangeContent((e) => {
  // debounce + autosave to workspace service
});

// Cleanup
editor.dispose();
model.dispose();
```

## Mevcut model'i bul / list

```ts
const m = monaco.editor.getModel(uri);
const all = monaco.editor.getModels();
```

## TypeScript compiler/diagnostics + extra libs

```ts
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ES2020,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  module: monaco.languages.typescript.ModuleKind.CommonJS,
  strict: true,
  jsx: monaco.languages.typescript.JsxEmit.React,
});

monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
});

monaco.languages.typescript.typescriptDefaults.addExtraLib(
  `declare interface User { id: number; name: string }`,
  'ts:custom/globals.d.ts',
);
```

## JSON schema validation

```ts
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: true,
  schemas: [{
    uri: 'http://app/config-schema.json',
    fileMatch: ['inmemory://model/config.json'],
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
      },
      required: ['version'],
    },
  }],
});
```

## Diff editor

```ts
const orig = monaco.editor.createModel('a', 'text/plain');
const mod = monaco.editor.createModel('b', 'text/plain');
const diff = monaco.editor.createDiffEditor(container, { renderSideBySide: true, automaticLayout: true });
diff.setModel({ original: orig, modified: mod });
```

## Custom dil (Monarch)

```ts
monaco.languages.register({ id: 'pcpLog' });
monaco.languages.setMonarchTokensProvider('pcpLog', {
  tokenizer: {
    root: [
      [/\[error\]/, 'custom-error'],
      [/\d{4}-\d{2}-\d{2}/, 'custom-date'],
      [/"[^"]*"/, 'string'],
    ],
  },
});
```

## Webpack / Next worker config

```js
// next.config.ts → webpack
import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
  getWorkerUrl: (_id, label) => {
    if (label === 'json') return '/_next/static/monaco/json.worker.js';
    if (label === 'css' || label === 'scss') return '/_next/static/monaco/css.worker.js';
    if (label === 'html') return '/_next/static/monaco/html.worker.js';
    if (label === 'typescript' || label === 'javascript') return '/_next/static/monaco/ts.worker.js';
    return '/_next/static/monaco/editor.worker.js';
  },
};
```

## Proje notları
- Next.js 16 + Monaco için `@monaco-editor/react` veya `monaco-editor-webpack-plugin` ile build pipeline ayarla.
- Worker'lar dinamik chunk olduğundan SSR'da `'use client'` gerekli.
- File auto-save: workspace API'sine PATCH; multi-tenant path = `/{userId}/{workspaceId}/...`.
