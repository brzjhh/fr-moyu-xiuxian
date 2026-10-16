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
const cultivation_1 = require("./cultivation");
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
let game = (0, cultivation_1.createGameState)();
let gameDirty = false;
let gameTickTimer;
let gameSaveTimer;
const settingsPath = () =>
  node_path_1.default.join(
    electron_1.app.getPath("userData"),
    "desktop-settings.json",
  );
const gamePath = () =>
  node_path_1.default.join(
    electron_1.app.getPath("userData"),
    "cultivation-save.json",
  );
function writeJsonAtomic(file, value) {
  node_fs_1.default.mkdirSync(node_path_1.default.dirname(file), {
    recursive: true,
  });
  node_fs_1.default.writeFileSync(
    file + ".tmp",
    JSON.stringify(value, null, 2),
  );
  node_fs_1.default.renameSync(file + ".tmp", file);
}
function saveGame() {
  try {
    writeJsonAtomic(gamePath(), game);
    gameDirty = false;
  } catch (e) {
    console.error("Cultivation save failed", e);
  }
}
function settleGame(options) {
  const result = (0, cultivation_1.settleGameState)(game, Date.now(), options);
  game = result.state;
  if (result.gained > 0) gameDirty = true;
  return result;
}
function publicGameState() {
  settleGame();
  return (0, cultivation_1.toPublicGameState)(game);
}
function publishGame() {
  if (win && !win.isDestroyed())
    win.webContents.send("game:updated", publicGameState());
}
function loadGame() {
  if (smoke) {
    game = (0, cultivation_1.createGameState)(Date.now());
    gameDirty = true;
    return;
  }
  try {
    game = (0, cultivation_1.normalizeGameState)(
      JSON.parse(node_fs_1.default.readFileSync(gamePath(), "utf8")),
    );
  } catch (e) {
    if (e && e.code !== "ENOENT") {
      console.error("Cultivation load failed", e);
      try {
        node_fs_1.default.copyFileSync(
          gamePath(),
          `${gamePath()}.invalid-${Date.now()}.json`,
        );
      } catch (backupError) {
        console.error("Invalid cultivation save backup failed", backupError);
      }
    }
    game = (0, cultivation_1.createGameState)(Date.now());
  }
  settleGame({ recordOffline: true });
  gameDirty = true;
}
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
        game = (0, cultivation_1.setCultivating)(
          game,
          value === "meditate",
          Date.now(),
        );
        gameDirty = true;
        saveGame();
        publishGame();
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
async function gameCommand(action) {
  switch (action) {
    case "breakthrough": {
      const result = (0, cultivation_1.breakthrough)(game, Date.now());
      game = result.state;
      gameDirty = true;
      saveGame();
      publishGame();
      return { state: publicGameState(), message: result.message };
    }
    case "export": {
      settleGame();
      saveGame();
      const result = await electron_1.dialog.showSaveDialog(win, {
        title: "导出尘途修仙存档",
        defaultPath: "尘途修仙-青岚-存档.json",
        filters: [{ name: "JSON 存档", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePath)
        return { state: publicGameState(), message: "已取消导出。" };
      writeJsonAtomic(result.filePath, game);
      return { state: publicGameState(), message: "存档已导出。" };
    }
    case "import": {
      const result = await electron_1.dialog.showOpenDialog(win, {
        title: "导入尘途修仙存档",
        properties: ["openFile"],
        filters: [{ name: "JSON 存档", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePaths[0])
        return { state: publicGameState(), message: "已取消导入。" };
      const imported = (0, cultivation_1.importGameState)(
        JSON.parse(node_fs_1.default.readFileSync(result.filePaths[0], "utf8")),
      );
      if (node_fs_1.default.existsSync(gamePath()))
        node_fs_1.default.copyFileSync(
          gamePath(),
          `${gamePath()}.before-import.json`,
        );
      game = (0, cultivation_1.settleGameState)(imported, Date.now(), {
        recordOffline: true,
      }).state;
      gameDirty = true;
      saveGame();
      publishGame();
      return { state: publicGameState(), message: "存档已导入并完成结算。" };
    }
    default:
      throw new Error("Unsupported game command");
  }
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
    loadGame();
    game = (0, cultivation_1.setCultivating)(
      game,
      settings.activity === "meditate",
      Date.now(),
    );
    saveGame();
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
    electron_1.ipcMain.handle("game:state", (event) => {
      if (event.sender !== win.webContents) throw new Error("Invalid sender");
      return publicGameState();
    });
    electron_1.ipcMain.handle("game:command", async (event, action) => {
      if (event.sender !== win.webContents || typeof action !== "string")
        throw new Error("Invalid sender");
      return gameCommand(action);
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
    win.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) =>
        console.error("Renderer load failed", {
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame,
        }),
    );
    win.webContents.on(
      "console-message",
      (_event, level, message, line, sourceId) =>
        console.log("Renderer console", {
          level,
          message,
          line,
          sourceId,
        }),
    );
    win.webContents.on("dom-ready", () =>
      console.log("Renderer DOM ready", win.webContents.getURL()),
    );
    ensureTray();
    await win.loadFile(
      node_path_1.default.join(__dirname, "../dist/index.html"),
    );
    gameTickTimer = setInterval(() => {
      const result = settleGame();
      if (result.gained > 0) publishGame();
    }, 1000);
    gameSaveTimer = setInterval(() => {
      if (gameDirty) saveGame();
    }, 15000);
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
    if (gameTickTimer) clearInterval(gameTickTimer);
    if (gameSaveTimer) clearInterval(gameSaveTimer);
    settleGame();
    saveGame();
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
  const initialGame = await win.webContents.executeJavaScript(
    "window.desktop.getGameState()",
  );
  assert(initialGame.realmName === "炼气一层", "cultivation bridge");
  command("activity", "meditate");
  await new Promise((resolve) => setTimeout(resolve, 1200));
  assert(publicGameState().cultivation >= 1, "cultivation tick");
  assert(
    node_fs_1.default.existsSync(gamePath()),
    "cultivation save persisted",
  );
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
      'document.body.innerText.includes("本地存档")',
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
          "cultivation/persistence",
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
