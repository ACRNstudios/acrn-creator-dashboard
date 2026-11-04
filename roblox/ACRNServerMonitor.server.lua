-- ACRN Studios Server Monitor
-- Install as a NEW Script (not LocalScript) in ServerScriptService.
--
-- Reports this server's live state to the ACRN Creator Dashboard:
--   POST <ENDPOINT>  (Authorization: Bearer <secret from the experience Secrets store>)
--
-- Requirements (see README "Phase 2"):
--   1. Game Settings > Security > "Allow HTTP Requests" = ON.
--   2. A secret named SECRET_NAME in Creator Hub > (Critter Factory) > Secrets,
--      restricted to your dashboard's domain, with the same value as the
--      dashboard's ROBLOX_TELEMETRY_SECRET. Never paste the secret into this script.
--   3. Set ENDPOINT below to your deployed dashboard URL.
--
-- This script never trusts itself to report shutdown: the dashboard marks a
-- server offline when its heartbeats stop, even if the server crashes.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local CONFIG = {
	ENDPOINT = "https://YOUR-DASHBOARD-DOMAIN/api/roblox/server-heartbeat",
	SECRET_NAME = "acrn_telemetry_secret",
	DEFAULT_INTERVAL = 30, -- seconds; the dashboard can override this in its response
	MIN_INTERVAL = 15,
	MAX_INTERVAL = 300,
	PLAYER_CHANGE_DEBOUNCE = 10, -- min seconds between player-change reports
	MAX_BACKOFF = 300, -- longest wait after repeated failures
	MISCONFIG_BACKOFF = 300, -- wait after 400/401/403 (configuration problem)
	REPORT_IN_STUDIO = true, -- Studio play tests appear as "studio" servers
}

local LOG_PREFIX = "[ACRN Monitor] "

if CONFIG.ENDPOINT:find("YOUR%-DASHBOARD%-DOMAIN") then
	warn(LOG_PREFIX .. "ENDPOINT is not set. Server monitoring is disabled.")
	return
end

local isStudio = RunService:IsStudio()
if isStudio and not CONFIG.REPORT_IN_STUDIO then
	return
end

-- Secret: loaded from the experience Secrets store. Never hard-code it.
local okSecret, secretOrError = pcall(function()
	return HttpService:GetSecret(CONFIG.SECRET_NAME)
end)
if not okSecret then
	warn(LOG_PREFIX .. "Could not load secret '" .. CONFIG.SECRET_NAME .. "'. Monitoring disabled. (" .. tostring(secretOrError) .. ")")
	return
end
local authorizationHeader = secretOrError:AddPrefix("Bearer ")

-- Server identity
local startedAt = os.time()
local jobId = game.JobId
if isStudio or jobId == "" then
	-- Studio has no real JobId; use a clearly-marked unique id instead.
	jobId = "studio-" .. string.lower(HttpService:GenerateGUID(false))
end

local function getServerType(): string
	if isStudio then
		return "studio"
	end
	if game.PrivateServerId ~= "" then
		-- PrivateServerOwnerId is 0 for reserved servers (TeleportService:ReserveServer).
		if game.PrivateServerOwnerId ~= 0 then
			return "private"
		end
		return "reserved"
	end
	return "public"
end
local serverType = getServerType()

-- Session tracking (cumulative for this server's lifetime)
local joinedAt: { [Player]: number } = {}
local sessionsCompleted = 0
local sessionSecondsTotal = 0

-- Scheduling state
local heartbeatInterval = CONFIG.DEFAULT_INTERVAL
local nextHeartbeatAt = 0 -- os.clock() time; 0 = send immediately (startup)
local blockedUntil = 0 -- no sends of any kind before this (backoff)
local lastSentAt = -math.huge
local playersChanged = false
local consecutiveFailures = 0
local hasReported = false
local shuttingDown = false
local lastWarning = ""

local function warnOnce(message: string)
	if message ~= lastWarning then
		lastWarning = message
		warn(LOG_PREFIX .. message)
	end
end

local function buildPayload(reason: string)
	local now = os.time()
	return {
		version = 1,
		universeId = game.GameId,
		placeId = game.PlaceId,
		placeVersion = game.PlaceVersion,
		jobId = jobId,
		serverType = serverType,
		playerCount = #Players:GetPlayers(),
		maxPlayers = Players.MaxPlayers,
		startedAt = startedAt,
		uptimeSeconds = math.max(0, now - startedAt),
		sentAt = now,
		reason = reason,
		sessionsCompleted = sessionsCompleted,
		sessionSecondsTotal = sessionSecondsTotal,
	}
end

-- Returns: success, statusCode (0 on network error), responseBody or error text
local function post(reason: string): (boolean, number, string)
	local okEncode, body = pcall(function()
		return HttpService:JSONEncode(buildPayload(reason))
	end)
	if not okEncode then
		return false, 0, "encode failed: " .. tostring(body)
	end
	local okRequest, response = pcall(function()
		return HttpService:RequestAsync({
			Url = CONFIG.ENDPOINT,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["Authorization"] = authorizationHeader,
			},
			Body = body,
		})
	end)
	if not okRequest then
		return false, 0, tostring(response)
	end
	return response.Success, response.StatusCode, response.Body or ""
