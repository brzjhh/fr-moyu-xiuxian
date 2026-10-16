const assert = require("node:assert/strict");
const test = require("node:test");
const {
  SAVE_VERSION,
  OFFLINE_CAP_MS,
  HERB_GROW_MS,
  JOURNEY_MS,
  RECIPES,
  createGameState,
  importGameState,
  normalizeGameState,
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
} = require("../src/electron/cultivation.js");

const NOW = 1_700_000_000_000;

test("migrates a version 1 save into the version 2 local loop", () => {
  const migrated = normalizeGameState(
    {
      version: 1,
      characterName: "青岚",
      realmIndex: 2,
      cultivation: 48,
      totalCultivation: 200,
      cultivating: false,
      createdAt: new Date(NOW - 1000).toISOString(),
      lastSettledAt: new Date(NOW).toISOString(),
      events: [],
    },
    NOW,
  );
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.realmIndex, 2);
  assert.equal(migrated.cultivation, 48);
  assert.equal(migrated.inventory.spiritStone, 20);
  assert.equal(migrated.garden.length, 2);
});

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
  assert.equal(normalized.realmIndex, 13);
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
  const state = setCultivating(createGameState(NOW), true, NOW);
  const result = settleGameState(state, NOW + OFFLINE_CAP_MS + 60_000, {
    recordOffline: true,
  });
  assert.equal(result.gained, OFFLINE_CAP_MS / 1000);
  assert.equal(result.capped, true);
  assert.match(result.state.events[0].text, /8 小时上限/);
});

test("plants, matures, and harvests a garden plot", () => {
  const cultivating = setCultivating(createGameState(NOW), true, NOW);
  let result = plantHerb(cultivating, 0, NOW);
  assert.equal(result.success, true);
  assert.equal(result.state.cultivating, true);
  assert.equal(result.state.inventory.spiritStone, 18);
  assert.equal(result.state.garden[0].status, "growing");

  let settled = settleGameState(result.state, NOW + HERB_GROW_MS);
  assert.equal(settled.state.garden[0].status, "ready");
  result = harvestHerb(settled.state, 0, NOW + HERB_GROW_MS);
  assert.equal(result.success, true);
  assert.equal(result.state.garden[0].status, "empty");
  assert.equal(result.state.inventory.dewHerb, 4);
});

test("brews, claims, and consumes a gathering pill", () => {
  let state = createGameState(NOW);
  state.inventory.dewHerb = 3;
  let result = startAlchemy(state, "gatheringPill", NOW);
  assert.equal(result.success, true);
  assert.equal(result.state.inventory.dewHerb, 0);
  assert.equal(result.state.inventory.spiritStone, 19);

  state = settleGameState(
    result.state,
    NOW + RECIPES.gatheringPill.durationMs,
  ).state;
  result = claimAlchemy(state, NOW + RECIPES.gatheringPill.durationMs);
  assert.equal(result.state.inventory.gatheringPill, 1);
  result = useGatheringPill(
    result.state,
    NOW + RECIPES.gatheringPill.durationMs,
  );
  assert.equal(result.success, true);
  assert.equal(result.state.inventory.gatheringPill, 0);
  assert.equal(result.state.cultivation, 120);
});

test("keeps alchemy and journeys mutually exclusive", () => {
  const state = createGameState(NOW);
  state.inventory.dewHerb = 3;
  const alchemy = startAlchemy(state, "gatheringPill", NOW);
  const journey = startJourney(alchemy.state, NOW + 1000);
  assert.equal(alchemy.success, true);
  assert.equal(journey.success, false);
  assert.match(journey.message, /丹炉/);
});

test("completes a journey and claims deterministic materials", () => {
  let result = startJourney(createGameState(NOW), NOW);
  assert.equal(result.success, true);
  let state = settleGameState(result.state, NOW + JOURNEY_MS).state;
  assert.equal(state.journeyJob.status, "ready");
  result = claimJourney(state, NOW + JOURNEY_MS);
  assert.equal(result.success, true);
  assert.equal(result.state.inventory.spiritStone, 28);
  assert.equal(result.state.inventory.beastCore, 1);
  assert.equal(result.state.inventory.ironOre, 2);
});

test("breakthrough preserves overflow and consumes a foundation pill", () => {
  let state = {
    ...createGameState(NOW),
    realmIndex: 12,
    cultivation: 6075,
    totalCultivation: 6075,
    inventory: {
      ...createGameState(NOW).inventory,
      foundationPill: 1,
    },
  };
  const result = breakthrough(state, NOW);
  assert.equal(result.success, true);
  assert.equal(result.state.realmIndex, 13);
  assert.equal(result.state.cultivation, 75);
  assert.equal(result.state.inventory.foundationPill, 0);
  assert.equal(toPublicGameState(result.state, NOW).realmName, "筑基初期");
});

test("requires a foundation pill for the final breakthrough", () => {
  const state = {
    ...createGameState(NOW),
    realmIndex: 12,
    cultivation: 6000,
    totalCultivation: 6000,
  };
  const result = breakthrough(state, NOW);
  assert.equal(result.success, false);
  assert.match(result.message, /筑基丹/);
});

test("rejects saves from a newer schema", () => {
  assert.throws(() => normalizeGameState({ version: 99 }, NOW), /更高版本/);
});

test("rejects arbitrary JSON files during import", () => {
  assert.throws(
    () => importGameState({ name: "not-a-save", version: "0.3.0" }, NOW),
    /不是有效的尘途修仙存档/,
  );
});

test("accepts valid version 1 and version 2 exported saves", () => {
  const current = createGameState(NOW);
  assert.equal(importGameState(current, NOW + 1000).version, SAVE_VERSION);
  const legacy = { ...current, version: 1 };
  delete legacy.gameId;
  assert.equal(importGameState(legacy, NOW + 1000).characterName, "青岚");
});
