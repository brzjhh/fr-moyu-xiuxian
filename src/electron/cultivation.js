"use strict";

const SAVE_VERSION = 1;
const GAIN_PER_SECOND = 1;
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
const MAX_EVENTS = 12;
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
];
const REQUIREMENTS = [60, 180, 360, 600, 900, 1260, 1680, 2160];

function clampInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(maximum, Math.floor(value)))
    : fallback;
}

function validTime(value, fallback, now) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return new Date(fallback).toISOString();
  return new Date(Math.min(parsed, now)).toISOString();
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

function createGameState(now = Date.now()) {
  const timestamp = new Date(now).toISOString();
  return {
    version: SAVE_VERSION,
    characterName: "青岚",
    realmIndex: 0,
    cultivation: 0,
    totalCultivation: 0,
    cultivating: false,
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
  return {
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
    value.version !== SAVE_VERSION ||
    !Number.isFinite(value.realmIndex) ||
    !Number.isFinite(value.cultivation) ||
    typeof value.createdAt !== "string" ||
    typeof value.lastSettledAt !== "string" ||
    !Array.isArray(value.events)
  ) {
    throw new Error("所选文件不是有效的尘途修仙存档。");
  }
  return normalizeGameState(value, now);
}

function settleGameState(value, now = Date.now(), options = {}) {
  let state = normalizeGameState(value, now);
  const last = Date.parse(state.lastSettledAt);
  const rawElapsed = Math.max(0, now - last);
  const elapsed = Math.min(rawElapsed, OFFLINE_CAP_MS);
  const wholeSeconds = state.cultivating ? Math.floor(elapsed / 1000) : 0;
  const gained = wholeSeconds * GAIN_PER_SECOND;

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

  if (options.recordOffline && gained >= 5) {
    const capped = rawElapsed > OFFLINE_CAP_MS;
    state = addEvent(
      state,
      `离府修炼获得 ${gained} 点修为${capped ? "（已达 8 小时上限）" : ""}。`,
      "offline",
      now,
    );
  }
  return { state, gained, capped: rawElapsed > OFFLINE_CAP_MS };
}

function setCultivating(value, cultivating, now = Date.now()) {
  let { state } = settleGameState(value, now);
  if (state.cultivating === cultivating) return state;
  state = { ...state, cultivating, lastSettledAt: new Date(now).toISOString() };
  return addEvent(
    state,
    cultivating ? "静心打坐，开始吐纳灵气。" : "结束打坐，本轮修炼暂停。",
    cultivating ? "meditate" : "pause",
    now,
  );
}

function breakthrough(value, now = Date.now()) {
  let { state } = settleGameState(value, now);
  const required = REQUIREMENTS[state.realmIndex];
  if (required == null) {
    return { state, success: false, message: "已达到当前版本最高境界。" };
  }
  if (state.cultivation < required) {
    return {
      state,
      success: false,
      message: `尚需 ${required - state.cultivation} 点修为方可突破。`,
    };
  }
  state = {
    ...state,
    realmIndex: state.realmIndex + 1,
    cultivation: state.cultivation - required,
  };
  state = addEvent(
    state,
    `灵息贯通，突破至${REALMS[state.realmIndex]}。`,
    "breakthrough",
    now,
  );
  return {
    state,
    success: true,
    message: `突破成功：${REALMS[state.realmIndex]}`,
  };
}

function toPublicGameState(value, now = Date.now()) {
  const state = normalizeGameState(value, now);
  const required = REQUIREMENTS[state.realmIndex] ?? null;
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
    canBreakthrough: required != null && state.cultivation >= required,
    maxRealm: required == null,
    cultivating: state.cultivating,
    gainPerSecond: GAIN_PER_SECOND,
    offlineCapHours: OFFLINE_CAP_MS / 60 / 60 / 1000,
    createdAt: state.createdAt,
    lastSettledAt: state.lastSettledAt,
    events: state.events,
  };
}

module.exports = {
  SAVE_VERSION,
  GAIN_PER_SECOND,
  OFFLINE_CAP_MS,
  REALMS,
  REQUIREMENTS,
  createGameState,
  normalizeGameState,
  importGameState,
  settleGameState,
  setCultivating,
  breakthrough,
  toPublicGameState,
};
