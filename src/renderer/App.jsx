import React from "react";
import Character from "./Character.jsx";

const DEFAULT_DESKTOP_STATE = {
  mode: "panel",
  activity: "idle",
  alwaysOnTop: false,
  clickThrough: false,
  scale: 1,
  hidden: false,
  animation: true,
};

const DEFAULT_GAME_STATE = {
  characterName: "青岚",
  realmName: "炼气一层",
  cultivation: 0,
  totalCultivation: 0,
  required: 60,
  progress: 0,
  canBreakthrough: false,
  breakthroughCost: null,
  maxRealm: false,
  cultivating: false,
  canCultivate: true,
  gainPerSecond: 1,
  offlineCapHours: 8,
  inventory: {
    spiritStone: 0,
    dewHerb: 0,
    ironOre: 0,
    beastCore: 0,
    gatheringPill: 0,
    foundationPill: 0,
  },
  itemLabels: {},
  garden: [],
  recipes: [],
  alchemyJob: null,
  journeyJob: null,
  mainTask: "idle",
  events: [],
};

const ACTIVITIES = [
  { value: "idle", name: "待机", symbol: "◇", note: "闲立听风，静候道友。" },
  { value: "meditate", name: "打坐", symbol: "◎", note: "每秒积累 1 点修为。" },
  { value: "walk", name: "行走", symbol: "彳", note: "历练时自动切换为行走。" },
  { value: "alchemy", name: "炼丹", symbol: "♧", note: "丹炉运转时自动切换。" },
  { value: "sword", name: "御剑", symbol: "↗", note: "当前为动作预览。" },
];

const TABS = [
  { id: "home", label: "修行", symbol: "◎" },
  { id: "cave", label: "洞府", symbol: "田" },
  { id: "journey", label: "历练", symbol: "山" },
  { id: "inventory", label: "行囊", symbol: "囊" },
  { id: "settings", label: "设置", symbol: "◇" },
];

const INVENTORY_ORDER = [
  ["spiritStone", "灵", "修行与生产的通用资源"],
  ["dewHerb", "草", "药园产出的基础灵草"],
  ["ironOre", "矿", "历练取得的炼器材料"],
  ["beastCore", "丹", "炼制筑基丹的关键材料"],
  ["gatheringPill", "聚", "服用后增加 120 点修为"],
  ["foundationPill", "筑", "炼气十三层突破所需"],
];

function formatEventTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
}

function remainingSeconds(item, now) {
  if (!item || item.status !== "running") return 0;
  return Math.max(0, Math.ceil((Date.parse(item.readyAt) - now) / 1000));
}

