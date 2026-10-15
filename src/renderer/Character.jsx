import React, { useId } from "react";
import frontSprite from "./assets/character-front.png";

const activityNames = {
  idle: "待机",
  meditate: "打坐",
  walk: "行走",
  alchemy: "炼丹",
  sword: "御剑",
};

export default function Character({
  activity = "idle",
  paused = false,
  className = "",
}) {
  const bladeId = useId().replace(/:/g, "");

  return (
    <svg
      className={`cultivator activity-${activity} ${paused ? "is-paused" : ""} ${className}`}
      data-character-model="reference-pixel-sprite-v1"
      viewBox="0 0 300 320"
      role="img"
      aria-label={`青岚小修士 · ${activityNames[activity] ?? activityNames.idle}`}
      shapeRendering="crispEdges"
    >
      <defs>
        <linearGradient id={bladeId} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#2b9ca4" />
          <stop offset=".5" stopColor="#a8f4e9" />
          <stop offset="1" stopColor="#3ab7bb" />
        </linearGradient>
      </defs>
      <ellipse
        className="ground-shadow"
        cx="150"
        cy="292"
        rx="68"
        ry="8"
        fill="#0d1b24"
        opacity=".22"
      />
      <g className="meditation-aura" fill="none" stroke="#9de9dc">
        <ellipse cx="150" cy="278" rx="88" ry="16" strokeWidth="2" />
        <path d="M76 256L96 250M224 256L204 250M150 278V296" strokeWidth="2" />
      </g>
      <g className="flying-sword" strokeLinejoin="miter">
        <path
          d="M47 270L230 260L273 273L230 286L47 283Z"
          fill="#102e3a"
          stroke="#0b1a27"
          strokeWidth="4"
        />
        <path
          d="M53 270L229 264L263 273L229 281L53 280Z"
          fill={`url(#${bladeId})`}
        />
        <path d="M72 275H235" stroke="#d9fff2" strokeWidth="3" />
        <path
          d="M62 258L67 289M49 259L55 289"
          stroke="#e1af4b"
          strokeWidth="8"
        />
        <path d="M18 274H50" stroke="#142b39" strokeWidth="10" />
        <path d="M12 274H23" stroke="#dfae4a" strokeWidth="8" />
      </g>
      <g className="character-body">
        <image
          href={frontSprite}
          x="56"
          y="14"
          width="188"
          height="276"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
      <g className="alchemy-prop">
        <g className="brew-steam" fill="none" stroke="#a4e9d1" strokeWidth="3">
          <path d="M219 212L215 200L222 190L218 180M238 207L244 195L239 185" />
        </g>
        <path
          d="M204 246L200 263L207 281L225 288L247 281L255 263L250 246Z"
          fill="#204e51"
          stroke="#101c29"
          strokeWidth="4"
        />
        <path
          d="M199 246L225 239L254 246L245 253L207 253Z"
          fill="#325e5e"
          stroke="#d7a645"
          strokeWidth="4"
        />
        <path
          d="M214 269L225 259L237 269L225 279Z"
          fill="none"
          stroke="#dfb961"
          strokeWidth="3"
        />
        <rect
          className="brew-glow"
          x="221"
          y="266"
          width="8"
          height="8"
          fill="#e8e7a0"
        />
      </g>
    </svg>
  );
}
