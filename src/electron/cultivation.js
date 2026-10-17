"use strict";

const SAVE_VERSION = 2;
const GAME_ID = "chentu-cultivation-save";
const GAIN_PER_SECOND = 1;
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
const MAX_EVENTS = 16;
const GARDEN_PLOTS = 2;
const HERB_GROW_MS = 45 * 1000;
const JOURNEY_MS = 45 * 1000;

const REALMS = [
  "炼气一层",
  "炼气二层",
  "炼气三层",
  "炼气四层",
  "炼气五层",
  "炼气六层",
  "炼气七层",
  "炼气八层",
  "炼气九层",
  "炼气十层",
  "炼气十一层",
  "炼气十二层",
  "炼气十三层",
  "筑基初期",
];

const REQUIREMENTS = [
  60, 180, 360, 600, 900, 1260, 1680, 2160, 2700, 3300, 3960, 4680, 6000,
];

const ITEM_DEFAULTS = {
  spiritStone: 20,
  dewHerb: 0,
  ironOre: 0,
  beastCore: 0,
  gatheringPill: 0,
  foundationPill: 0,
};

const ITEM_LABELS = {
  spiritStone: "下品灵石",
  dewHerb: "凝露草",
  ironOre: "青纹矿",
  beastCore: "妖兽内丹",
  gatheringPill: "聚气丹",
  foundationPill: "筑基丹",
};

const RECIPES = {
  gatheringPill: {
    id: "gatheringPill",
    name: "聚气丹",
    durationMs: 30 * 1000,
    costs: { dewHerb: 3, spiritStone: 1 },
    output: { gatheringPill: 1 },
    note: "服用后立即获得 120 点修为。",
  },
  foundationPill: {
    id: "foundationPill",
    name: "筑基丹",
    durationMs: 60 * 1000,
    costs: { dewHerb: 6, beastCore: 2, spiritStone: 5 },
    output: { foundationPill: 1 },
    note: "炼气十三层突破筑基时消耗。",
  },
};

const JOURNEY_REWARD = {
  spiritStone: 8,
  dewHerb: 2,
  ironOre: 2,
  beastCore: 1,
};

function clampInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(maximum, Math.floor(value)))
    : fallback;
}

function validTime(value, fallback, now, futureCapMs = 0) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return new Date(fallback).toISOString();
  const maximum = futureCapMs > 0 ? now + futureCapMs : now;
  return new Date(Math.min(parsed, maximum)).toISOString();
}

