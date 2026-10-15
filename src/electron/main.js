"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
function ensureTray() {
  if (process.platform !== "win32") return true;
  const b = tray.getBounds();
  if (b.width > 0 && b.height > 0) return true;
  const script = node_path_1.default.join(
    electron_1.app.getAppPath(),
    "dist-electron",
    "repair-tray.ps1",
  );
  const result = (0, node_child_process_1.spawnSync)(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-OwnerPid",
      String(process.pid),
      "-IconPath",
      node_path_1.default.join(
        electron_1.app.getAppPath(),
        "assets",
        "tray.ico",
      ),
    ],
    { stdio: "inherit", windowsHide: true, timeout: 15000 },
  );
  const after = tray.getBounds();
  console.log("Tray registration verification", after);
  return result.status === 0 && after.width > 0 && after.height > 0;
}
const settings_1 = require("./settings");
const smoke = process.argv.includes("--smoke-test");
if (smoke)
  electron_1.app.setPath(
    "userData",
    node_path_1.default.join(process.cwd(), "artifacts", "smoke-profile"),
  );
let win;
let tray;
let settings = { ...settings_1.defaults };
let mode = "pet";
let through = false;
let quitting = false;
let drag;
let saveTimer;
const settingsPath = () =>
  node_path_1.default.join(
    electron_1.app.getPath("userData"),
    "desktop-settings.json",
  );
