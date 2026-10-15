const assert = require("node:assert/strict");
const test = require("node:test");
const {
  normalizeSettings,
  clampPosition,
} = require("../src/electron/settings.js");

test("normalizes saved preferences from untrusted data", () => {
  assert.deepEqual(
    normalizeSettings({ activity: "invalid", alwaysOnTop: 1, scale: 8 }),
    {
      activity: "meditate",
      alwaysOnTop: false,
      scale: 1,
      petPosition: undefined,
      panelPosition: undefined,
    },
  );
  assert.deepEqual(
    normalizeSettings({
      activity: "walk",
      alwaysOnTop: true,
      scale: 1.25,
      petPosition: { x: 20.7, y: 10.2 },
    }),
    {
      activity: "walk",
      alwaysOnTop: true,
      scale: 1.25,
      petPosition: { x: 21, y: 10 },
      panelPosition: undefined,
    },
  );
});

test("recovers a window moved off the available displays", () => {
  const areas = [{ x: 0, y: 0, width: 1920, height: 1080 }];
  assert.deepEqual(
    clampPosition({ x: -20000, y: -20000 }, { width: 440, height: 660 }, areas),
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    clampPosition({ x: 1800, y: 900 }, { width: 440, height: 660 }, areas),
    { x: 1480, y: 420 },
  );
});
