-- ACRN Studios Announcement UI
-- Install this as a NEW LocalScript in StarterPlayer > StarterPlayerScripts.
-- It listens for announcements broadcast by the server-side creator listener.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local event = ReplicatedStorage:WaitForChild("ACRN_Announcement")

local gui = Instance.new("ScreenGui")
gui.Name = "ACRN_AnnouncementGui"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local function showAnnouncement(message)
    local card = Instance.new("Frame")
    card.Name = "Announcement"
    card.AnchorPoint = Vector2.new(0.5, 0)
    card.Position = UDim2.new(0.5, 0, 0, -110)
    card.Size = UDim2.new(0.82, 0, 0, 76)
    card.BackgroundColor3 = Color3.fromRGB(17, 22, 30)
    card.BorderSizePixel = 0
    card.Parent = gui

    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 12)
    corner.Parent = card

    local stroke = Instance.new("UIStroke")
    stroke.Color = Color3.fromRGB(157, 224, 104)
    stroke.Thickness = 1
    stroke.Transparency = 0.2
    stroke.Parent = card

    local title = Instance.new("TextLabel")
    title.BackgroundTransparency = 1
    title.Position = UDim2.fromOffset(16, 9)
    title.Size = UDim2.new(1, -32, 0, 17)
    title.Font = Enum.Font.GothamBold
    title.Text = "ACRN STUDIOS  •  ANNOUNCEMENT"
    title.TextColor3 = Color3.fromRGB(166, 232, 112)
    title.TextSize = 11
    title.TextXAlignment = Enum.TextXAlignment.Left
    title.Parent = card

    local body = Instance.new("TextLabel")
    body.BackgroundTransparency = 1
    body.Position = UDim2.fromOffset(16, 30)
    body.Size = UDim2.new(1, -32, 0, 34)
    body.Font = Enum.Font.GothamMedium
    body.Text = message
    body.TextColor3 = Color3.fromRGB(245, 247, 250)
    body.TextSize = 14
    body.TextWrapped = true
    body.TextXAlignment = Enum.TextXAlignment.Left
    body.Parent = card

    TweenService:Create(card, TweenInfo.new(0.35, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), {
        Position = UDim2.new(0.5, 0, 0, 24)
    }):Play()

    task.delay(6, function()
        local tween = TweenService:Create(card, TweenInfo.new(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
            Position = UDim2.new(0.5, 0, 0, -110)
        })
        tween:Play()
        tween.Completed:Wait()
        card:Destroy()
    end)
end

event.OnClientEvent:Connect(showAnnouncement)