end

local function report(reason: string)
	local ok, status, body = post(reason)
	local now = os.clock()
	lastSentAt = now

	if ok then
		consecutiveFailures = 0
		blockedUntil = 0
		playersChanged = false
		if not hasReported then
			hasReported = true
			print(LOG_PREFIX .. "Reporting to dashboard as " .. jobId .. " (" .. serverType .. ")")
		end
		lastWarning = ""
		-- The dashboard is the source of truth for the heartbeat interval.
		local okDecode, decoded = pcall(function()
			return HttpService:JSONDecode(body)
		end)
		if okDecode and typeof(decoded) == "table" and typeof(decoded.heartbeatIntervalSeconds) == "number" then
			heartbeatInterval = math.clamp(decoded.heartbeatIntervalSeconds, CONFIG.MIN_INTERVAL, CONFIG.MAX_INTERVAL)
		end
		nextHeartbeatAt = now + heartbeatInterval
		return
	end

	if status == 429 then
		-- Rate limited: our state will be resent shortly; nothing is lost.
		blockedUntil = now + 10
		nextHeartbeatAt = math.max(nextHeartbeatAt, blockedUntil)
		return
	end

	if status == 400 or status == 401 or status == 403 then
		-- Configuration problem (secret, universe, payload). Retry slowly so a fix is picked up.
		warnOnce("Dashboard rejected report (HTTP " .. status .. "): " .. string.sub(body, 1, 200))
		blockedUntil = now + CONFIG.MISCONFIG_BACKOFF
		nextHeartbeatAt = blockedUntil
		return
	end

	-- Network error or 5xx: exponential backoff with jitter. The next attempt
	-- sends fresh state, so failed reports are never queued or duplicated.
	consecutiveFailures += 1
	local backoff = math.min(CONFIG.MAX_BACKOFF, 5 * 2 ^ (consecutiveFailures - 1))
	backoff += math.random() * backoff * 0.25
	if status == 0 then
		warnOnce("Heartbeat failed: " .. string.sub(body, 1, 200))
	else
		warnOnce("Heartbeat failed (HTTP " .. status .. ")")
	end
	blockedUntil = now + backoff
	nextHeartbeatAt = blockedUntil
end

-- Player tracking
local function onPlayerAdded(player: Player)
	joinedAt[player] = os.clock()
	playersChanged = true
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do
	onPlayerAdded(player)
end

Players.PlayerRemoving:Connect(function(player: Player)
	local joined = joinedAt[player]
	if joined then
		sessionsCompleted += 1
		sessionSecondsTotal += math.floor(os.clock() - joined)
		joinedAt[player] = nil
	end
	playersChanged = true
end)

-- Final report on graceful shutdown (best-effort; crashes are detected by the dashboard).
game:BindToClose(function()
	shuttingDown = true
	-- Count sessions of players still connected.
	for player, joined in joinedAt do
		sessionsCompleted += 1
		sessionSecondsTotal += math.floor(os.clock() - joined)
		joinedAt[player] = nil
	end
	local ok, status = post("shutdown")
	if not ok then
		warn(LOG_PREFIX .. "Shutdown report failed (HTTP " .. tostring(status) .. ")")
	end
end)

-- Main loop: one request at a time, never overlapping.
task.spawn(function()
	while not shuttingDown do
		local now = os.clock()
		if now >= blockedUntil then
			if now >= nextHeartbeatAt then
				report(hasReported and "heartbeat" or "startup")
			elseif playersChanged and hasReported and now - lastSentAt >= CONFIG.PLAYER_CHANGE_DEBOUNCE then
				report("player_change")
			end
		end
		task.wait(1)
	end
end)
