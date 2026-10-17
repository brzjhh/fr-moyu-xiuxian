import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import {
  createSessionToken,
  hashInvitationCode,
  hashOpaqueValue,
  hashPassword,
  verifyPassword,
} from "./security.js";
import {
  StoreError,
  type AppStore,
  type JsonObject,
  type SaveSummary,
  type SessionRecord,
} from "./store.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GAME_ID = "chentu-cultivation-save";
const SAVE_VERSION = 2;
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;
const missingAccountPasswordHash = hashPassword("missing-account-placeholder");

export type BuildAppOptions = {
  store: AppStore;
  logger?: boolean;
  now?: () => Date;
  sessionTtlMs?: number;
};

type AuthenticatedRequest = {
  session: SessionRecord;
  tokenHash: string;
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function integer(
  value: unknown,
  minimum = 0,
  maximum = 1_000_000_000,
): number | null {
  return Number.isInteger(value) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
    ? Number(value)
    : null;
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return USERNAME_PATTERN.test(normalized) ? normalized : null;
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

function normalizeCharacterName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= 1 && normalized.length <= 12 ? normalized : null;
}

function createInitialState(characterName: string, now: Date): JsonObject {
  const timestamp = now.toISOString();
  return {
    gameId: GAME_ID,
    version: SAVE_VERSION,
    characterName,
    realmIndex: 0,
    cultivation: 0,
    totalCultivation: 0,
    cultivating: false,
    inventory: {
      spiritStone: 20,
      dewHerb: 0,
      ironOre: 0,
      beastCore: 0,
      gatheringPill: 0,
      foundationPill: 0,
    },
    garden: [
      { index: 0, status: "empty", crop: null, plantedAt: null, readyAt: null },
      { index: 1, status: "empty", crop: null, plantedAt: null, readyAt: null },
    ],
    alchemyJob: null,
    journeyJob: null,
    createdAt: timestamp,
    lastSettledAt: timestamp,
    events: [
      {
        id: `registered-${now.getTime()}`,
        at: timestamp,
        kind: "system",
        text: "踏入洞府，修行自此始。",
      },
    ],
  };
}

function validateSaveState(
  value: unknown,
): { state: JsonObject; summary: SaveSummary } | null {
  if (!isObject(value) || value.gameId !== GAME_ID) return null;
  const version = integer(value.version, 1, SAVE_VERSION);
  const characterName = normalizeCharacterName(value.characterName);
  const realmIndex = integer(value.realmIndex, 0, 13);
  const cultivation = integer(value.cultivation);
  const totalCultivation = integer(value.totalCultivation);
  if (
    version == null ||
    !characterName ||
    realmIndex == null ||
    cultivation == null ||
    totalCultivation == null ||
    totalCultivation < cultivation ||
    !isObject(value.inventory) ||
    !Array.isArray(value.garden) ||
    !Array.isArray(value.events) ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.lastSettledAt !== "string" ||
    !Number.isFinite(Date.parse(value.lastSettledAt))
  ) {
    return null;
  }

  const spiritStones = integer(value.inventory.spiritStone);
  const dewGrass = integer(value.inventory.dewHerb);
  const gatheringPills = integer(value.inventory.gatheringPill);
  const foundationPills = integer(value.inventory.foundationPill);
  const blueOre = integer(value.inventory.ironOre);
  const beastCores = integer(value.inventory.beastCore);
  if (
    spiritStones == null ||
    dewGrass == null ||
    gatheringPills == null ||
    foundationPills == null ||
    blueOre == null ||
    beastCores == null
  ) {
    return null;
  }

  return {
    state: value,
    summary: {
      realmIndex,
      cultivation,
      totalCultivation,
      spiritStones,
      dewGrass,
      gatheringPills,
      foundationPills,
      blueOre,
      beastCores,
    },
  };
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{40,128})$/.exec(header);
  return match?.[1] ?? null;
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    bodyLimit: 256 * 1024,
    logger: options.logger ?? false,
  });
  const now = options.now ?? (() => new Date());
  const sessionTtlMs = options.sessionTtlMs ?? SESSION_TTL_MS;

  async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<AuthenticatedRequest | null> {
    const token = bearerToken(request);
    if (!token) {
      await reply
        .code(401)
        .send(errorBody("unauthorized", "需要有效的登录会话。"));
      return null;
    }
    const tokenHash = hashOpaqueValue(token);
    const session = await options.store.findSession(tokenHash, now());
    if (!session) {
      await reply
        .code(401)
        .send(errorBody("unauthorized", "登录会话无效或已过期。"));
      return null;
    }
    return { session, tokenHash };
  }

  app.get("/health", async (request, reply) => {
    try {
      await options.store.check();
      return {
        database: "ok",
        service: "chentu-server",
        status: "ok",
        time: now().toISOString(),
      };
    } catch (error) {
      request.log.warn({ error }, "database health check failed");
      return reply.code(503).send({
        database: "unavailable",
        service: "chentu-server",
        status: "unavailable",
      });
    }
  });

  app.post("/v1/auth/register", async (request, reply) => {
    const body = isObject(request.body) ? request.body : {};
    const username = normalizeUsername(body.username);
    const password = validPassword(body.password) ? body.password : null;
    const characterName = normalizeCharacterName(body.characterName);
    const invitationCode =
      typeof body.invitationCode === "string" &&
      body.invitationCode.trim().length >= 6 &&
      body.invitationCode.trim().length <= 128
        ? body.invitationCode
        : null;
    if (!username || !password || !characterName || !invitationCode) {
      return reply
        .code(400)
        .send(
          errorBody(
            "invalid_registration",
            "用户名需为 3-32 位小写字母、数字或下划线；密码至少 8 位。",
          ),
        );
    }

    const currentTime = now();
    const expiresAt = new Date(currentTime.getTime() + sessionTtlMs);
    const token = createSessionToken();
    const initialState = createInitialState(characterName, currentTime);
    try {
      const profile = await options.store.register({
        username,
        passwordHash: await hashPassword(password),
        invitationCodeHash: hashInvitationCode(invitationCode),
        characterName,
        initialState,
        initialSummary: validateSaveState(initialState)!.summary,
        sessionTokenHash: hashOpaqueValue(token),
        sessionExpiresAt: expiresAt,
      });
      return reply.code(201).send({
        token,
        expiresAt: expiresAt.toISOString(),
        ...profile,
      });
    } catch (error) {
      if (!(error instanceof StoreError)) throw error;
      const responses = {
        invitation_invalid: [400, "邀请码无效。"],
        invitation_expired: [400, "邀请码已过期。"],
        invitation_exhausted: [400, "邀请码使用次数已耗尽。"],
        username_taken: [409, "用户名已被占用。"],
      } as const;
      const [status, message] = responses[error.code];
      return reply.code(status).send(errorBody(error.code, message));
    }
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const body = isObject(request.body) ? request.body : {};
    const username = normalizeUsername(body.username);
    const password = validPassword(body.password) ? body.password : null;
    if (!username || !password) {
      return reply
        .code(400)
        .send(errorBody("invalid_login", "用户名或密码格式无效。"));
    }

    const account = await options.store.findAccountByUsername(username);
    const passwordMatches = await verifyPassword(
      password,
      account?.passwordHash ?? (await missingAccountPasswordHash),
    );
    if (!account || !passwordMatches) {
      return reply
        .code(401)
        .send(errorBody("invalid_credentials", "用户名或密码错误。"));
    }
    const token = createSessionToken();
    const expiresAt = new Date(now().getTime() + sessionTtlMs);
    await options.store.createSession(
      account.user.id,
      hashOpaqueValue(token),
      expiresAt,
    );
    const { passwordHash: _passwordHash, ...profile } = account;
    return { token, expiresAt: expiresAt.toISOString(), ...profile };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const authenticated = await authenticate(request, reply);
    if (!authenticated) return;
    await options.store.deleteSession(authenticated.tokenHash);
    return reply.code(204).send();
  });

  app.get("/v1/me", async (request, reply) => {
    const authenticated = await authenticate(request, reply);
    if (!authenticated) return;
    return {
      user: authenticated.session.user,
      character: authenticated.session.character,
      sessionExpiresAt: authenticated.session.expiresAt,
    };
  });

  app.get("/v1/save", async (request, reply) => {
    const authenticated = await authenticate(request, reply);
    if (!authenticated) return;
    return { character: authenticated.session.character };
  });

  app.put("/v1/save", async (request, reply) => {
    const authenticated = await authenticate(request, reply);
    if (!authenticated) return;
    const body = isObject(request.body) ? request.body : {};
    const expectedVersion = integer(
      body.stateVersion,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const save = validateSaveState(body.state);
    if (expectedVersion == null || !save) {
      return reply
        .code(400)
        .send(errorBody("invalid_save", "存档内容或状态版本无效。"));
    }

    const result = await options.store.updateCharacter(
      authenticated.session.user.id,
      {
        expectedVersion,
        state: save.state,
        summary: save.summary,
      },
    );
    if (!result.updated) {
      return reply.code(409).send({
        ...errorBody("save_conflict", "云端存档已被其他设备更新。"),
        character: result.character,
      });
    }
    return { character: result.character };
  });

  return app;
}
