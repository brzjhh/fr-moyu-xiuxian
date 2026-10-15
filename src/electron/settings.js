"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaults = void 0;
exports.normalizeSettings = normalizeSettings;
exports.clampPosition = clampPosition;
exports.defaults = { activity: "meditate", alwaysOnTop: false, scale: 1 };
function normalizeSettings(value) {
  const s = value && typeof value === "object" ? value : {};
  const point = (p) => {
    const v = p;
    return v && Number.isFinite(v.x) && Number.isFinite(v.y)
      ? { x: Math.round(v.x), y: Math.round(v.y) }
      : undefined;
  };
  return {
    activity: ["idle", "meditate", "walk", "alchemy", "sword"].includes(
      s.activity ?? "",
    )
      ? s.activity
      : exports.defaults.activity,
    alwaysOnTop: typeof s.alwaysOnTop === "boolean" ? s.alwaysOnTop : false,
    scale: [0.75, 1, 1.25].includes(s.scale ?? 0) ? s.scale : 1,
    petPosition: point(s.petPosition),
    panelPosition: point(s.panelPosition),
  };
}
function clampPosition(position, size, areas) {
  if (!areas.length) return position;
  const overlap = (r) =>
    Math.max(
      0,
      Math.min(position.x + size.width, r.x + r.width) -
        Math.max(position.x, r.x),
    ) *
    Math.max(
      0,
      Math.min(position.y + size.height, r.y + r.height) -
        Math.max(position.y, r.y),
    );
  const area = [...areas].sort((a, b) => overlap(b) - overlap(a))[0];
  return {
    x: Math.round(
      Math.max(area.x, Math.min(position.x, area.x + area.width - size.width)),
    ),
    y: Math.round(
      Math.max(
        area.y,
        Math.min(position.y, area.y + area.height - size.height),
      ),
    ),
  };
}
