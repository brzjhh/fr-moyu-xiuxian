export type JsonObject = Record<string, unknown>;

export type SaveSummary = {
  realmIndex: number;
  cultivation: number;
  totalCultivation: number;
  spiritStones: number;
  dewGrass: number;
  gatheringPills: number;
  foundationPills: number;
  blueOre: number;
  beastCores: number;
};

export type CharacterRecord = {
  id: string;
  name: string;
  stateVersion: number;
  state: JsonObject;
  updatedAt: string;
};

export type AccountProfile = {
  user: { id: string; username: string };
  character: CharacterRecord;
};

export type AccountWithPassword = AccountProfile & {
  passwordHash: string;
};

export type SessionRecord = AccountProfile & {
  expiresAt: string;
};

export type RegistrationInput = {
  username: string;
  passwordHash: string;
  invitationCodeHash: string;
  characterName: string;
  initialState: JsonObject;
  initialSummary: SaveSummary;
  sessionTokenHash: string;
  sessionExpiresAt: Date;
};

export type SaveUpdate = {
  state: JsonObject;
  summary: SaveSummary;
  expectedVersion: number;
};

export class StoreError extends Error {
  constructor(
    public readonly code:
      | "invitation_invalid"
      | "invitation_expired"
      | "invitation_exhausted"
      | "username_taken",
  ) {
    super(code);
  }
}

export interface AppStore {
  check(): Promise<void>;
  register(input: RegistrationInput): Promise<AccountProfile>;
  findAccountByUsername(username: string): Promise<AccountWithPassword | null>;
  createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  findSession(tokenHash: string, now: Date): Promise<SessionRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  updateCharacter(
    userId: string,
    update: SaveUpdate,
  ): Promise<{ updated: boolean; character: CharacterRecord }>;
  close(): Promise<void>;
}
