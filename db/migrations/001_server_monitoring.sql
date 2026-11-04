-- ACRN Studios — Phase 2: real-time server monitoring
-- Idempotent: safe to run more than once.
-- Run with:  node --env-file=.env.local scripts/db-migrate.mjs
-- or paste into the Neon SQL Editor.

-- Latest state of every game server that has reported in.
-- One row per (universe, JobId); heartbeats update the row in place.
CREATE TABLE IF NOT EXISTS game_servers (
  universe_id           BIGINT      NOT NULL,
  job_id                TEXT        NOT NULL,
  place_id              BIGINT      NOT NULL,
  place_version         INTEGER     NOT NULL,
  server_type           TEXT        NOT NULL CHECK (server_type IN ('public', 'private', 'reserved', 'studio')),
  player_count          INTEGER     NOT NULL CHECK (player_count >= 0),
  max_players           INTEGER     NOT NULL CHECK (max_players > 0),
  started_at            TIMESTAMPTZ NOT NULL,
  first_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_count       BIGINT      NOT NULL DEFAULT 1,
  shutdown_reported_at  TIMESTAMPTZ,
  sessions_completed    INTEGER     NOT NULL DEFAULT 0 CHECK (sessions_completed >= 0),
  session_seconds_total BIGINT      NOT NULL DEFAULT 0 CHECK (session_seconds_total >= 0),
  PRIMARY KEY (universe_id, job_id)
);

CREATE INDEX IF NOT EXISTS game_servers_recent_idx
  ON game_servers (universe_id, last_heartbeat_at DESC);

-- Player-count history, aggregated per server into fixed time buckets
-- (default 5 minutes) so storage grows with time, not heartbeat frequency.
CREATE TABLE IF NOT EXISTS server_population_samples (
  universe_id      BIGINT      NOT NULL,
  job_id           TEXT        NOT NULL,
  bucket_start     TIMESTAMPTZ NOT NULL,
  sample_count     INTEGER     NOT NULL,
  player_count_sum BIGINT      NOT NULL,
  player_count_min INTEGER     NOT NULL,
  player_count_max INTEGER     NOT NULL,
  max_players      INTEGER     NOT NULL,
  PRIMARY KEY (universe_id, job_id, bucket_start)
);

CREATE INDEX IF NOT EXISTS server_population_samples_bucket_idx
  ON server_population_samples (universe_id, bucket_start);
