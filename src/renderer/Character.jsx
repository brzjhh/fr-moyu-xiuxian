import React, { useId } from "react";

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
  const id = useId().replace(/:/g, "");
  const paint = (name) => `url(#${id}-${name})`;

  return (
    <svg
      className={`cultivator activity-${activity} ${paused ? "is-paused" : ""} ${className}`}
      data-character-model="blue-swordsman-v1"
      viewBox="0 0 300 320"
      role="img"
      aria-label={`青岚小修士 · ${activityNames[activity] ?? activityNames.idle}`}
      shapeRendering="crispEdges"
    >
      <defs>
        <linearGradient id={`${id}-robe`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#3e75ab" />
          <stop offset=".5" stopColor="#285487" />
          <stop offset="1" stopColor="#162e59" />
        </linearGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#49363a" />
          <stop offset=".55" stopColor="#2e222a" />
          <stop offset="1" stopColor="#1a1720" />
        </linearGradient>
        <linearGradient id={`${id}-blade`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#2b9ca4" />
          <stop offset=".5" stopColor="#a8f4e9" />
          <stop offset="1" stopColor="#3ab7bb" />
        </linearGradient>
        <radialGradient id={`${id}-aura`}>
          <stop stopColor="#8ee9d5" stopOpacity=".3" />
          <stop offset="1" stopColor="#8ee9d5" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse
        className="ground-shadow"
        cx="150"
        cy="290"
        rx="68"
        ry="8"
        fill="#0d1b24"
        opacity=".22"
      />
      <g className="meditation-aura">
        <circle cx="150" cy="205" r="103" fill={paint("aura")} />
        <ellipse
          cx="150"
          cy="278"
          rx="89"
          ry="16"
          fill="none"
          stroke="#9de9dc"
          strokeWidth="2"
          strokeDasharray="14 6 3 6"
        />
        <path
          d="M76 256L96 250M224 256L204 250M150 278V296"
          fill="none"
          stroke="#e3c176"
          strokeWidth="2"
        />
      </g>

      <g className="flying-sword">
        <path
          d="M49 270L231 260L272 273L230 285L50 283Z"
          fill="#102e3a"
          stroke="#0b1a27"
          strokeWidth="4"
        />
        <path
          d="M55 270L229 264L262 273L229 281L55 281Z"
          fill={paint("blade")}
        />
        <path d="M72 275H235" stroke="#d9fff2" strokeWidth="3" />
        <path
          d="M106 269L117 275L106 281L95 275ZM144 267L155 275L144 282L133 275ZM184 265L196 274L184 283L173 274Z"
          fill="#155b66"
          opacity=".9"
        />
        <path
          d="M61 258L66 288M49 259L55 289"
          stroke="#e1af4b"
          strokeWidth="8"
        />
        <path d="M18 274L50 274" stroke="#142b39" strokeWidth="10" />
        <path d="M12 274L23 274" stroke="#dfae4a" strokeWidth="8" />
        <path
          className="sword-trail"
          d="M13 299L81 296M190 302L255 298"
          stroke="#7ff1df"
          strokeWidth="2"
          opacity=".7"
        />
      </g>

      <g className="character-body">
        <g
          className="hair-back"
          stroke="#12131b"
          strokeWidth="4"
          strokeLinejoin="miter"
        >
          <path
            d="M109 91L94 105L88 131L91 155L79 185L87 207L78 222L98 229L118 209L125 164Z"
            fill={paint("hair")}
          />
          <path
            d="M188 88L207 105L213 136L208 160L223 187L218 212L231 227L208 233L185 214L175 158Z"
            fill={paint("hair")}
          />
          <path
            d="M90 197L104 213L97 222M207 192L213 216L224 226"
            fill="none"
            stroke="#6b4b45"
            strokeWidth="3"
          />
        </g>

        <g className="sheathed-sword" strokeLinejoin="miter">
          <path
            d="M209 192L224 197L244 268L237 278L226 272Z"
            fill="#113e53"
            stroke="#101c2a"
            strokeWidth="4"
          />
          <path d="M218 205L239 266" stroke="#57c9c3" strokeWidth="6" />
          <path
            d="M209 201L228 196M212 192L220 211"
            stroke="#dca640"
            strokeWidth="7"
          />
          <path d="M204 187L216 182" stroke="#14313e" strokeWidth="9" />
          <path d="M202 186L208 182" stroke="#e2b551" strokeWidth="6" />
        </g>

        <g className="leg leg-left">
          <path
            d="M112 246L142 246L140 278L109 278Z"
            fill="#172b50"
            stroke="#101823"
            strokeWidth="4"
          />
          <path
            d="M105 273L141 273L144 289L102 289L98 283Z"
            fill="#142039"
            stroke="#0e1622"
            strokeWidth="4"
          />
          <path d="M104 282H139" stroke="#8da8ba" strokeWidth="3" />
        </g>
        <g className="leg leg-right">
          <path
            d="M158 246L188 246L192 278L160 278Z"
            fill="#172b50"
            stroke="#101823"
            strokeWidth="4"
          />
          <path
            d="M160 273L194 273L201 284L197 289L158 289Z"
            fill="#142039"
            stroke="#0e1622"
            strokeWidth="4"
          />
          <path d="M162 282H196" stroke="#8da8ba" strokeWidth="3" />
        </g>
        <g className="crossed-legs">
          <path
            d="M124 241L96 255L99 274L149 279L200 274L203 255L174 241Z"
            fill="#17365e"
            stroke="#101823"
            strokeWidth="4"
          />
          <path
            d="M107 263L150 269L193 258M193 267L152 276L112 258"
            fill="none"
            stroke="#dba94d"
            strokeWidth="4"
          />
        </g>

        <path
          d="M121 160L178 160L196 205L207 275L186 285L151 268L113 285L94 275L105 208Z"
          fill="#182d52"
          stroke="#101722"
          strokeWidth="5"
          strokeLinejoin="miter"
        />
        <path
          d="M132 161L169 161L177 204L181 268L151 279L119 268L124 204Z"
          fill="#e4eef2"
          stroke="#101b30"
          strokeWidth="3"
        />
        <path
          d="M135 178L150 194L165 178L173 263L150 275L126 263Z"
          fill="#bdd5e2"
        />
        <path
          d="M119 171L137 164L145 194L129 265L105 274L111 212Z"
          fill={paint("robe")}
          stroke="#101722"
          strokeWidth="4"
        />
        <path
          d="M181 171L164 164L155 194L172 265L196 274L189 212Z"
          fill={paint("robe")}
          stroke="#101722"
          strokeWidth="4"
        />
        <path
          d="M123 174L149 205L177 174"
          fill="none"
          stroke="#f0f4ef"
          strokeWidth="7"
        />
        <path
          d="M131 168L150 193L168 168"
          fill="none"
          stroke="#173c6a"
          strokeWidth="5"
        />
        <path
          d="M108 262L126 271L150 264L174 271L193 262"
          fill="none"
          stroke="#dfa945"
          strokeWidth="5"
          strokeLinejoin="miter"
        />
        <path
          d="M114 276L130 269M172 269L188 276"
          stroke="#f2c765"
          strokeWidth="3"
        />

        <g className="arm arm-left" strokeLinejoin="miter">
          <path
            d="M121 169L100 170L75 203L65 235L82 249L113 236L133 194Z"
            fill={paint("robe")}
            stroke="#101722"
            strokeWidth="5"
          />
          <path
            d="M72 224L88 234L113 225L109 240L82 250L65 238Z"
            fill="#dda847"
            stroke="#101722"
            strokeWidth="3"
          />
          <path
            d="M84 207L94 197L100 203L93 214L102 216L94 224L79 219"
            fill="none"
            stroke="#76acd2"
            strokeWidth="4"
          />
          <path
            d="M78 237L96 238L102 247L94 254L79 250Z"
            fill="#f3d2bb"
            stroke="#101722"
            strokeWidth="4"
          />
        </g>
        <g className="arm arm-right" strokeLinejoin="miter">
          <path
            d="M178 169L200 170L225 203L235 235L218 249L187 236L167 194Z"
            fill={paint("robe")}
            stroke="#101722"
            strokeWidth="5"
          />
          <path
            d="M228 224L212 234L187 225L191 240L218 250L235 238Z"
            fill="#dda847"
            stroke="#101722"
            strokeWidth="3"
          />
          <path
            d="M216 207L206 197L200 203L207 214L198 216L206 224L221 219"
            fill="none"
            stroke="#76acd2"
            strokeWidth="4"
          />
          <path
            d="M222 237L204 238L198 247L206 254L221 250Z"
            fill="#f3d2bb"
            stroke="#101722"
            strokeWidth="4"
          />
        </g>

        <path
          d="M114 219L149 225L186 219L188 235L150 242L112 235Z"
          fill="#d79a39"
          stroke="#101722"
          strokeWidth="4"
        />
        <path
          d="M119 224L149 230L181 224"
          fill="none"
          stroke="#ffe29a"
          strokeWidth="3"
        />
        <path
          d="M144 224L157 224L164 235L152 246L140 236Z"
          fill="#47bec2"
          stroke="#14324b"
          strokeWidth="3"
        />
        <path d="M151 243L154 264" stroke="#d5a240" strokeWidth="3" />
        <path
          className="tassel"
          d="M151 259L146 277L152 274L158 277L155 259Z"
          fill="#b43131"
          stroke="#501b26"
          strokeWidth="2"
        />
        <path
          d="M111 167L125 160L136 168L124 179L115 177ZM189 167L175 160L164 168L176 179L185 177Z"
          fill="#dba541"
          stroke="#101722"
          strokeWidth="3"
        />

        <g className="head">
          <path
            d="M103 96L95 80L103 57L125 43L151 38L179 42L201 57L209 78L199 105L206 156L190 177L110 176L94 155Z"
            fill={paint("hair")}
            stroke="#101319"
            strokeWidth="5"
            strokeLinejoin="miter"
          />
          <path
            d="M132 43L126 31L135 19L151 15L168 21L174 35L166 46Z"
            fill={paint("hair")}
            stroke="#101319"
            strokeWidth="4"
          />
          <path
            d="M128 33L143 37L163 35L171 31"
            fill="none"
            stroke="#e0aa48"
            strokeWidth="6"
          />
          <path
            d="M163 30L173 18L177 32Z"
            fill="#51c7cb"
            stroke="#122834"
            strokeWidth="3"
          />
          <path
            className="ribbon"
            d="M178 35L185 48L204 63L216 91L226 107L215 105L197 82L184 69L177 54Z"
            fill="#43b8c3"
            stroke="#15344d"
            strokeWidth="3"
          />
          <path
            d="M214 105L225 113L219 117L209 108Z"
            fill="#dfaa48"
            stroke="#101722"
            strokeWidth="2"
          />
          <path
            d="M107 105L111 89L128 78L173 78L192 91L195 111L191 147L181 165L119 165L108 149Z"
            fill="#f3d1bd"
            stroke="#101722"
            strokeWidth="4"
            strokeLinejoin="miter"
          />
          <path
            d="M100 99L102 73L124 53L150 46L179 52L196 68L202 95L188 89L175 78L160 86L143 77L129 94L113 98L109 117L101 116Z"
            fill={paint("hair")}
            stroke="#101319"
            strokeWidth="4"
            strokeLinejoin="miter"
          />
          <path
            d="M105 75L128 57L153 53M173 57L190 69"
            fill="none"
            stroke="#674c4c"
            strokeWidth="4"
          />
          <path
            d="M98 111L110 111L112 164L101 180L92 171L95 146ZM190 109L202 111L205 147L199 173L188 164Z"
            fill={paint("hair")}
            stroke="#101319"
            strokeWidth="4"
          />
          <path
            d="M110 119L130 118M170 118L190 119"
            stroke="#3c292a"
            strokeWidth="5"
          />
          <g className="eyes-open" fill="#252027">
            <rect x="116" y="125" width="13" height="17" />
            <rect x="171" y="125" width="13" height="17" />
            <path
              d="M117 138H128M172 138H183"
              stroke="#0e141c"
              strokeWidth="3"
            />
            <rect x="119" y="126" width="4" height="5" fill="#f7eee6" />
            <rect x="174" y="126" width="4" height="5" fill="#f7eee6" />
          </g>
          <g
            className="eyes-closed"
            stroke="#2d2529"
            strokeWidth="4"
            fill="none"
          >
            <path d="M115 135H130M170 135H185" />
          </g>
          <path
            d="M142 152L151 155L159 152"
            stroke="#a4756d"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M112 149H126M174 149H188"
            stroke="#e8a9a0"
            strokeWidth="3"
            opacity=".5"
          />
          <path
            d="M185 49L194 44L199 51L192 58Z"
            fill="#dca840"
            stroke="#101722"
            strokeWidth="2"
          />
          <path
            d="M194 49L202 43L207 50L200 56Z"
            fill="#48c4ca"
            stroke="#101722"
            strokeWidth="2"
          />
          <path d="M197 55L193 68" stroke="#e0ac49" strokeWidth="3" />
        </g>
      </g>

      <g className="alchemy-prop">
        <g
          className="brew-steam"
          fill="none"
          stroke="#a4e9d1"
          strokeWidth="3"
          opacity=".8"
        >
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

      <g className="motes" fill="#a6e7d7">
        <path d="M64 134L68 143L77 147L68 151L64 160L60 151L51 147L60 143Z" />
        <path d="M234 99L237 106L244 109L237 112L234 119L231 112L224 109L231 106Z" />
        <rect x="74" y="206" width="4" height="4" />
        <rect x="225" y="68" width="4" height="4" />
      </g>
    </svg>
  );
}