function save() {
  try {
    node_fs_1.default.mkdirSync(electron_1.app.getPath("userData"), {
      recursive: true,
    });
    const file = settingsPath();
    node_fs_1.default.writeFileSync(
      file + ".tmp",
      JSON.stringify(settings, null, 2),
    );
    node_fs_1.default.renameSync(file + ".tmp", file);
  } catch (e) {
    console.error("Settings save failed", e);
  }
}
function remember() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  settings[mode === "pet" ? "petPosition" : "panelPosition"] = { x, y };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}
function state() {
  return {
    mode,
    activity: settings.activity,
    alwaysOnTop: settings.alwaysOnTop,
    clickThrough: through,
    scale: settings.scale,
    hidden: !win.isVisible() || win.isMinimized(),
    animation: win.isVisible() && !win.isMinimized(),
  };
}
function publish() {
  if (!win.isDestroyed()) win.webContents.send("desktop:updated", state());
  if (tray) tray.setContextMenu(menu());
}
function areas() {
  return electron_1.screen.getAllDisplays().map((d) => d.workArea);
}
function recover() {
  const [width, height] = win.getSize();
  const [x, y] = win.getPosition();
  win.setPosition(
    ...toTuple(
      (0, settings_1.clampPosition)({ x, y }, { width, height }, areas()),
    ),
  );
  remember();
}
function toTuple(p) {
  return [p.x, p.y];
}
function setThrough(value) {
  through = value;
  win.setIgnoreMouseEvents(value, { forward: true });
  publish();
}
function setMode(next) {
  remember();
  const desired = settings[next === "pet" ? "petPosition" : "panelPosition"];
  mode = next;
  through = false;
  win.setIgnoreMouseEvents(false);
  const width = mode === "pet" ? Math.round(230 * settings.scale) : 440;
  const height = mode === "pet" ? Math.round(270 * settings.scale) : 660;
  win.setResizable(true);
  win.setMinimumSize(1, 1);
  win.setMaximumSize(10000, 10000);
  win.setSize(width, height, false);
  win.setMinimumSize(width, height);
  win.setMaximumSize(width, height);
  win.setResizable(false);
  const area = electron_1.screen.getPrimaryDisplay().workArea;
  const position = desired ?? {
    x: area.x + area.width - width - 30,
    y: area.y + area.height - height - 30,
  };
  win.setPosition(
    ...toTuple(
      (0, settings_1.clampPosition)(position, { width, height }, areas()),
    ),
  );
  if (win.isMinimized()) win.restore();
  win.setSkipTaskbar(mode === "pet");
  win.showInactive();
  publish();
}
function command(action, value) {
  switch (action) {
    case "mode":
      if (value === "pet" || value === "panel") setMode(value);
      break;
    case "activity":
      if (
        typeof value === "string" &&
        ["idle", "meditate", "walk", "alchemy", "sword"].includes(value)
      ) {
        settings.activity = value;
        save();
      }
      break;
    case "top":
      if (typeof value === "boolean") {
        settings.alwaysOnTop = value;
        win.setAlwaysOnTop(value);
        save();
      }
      break;
    case "through":
      if (typeof value === "boolean" && mode === "pet") setThrough(value);
      break;
    case "scale":
      if (typeof value === "number" && [0.75, 1, 1.25].includes(value)) {
        settings.scale = value;
        save();
        if (mode === "pet") setMode("pet");
      }
      break;
    case "hide":
      remember();
      if (!ensureTray()) {
        console.error("Tray registration failed; retaining taskbar recovery");
        win.setSkipTaskbar(false);
        win.minimize();
      } else {
        win.setSkipTaskbar(true);
        win.hide();
      }
      break;
    case "menu":
      electron_1.Menu.buildFromTemplate(menuTemplate()).popup({ window: win });
      break;
    case "drag-start": {
      const p = value;
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && mode === "pet") {
        const [x, y] = win.getPosition();
        drag = { cursor: p, origin: { x, y } };
      }
      break;
    }
    case "drag-move": {
      const p = value;
      if (drag && p && Number.isFinite(p.x) && Number.isFinite(p.y))
        win.setPosition(
          Math.round(drag.origin.x + p.x - drag.cursor.x),
          Math.round(drag.origin.y + p.y - drag.cursor.y),
        );
      break;
    }
    case "drag-end":
      drag = undefined;
      recover();
      break;
    default:
      throw new Error("Unsupported desktop command");
  }
  publish();
  return state();
}
function menuTemplate() {
  return [
    { label: "打开洞府", click: () => setMode("panel") },
    { label: "显示桌宠", click: () => setMode("pet") },
    { label: "恢复鼠标交互", enabled: through, click: () => setThrough(false) },
    {
      label: "桌宠鼠标穿透",
      type: "checkbox",
      checked: through,
      enabled: mode === "pet",
      click: (item) => setThrough(item.checked),
    },
    {
      label: "始终置顶",
      type: "checkbox",
      checked: settings.alwaysOnTop,
      click: (item) => command("top", item.checked),
    },
    {
      label: "动作预览",
      submenu: [
        ["meditate", "打坐"],
        ["idle", "待机"],
        ["walk", "行走"],
        ["alchemy", "炼丹"],
        ["sword", "御剑"],
      ].map(([value, label]) => ({
        label,
        type: "radio",
        checked: settings.activity === value,
        click: () => command("activity", value),
      })),
    },
    {
      label: "桌宠大小",
      submenu: [0.75, 1, 1.25].map((value) => ({
        label: `${Math.round(value * 100)}%`,
        type: "radio",
        checked: settings.scale === value,
        click: () => command("scale", value),
      })),
    },
    { type: "separator" },
    { label: "隐藏到托盘 / 菜单栏", click: () => command("hide") },
    {
      label: "退出",
      click: () => {
        quitting = true;
        electron_1.app.quit();
      },
    },
  ];
}
function menu() {
  return electron_1.Menu.buildFromTemplate(menuTemplate());
}
function trayIcon() {
  return electron_1.nativeImage.createFromBuffer(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAvklEQVR4nGNgGGDAiE/y7fnm/9SwRNiwFqc9jLS0mBiHMOKzXHvCMapYfLXACqcjGLFZTi2LcTkE2RFM9LIc2WzkUGZiGGDASInvn08sgbMl83vIigomhgEGTKMOYBjpUcBCToonVp6YnMHEMFRCQBKLb8gtBwZVCDCNOoBhNAoGGDCNeAewkBIC+IpjdDliCyYm5EYicuuVVgC9YcpCimZyi1uiEqEwHUIBW7OccVB1TAZF14wBCdCjczrgAADeylC/wSX/SgAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
}
if (!electron_1.app.requestSingleInstanceLock()) {
  electron_1.app.quit();
} else {
  electron_1.app.on("second-instance", () => {
    if (win) {
      setMode("panel");
      win.show();
      win.focus();
    }
  });
  electron_1.app.whenReady().then(async () => {
    try {
      settings = (0, settings_1.normalizeSettings)(
        JSON.parse(node_fs_1.default.readFileSync(settingsPath(), "utf8")),
      );
    } catch {
      settings = { ...settings_1.defaults };
    }
    win = new electron_1.BrowserWindow({
      width: 230,
      height: 270,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: settings.alwaysOnTop,
      webPreferences: {
        preload: node_path_1.default.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.setMenu(null);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event) => event.preventDefault());
    win.on("close", (event) => {
      if (!quitting) {
        event.preventDefault();
        command("hide");
      }
    });
    win.on("move", remember);
    win.on("show", publish);
    win.on("hide", publish);
    win.on("minimize", publish);
    win.on("restore", () => {
      through = false;
      win.setIgnoreMouseEvents(false);
      recover();
      publish();
    });
    tray = new electron_1.Tray(trayIcon());
    tray.setToolTip("尘途修仙 · 本地桌宠原型");
    tray.on("click", () => {
      setMode("panel");
      win.show();
      win.focus();
    });
    tray.on("double-click", () => {
      setMode("panel");
      win.show();
      win.focus();
    });
    tray.setContextMenu(menu());
    electron_1.ipcMain.handle("desktop:state", (event) => {
      if (event.sender !== win.webContents) throw new Error("Invalid sender");
      return state();
    });
    electron_1.ipcMain.handle("desktop:command", (event, action, value) => {
      if (event.sender !== win.webContents || typeof action !== "string")
        throw new Error("Invalid sender");
      return command(action, value);
    });
    electron_1.screen.on("display-removed", recover);
    electron_1.screen.on("display-metrics-changed", recover);
    electron_1.powerMonitor.on("resume", () => {
      recover();
      publish();
    });
    win.webContents.on("render-process-gone", (_event, details) =>
      console.error("Renderer gone", details),
    );
    ensureTray();
    await win.loadFile(
      node_path_1.default.join(__dirname, "../dist/index.html"),
    );
    setMode("pet");
    if (smoke) {
      try {
        await runSmoke();
      } catch (e) {
        console.error(e);
        electron_1.app.exit(1);
      }
    }
  });
  electron_1.app.on("activate", () => {
    if (win) setMode("panel");
  });
  electron_1.app.on("before-quit", () => {
    quitting = true;
    remember();
    if (saveTimer) clearTimeout(saveTimer);
    save();
  });
  electron_1.app.on("window-all-closed", () => {
    if (quitting) electron_1.app.quit();
  });
}
async function runSmoke() {
  const assert = (ok, label) => {
    if (!ok) throw new Error(label);
  };
  const wait = () => new Promise((resolve) => setTimeout(resolve, 400));
  await wait();
  assert(
    await win.webContents.executeJavaScript(
      '!!window.desktop && document.querySelectorAll("svg").length > 0',
    ),
    "bridge and character mounted",
  );
  const bridged = await win.webContents.executeJavaScript(
    "window.desktop.getState()",
  );
  assert(bridged.mode === "pet", "renderer IPC state");
  command("activity", "alchemy");
  command("top", true);
  assert(win.isAlwaysOnTop(), "top");
  command("top", false);
  command("scale", 1.25);
  assert(win.getSize()[0] === 288, "scale");
  command("through", true);
  assert(state().clickThrough, "through");
  command("through", false);
  await win.webContents.executeJavaScript(
    'window.desktop.command("mode","panel")',
  );
  await wait();
  assert(state().mode === "panel" && win.getSize()[0] === 440, "panel");
  assert(
    await win.webContents.executeJavaScript(
      'document.body.innerText.includes("服务器未接入")',
    ),
    "panel UI synchronized",
  );
  node_fs_1.default.mkdirSync(
    node_path_1.default.join(process.cwd(), "artifacts"),
    { recursive: true },
  );
  node_fs_1.default.writeFileSync(
    node_path_1.default.join(process.cwd(), "artifacts", "panel.png"),
    (await win.webContents.capturePage()).toPNG(),
  );
  for (let i = 0; i < 5; i++) {
    command("mode", "pet");
    await wait();
    assert(
      win.getSize()[0] === 288 && win.getSize()[1] === 338,
      "pet exact size",
    );
    command("mode", "panel");
    await wait();
    assert(
      win.getSize()[0] === 440 && win.getSize()[1] === 660,
      "panel stable size",
    );
  }
  await win.webContents.executeJavaScript(
    'document.querySelector(".icon-action").click()',
  );
  await wait();
  assert(state().hidden && !win.isVisible(), "minus hides to tray");
  assert(!tray.isDestroyed() && !trayIcon().isEmpty(), "tray alive with icon");
  tray.emit("click");
  await wait();
  assert(
    !state().hidden && state().mode === "panel",
    "tray click restores panel",
  );
  win.close();
  await wait();
  assert(state().hidden, "close hides to tray");
  tray.emit("double-click");
  await wait();
  assert(!state().hidden, "tray double-click restores");
  command("mode", "pet");
  command("scale", 1);
  command("activity", "meditate");
  await wait();
  node_fs_1.default.writeFileSync(
    node_path_1.default.join(process.cwd(), "artifacts", "pet.png"),
    (await win.webContents.capturePage()).toPNG(),
  );
  win.setPosition(-20000, -20000);
  recover();
  const [x, y] = win.getPosition();
  assert(x > -20000 && y > -20000, "offscreen recovery");
  save();
  assert(
    (0, settings_1.normalizeSettings)(
      JSON.parse(node_fs_1.default.readFileSync(settingsPath(), "utf8")),
    ).activity === "meditate",
    "persistence",
  );
  node_fs_1.default.writeFileSync(
    node_path_1.default.join(process.cwd(), "artifacts", "smoke-result.json"),
    JSON.stringify(
      {
        passed: true,
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        checks: [
          "renderer/bridge",
          "activity",
          "top",
          "scale",
          "through",
          "panel",
          "hide/show",
          "offscreen recovery",
          "settings persistence",
        ],
        macTested: false,
        sandboxDisabledForTest: process.argv.includes("--no-sandbox"),
      },
      null,
      2,
    ),
  );
  console.log("SMOKE PASS");
  quitting = true;
  electron_1.app.quit();
}
