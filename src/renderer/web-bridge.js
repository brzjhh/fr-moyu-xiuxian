import "../electron/cultivation.js";

const GAME_STORAGE_KEY = "chentu.web.game.v2";
const DESKTOP_STORAGE_KEY = "chentu.web.desktop.v1";

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The game remains usable for the current tab when storage is unavailable.
  }
}

function downloadSave(game) {
  const blob = new Blob([JSON.stringify(game, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "尘途修仙-青岚-网页存档.json";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function chooseSaveFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.hidden = true;
    document.body.append(input);
    const clean = () => input.remove();
    input.addEventListener(
      "change",
      async () => {
        try {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          resolve(JSON.parse(await file.text()));
        } catch (error) {
          reject(error);
        } finally {
          clean();
        }
      },
      { once: true },
    );
    input.addEventListener(
      "cancel",
      () => {
        clean();
        resolve(null);
      },
      { once: true },
    );
    input.click();
  });
}

export function createWebBridge() {
  const engine = window.ChentuCultivation;
  if (!engine) throw new Error("网页修炼规则加载失败");

  const stateListeners = new Set();
  const gameListeners = new Set();
  let desktopState = {
    mode: "panel",
    activity: "idle",
    alwaysOnTop: true,
    clickThrough: false,
    scale: 1,
    hidden: false,
    animation: true,
    ...readJson(DESKTOP_STORAGE_KEY, {}),
  };
  let game;

  try {
    game = engine.normalizeGameState(readJson(GAME_STORAGE_KEY, null));
  } catch {
    game = engine.createGameState();
  }
  game = engine.settleGameState(game, Date.now(), {
    recordOffline: true,
  }).state;
  game = engine.setCultivating(
    game,
    desktopState.activity === "meditate",
    Date.now(),
  );

  function saveDesktop() {
    writeJson(DESKTOP_STORAGE_KEY, {
      activity: desktopState.activity,
      scale: desktopState.scale,
    });
  }

  function saveGame() {
    writeJson(GAME_STORAGE_KEY, game);
  }

  function publicGameState() {
    const settled = engine.settleGameState(game, Date.now());
    game = settled.state;
    if (settled.changed) saveGame();
    return engine.toPublicGameState(game);
  }

  function publishDesktop() {
    const snapshot = { ...desktopState };
    stateListeners.forEach((listener) => listener(snapshot));
  }

  function publishGame() {
    const snapshot = publicGameState();
    gameListeners.forEach((listener) => listener(snapshot));
  }

  function finish(result) {
    game = result.state;
    if (result.activity) {
      desktopState = { ...desktopState, activity: result.activity };
      saveDesktop();
      publishDesktop();
    }
    saveGame();
    const state = publicGameState();
    gameListeners.forEach((listener) => listener(state));
    return { state, message: result.message };
  }

  async function command(action, value) {
    switch (action) {
      case "mode":
        if (value === "pet" || value === "panel") {
          desktopState = { ...desktopState, mode: value };
        }
        break;
      case "activity":
        if (
          typeof value === "string" &&
          ["idle", "meditate", "walk", "alchemy", "sword"].includes(value)
        ) {
          const mainTask = publicGameState().mainTask;
          if (
            (mainTask === "alchemy" && value !== "alchemy") ||
            (mainTask === "journey" && value !== "walk")
          ) {
            break;
          }
          desktopState = { ...desktopState, activity: value };
          game = engine.setCultivating(game, value === "meditate", Date.now());
          saveDesktop();
          saveGame();
          publishGame();
        }
        break;
      case "scale":
        if ([0.75, 1, 1.25].includes(value)) {
          desktopState = { ...desktopState, scale: value };
          saveDesktop();
        }
        break;
      case "top":
        desktopState = { ...desktopState, alwaysOnTop: Boolean(value) };
        break;
      case "hide":
        desktopState = { ...desktopState, mode: "panel", hidden: false };
        break;
      case "menu":
      case "drag-start":
      case "drag-move":
      case "drag-end":
        break;
      default:
        throw new Error("Unsupported web desktop command");
    }
    publishDesktop();
    return { ...desktopState };
  }

  async function gameCommand(action, payload) {
    switch (action) {
      case "breakthrough":
        return finish(engine.breakthrough(game, Date.now()));
      case "plant":
        return finish(engine.plantHerb(game, payload?.plotIndex, Date.now()));
      case "harvest":
        return finish(engine.harvestHerb(game, payload?.plotIndex, Date.now()));
      case "start-alchemy":
        return finish(engine.startAlchemy(game, payload?.recipe, Date.now()));
      case "claim-alchemy":
        return finish(engine.claimAlchemy(game, Date.now()));
      case "start-journey":
        return finish(engine.startJourney(game, Date.now()));
      case "claim-journey":
        return finish(engine.claimJourney(game, Date.now()));
      case "use-gathering-pill":
        return finish(engine.useGatheringPill(game, Date.now()));
      case "export":
        game = engine.settleGameState(game, Date.now()).state;
        saveGame();
        downloadSave(game);
        return { state: publicGameState(), message: "网页存档已导出。" };
      case "import": {
        const selected = await chooseSaveFile();
        if (!selected)
          return { state: publicGameState(), message: "已取消导入。" };
        game = engine.importGameState(selected, Date.now());
        game = engine.settleGameState(game, Date.now(), {
          recordOffline: true,
        }).state;
        saveGame();
        publishGame();
        return {
          state: publicGameState(),
          message: "存档已导入并完成结算。",
        };
      }
      default:
        throw new Error("Unsupported web game command");
    }
  }

  const tick = window.setInterval(() => {
    const settled = engine.settleGameState(game, Date.now());
    game = settled.state;
    if (settled.changed) {
      saveGame();
      publishGame();
    }
  }, 1000);

  window.addEventListener("pagehide", () => {
    window.clearInterval(tick);
    game = engine.settleGameState(game, Date.now()).state;
    saveGame();
  });

  saveDesktop();
  saveGame();

  return {
    platform: "web",
    getState: async () => ({ ...desktopState }),
    command,
    onState: (callback) => {
      stateListeners.add(callback);
      return () => stateListeners.delete(callback);
    },
    getGameState: async () => publicGameState(),
    gameCommand,
    onGameState: (callback) => {
      gameListeners.add(callback);
      return () => gameListeners.delete(callback);
    },
  };
}
