const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = process.argv[2] && path.resolve(process.argv[2]);
const output = path.resolve(
  process.argv[3] || path.join(root, "release", "recovered-win"),
);
if (!source || !fs.existsSync(path.join(source, "Chentu.exe"))) {
  throw new Error("Pass the complete original Windows release directory");
}
if (fs.existsSync(output)) {
  throw new Error(`Output already exists: ${output}`);
}
for (const relative of [
  "dist/index.html",
  "dist-electron/main.js",
  "assets/tray.ico",
]) {
  if (!fs.existsSync(path.join(root, relative))) {
    throw new Error(`Build first; missing ${relative}`);
  }
}

fs.mkdirSync(output, { recursive: true });
for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (
    [
      "resources",
      "local-preview-profile",
      "startup-stderr.log",
      "startup-stdout.log",
    ].includes(entry.name)
  )
    continue;
  fs.cpSync(path.join(source, entry.name), path.join(output, entry.name), {
    recursive: true,
  });
}
const outputResources = path.join(output, "resources");
const outputApp = path.join(outputResources, "app");
fs.mkdirSync(outputApp, { recursive: true });
fs.copyFileSync(
  path.join(source, "resources", "default_app.asar"),
  path.join(outputResources, "default_app.asar"),
);
fs.copyFileSync(
  path.join(source, "resources", "app", "package.json"),
  path.join(outputApp, "package.json"),
);
for (const entry of ["dist", "dist-electron", "assets"]) {
  fs.cpSync(path.join(root, entry), path.join(outputApp, entry), {
    recursive: true,
  });
}
console.log(`Packaged recovered prototype: ${output}`);