function timedProgress(item, now) {
  if (!item) return 0;
  if (item.status === "ready") return 1;
  const start = Date.parse(item.startedAt ?? item.plantedAt);
  const end = Date.parse(item.readyAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return 0;
  return Math.max(0, Math.min(1, (now - start) / (end - start)));
}

function formatCountdown(seconds) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(2, "0")}`
    : `${remainder} 秒`;
}

function formatCosts(costs, labels) {
  return Object.entries(costs)
    .map(([key, amount]) => `${labels[key] ?? key} ${amount}`)
    .join(" · ");
}

function SectionHeading({ eyebrow, title, chapter }) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <span className="chapter">{chapter}</span>
    </div>
  );
}

function ProgressBar({ value, label }) {
  const percent = Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100);
  return (
    <div
      className="cultivation-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={percent}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function App() {
  const [desktopState, setDesktopState] = React.useState(DEFAULT_DESKTOP_STATE);
  const [gameState, setGameState] = React.useState(DEFAULT_GAME_STATE);
  const [page, setPage] = React.useState("home");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [ready, setReady] = React.useState(!window.desktop);
  const [busy, setBusy] = React.useState(false);
  const [previewMenu, setPreviewMenu] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const pointer = React.useRef(null);
  const mounted = React.useRef(true);
  const commandSequence = React.useRef(0);
  const isDesktop = Boolean(window.desktop);
  const activity =
    ACTIVITIES.find((item) => item.value === desktopState.activity) ??
    ACTIVITIES[0];
  const mainTaskBusy = ["alchemy", "journey"].includes(gameState.mainTask);

  React.useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, []);

  React.useEffect(() => {
    const bridge = window.desktop;
    if (!bridge) return;
    let active = true;
    let received = false;
    const unsubscribe = bridge.onState((next) => {
      if (!active) return;
      received = true;
      commandSequence.current += 1;
      setDesktopState(next);
      setReady(true);
    });
    bridge
      .getState()
      .then((next) => {
        if (active && !received) setDesktopState(next);
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) {
          setError("无法读取窗口状态，请检查桌面桥接。");
          setReady(true);
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  React.useEffect(() => {
    const bridge = window.desktop;
    if (!bridge?.getGameState || !bridge?.onGameState) return;
    let active = true;
    const unsubscribe = bridge.onGameState((next) => {
      if (active) setGameState(next);
    });
    bridge
      .getGameState()
      .then((next) => active && setGameState(next))
      .catch(() => active && setError("无法读取本地修炼存档。"));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function desktopCommand(actionName, value) {
    setError("");
    const bridge = window.desktop;
    if (!bridge) {
      setDesktopState((current) => {
        switch (actionName) {
          case "mode":
            return { ...current, mode: value };
          case "activity":
            return { ...current, activity: value };
          case "top":
            return { ...current, alwaysOnTop: Boolean(value) };
          case "scale":
            return { ...current, scale: Number(value) };
          case "hide":
            return { ...current, hidden: !current.hidden };
          default:
            return current;
        }
      });
      if (actionName === "menu") setPreviewMenu(true);
      return;
    }
    const sequence = ++commandSequence.current;
    try {
      const next = await bridge.command(actionName, value);
      if (mounted.current && sequence === commandSequence.current)
        setDesktopState(next);
    } catch {
      if (mounted.current) setError(`操作“${actionName}”未完成，请重试。`);
    }
  }

  async function runDesktopCommand(actionName, value) {
    if (busy) return;
    setBusy(true);
    await desktopCommand(actionName, value);
    if (mounted.current) setBusy(false);
  }

  async function runGameAction(actionName, payload) {
    const bridge = window.desktop;
    if (busy || !bridge?.gameCommand) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await bridge.gameCommand(actionName, payload);
      if (mounted.current) {
        setGameState(result.state);
        setMessage(result.message ?? "");
      }
    } catch {
      if (mounted.current) setError("存档操作未完成，请重试。");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function pointerDown(event) {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = {
      id: event.pointerId,
      x: event.screenX,
      y: event.screenY,
      moved: false,
    };
    desktopCommand("drag-start", { x: event.screenX, y: event.screenY });
  }

  function pointerMove(event) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    if (Math.hypot(event.screenX - current.x, event.screenY - current.y) > 5)
      current.moved = true;
    if (current.moved)
      desktopCommand("drag-move", { x: event.screenX, y: event.screenY });
  }

  function pointerEnd(event, cancelled = false) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    pointer.current = null;
    desktopCommand("drag-end");
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && !current.moved) runDesktopCommand("mode", "panel");
  }

  if (desktopState.mode === "pet") {
    return (
      <main
        className={`pet-mode ${desktopState.hidden ? "hidden-state" : ""}`}
        style={{ "--pet-scale": desktopState.scale }}
      >
        <div
          className="pet-drag-surface"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={(event) => pointerEnd(event)}
          onPointerCancel={(event) => pointerEnd(event, true)}
          onLostPointerCapture={(event) => pointerEnd(event, true)}
          onContextMenu={(event) => {
            event.preventDefault();
            desktopCommand("menu");
          }}
        >
          <Character
            activity={desktopState.activity}
            paused={desktopState.hidden || !desktopState.animation}
          />
          <div className="pet-caption">
            青岚 · {activity.name}
            {gameState.mainTask !== "idle" ? ` · ${gameState.realmName}` : ""}
          </div>
        </div>
        <button
          className="pet-open"
          onClick={() => runDesktopCommand("mode", "panel")}
          aria-label="打开洞府"
        >
          入府 ↗
        </button>
        {!isDesktop && (
          <div className="pet-preview">
            浏览器预览 · 拖动不移动窗口
            {desktopState.hidden && (
              <button onClick={() => runDesktopCommand("hide")}>
                恢复显示
              </button>
            )}
          </div>
        )}
        {previewMenu && (
          <div className="pet-menu">
            <span>本地预览菜单</span>
            <button onClick={() => runDesktopCommand("mode", "panel")}>
              打开洞府
            </button>
            {ACTIVITIES.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setPreviewMenu(false);
                  runDesktopCommand("activity", item.value);
                }}
              >
                {item.name}
              </button>
            ))}
            <button onClick={() => setPreviewMenu(false)}>关闭菜单</button>
          </div>
        )}
        {error && <div className="pet-error">{error}</div>}
      </main>
    );
  }

  return (
    <main className="palace">
      <header className="titlebar">
        <div className="brand-seal">尘途</div>
        <div className="brand">
          <strong>青岚洞府</strong>
          <i>CHENTU</i>
          <span>炼气修行 · 洞府经营</span>
        </div>
        <button
          className="window-action"
          disabled={!ready || busy}
          onClick={() => runDesktopCommand("mode", "pet")}
        >
          桌宠 ↗
        </button>
        <button
          className="window-action icon-action"
          aria-label="隐藏到托盘"
          title="隐藏到托盘"
          disabled={!ready || busy}
          onClick={() => runDesktopCommand("hide")}
        >
          −
        </button>
      </header>

      <div className="prototype-banner">
        <span className="status-dot" />
        <span>本地单人存档</span>
        <span className="offline-label">
          {gameState.mainTask === "meditate"
            ? "吐纳中"
            : gameState.mainTask === "alchemy"
              ? "丹炉运转"
              : gameState.mainTask === "journey"
                ? "历练途中"
                : "闲置"}
        </span>
      </div>

      <nav className="tabs" aria-label="洞府导航">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={page === tab.id ? "active" : ""}
            onClick={() => {
              setPage(tab.id);
              setMessage("");
            }}
          >
            <span>{tab.symbol}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="panel-content">
        {!isDesktop && (
          <div className="browser-note">
            浏览器仅展示界面，修炼与存档操作需要 Electron。
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
        {message && <div className="success-banner">{message}</div>}

        {page === "home" && (
          <HomePage
            desktopState={desktopState}
            gameState={gameState}
            activity={activity}
            busy={busy}
            isDesktop={isDesktop}
            mainTaskBusy={mainTaskBusy}
            onActivity={(value) => runDesktopCommand("activity", value)}
            onBreakthrough={() => runGameAction("breakthrough")}
          />
        )}

        {page === "cave" && (
          <CavePage
            gameState={gameState}
            now={now}
            busy={busy}
            isDesktop={isDesktop}
            onAction={runGameAction}
          />
        )}

        {page === "journey" && (
          <JourneyPage
            gameState={gameState}
            now={now}
            busy={busy}
            isDesktop={isDesktop}
            onAction={runGameAction}
          />
        )}

        {page === "inventory" && (
          <InventoryPage
            gameState={gameState}
            busy={busy}
            isDesktop={isDesktop}
            onAction={runGameAction}
          />
        )}

        {page === "settings" && (
          <SettingsPage
            desktopState={desktopState}
            busy={busy}
            isDesktop={isDesktop}
            onDesktopAction={runDesktopCommand}
            onGameAction={runGameAction}
          />
        )}
      </section>

      <footer className="panel-footer">
        <span>尘途 · 与你共一段清闲</span>
        <span>LOCAL / 0.3.0</span>
      </footer>
    </main>
  );
}

function HomePage({
  desktopState,
  gameState,
  activity,
  busy,
  isDesktop,
  mainTaskBusy,
  onActivity,
  onBreakthrough,
}) {
  const gamePercent = Math.round((gameState.progress ?? 0) * 100);
  return (
    <>
      <SectionHeading
        eyebrow="YOUR LITTLE SANCTUARY"
        title="今日，亦可从容"
        chapter="壹 · 修行"
      />
      <div className="cultivation-overview">
        <div className="cultivation-summary">
          <div>
            <span>当前境界</span>
            <strong>{gameState.realmName}</strong>
          </div>
          <div className="cultivation-value">
            <b>{gameState.cultivation}</b>
            <span>
              {gameState.required == null
                ? " 修为"
                : ` / ${gameState.required}`}
            </span>
          </div>
        </div>
        <ProgressBar value={gameState.progress} label="修为进度" />
        <div className="cultivation-meta">
          <span className={gameState.cultivating ? "cultivating" : ""}>
            {gameState.cultivating
              ? `吐纳中 · +${gameState.gainPerSecond}/秒`
              : gameState.breakthroughCost
                ? `筑基需 ${gameState.breakthroughCost}`
                : `修炼暂停 · 当前 ${gamePercent}%`}
          </span>
          <button
            className="breakthrough-button"
            disabled={
              !isDesktop ||
              busy ||
              !gameState.canBreakthrough ||
              gameState.maxRealm
            }
            onClick={onBreakthrough}
          >
            {gameState.maxRealm ? "已至筑基" : "突破"}
          </button>
        </div>
      </div>

      <div className="scene">
        <div className="scene-moon" />
        <div className="mountain mountain-far" />
        <div className="mountain mountain-near" />
        <div className="scene-ring" />
        <span className="scene-calligraphy">
          心静
          <br />
          自有清风
        </span>
        <span className="scene-corner">青岚居</span>
        <Character
          activity={desktopState.activity}
          paused={desktopState.hidden || !desktopState.animation}
        />
        <div className="scene-floor" />
        <div className="character-label">
          <span className="status-dot" />
          青岚 <span>· {activity.name}中</span>
        </div>
        <span className="scene-mark">洞 府 修 士</span>
      </div>

      <div className="activity-heading">
        <h2>修行日常</h2>
        <span>{mainTaskBusy ? "主任务进行中" : "打坐积累真实修为"}</span>
      </div>
      <div className="activity-grid">
        {ACTIVITIES.map((item) => (
          <button
            key={item.value}
            aria-pressed={desktopState.activity === item.value}
            disabled={!isDesktop || busy || mainTaskBusy}
            className={desktopState.activity === item.value ? "selected" : ""}
            onClick={() => onActivity(item.value)}
          >
            <span className="activity-symbol">{item.symbol}</span>
            <span>{item.name}</span>
            <span className="selected-mark">
              {desktopState.activity === item.value ? "·" : ""}
            </span>
          </button>
        ))}
      </div>
      <p className="activity-note">
        {mainTaskBusy
          ? "炼丹或历练期间不能切换主任务，药园仍会独立生长。"
          : desktopState.activity === "meditate"
            ? `每秒获得 ${gameState.gainPerSecond} 点修为；离线收益最多 ${gameState.offlineCapHours} 小时。`
            : `${activity.note} 切换离开打坐会暂停修为增长。`}
      </p>

      <div className="cultivation-log">
        <div className="cultivation-log-heading">
          <strong>修行纪要</strong>
          <span>累计 {gameState.totalCultivation} 修为</span>
        </div>
        <div className="cultivation-events">
          {gameState.events.slice(0, 4).map((entry) => (
            <p key={entry.id}>
              <time>{formatEventTime(entry.at)}</time>
              <span>{entry.text}</span>
            </p>
          ))}
        </div>
      </div>
    </>
  );
}

function CavePage({ gameState, now, busy, isDesktop, onAction }) {
  const labels = gameState.itemLabels;
  return (
    <>
      <SectionHeading
        eyebrow="GROW · REFINE · PREPARE"
        title="洞府经营"
        chapter="贰 · 洞府"
      />
      <div className="resource-ribbon">
        <span>
          灵石 <b>{gameState.inventory.spiritStone}</b>
        </span>
        <span>
          凝露草 <b>{gameState.inventory.dewHerb}</b>
        </span>
        <span>
          兽丹 <b>{gameState.inventory.beastCore}</b>
        </span>
      </div>

      <section className="feature-section">
        <div className="feature-heading">
          <div>
            <span className="feature-kicker">药园</span>
            <h2>两畦凝露草</h2>
          </div>
          <small>种植消耗 2 灵石 · 收获 4 株</small>
        </div>
        <div className="garden-grid">
          {gameState.garden.map((plot) => {
            const seconds = remainingSeconds(plot, now);
            const progress = timedProgress(plot, now);
            return (
              <div className={`garden-plot ${plot.status}`} key={plot.index}>
                <div className="plot-visual" aria-hidden="true">
                  <span>
                    {plot.status === "empty"
                      ? "·"
                      : plot.status === "ready"
                        ? "芽"
                        : "苗"}
                  </span>
                </div>
                <strong>药田 {plot.index + 1}</strong>
                <p>
                  {plot.status === "empty"
                    ? "土地松软，可种凝露草"
                    : plot.status === "ready"
                      ? "灵气充盈，可以收获"
                      : `生长中 · ${formatCountdown(seconds)}`}
                </p>
                {plot.status !== "empty" && (
                  <ProgressBar value={progress} label="药田进度" />
                )}
                <button
                  disabled={!isDesktop || busy || plot.status === "growing"}
                  onClick={() =>
                    onAction(plot.status === "ready" ? "harvest" : "plant", {
                      plotIndex: plot.index,
                    })
                  }
                >
                  {plot.status === "ready"
                    ? "收获"
                    : plot.status === "growing"
                      ? "培育中"
                      : "种植"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="feature-section">
        <div className="feature-heading">
          <div>
            <span className="feature-kicker">丹房</span>
            <h2>一炉一丹方</h2>
          </div>
          <small>炼丹占用主任务</small>
        </div>
        {gameState.alchemyJob ? (
          <div className={`active-job ${gameState.alchemyJob.status}`}>
            <div className="job-symbol">炉</div>
            <div className="job-copy">
              <strong>{gameState.alchemyJob.name}</strong>
              <p>
                {gameState.alchemyJob.status === "ready"
                  ? "丹火已息，可以开炉收丹。"
                  : `凝练中 · ${formatCountdown(remainingSeconds(gameState.alchemyJob, now))}`}
              </p>
              <ProgressBar
                value={timedProgress(gameState.alchemyJob, now)}
                label="炼丹进度"
              />
            </div>
            <button
              disabled={
                !isDesktop || busy || gameState.alchemyJob.status !== "ready"
              }
              onClick={() => onAction("claim-alchemy")}
            >
              {gameState.alchemyJob.status === "ready" ? "收丹" : "炼制中"}
            </button>
          </div>
        ) : (
          <div className="recipe-list">
            {gameState.recipes.map((recipe) => (
              <div className="recipe-row" key={recipe.id}>
                <div>
                  <strong>{recipe.name}</strong>
                  <p>{recipe.note}</p>
                  <small>
                    {formatCosts(recipe.costs, labels)} ·{" "}
                    {recipe.durationSeconds} 秒
                  </small>
                </div>
                <button
                  disabled={
                    !isDesktop ||
                    busy ||
                    !recipe.canAfford ||
                    gameState.mainTask === "journey"
                  }
                  onClick={() =>
                    onAction("start-alchemy", { recipe: recipe.id })
                  }
                >
                  开炉
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function JourneyPage({ gameState, now, busy, isDesktop, onAction }) {
  const job = gameState.journeyJob;
  return (
    <>
      <SectionHeading
        eyebrow="VENTURE BEYOND THE CAVE"
        title="青石岭历练"
        chapter="叁 · 历练"
      />
      <div className="journey-landscape">
        <span className="journey-sun" />
        <span className="ridge ridge-back" />
        <span className="ridge ridge-front" />
        <strong>青石岭</strong>
        <small>推荐境界 · 炼气一层</small>
      </div>

      <section className="feature-section journey-details">
        <div className="journey-facts">
          <div>
            <span>耗时</span>
            <strong>45 秒</strong>
          </div>
          <div>
            <span>策略</span>
            <strong>稳妥采集</strong>
          </div>
          <div>
            <span>风险</span>
            <strong>低</strong>
          </div>
        </div>
        <div className="reward-line">
          <span>可能收获</span>
          <p>灵石 8 · 凝露草 2 · 青纹矿 2 · 妖兽内丹 1</p>
        </div>

        {job ? (
          <div className={`active-job journey-job ${job.status}`}>
            <div className="job-symbol">行</div>
            <div className="job-copy">
              <strong>
                {job.site} · {job.strategy}
              </strong>
              <p>
                {job.status === "ready"
                  ? "历练结束，所得已整理完毕。"
                  : `采集途中 · ${formatCountdown(remainingSeconds(job, now))}`}
              </p>
              <ProgressBar value={timedProgress(job, now)} label="历练进度" />
            </div>
            <button
              disabled={!isDesktop || busy || job.status !== "ready"}
              onClick={() => onAction("claim-journey")}
            >
              {job.status === "ready" ? "领取" : "途中"}
            </button>
          </div>
        ) : (
          <button
            className="primary-command"
            disabled={!isDesktop || busy || gameState.mainTask === "alchemy"}
            onClick={() => onAction("start-journey")}
          >
            <span>出发历练</span>
            <span>山路虽远，所得可期 ↗</span>
          </button>
        )}
      </section>

      <div className="honest-note">
        <span>规则</span>
        <p>
          历练采用本地确定性结算，不会丢失已有物品。离开客户端后计时仍会继续，回来后领取结果。
        </p>
      </div>
    </>
  );
}

function InventoryPage({ gameState, busy, isDesktop, onAction }) {
  return (
    <>
      <SectionHeading
        eyebrow="EVERY ITEM HAS A PURPOSE"
        title="行囊百物"
        chapter="肆 · 行囊"
      />
      <div className="inventory-list">
        {INVENTORY_ORDER.map(([key, symbol, note]) => (
          <div className="inventory-row" key={key}>
            <span className="item-symbol">{symbol}</span>
            <div>
              <strong>{gameState.itemLabels[key] ?? key}</strong>
              <p>{note}</p>
            </div>
            <b>{gameState.inventory[key] ?? 0}</b>
            {key === "gatheringPill" && (
              <button
                title="服用聚气丹"
                disabled={
                  !isDesktop || busy || gameState.inventory.gatheringPill < 1
                }
                onClick={() => onAction("use-gathering-pill")}
              >
                服用
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="inventory-summary">
        <span>累计修为</span>
        <strong>{gameState.totalCultivation}</strong>
        <p>物品没有容量上限；生产与历练所得会在领取后原子写入本地存档。</p>
      </div>
    </>
  );
}

function SettingsPage({
  desktopState,
  busy,
  isDesktop,
  onDesktopAction,
  onGameAction,
}) {
  return (
    <>
      <SectionHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="桌面，亦是洞府"
        chapter="伍 · 设置"
      />
      <div className="settings-card">
        <SettingRow
          title="始终置顶"
          note="让小修士陪在其他窗口之上"
          checked={desktopState.alwaysOnTop}
          disabled={busy}
          onChange={(value) => onDesktopAction("top", value)}
        />
        <SettingRow
          title="鼠标穿透"
          note="仅桌宠模式可用，请通过托盘恢复"
          checked={desktopState.clickThrough}
          disabled
          onChange={(value) => onDesktopAction("through", value)}
        />
        <div className="setting-row scale-setting">
          <div>
            <strong>桌宠尺寸</strong>
            <p>选择最合适的陪伴距离</p>
          </div>
          <div className="segmented">
            {[0.75, 1, 1.25].map((value) => (
              <button
                key={value}
                aria-pressed={desktopState.scale === value}
                className={desktopState.scale === value ? "selected" : ""}
                disabled={busy}
                onClick={() => onDesktopAction("scale", value)}
              >
                {value === 1 ? "标准" : value < 1 ? "小巧" : "放大"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="save-actions">
        <div>
          <strong>本地修炼存档 v2</strong>
          <p>自动保存，可导入 v0.2 旧存档并迁移。</p>
        </div>
        <div className="save-buttons">
          <button
            disabled={!isDesktop || busy}
            onClick={() => onGameAction("import")}
          >
            导入
          </button>
          <button
            disabled={!isDesktop || busy}
            onClick={() => onGameAction("export")}
          >
            导出
          </button>
        </div>
      </div>

      <button
        className="primary-button"
        disabled={busy}
        onClick={() => onDesktopAction("mode", "pet")}
      >
        <span>◇ 返回透明桌宠</span>
        <span>↗</span>
      </button>
      <div className="settings-help">
        <h2>陪伴的小秘诀</h2>
        <p>
          拖动小修士移动窗口，单击进入洞府。
          <br />
          右键打开菜单；鼠标穿透后请用托盘恢复。
          <br />
          炼丹和历练是主任务，药园则会独立生长。
        </p>
      </div>
    </>
  );
}

function SettingRow({ title, note, checked, disabled, onChange }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
      <button
        className={`toggle ${checked ? "on" : ""}`}
        role="switch"
        aria-label={title}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export default App;
