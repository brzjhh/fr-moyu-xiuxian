const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const releaseRoot = path.join(root, "release");
const version = process.env.RELEASE_VERSION || process.argv[2] || "dev";
const safeVersion = version.replace(/[^0-9A-Za-z._-]/g, "-");
const name = `Chentu-Xiuxian-${safeVersion}-win-x64`;
const output = path.join(releaseRoot, name);

function assertInsideRelease(target) {
  const relative = path.relative(releaseRoot, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Refusing to modify path outside release directory: ${target}`,
    );
  }
}

function requirePath(relative) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target))
    throw new Error(`Missing ${relative}; build first`);
  return target;
}

for (const relative of [
  "node_modules/electron/dist/electron.exe",
  "dist/index.html",
  "dist-electron/main.js",
  "assets/tray.ico",
]) {
  requirePath(relative);
}

assertInsideRelease(output);
fs.rmSync(output, { force: true, recursive: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(requirePath("node_modules/electron/dist"), output, {
  recursive: true,
});
fs.renameSync(
  path.join(output, "electron.exe"),
  path.join(output, "尘途修仙.exe"),
);

const appDirectory = path.join(output, "resources", "app");
fs.mkdirSync(appDirectory, { recursive: true });
for (const entry of ["dist", "dist-electron", "assets"]) {
  fs.cpSync(requirePath(entry), path.join(appDirectory, entry), {
    recursive: true,
  });
}
fs.copyFileSync(
  requirePath("package.json"),
  path.join(appDirectory, "package.json"),
);

const commit = process.env.GITHUB_SHA || "local-build";
fs.writeFileSync(
  path.join(output, "使用说明.txt"),
  [
    `尘途修仙 ${version}`,
    "Windows x64 未签名免安装测试版",
    "",
    `来源提交：${commit}`,
    "",
    "完整解压后双击“尘途修仙.exe”。不要单独移动 EXE。",
    "本版本没有服务器账号或云同步，更新前请在设置中导出 JSON 存档。",
    "Windows 可能显示 SmartScreen 警告，请仅从项目 GitHub Release 下载。",
    "",
  ].join("\r\n"),
  "utf8",
);

console.log(output);
