-- ACRN Studios Creator Command Listener
-- Install this as a NEW Script in ServerScriptService.
-- Topic must match ROBLOX_COMMAND_TOPIC in the website backend.

local MessagingService = game:GetService("MessagingService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TOPIC = "ACRN_Creator_Commands"
local MAX_AGE_SECONDS = 120
local seenCommands = {}

local announcementEvent = ReplicatedStorage:FindFirstChild("ACRN_Announcement")
if not announcementEvent then
    announcementEvent = Instance.new("RemoteEvent")
    announcementEvent.Name = "ACRN_Announcement"
    announcementEvent.Parent = ReplicatedStorage
end

local function handleMessage(message)
    local raw = message.Data
    if typeof(raw) ~= "string" then
        warn("[ACRN Creator] Ignored non-string message")
        return
    end

    local ok, payload = pcall(function()
        return HttpService:JSONDecode(raw)
    end)
    if not ok or typeof(payload) ~= "table" then
        warn("[ACRN Creator] Ignored invalid JSON command")
        return
    end

    if payload.version ~= 1 or payload.type ~= "announcement" then
        warn("[ACRN Creator] Ignored unsupported command")
        return
    end

    if typeof(payload.sentAt) ~= "number" or math.abs(os.time() - math.floor(payload.sentAt / 1000)) > MAX_AGE_SECONDS then
        warn("[ACRN Creator] Ignored stale command")
        return
    end

    if typeof(payload.text) ~= "string" or #payload.text < 1 or #payload.text > 180 then
        warn("[ACRN Creator] Invalid announcement text")
        return
    end

    local commandId = tostring(payload.sentAt) .. ":" .. payload.text
    if seenCommands[commandId] then return end
    seenCommands[commandId] = true

    announcementEvent:FireAllClients(payload.text)
    print("[ACRN Creator] Broadcast announcement: " .. payload.text)
end

local ok, connectionOrError = pcall(function()
    return MessagingService:SubscribeAsync(TOPIC, handleMessage)
end)

if ok then
    print("[ACRN Creator] Listening on topic: " .. TOPIC)
else
    warn("[ACRN Creator] Failed to subscribe: " .. tostring(connectionOrError))
end
