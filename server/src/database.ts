import { Pool, type PoolClient, type QueryResultRow } from "pg";
import {
  StoreError,
  type AccountProfile,
  type AppStore,
  type CharacterRecord,
  type JsonObject,
  type SaveSummary,
} from "./store.js";

type AccountRow = QueryResultRow & {
  user_id: string;
  username: string;
  password_hash?: string;
  character_id: string;
  character_name: string;
  state_version: number;
  save_data: JsonObject;
  character_updated_at: Date | string;
  session_expires_at?: Date | string;
};

function isoDate(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapCharacter(row: AccountRow): CharacterRecord {
  return {
    id: String(row.character_id),
    name: row.character_name,
    stateVersion: Number(row.state_version),
    state:
      row.save_data && typeof row.save_data === "object" ? row.save_data : {},
    updatedAt: isoDate(row.character_updated_at),
  };
}

function mapProfile(row: AccountRow): AccountProfile {
  return {
    user: { id: String(row.user_id), username: row.username },
    character: mapCharacter(row),
  };
}

function accountSelect(where: string): string {
  return `
    SELECT
      u.id AS user_id,
      u.username,
      u.password_hash,
      c.id AS character_id,
      c.name AS character_name,
      c.state_version,
      c.save_data,
      c.updated_at AS character_updated_at
    FROM users u
    JOIN characters c ON c.user_id = u.id
    ${where}
  `;
}

async function rollback(client: PoolClient) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original transaction error.
  }
}

function isUsernameTaken(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      error.constraint === "users_username_key",
  );
}

async function updateResources(
  client: PoolClient,
  characterId: string,
  summary: SaveSummary,
) {
  await client.query(
    `
      INSERT INTO character_resources (
        character_id,
        spirit_stones,
        dew_grass,
        gathering_pills,
        foundation_pills,
        blue_ore,
        beast_cores,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT (character_id) DO UPDATE SET
        spirit_stones = EXCLUDED.spirit_stones,
        dew_grass = EXCLUDED.dew_grass,
        gathering_pills = EXCLUDED.gathering_pills,
        foundation_pills = EXCLUDED.foundation_pills,
        blue_ore = EXCLUDED.blue_ore,
        beast_cores = EXCLUDED.beast_cores,
        updated_at = now()
    `,
    [
      characterId,
      summary.spiritStones,
      summary.dewGrass,
      summary.gatheringPills,
      summary.foundationPills,
      summary.blueOre,
      summary.beastCores,
    ],
  );
}

