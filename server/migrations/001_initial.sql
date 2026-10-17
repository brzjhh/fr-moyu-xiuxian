CREATE TABLE invitation_codes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_hash text NOT NULL UNIQUE,
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses integer NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE characters (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  realm_index integer NOT NULL DEFAULT 0 CHECK (realm_index >= 0),
  cultivation bigint NOT NULL DEFAULT 0 CHECK (cultivation >= 0),
  total_cultivation bigint NOT NULL DEFAULT 0 CHECK (total_cultivation >= 0),
  state_version integer NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE character_resources (
  character_id bigint PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  spirit_stones bigint NOT NULL DEFAULT 0 CHECK (spirit_stones >= 0),
  dew_grass bigint NOT NULL DEFAULT 0 CHECK (dew_grass >= 0),
  gathering_pills bigint NOT NULL DEFAULT 0 CHECK (gathering_pills >= 0),
  foundation_pills bigint NOT NULL DEFAULT 0 CHECK (foundation_pills >= 0),
  blue_ore bigint NOT NULL DEFAULT 0 CHECK (blue_ore >= 0),
  beast_cores bigint NOT NULL DEFAULT 0 CHECK (beast_cores >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_key text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_key)
);
