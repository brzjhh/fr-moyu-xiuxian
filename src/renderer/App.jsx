import React from "react";
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import Character from "./Character.jsx";
const Ut = React;
const s = { jsx, jsxs, Fragment };
const DEFAULT_STATE = {
    mode: "panel",
    activity: "idle",
    alwaysOnTop: !1,
    clickThrough: !1,
    scale: 1,
    hidden: !1,
    animation: !0,
  },
  ACTIVITIES = [
    { value: "idle", name: "待机", symbol: "◇", note: "闲立听风，静候道友。" },
    {
      value: "meditate",
      name: "打坐",
      symbol: "◎",
      note: "一呼一吸间，观照此刻。",
    },
    {
      value: "walk",
      name: "行走",
      symbol: "彳",
      note: "山间漫步，且行且从容。",
    },
    {
      value: "alchemy",
      name: "炼丹",
      symbol: "♧",
      note: "温炉候火，只作动作演示。",
    },
    {
      value: "sword",
      name: "御剑",
      symbol: "↗",
      note: "乘风御剑，掠过一川青岚。",
    },
  ],
  PLANNED_PAGES = {
    journeys: {
      title: "山海游历",
      subtitle: "行过山海，方见天地",
      text: "计划探索地图、游历事件与归来见闻。当前没有出发、结算或掉落功能，待服务端与存档规则接入后开放。",
      items: ["山海地图", "游历事件", "归来见闻"],
    },
    collection: {
      title: "万物图鉴",
      subtitle: "一草一木，皆有来处",
      text: "计划收录灵植、丹方与法器。当前没有物品库存、合成或收藏进度，也不会生成虚构的解锁记录。",
      items: ["灵植图录", "丹方考据", "法器收藏"],
    },
  };