export function createDatabase(connectionString: string): AppStore {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });

  return {
    async check() {
      await pool.query("SELECT 1");
    },

    async register(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const invitation = await client.query<{
          id: string;
          max_uses: number;
          uses: number;
          expires_at: Date | null;
        }>(
          `
            SELECT id, max_uses, uses, expires_at
            FROM invitation_codes
            WHERE code_hash = $1
            FOR UPDATE
          `,
          [input.invitationCodeHash],
        );
        const code = invitation.rows[0];
        if (!code) throw new StoreError("invitation_invalid");
        if (code.expires_at && code.expires_at.getTime() <= Date.now()) {
          throw new StoreError("invitation_expired");
        }
        if (code.uses >= code.max_uses) {
          throw new StoreError("invitation_exhausted");
        }

        const userResult = await client.query<{ id: string; username: string }>(
          `
            INSERT INTO users (username, password_hash)
            VALUES ($1, $2)
            RETURNING id, username
          `,
          [input.username, input.passwordHash],
        );
        const user = userResult.rows[0];
        if (!user) throw new Error("user insert returned no row");

        const characterResult = await client.query<{
          id: string;
          name: string;
          state_version: number;
          save_data: JsonObject;
          updated_at: Date;
        }>(
          `
            INSERT INTO characters (
              user_id,
              name,
              realm_index,
              cultivation,
              total_cultivation,
              save_data
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            RETURNING id, name, state_version, save_data, updated_at
          `,
          [
            user.id,
            input.characterName,
            input.initialSummary.realmIndex,
            input.initialSummary.cultivation,
            input.initialSummary.totalCultivation,
            JSON.stringify(input.initialState),
          ],
        );
        const character = characterResult.rows[0];
        if (!character) throw new Error("character insert returned no row");

        await updateResources(client, character.id, input.initialSummary);
        await client.query(
          "UPDATE invitation_codes SET uses = uses + 1 WHERE id = $1",
          [code.id],
        );
        await client.query(
          "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
          [input.sessionTokenHash, user.id, input.sessionExpiresAt],
        );
        await client.query("COMMIT");

        return {
          user: { id: String(user.id), username: user.username },
          character: {
            id: String(character.id),
            name: character.name,
            stateVersion: Number(character.state_version),
            state: character.save_data,
            updatedAt: isoDate(character.updated_at),
          },
        };
      } catch (error) {
        await rollback(client);
        if (error instanceof StoreError) throw error;
        if (isUsernameTaken(error)) throw new StoreError("username_taken");
        throw error;
      } finally {
        client.release();
      }
    },

    async findAccountByUsername(username) {
      const result = await pool.query<AccountRow>(
        accountSelect("WHERE u.username = $1"),
        [username],
      );
      const row = result.rows[0];
      if (!row?.password_hash) return null;
      return { ...mapProfile(row), passwordHash: row.password_hash };
    },

    async createSession(userId, tokenHash, expiresAt) {
      await pool.query("DELETE FROM sessions WHERE expires_at <= now()");
      await pool.query(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
        [tokenHash, userId, expiresAt],
      );
    },

    async findSession(tokenHash, now) {
      const result = await pool.query<AccountRow>(
        `
          SELECT
            u.id AS user_id,
            u.username,
            c.id AS character_id,
            c.name AS character_name,
            c.state_version,
            c.save_data,
            c.updated_at AS character_updated_at,
            s.expires_at AS session_expires_at
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          JOIN characters c ON c.user_id = u.id
          WHERE s.token_hash = $1 AND s.expires_at > $2
        `,
        [tokenHash, now],
      );
      const row = result.rows[0];
      if (!row?.session_expires_at) return null;
      return { ...mapProfile(row), expiresAt: isoDate(row.session_expires_at) };
    },

    async deleteSession(tokenHash) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [
        tokenHash,
      ]);
    },

    async updateCharacter(userId, update) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<{
          id: string;
          name: string;
          state_version: number;
          save_data: JsonObject;
          updated_at: Date;
        }>(
          `
            UPDATE characters
            SET
              name = $3,
              realm_index = $4,
              cultivation = $5,
              total_cultivation = $6,
              save_data = $7::jsonb,
              state_version = state_version + 1,
              updated_at = now()
            WHERE user_id = $1 AND state_version = $2
            RETURNING id, name, state_version, save_data, updated_at
          `,
          [
            userId,
            update.expectedVersion,
            String(update.state.characterName),
            update.summary.realmIndex,
            update.summary.cultivation,
            update.summary.totalCultivation,
            JSON.stringify(update.state),
          ],
        );
        const updated = result.rows[0];
        if (updated) {
          await updateResources(client, updated.id, update.summary);
          await client.query("COMMIT");
          return {
            updated: true,
            character: {
              id: String(updated.id),
              name: updated.name,
              stateVersion: Number(updated.state_version),
              state: updated.save_data,
              updatedAt: isoDate(updated.updated_at),
            },
          };
        }

        const current = await client.query<{
          id: string;
          name: string;
          state_version: number;
          save_data: JsonObject;
          updated_at: Date;
        }>(
          "SELECT id, name, state_version, save_data, updated_at FROM characters WHERE user_id = $1",
          [userId],
        );
        await client.query("COMMIT");
        const character = current.rows[0];
        if (!character) throw new Error("character not found");
        return {
          updated: false,
          character: {
            id: String(character.id),
            name: character.name,
            stateVersion: Number(character.state_version),
            state: character.save_data,
            updatedAt: isoDate(character.updated_at),
          },
        };
      } catch (error) {
        await rollback(client);
        throw error;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    },
  };
}
