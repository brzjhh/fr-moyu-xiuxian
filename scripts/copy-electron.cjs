const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "src", "electron");
const output = path.join(root, "dist-electron");
fs.mkdirSync(output, { recursive: true });
for (const name of [
  "main.js",
  "settings.js",
  "preload.js",
  "repair-tray.ps1",
]) {
  fs.copyFileSync(path.join(source, name), path.join(output, name));
}
