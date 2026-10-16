const assert = require("node:assert/strict");
const test = require("node:test");
const {
  OFFLINE_CAP_MS,
  createGameState,
  importGameState,
  normalizeGameState,
  settleGameState,
  setCultivating,
  breakthrough,
  toPublicGameState,
} = require("../src/electron/cultivation.js");

const NOW = 1_700_000_000_000;

test("normalizes imported cultivation saves", () => {
  const normalized = normalizeGameState(
    {
      version: 1,
      characterName: "  青岚道友  ",
      realmIndex: 99,
      cultivation: -20,
      totalCultivation: "invalid",
      cultivating: true,
      lastSettledAt: "not-a-date",
      events: [{ text: "旧记录\n第二行", at: "invalid" }],
    },
    NOW,
  );
  assert.equal(normalized.characterName, "青岚道友");
  assert.equal(normalized.realmIndex, 8);
  assert.equal(normalized.cultivation, 0);
  assert.equal(normalized.totalCultivation, 0);
  assert.equal(normalized.cultivating, true);
  assert.equal(normalized.events[0].text, "旧记录 第二行");
});

test("accrues cultivation only while meditating", () => {
  let state = createGameState(NOW);
  state = setCultivating(state, true, NOW);
  let result = settleGameState(state, NOW + 10_500);
  assert.equal(result.gained, 10);
  assert.equal(result.state.cultivation, 10);

  state = setCultivating(result.state, false, NOW + 10_500);
  result = settleGameState(state, NOW + 50_000);
  assert.equal(result.gained, 0);
  assert.equal(result.state.cultivation, 10);
});

test("caps offline cultivation at eight hours", () => {
  let state = setCultivating(createGameState(NOW), true, NOW);
  const result = settleGameState(state, NOW + OFFLINE_CAP_MS + 60_000, {
    recordOffline: true,
  });
  assert.equal(result.gained, OFFLINE_CAP_MS / 1000);
  assert.equal(result.capped, true);
  assert.match(result.state.events[0].text, /8 小时上限/);
});

test("breakthrough consumes the requirement and preserves overflow", () => {
  const state = {
    ...createGameState(NOW),
    cultivation: 75,
    totalCultivation: 75,
  };
  const result = breakthrough(state, NOW);
  assert.equal(result.success, true);
  assert.equal(result.state.realmIndex, 1);
  assert.equal(result.state.cultivation, 15);
  assert.equal(toPublicGameState(result.state, NOW).realmName, "炼气二层");
});

test("rejects saves from a newer schema", () => {
  assert.throws(() => normalizeGameState({ version: 99 }, NOW), /更高版本/);
});

test("rejects arbitrary JSON files during import", () => {
  assert.throws(
    () => importGameState({ name: "not-a-save", version: "0.2.0" }, NOW),
    /不是有效的尘途修仙存档/,
  );
});

test("accepts a valid exported cultivation save", () => {
  const imported = importGameState(createGameState(NOW), NOW + 1000);
  assert.equal(imported.realmIndex, 0);
  assert.equal(imported.characterName, "青岚");
  assert.equal(imported.events.length, 1);
});
