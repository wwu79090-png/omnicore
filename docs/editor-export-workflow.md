# Editor Export Workflow

OmniCore.Editor now exposes `exportRunnableProject()` for turning the current scene into a runnable Vite project.

## Editor API

```js
const project = app.EditorAPI.exportRunnableProject({
  projectName: 'my-first-game'
});
```

The returned payload contains:

- `package.json`
- `index.html`
- `src/main.js`
- `assets/manifest.json`
- `scenes/<scene>.scene.json`
- `README.md`

## CLI Smoke Export

```bash
npm run editor:export -- --out dist/editor-runnable-project --projectName demo
```

The generated project can be opened with:

```bash
cd dist/editor-runnable-project
npm install
npm run dev
```

## Validation

- Confirm `src/main.js` imports `omnicore`.
- Confirm `assets/manifest.json` points to the exported scene file.
- Confirm the first scene renders without console error/warn.
- If exporting for WeChat, run `npm run build:wechat` after copying the generated scene and assets into the target project.
