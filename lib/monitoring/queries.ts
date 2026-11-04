// SQL for server monitoring. All values are bound parameters ($n) with explicit casts.

/**
 * Upsert the server's latest state AND fold the player count into its history bucket,
 * in one statement / one round trip.
 * Returns one row ({ inserted }) when recorded, zero rows when rate-limited.
 * $1 universe_id  $2 job_id  $3 place_id  $4 place_version  $5 server_type  $6 player_count
 * $7 max_players  $8 started_at (unix s)  $9 reason (text)  $10 sessions_completed
 * $11 session_seconds_total  $12 min_report_interval_s  $13 sample_bucket_s
 */
export const UPSERT_HEARTBEAT_SQL = `
WITH upserted AS (
  INSERT INTO game_servers AS gs (
    universe_id, job_id, place_id, place_version, server_type, player_count, max_players,
    started_at, first_seen_at, last_heartbeat_at, heartbeat_count, shutdown_reported_at,
    sessions_completed, session_seconds_total)
  VALUES (
    $1::bigint, $2::text, $3::bigint, $4::int, $5::text, $6::int, $7::int,
    to_timestamp($8::bigint), now(), now(), 1, CASE WHEN ($9::text = 'shutdown') THEN now() END,
    $10::int, $11::bigint)
  ON CONFLICT (universe_id, job_id) DO UPDATE SET
    place_id = EXCLUDED.place_id,
    place_version = EXCLUDED.place_version,
    server_type = EXCLUDED.server_type,
    player_count = EXCLUDED.player_count,
    max_players = EXCLUDED.max_players,
    started_at = EXCLUDED.started_at,
    last_heartbeat_at = now(),
    heartbeat_count = gs.heartbeat_count + 1,
    shutdown_reported_at = EXCLUDED.shutdown_reported_at,
    sessions_completed = GREATEST(gs.sessions_completed, EXCLUDED.sessions_completed),
    session_seconds_total = GREATEST(gs.session_seconds_total, EXCLUDED.session_seconds_total)
  WHERE ($9::text = 'shutdown') OR gs.last_heartbeat_at <= now() - make_interval(secs => $12::int)
  RETURNING (xmax = 0) AS inserted
), sampled AS (
  INSERT INTO server_population_samples AS s (
    universe_id, job_id, bucket_start, sample_count, player_count_sum,
    player_count_min, player_count_max, max_players)
  SELECT $1::bigint, $2::text,
         to_timestamp(floor(extract(epoch FROM now()) / $13::int) * $13::int),
         1, $6::int, $6::int, $6::int, $7::int
  FROM upserted
  WHERE NOT ($9::text = 'shutdown')
  ON CONFLICT (universe_id, job_id, bucket_start) DO UPDATE SET
    sample_count = s.sample_count + 1,
    player_count_sum = s.player_count_sum + EXCLUDED.player_count_sum,
    player_count_min = LEAST(s.player_count_min, EXCLUDED.player_count_min),
    player_count_max = GREATEST(s.player_count_max, EXCLUDED.player_count_max),
    max_players = EXCLUDED.max_players
  RETURNING 1
)
SELECT inserted FROM upserted`;

/** $1 universe_id  $2 window hours */
export const LIST_SERVERS_SQL = `
SELECT job_id, place_id::float8 AS place_id, place_version, server_type, player_count, max_players,
       extract(epoch FROM started_at)::float8 AS started_at,
       extract(epoch FROM first_seen_at)::float8 AS first_seen_at,
       extract(epoch FROM last_heartbeat_at)::float8 AS last_heartbeat_at,
       (shutdown_reported_at IS NOT NULL) AS shutdown_reported
FROM game_servers
WHERE universe_id = $1::bigint
  AND last_heartbeat_at > now() - make_interval(hours => $2::int)
ORDER BY last_heartbeat_at DESC
LIMIT 1000`;

/** $1 universe_id  $2 window hours. Always returns exactly one row (also carries the DB clock). */
export const SESSION_TOTALS_SQL = `
SELECT COALESCE(SUM(sessions_completed), 0)::float8 AS sessions,
       COALESCE(SUM(session_seconds_total), 0)::float8 AS seconds,
       extract(epoch FROM now())::float8 AS db_now
FROM game_servers
WHERE universe_id = $1::bigint
  AND last_heartbeat_at > now() - make_interval(hours => $2::int)`;

/** $1 universe_id  $2 window hours */
export const POPULATION_HISTORY_SQL = `
SELECT extract(epoch FROM bucket_start)::float8 AS bucket_start,
       SUM(player_count_max)::float8 AS peak_players,
       SUM(player_count_sum::float8 / sample_count)::float8 AS average_players,
       COUNT(*)::float8 AS servers
FROM server_population_samples
WHERE universe_id = $1::bigint
  AND bucket_start >= now() - make_interval(hours => $2::int)
GROUP BY bucket_start
ORDER BY bucket_start`;

/** $1 retention days */
export const PRUNE_SAMPLES_SQL = `DELETE FROM server_population_samples WHERE bucket_start < now() - make_interval(days => $1::int)`;
/** $1 retention days */
export const PRUNE_SERVERS_SQL = `DELETE FROM game_servers WHERE last_heartbeat_at < now() - make_interval(days => $1::int)`;