function event(text, kind, at) {
  return {
    id: `${at}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date(at).toISOString(),
    kind,
    text,
  };
}

function addEvent(state, text, kind, at) {
  return {
    ...state,
    events: [event(text, kind, at), ...state.events].slice(0, MAX_EVENTS),
  };
}

function emptyPlot(index) {
  return { index, status: "empty", crop: null, plantedAt: null, readyAt: null };
}

function createGameState(now = Date.now()) {
  const timestamp = new Date(now).toISOString();
  return {
    gameId: GAME_ID,
    version: SAVE_VERSION,
    characterName: "青岚",
    realmIndex: 0,
    cultivation: 0,
    totalCultivation: 0,
    cultivating: false,
    inventory: { ...ITEM_DEFAULTS },
    garden: Array.from({ length: GARDEN_PLOTS }, (_, index) =>
      emptyPlot(index),
    ),
    alchemyJob: null,
    journeyJob: null,
    createdAt: timestamp,
    lastSettledAt: timestamp,
    events: [event("踏入洞府，修行自此始。", "system", now)],
  };
}

function normalizeEvents(value, now) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const at = Date.parse(item.at);
      return {
        id:
          typeof item.id === "string" && item.id.length <= 80
            ? item.id
            : `imported-${index}`,
        at: new Date(
          Number.isFinite(at) ? Math.min(at, now) : now,
        ).toISOString(),
        kind:
          typeof item.kind === "string" && item.kind.length <= 24
            ? item.kind
            : "system",
        text:
          typeof item.text === "string"
            ? item.text.replace(/[\r\n]+/g, " ").slice(0, 120)
            : "旧存档记录",
      };
    })
    .slice(0, MAX_EVENTS);
}

function normalizeInventory(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.entries(ITEM_DEFAULTS).map(([key, fallback]) => [
      key,
      clampInteger(source[key], fallback, 1_000_000_000),
    ]),
  );
}

function normalizePlot(value, index, now) {
  if (!value || typeof value !== "object") return emptyPlot(index);
  if (!["growing", "ready"].includes(value.status)) return emptyPlot(index);
  return {
    index,
    status: value.status,
    crop: "dewHerb",
    plantedAt: validTime(value.plantedAt, now, now),
    readyAt: validTime(value.readyAt, now, now, 24 * 60 * 60 * 1000),
  };
}

function normalizeJob(value, type, now) {
  if (!value || typeof value !== "object") return null;
  if (!["running", "ready"].includes(value.status)) return null;
  const startedAt = validTime(value.startedAt, now, now);
  const readyAt = validTime(value.readyAt, now, now, 24 * 60 * 60 * 1000);
  if (type === "alchemy") {
    const recipe = RECIPES[value.recipe];
    if (!recipe) return null;
    return {
      type,
      recipe: recipe.id,
      status: value.status,
      startedAt,
      readyAt,
    };
  }
  return {
    type,
    site: "greenRidge",
    strategy: "gather",
    status: value.status,
    startedAt,
    readyAt,
    reward: { ...JOURNEY_REWARD },
  };
}

function normalizeGameState(value, now = Date.now()) {
  if (
    value &&
    typeof value === "object" &&
    Number.isFinite(value.version) &&
    value.version > SAVE_VERSION
  ) {
    throw new Error("存档来自更高版本，当前程序无法读取。");
  }
  const base = createGameState(now);
  const source = value && typeof value === "object" ? value : {};
  const realmIndex = clampInteger(source.realmIndex, 0, REALMS.length - 1);
  const cultivation = clampInteger(source.cultivation, 0, 1_000_000_000);
  const events = normalizeEvents(source.events, now);
  const gardenSource = Array.isArray(source.garden) ? source.garden : [];
  return {
    gameId: GAME_ID,
    version: SAVE_VERSION,
    characterName:
      typeof source.characterName === "string" && source.characterName.trim()
        ? source.characterName.trim().slice(0, 12)
        : base.characterName,
    realmIndex,
    cultivation,
    totalCultivation: Math.max(
      cultivation,
      clampInteger(source.totalCultivation, cultivation, 1_000_000_000),
    ),
    cultivating: source.cultivating === true,
    inventory: normalizeInventory(source.inventory),
    garden: Array.from({ length: GARDEN_PLOTS }, (_, index) =>
      normalizePlot(gardenSource[index], index, now),
    ),
    alchemyJob: normalizeJob(source.alchemyJob, "alchemy", now),
    journeyJob: normalizeJob(source.journeyJob, "journey", now),
    createdAt: validTime(source.createdAt, now, now),
    lastSettledAt: validTime(source.lastSettledAt, now, now),
    events: events.length ? events : base.events,
  };
}

function importGameState(value, now = Date.now()) {
  if (!value || typeof value !== "object")
    throw new Error("所选文件不是有效的尘途修仙存档。");
  if (Number.isFinite(value.version) && value.version > SAVE_VERSION)
    throw new Error("存档来自更高版本，当前程序无法读取。");
  if (
    !Number.isFinite(value.version) ||
    value.version < 1 ||
    !Number.isFinite(value.realmIndex) ||
    !Number.isFinite(value.cultivation) ||
    typeof value.createdAt !== "string" ||
    typeof value.lastSettledAt !== "string" ||
    !Array.isArray(value.events) ||
    (value.version >= 2 && value.gameId !== GAME_ID)
  ) {
    throw new Error("所选文件不是有效的尘途修仙存档。");
  }
  return normalizeGameState(value, now);
}

function hasRunningMainTask(state) {
  return (
    state.alchemyJob?.status === "running" ||
    state.journeyJob?.status === "running"
  );
}

function settleGameState(value, now = Date.now(), options = {}) {
  let state = normalizeGameState(value, now);
  const last = Date.parse(state.lastSettledAt);
  const rawElapsed = Math.max(0, now - last);
  const elapsed = Math.min(rawElapsed, OFFLINE_CAP_MS);
  const wholeSeconds = state.cultivating ? Math.floor(elapsed / 1000) : 0;
  const gained = wholeSeconds * GAIN_PER_SECOND;
  let changed = gained > 0;

  if (gained > 0) {
    state = {
      ...state,
      cultivation: state.cultivation + gained,
      totalCultivation: state.totalCultivation + gained,
    };
  }

  const settledAt =
    state.cultivating && rawElapsed <= OFFLINE_CAP_MS
      ? last + wholeSeconds * 1000
      : now;
  state = { ...state, lastSettledAt: new Date(settledAt).toISOString() };

  let matured = 0;
  const garden = state.garden.map((plot) => {
    if (plot.status === "growing" && now >= Date.parse(plot.readyAt)) {
      matured += 1;
      changed = true;
      return { ...plot, status: "ready" };
    }
    return plot;
  });
  state = { ...state, garden };
  if (matured > 0)
    state = addEvent(
      state,
      `${matured} 块药田的凝露草已经成熟。`,
      "garden",
      now,
    );

  if (
    state.alchemyJob?.status === "running" &&
    now >= Date.parse(state.alchemyJob.readyAt)
  ) {
    const recipe = RECIPES[state.alchemyJob.recipe];
    state = {
      ...state,
      cultivating: false,
      alchemyJob: { ...state.alchemyJob, status: "ready" },
    };
    state = addEvent(
      state,
      `${recipe.name}炼制完成，等待收丹。`,
      "alchemy",
      now,
    );
    changed = true;
  }

  if (
    state.journeyJob?.status === "running" &&
    now >= Date.parse(state.journeyJob.readyAt)
  ) {
    state = {
      ...state,
      cultivating: false,
      journeyJob: { ...state.journeyJob, status: "ready" },
    };
    state = addEvent(state, "青石岭历练结束，带回了一批材料。", "journey", now);
    changed = true;
  }

  if (options.recordOffline && gained >= 5) {
    const capped = rawElapsed > OFFLINE_CAP_MS;
    state = addEvent(
      state,
      `离府修炼获得 ${gained} 点修为${capped ? "（已达 8 小时上限）" : ""}。`,
      "offline",
      now,
    );
    changed = true;
  }
  return { state, gained, changed, capped: rawElapsed > OFFLINE_CAP_MS };
}

function result(state, success, message, activity) {
  return { state, success, message, activity };
}

function setCultivating(value, cultivating, now = Date.now()) {
  let { state } = settleGameState(value, now);
  if (cultivating && hasRunningMainTask(state)) return state;
  if (state.cultivating === cultivating) return state;
  state = { ...state, cultivating, lastSettledAt: new Date(now).toISOString() };
  return addEvent(
    state,
    cultivating ? "静心打坐，开始吐纳灵气。" : "结束打坐，本轮修炼暂停。",
    cultivating ? "meditate" : "pause",
    now,
  );
}

function plantHerb(value, plotIndex, now = Date.now()) {
  let { state } = settleGameState(value, now);
  const index = Number.isInteger(plotIndex) ? plotIndex : -1;
  if (index < 0 || index >= GARDEN_PLOTS)
    return result(state, false, "药田位置无效。");
  if (state.garden[index].status !== "empty")
    return result(state, false, "这块药田尚未空闲。");
  if (state.inventory.spiritStone < 2)
    return result(state, false, "种植凝露草需要 2 枚下品灵石。");
  const timestamp = new Date(now).toISOString();
  const garden = state.garden.map((plot, current) =>
    current === index
      ? {
          index,
          status: "growing",
          crop: "dewHerb",
          plantedAt: timestamp,
          readyAt: new Date(now + HERB_GROW_MS).toISOString(),
        }
      : plot,
  );
  state = {
    ...state,
    inventory: {
      ...state.inventory,
      spiritStone: state.inventory.spiritStone - 2,
    },
    garden,
  };
  state = addEvent(state, `第 ${index + 1} 块药田种下凝露草。`, "garden", now);
  return result(state, true, "凝露草已种下，成熟后可收获。");
}

function harvestHerb(value, plotIndex, now = Date.now()) {
  let { state } = settleGameState(value, now);
  const index = Number.isInteger(plotIndex) ? plotIndex : -1;
  if (
    index < 0 ||
    index >= GARDEN_PLOTS ||
    state.garden[index].status !== "ready"
  )
    return result(state, false, "凝露草尚未成熟。");
  const garden = state.garden.map((plot, current) =>
    current === index ? emptyPlot(index) : plot,
  );
  state = {
    ...state,
    garden,
    inventory: { ...state.inventory, dewHerb: state.inventory.dewHerb + 4 },
  };
  state = addEvent(state, "收获凝露草 4 株。", "garden", now);
  return result(state, true, "收获 4 株凝露草。");
}

function canAfford(inventory, costs) {
  return Object.entries(costs).every(
    ([key, amount]) => inventory[key] >= amount,
  );
}

function applyItems(inventory, items, direction = 1) {
  const next = { ...inventory };
  for (const [key, amount] of Object.entries(items))
    next[key] += amount * direction;
  return next;
}

function startAlchemy(value, recipeId, now = Date.now()) {
  let { state } = settleGameState(value, now);
  const recipe = RECIPES[recipeId];
  if (!recipe) return result(state, false, "丹方不存在。");
  if (state.alchemyJob)
    return result(
      state,
      false,
      state.alchemyJob.status === "ready" ? "请先收取丹药。" : "丹炉正在运转。",
    );
  if (hasRunningMainTask(state))
    return result(state, false, "当前正在历练，无法同时炼丹。");
  if (!canAfford(state.inventory, recipe.costs))
    return result(state, false, `炼制${recipe.name}的材料不足。`);
  state = setCultivating(state, false, now);
  state = {
    ...state,
    inventory: applyItems(state.inventory, recipe.costs, -1),
    alchemyJob: {
      type: "alchemy",
      recipe: recipe.id,
      status: "running",
      startedAt: new Date(now).toISOString(),
      readyAt: new Date(now + recipe.durationMs).toISOString(),
    },
  };
  state = addEvent(state, `投入材料，开始炼制${recipe.name}。`, "alchemy", now);
  return result(state, true, `${recipe.name}开始炼制。`, "alchemy");
}

function claimAlchemy(value, now = Date.now()) {
  let { state } = settleGameState(value, now);
  if (state.alchemyJob?.status !== "ready")
    return result(state, false, "丹药尚未炼成。");
  const recipe = RECIPES[state.alchemyJob.recipe];
  state = {
    ...state,
    inventory: applyItems(state.inventory, recipe.output),
    alchemyJob: null,
  };
  state = addEvent(state, `收取${recipe.name} 1 枚。`, "alchemy", now);
  return result(state, true, `获得${recipe.name} 1 枚。`, "idle");
}

function startJourney(value, now = Date.now()) {
  let { state } = settleGameState(value, now);
  if (state.journeyJob)
    return result(
      state,
      false,
      state.journeyJob.status === "ready"
        ? "请先整理上次历练所得。"
        : "已经在历练途中。",
    );
  if (hasRunningMainTask(state))
    return result(state, false, "丹炉正在运转，暂不能离府。");
  state = setCultivating(state, false, now);
  state = {
    ...state,
    journeyJob: {
      type: "journey",
      site: "greenRidge",
      strategy: "gather",
      status: "running",
      startedAt: new Date(now).toISOString(),
      readyAt: new Date(now + JOURNEY_MS).toISOString(),
      reward: { ...JOURNEY_REWARD },
    },
  };
  state = addEvent(state, "前往青石岭，开始稳妥采集。", "journey", now);
  return result(state, true, "已启程前往青石岭。", "walk");
}

function claimJourney(value, now = Date.now()) {
  let { state } = settleGameState(value, now);
  if (state.journeyJob?.status !== "ready")
    return result(state, false, "历练尚未结束。");
  state = {
    ...state,
    inventory: applyItems(state.inventory, state.journeyJob.reward),
    journeyJob: null,
  };
  state = addEvent(state, "整理历练所得，材料已收入行囊。", "journey", now);
  return result(state, true, "历练奖励已收入行囊。", "idle");
}

function useGatheringPill(value, now = Date.now()) {
  let { state } = settleGameState(value, now);
  if (state.inventory.gatheringPill < 1)
    return result(state, false, "行囊中没有聚气丹。");
  state = {
    ...state,
    cultivation: state.cultivation + 120,
    totalCultivation: state.totalCultivation + 120,
    inventory: {
      ...state.inventory,
      gatheringPill: state.inventory.gatheringPill - 1,
    },
  };
  state = addEvent(state, "服下一枚聚气丹，修为增加 120 点。", "pill", now);
  return result(state, true, "聚气丹化开，修为增加 120 点。");
}

function breakthrough(value, now = Date.now()) {
  let { state } = settleGameState(value, now);
  const required = REQUIREMENTS[state.realmIndex];
  if (required == null) return result(state, false, "已达到当前版本最高境界。");
  if (state.cultivation < required)
    return result(
      state,
      false,
      `尚需 ${required - state.cultivation} 点修为方可突破。`,
    );
  const requiresFoundationPill = state.realmIndex === 12;
  if (requiresFoundationPill && state.inventory.foundationPill < 1)
    return result(state, false, "突破筑基需要 1 枚筑基丹。");
  state = {
    ...state,
    realmIndex: state.realmIndex + 1,
    cultivation: state.cultivation - required,
    inventory: requiresFoundationPill
      ? {
          ...state.inventory,
          foundationPill: state.inventory.foundationPill - 1,
        }
      : state.inventory,
  };
  state = addEvent(
    state,
    `灵息贯通，突破至${REALMS[state.realmIndex]}。`,
    "breakthrough",
    now,
  );
  return result(state, true, `突破成功：${REALMS[state.realmIndex]}`);
}

function publicTimedJob(job, now, durationMs, extra = {}) {
  if (!job) return null;
  const remainingSeconds =
    job.status === "ready"
      ? 0
      : Math.max(0, Math.ceil((Date.parse(job.readyAt) - now) / 1000));
  const elapsed = Math.max(0, now - Date.parse(job.startedAt));
  return {
    ...extra,
    status: job.status,
    startedAt: job.startedAt,
    readyAt: job.readyAt,
    remainingSeconds,
    progress:
      job.status === "ready"
        ? 1
        : Math.max(0, Math.min(1, elapsed / durationMs)),
  };
}

function toPublicGameState(value, now = Date.now()) {
  const { state } = settleGameState(value, now);
  const required = REQUIREMENTS[state.realmIndex] ?? null;
  const requiresFoundationPill = state.realmIndex === 12;
  const alchemyRecipe = state.alchemyJob
    ? RECIPES[state.alchemyJob.recipe]
    : null;
  return {
    version: state.version,
    characterName: state.characterName,
    realmIndex: state.realmIndex,
    realmName: REALMS[state.realmIndex],
    cultivation: state.cultivation,
    totalCultivation: state.totalCultivation,
    required,
    progress:
      required == null
        ? 1
        : Math.max(0, Math.min(1, state.cultivation / required)),
    canBreakthrough:
      required != null &&
      state.cultivation >= required &&
      (!requiresFoundationPill || state.inventory.foundationPill > 0),
    breakthroughCost: requiresFoundationPill ? "筑基丹 1 枚" : null,
    maxRealm: required == null,
    cultivating: state.cultivating,
    canCultivate: !hasRunningMainTask(state),
    gainPerSecond: GAIN_PER_SECOND,
    offlineCapHours: OFFLINE_CAP_MS / 60 / 60 / 1000,
    inventory: { ...state.inventory },
    itemLabels: ITEM_LABELS,
    garden: state.garden.map((plot) => {
      if (plot.status === "empty")
        return { ...plot, remainingSeconds: 0, progress: 0 };
      const remainingSeconds =
        plot.status === "ready"
          ? 0
          : Math.max(0, Math.ceil((Date.parse(plot.readyAt) - now) / 1000));
      return {
        ...plot,
        remainingSeconds,
        progress:
          plot.status === "ready"
            ? 1
            : Math.max(
                0,
                Math.min(1, (now - Date.parse(plot.plantedAt)) / HERB_GROW_MS),
              ),
      };
    }),
    recipes: Object.values(RECIPES).map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      costs: recipe.costs,
      durationSeconds: recipe.durationMs / 1000,
      note: recipe.note,
      canAfford: canAfford(state.inventory, recipe.costs),
    })),
    alchemyJob: alchemyRecipe
      ? publicTimedJob(state.alchemyJob, now, alchemyRecipe.durationMs, {
          recipe: alchemyRecipe.id,
          name: alchemyRecipe.name,
        })
      : null,
    journeyJob: state.journeyJob
      ? publicTimedJob(state.journeyJob, now, JOURNEY_MS, {
          site: "青石岭",
          strategy: "稳妥采集",
          reward: { ...state.journeyJob.reward },
        })
      : null,
    mainTask:
      state.alchemyJob?.status === "running"
        ? "alchemy"
        : state.journeyJob?.status === "running"
          ? "journey"
          : state.cultivating
            ? "meditate"
            : "idle",
    createdAt: state.createdAt,
    lastSettledAt: state.lastSettledAt,
    events: state.events,
  };
}

const cultivationApi = {
  SAVE_VERSION,
  GAME_ID,
  GAIN_PER_SECOND,
  OFFLINE_CAP_MS,
  HERB_GROW_MS,
  JOURNEY_MS,
  REALMS,
  REQUIREMENTS,
  RECIPES,
  JOURNEY_REWARD,
  createGameState,
  normalizeGameState,
  importGameState,
  settleGameState,
  setCultivating,
  plantHerb,
  harvestHerb,
  startAlchemy,
  claimAlchemy,
  startJourney,
  claimJourney,
  useGatheringPill,
  breakthrough,
  toPublicGameState,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = cultivationApi;
}

if (typeof window !== "undefined") {
  window.ChentuCultivation = cultivationApi;
}