function App() {
  const [N, el] = Ut.useState(DEFAULT_STATE),
    [L, g] = Ut.useState("home"),
    [x, w] = Ut.useState(""),
    [Ml, Gl] = Ut.useState(!1),
    [vl, zl] = Ut.useState(!window.desktop),
    [p, b] = Ut.useState(!1),
    Q = Ut.useRef(null),
    Nl = Ut.useRef(0),
    jl = Ut.useRef(!0),
    Rl = !!window.desktop,
    nl = ACTIVITIES.find((O) => O.value === N.activity) ?? ACTIVITIES[0];
  Ut.useEffect(() => {
    jl.current = !0;
    const O = window.desktop;
    if (!O)
      return () => {
        jl.current = !1;
      };
    let D = !0,
      K = !1,
      Xl;
    try {
      ((Xl = O.onState((ml) => {
        D && ((K = !0), Nl.current++, el(ml), zl(!0));
      })),
        O.getState()
          .then((ml) => {
            D && (K || el(ml), zl(!0));
          })
          .catch(() => {
            D && (w("无法读取窗口状态，请检查桌面桥接。"), zl(!0));
          }));
    } catch {
      (w("桌面桥接初始化失败。"), zl(!0));
    }
    return () => {
      ((D = !1), (jl.current = !1), Xl == null || Xl());
    };
  }, []);
  async function Hl(O, D) {
    const K = window.desktop;
    if ((w(""), !K)) {
      (el((ml) => {
        switch (O) {
          case "mode":
            return { ...ml, mode: D };
          case "activity":
            return { ...ml, activity: D };
          case "top":
            return { ...ml, alwaysOnTop: !!D };
          case "through":
            return { ...ml, clickThrough: !!D };
          case "scale":
            return { ...ml, scale: Number(D) };
          case "hide":
            return { ...ml, hidden: !ml.hidden };
          default:
            return ml;
        }
      }),
        O === "menu" && Gl(!0));
      return;
    }
    const Xl = ++Nl.current;
    try {
      const ml = await K.command(O, D);
      jl.current && Xl === Nl.current && el(ml);
    } catch {
      jl.current && w(`操作「${O}」未完成，请重试。`);
    }
  }
  async function rl(O, D) {
    p || (b(!0), await Hl(O, D), jl.current && b(!1));
  }
  function Pt(O) {
    O.button !== 0 ||
      O.target.closest("button") ||
      (O.preventDefault(),
      O.currentTarget.setPointerCapture(O.pointerId),
      (Q.current = { id: O.pointerId, x: O.screenX, y: O.screenY, moved: !1 }),
      Hl("drag-start", { x: O.screenX, y: O.screenY }));
  }
  function Et(O) {
    const D = Q.current;
    !D ||
      D.id !== O.pointerId ||
      (Math.hypot(O.screenX - D.x, O.screenY - D.y) > 5 && (D.moved = !0),
      D.moved && Hl("drag-move", { x: O.screenX, y: O.screenY }));
  }
  function ut(O, D = !1) {
    const K = Q.current;
    !K ||
      K.id !== O.pointerId ||
      ((Q.current = null),
      Hl("drag-end"),
      O.currentTarget.hasPointerCapture(O.pointerId) &&
        O.currentTarget.releasePointerCapture(O.pointerId),
      !D && !K.moved && rl("mode", "panel"));
  }
  return N.mode === "pet"
    ? s.jsxs("main", {
        className: `pet-mode ${N.hidden ? "hidden-state" : ""}`,
        style: { "--pet-scale": N.scale },
        children: [
          s.jsxs("div", {
            className: "pet-drag-surface",
            onPointerDown: Pt,
            onPointerMove: Et,
            onPointerUp: (O) => ut(O),
            onPointerCancel: (O) => ut(O, !0),
            onLostPointerCapture: (O) => ut(O, !0),
            onContextMenu: (O) => {
              (O.preventDefault(), Hl("menu"));
            },
            children: [
              s.jsx(Character, {
                activity: N.activity,
                paused: N.hidden || !N.animation,
              }),
              s.jsxs("div", {
                className: "pet-caption",
                children: ["青岚 · ", nl.name],
              }),
            ],
          }),
          s.jsx("button", {
            className: "pet-open",
            onClick: () => void rl("mode", "panel"),
            "aria-label": "打开洞府",
            children: "入府 ↗",
          }),
          !Rl &&
            s.jsxs("div", {
              className: "pet-preview",
              children: [
                "浏览器预览 · 拖动不移动窗口",
                N.hidden &&
                  s.jsx("button", {
                    onClick: () => void rl("hide"),
                    children: "恢复显示",
                  }),
              ],
            }),
          Ml &&
            s.jsxs("div", {
              className: "pet-menu",
              children: [
                s.jsx("span", { children: "本地预览菜单" }),
                s.jsx("button", {
                  onClick: () => {
                    (Gl(!1), rl("mode", "panel"));
                  },
                  children: "打开洞府",
                }),
                ACTIVITIES.map((O) =>
                  s.jsx(
                    "button",
                    {
                      onClick: () => {
                        (Gl(!1), rl("activity", O.value));
                      },
                      children: O.name,
                    },
                    O.value,
                  ),
                ),
                s.jsx("button", {
                  onClick: () => Gl(!1),
                  children: "关闭菜单",
                }),
              ],
            }),
          x &&
            s.jsx("div", {
              className: "pet-error",
              role: "alert",
              children: x,
            }),
        ],
      })
    : s.jsxs("main", {
        className: "palace",
        children: [
          s.jsxs("header", {
            className: "titlebar",
            children: [
              s.jsx("div", { className: "brand-seal", children: "尘途" }),
              s.jsxs("div", {
                className: "brand",
                children: [
                  s.jsxs("strong", {
                    children: ["尘途 ", s.jsx("i", { children: "CHENTU" })],
                  }),
                  s.jsx("span", { children: "一方洞府 · 一念清闲" }),
                ],
              }),
              s.jsx("button", {
                className: "window-action",
                disabled: !vl || p,
                onClick: () => void rl("mode", "pet"),
                title: "切换透明桌宠",
                children: "桌宠 ↗",
              }),
              s.jsx("button", {
                className: "window-action icon-action",
                disabled: !vl || p,
                onClick: () => void rl("hide"),
                "aria-label": "隐藏到托盘",
                title: "隐藏到托盘，点击托盘图标恢复",
                children: "−",
              }),
            ],
          }),
          s.jsxs("div", {
            className: "prototype-banner",
            children: [
              s.jsx("span", { className: "status-dot" }),
              "阶段 A · 本地原型",
              s.jsx("span", {
                className: "offline-label",
                children: "服务器未接入",
              }),
            ],
          }),
          s.jsx("nav", {
            className: "tabs",
            "aria-label": "洞府导航",
            children: [
              { id: "home", label: "修行", icon: "◇" },
              { id: "journeys", label: "游历", icon: "山" },
              { id: "collection", label: "图鉴", icon: "册" },
              { id: "settings", label: "设置", icon: "⚙" },
            ].map((O) =>
              s.jsxs(
                "button",
                {
                  className: L === O.id ? "active" : "",
                  onClick: () => g(O.id),
                  "aria-current": L === O.id ? "page" : void 0,
                  children: [
                    s.jsx("span", { children: O.icon }),
                    O.label,
                    (O.id === "journeys" || O.id === "collection") &&
                      s.jsx("small", { children: "筹备" }),
                  ],
                },
                O.id,
              ),
            ),
          }),
          s.jsxs("section", {
            className: "panel-content",
            children: [
              x &&
                s.jsx("div", {
                  className: "error-banner",
                  role: "alert",
                  children: x,
                }),
              !Rl &&
                s.jsx("div", {
                  className: "browser-note",
                  children: "浏览器预览 · 窗口设置仅模拟，不影响系统",
                }),
              N.hidden &&
                s.jsxs("div", {
                  className: "browser-note",
                  children: [
                    "窗口已标记隐藏，动画暂停。",
                    !Rl &&
                      s.jsx("button", {
                        onClick: () => void rl("hide"),
                        children: "恢复预览",
                      }),
                  ],
                }),
              L === "home" &&
                s.jsxs(s.Fragment, {
                  children: [
                    s.jsxs("div", {
                      className: "section-heading",
                      children: [
                        s.jsxs("div", {
                          children: [
                            s.jsx("span", {
                              className: "eyebrow",
                              children: "YOUR LITTLE SANCTUARY",
                            }),
                            s.jsx("h1", { children: "今日，亦可从容" }),
                          ],
                        }),
                        s.jsx("span", {
                          className: "chapter",
                          children: "壹 · 修行",
                        }),
                      ],
                    }),
                    s.jsxs("div", {
                      className: "scene",
                      children: [
                        s.jsx("div", { className: "scene-moon" }),
                        s.jsx("div", { className: "mountain mountain-far" }),
                        s.jsx("div", { className: "mountain mountain-near" }),
                        s.jsx("div", { className: "scene-ring" }),
                        s.jsxs("span", {
                          className: "scene-calligraphy",
                          children: ["心静", s.jsx("br", {}), "自有清风"],
                        }),
                        s.jsx("span", {
                          className: "scene-corner",
                          children: "青岚居",
                        }),
                        s.jsx(Character, {
                          activity: N.activity,
                          paused: N.hidden || !N.animation,
                        }),
                        s.jsx("div", { className: "scene-floor" }),
                        s.jsxs("div", {
                          className: "character-label",
                          children: [
                            s.jsx("span", { className: "status-dot" }),
                            "青岚 ",
                            s.jsxs("span", { children: ["· ", nl.name, "中"] }),
                          ],
                        }),
                        s.jsx("span", {
                          className: "scene-mark",
                          children: "原 创 修 士",
                        }),
                      ],
                    }),
                    s.jsxs("div", {
                      className: "activity-heading",
                      children: [
                        s.jsx("h2", { children: "修行日常" }),
                        s.jsx("span", { children: "仅动作预览" }),
                      ],
                    }),
                    s.jsx("div", {
                      className: "activity-grid",
                      children: ACTIVITIES.map((O) =>
                        s.jsxs(
                          "button",
                          {
                            "aria-pressed": N.activity === O.value,
                            disabled: !vl || p,
                            className: N.activity === O.value ? "selected" : "",
                            onClick: () => void rl("activity", O.value),
                            children: [
                              s.jsx("span", {
                                className: "activity-symbol",
                                children: O.symbol,
                              }),
                              s.jsx("span", { children: O.name }),
                              s.jsx("span", {
                                className: "selected-mark",
                                children: N.activity === O.value ? "·" : "",
                              }),
                            ],
                          },
                          O.value,
                        ),
                      ),
                    }),
                    s.jsx("p", {
                      className: "activity-note",
                      children: nl.note,
                    }),
                    s.jsxs("div", {
                      className: "honest-note",
                      children: [
                        s.jsx("span", { children: "知" }),
                        s.jsxs("p", {
                          children: [
                            "此处不计时、不产出修为或奖励。",
                            s.jsx("br", {}),
                            "真正的修行与存档，将在后续阶段接入。",
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              L === "settings" &&
                s.jsxs(s.Fragment, {
                  children: [
                    s.jsxs("div", {
                      className: "section-heading",
                      children: [
                        s.jsxs("div", {
                          children: [
                            s.jsx("span", {
                              className: "eyebrow",
                              children: "MAKE YOURSELF AT HOME",
                            }),
                            s.jsx("h1", { children: "桌面，亦是洞府" }),
                          ],
                        }),
                        s.jsx("span", {
                          className: "chapter",
                          children: "肆 · 设置",
                        }),
                      ],
                    }),
                    s.jsxs("div", {
                      className: "settings-card",
                      children: [
                        s.jsx(SettingRow, {
                          title: "始终置顶",
                          note: "让小修士陪在其他窗口之上",
                          checked: N.alwaysOnTop,
                          disabled: !vl || p,
                          onChange: (O) => void rl("top", O),
                        }),
                        s.jsx(SettingRow, {
                          title: "鼠标穿透",
                          note: "仅桌宠模式可用，请右键桌宠或托盘菜单开启",
                          checked: N.clickThrough,
                          disabled: !0,
                          onChange: (O) => void rl("through", O),
                        }),
                        s.jsxs("div", {
                          className: "setting-row scale-setting",
                          children: [
                            s.jsxs("div", {
                              children: [
                                s.jsx("strong", { children: "桌宠尺寸" }),
                                s.jsx("p", {
                                  children: "选择最合适的陪伴距离",
                                }),
                              ],
                            }),
                            s.jsx("div", {
                              className: "segmented",
                              children: [0.75, 1, 1.25].map((O) =>
                                s.jsx(
                                  "button",
                                  {
                                    "aria-pressed": N.scale === O,
                                    className: N.scale === O ? "selected" : "",
                                    disabled: !vl || p,
                                    onClick: () => void rl("scale", O),
                                    children:
                                      O === 1
                                        ? "标准"
                                        : O < 1
                                          ? "小巧"
                                          : "放大",
                                  },
                                  O,
                                ),
                              ),
                            }),
                          ],
                        }),
                        s.jsxs("div", {
                          className: "setting-row",
                          children: [
                            s.jsxs("div", {
                              children: [
                                s.jsx("strong", { children: "动画状态" }),
                                s.jsx("p", {
                                  children: "遵循系统减少动态偏好；隐藏时暂停",
                                }),
                              ],
                            }),
                            s.jsx("span", {
                              className: "setting-value",
                              children:
                                N.animation && !N.hidden ? "已开启" : "已暂停",
                            }),
                          ],
                        }),
                      ],
                    }),
                    s.jsxs("button", {
                      className: "primary-button",
                      disabled: !vl || p,
                      onClick: () => void rl("mode", "pet"),
                      children: [
                        "◇ 返回透明桌宠 ",
                        s.jsx("span", { children: "↗" }),
                      ],
                    }),
                    s.jsxs("div", {
                      className: "settings-help",
                      children: [
                        s.jsx("h2", { children: "陪伴的小秘诀" }),
                        s.jsxs("p", {
                          children: [
                            "拖动小修士移动窗口，单击进入洞府。",
                            s.jsx("br", {}),
                            "右键打开菜单；鼠标穿透后请用托盘恢复。",
                            s.jsx("br", {}),
                            "洞府顶部可拖动，按钮与控件不参与拖动。",
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              (L === "journeys" || L === "collection") &&
                s.jsxs("div", {
                  className: "planned-page",
                  children: [
                    s.jsx("span", {
                      className: "eyebrow",
                      children: "A CHAPTER YET TO UNFOLD",
                    }),
                    s.jsx("div", {
                      className: "planned-symbol",
                      children: L === "journeys" ? "山" : "册",
                    }),
                    s.jsx("span", {
                      className: "planned-badge",
                      children: "规划中 · 尚未开放",
                    }),
                    s.jsx("h1", { children: PLANNED_PAGES[L].title }),
                    s.jsx("p", {
                      className: "planned-subtitle",
                      children: PLANNED_PAGES[L].subtitle,
                    }),
                    s.jsx("p", {
                      className: "planned-description",
                      children: PLANNED_PAGES[L].text,
                    }),
                    s.jsx("div", {
                      className: "planned-list",
                      children: PLANNED_PAGES[L].items.map((O, D) =>
                        s.jsxs(
                          "div",
                          {
                            children: [
                              s.jsxs("span", { children: ["0", D + 1] }),
                              O,
                              s.jsx("small", { children: "计划" }),
                            ],
                          },
                          O,
                        ),
                      ),
                    }),
                    s.jsx("button", {
                      className: "text-button",
                      onClick: () => g("home"),
                      children: "返回修行动作预览 ↗",
                    }),
                  ],
                }),
            ],
          }),
          s.jsxs("footer", {
            className: "panel-footer",
            children: [
              s.jsx("span", { children: "尘途 · 与你共一段清闲" }),
              s.jsx("span", { children: "LOCAL / A.01" }),
            ],
          }),
        ],
      });
}
function SettingRow({
  title: N,
  note: el,
  checked: L,
  disabled: g,
  onChange: x,
}) {
  return s.jsxs("div", {
    className: "setting-row",
    children: [
      s.jsxs("div", {
        children: [
          s.jsx("strong", { children: N }),
          s.jsx("p", { children: el }),
        ],
      }),
      s.jsx("button", {
        className: `toggle ${L ? "on" : ""}`,
        role: "switch",
        "aria-label": N,
        "aria-checked": L,
        disabled: g,
        onClick: () => x(!L),
        children: s.jsx("span", {}),
      }),
    ],
  });
}
export default App;
