const fs = require("node:fs");
const path = require("node:path");

const release = process.argv[2];
if (!release) {
  throw new Error(
    "Usage: node scripts/recover-from-release.cjs <release-directory>",
  );
}

const root = path.resolve(__dirname, "..");
const app = path.join(path.resolve(release), "resources", "app");
const html = fs.readFileSync(path.join(app, "dist", "index.html"), "utf8");
const scriptName = html.match(/src="\.\/assets\/(index-[^"]+\.js)"/)?.[1];
const styleName = html.match(/href="\.\/assets\/(index-[^"]+\.css)"/)?.[1];
if (!scriptName || !styleName) {
  throw new Error("Could not identify the active renderer assets");
}

const bundle = fs.readFileSync(
  path.join(app, "dist", "assets", scriptName),
  "utf8",
);
const start = bundle.indexOf("function cv(");
const appStart = bundle.indexOf("const Ty=", start);
const mount = bundle.indexOf(
  'const dv=document.getElementById("root")',
  appStart,
);
if (
  start < 0 ||
  appStart < 0 ||
  mount < 0 ||
  !bundle.includes("function Ey()", appStart)
) {
  throw new Error(
    "Renderer extraction markers changed; inspect the bundle before recovering",
  );
}

const renderer = path.join(root, "src", "renderer");
const electron = path.join(root, "src", "electron");
fs.mkdirSync(renderer, { recursive: true });
fs.mkdirSync(electron, { recursive: true });
fs.mkdirSync(path.join(root, "assets"), { recursive: true });

const character = bundle.slice(start, appStart).replace(/\bcv\b/g, "Character");
const appCode = bundle
  .slice(appStart, mount)
  .replace(/\bcv\b/g, "Character")
  .replace(/\bEy\b/g, "App")
  .replace(/\bsv\b/g, "SettingRow")
  .replace(/\bTy\b/g, "DEFAULT_STATE")
  .replace(/\bQi\b/g, "ACTIVITIES")
  .replace(/\bYi\b/g, "PLANNED_PAGES");
fs.writeFileSync(
  path.join(renderer, "Character.jsx"),
  [
    "import React from 'react';",
    "import { jsx, jsxs } from 'react/jsx-runtime';",
    "const Ut = React;",
    "const s = { jsx, jsxs };",
    character,
    "export default Character;",
    "",
  ].join("\n"),
);
fs.writeFileSync(
  path.join(renderer, "App.jsx"),
  [
    "import React from 'react';",
    "import { jsx, jsxs, Fragment } from 'react/jsx-runtime';",
    "import Character from './Character.jsx';",
    "const Ut = React;",
    "const s = { jsx, jsxs, Fragment };",
    appCode,
    "export default App;",
    "",
  ].join("\n"),
);
fs.writeFileSync(
  path.join(renderer, "main.jsx"),
  [
    "import React from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import App from './App.jsx';",
    "import './styles.css';",
    "const root = document.getElementById('root');",
    "if (!root) throw new Error('未找到应用挂载节点');",
    "createRoot(root).render(React.createElement(React.StrictMode, null, React.createElement(App)));",
    "",
  ].join("\n"),
);
fs.copyFileSync(
  path.join(app, "dist", "assets", styleName),
  path.join(renderer, "styles.css"),
);
for (const name of [
  "main.js",
  "settings.js",
  "preload.js",
  "repair-tray.ps1",
]) {
  fs.copyFileSync(
    path.join(app, "dist-electron", name),
    path.join(electron, name),
  );
}
fs.copyFileSync(
  path.join(app, "assets", "tray.ico"),
  path.join(root, "assets", "tray.ico"),
);
console.log(`Recovered renderer from ${scriptName} and ${styleName}`);
