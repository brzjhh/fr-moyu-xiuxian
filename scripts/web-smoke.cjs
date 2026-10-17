"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

app.setPath(
  "userData",
  path.join(process.cwd(), "artifacts", `web-smoke-profile-${process.pid}`),
);

function contentType(file) {
  const extension = path.extname(file);
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webmanifest": "application/manifest+json",
    }[extension] ?? "application/octet-stream"
  );
}

function startStaticServer() {
  const root = path.resolve(process.cwd(), "dist");
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) && file !== root) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, value) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "Content-Type": contentType(file) });
      response.end(value);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}

app.whenReady().then(async () => {
  const localSite = await startStaticServer();
  const win = new BrowserWindow({
    width: 1024,
    height: 760,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await win.loadURL(localSite.url);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const initial = await win.webContents.executeJavaScript(`(async () => {
      const state = await window.desktop.getGameState();
      return {
        platform: window.desktop?.platform,
        realm: document.body.innerText.includes("炼气一层"),
        webNote: document.body.innerText.includes("网页修炼与本地存档已启用"),
        activityEnabled: !document.querySelector(".activity-grid button")?.disabled,
        spiritStone: state.inventory.spiritStone,
        pipSupported: "documentPictureInPicture" in window
      };
    })()`);
    assert(initial.platform === "web", "web bridge did not initialize");
    assert(initial.realm, "web game state did not render");
    assert(initial.webNote, "web mode notice missing");
    assert(initial.activityEnabled, "web game controls remain disabled");
    assert(initial.spiritStone === 20, "web save did not initialize");

    await win.webContents.executeJavaScript(
      'window.desktop.command("activity", "meditate")',
    );
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const cultivation = await win.webContents.executeJavaScript(
      "window.desktop.getGameState().then((state) => state.cultivation)",
    );
    assert(cultivation >= 1, "web cultivation timer did not advance");

    const planted = await win.webContents.executeJavaScript(
      'window.desktop.gameCommand("plant", { plotIndex: 0 })',
    );
    assert(planted.state.garden[0].status === "growing", "web garden failed");
    assert(
      planted.state.inventory.spiritStone === 18,
      "web garden cost was not persisted",
    );
    const persisted = await win.webContents.executeJavaScript(
      'Boolean(localStorage.getItem("chentu.web.game.v2"))',
    );
    assert(persisted, "web save was not written to localStorage");

    if (initial.pipSupported) {
      await win.webContents.executeJavaScript(`(() => {
        const frame = document.createElement("iframe");
        frame.id = "pip-smoke-frame";
        frame.hidden = true;
        document.body.append(frame);
        Object.defineProperty(documentPictureInPicture, "requestWindow", {
          configurable: true,
          value: async () => frame.contentWindow
        });
      })()`);
      win.focus();
      await win.webContents.executeJavaScript(
        'document.querySelector(".window-action").click()',
        true,
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      const floatingPet = await win.webContents.executeJavaScript(`({
        rendered: document.querySelector("#pip-smoke-frame").contentDocument.body.innerText.includes("入府"),
        character: document.querySelector("#pip-smoke-frame").contentDocument.body.innerText.includes("青岚")
      })`);
      assert(floatingPet.rendered, "floating pet controls did not render");
      assert(floatingPet.character, "floating pet state did not render");
      await win.webContents.executeJavaScript(
        'document.querySelector("#pip-smoke-frame").contentDocument.querySelector(".pet-open").click()',
      );
      await win.webContents.executeJavaScript(`Object.defineProperty(
        documentPictureInPicture,
        "requestWindow",
        { configurable: true, value: async () => { throw new Error("smoke rejection"); } }
      )`);
      await win.webContents.executeJavaScript(
        'document.querySelector(".window-action").click()',
        true,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      const fallback = await win.webContents.executeJavaScript(
        'Boolean(document.querySelector(".pet-mode"))',
      );
      assert(fallback, "floating pet fallback did not render");
    }

    fs.mkdirSync(path.join(process.cwd(), "artifacts"), { recursive: true });
    fs.writeFileSync(
      path.join(process.cwd(), "artifacts", "web-panel.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    fs.writeFileSync(
      path.join(process.cwd(), "artifacts", "web-smoke-result.json"),
      JSON.stringify(
        {
          passed: true,
          platform: initial.platform,
          pipSupported: initial.pipSupported,
          checks: [
            "web bridge",
            "rendered game state",
            "enabled controls",
            "cultivation timer",
            "garden command",
            "localStorage persistence",
            ...(initial.pipSupported
              ? ["floating pet portal", "floating pet fallback"]
              : []),
          ],
        },
        null,
        2,
      ),
    );
    console.log("WEB SMOKE PASS");
    localSite.server.close();
    app.exit(0);
  } catch (error) {
    console.error(error);
    localSite.server.close();
    app.exit(1);
  }
});
