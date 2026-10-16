"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("desktop", {
  getState: () => electron_1.ipcRenderer.invoke("desktop:state"),
  command: (action, value) =>
    electron_1.ipcRenderer.invoke("desktop:command", action, value),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    electron_1.ipcRenderer.on("desktop:updated", listener);
    return () =>
      electron_1.ipcRenderer.removeListener("desktop:updated", listener);
  },
  getGameState: () => electron_1.ipcRenderer.invoke("game:state"),
  gameCommand: (action, payload) =>
    electron_1.ipcRenderer.invoke("game:command", action, payload),
  onGameState: (callback) => {
    const listener = (_event, state) => callback(state);
    electron_1.ipcRenderer.on("game:updated", listener);
    return () =>
      electron_1.ipcRenderer.removeListener("game:updated", listener);
  },
});
