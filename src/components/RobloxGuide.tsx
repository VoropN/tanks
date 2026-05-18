import React from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

const serverMovementCode = `-- ServerScriptService or inside the Tank Model
-- This script controls typical Roblox vehicle movement using BodyMover.
local seat = script.Parent:WaitForChild("VehicleSeat")
local base = seat.Parent:WaitForChild("Base")

-- Ensure we have physics objects
local bodyVelocity = base:FindFirstChild("BodyVelocity") or Instance.new("BodyVelocity", base)
local bodyGyro = base:FindFirstChild("BodyGyro") or Instance.new("BodyGyro", base)

bodyVelocity.MaxForce = Vector3.new(100000, 0, 100000)
bodyGyro.MaxTorque = Vector3.new(0, 100000, 0)
bodyGyro.D = 500

local speed = 40
local turnSpeed = 3

seat:GetPropertyChangedSignal("Throttle"):Connect(function()
    bodyVelocity.Velocity = seat.CFrame.LookVector * (seat.Throttle * speed)
end)

seat:GetPropertyChangedSignal("Steer"):Connect(function()
    local angle = math.rad(-seat.Steer * turnSpeed)
    bodyGyro.CFrame = bodyGyro.CFrame * CFrame.Angles(0, angle, 0)
end)

-- Ensure the body gyro aligns with the floor normally
game:GetService("RunService").Heartbeat:Connect(function()
    if seat.Steer == 0 then
        local look = seat.CFrame.LookVector
        bodyGyro.CFrame = CFrame.lookAt(base.Position, base.Position + Vector3.new(look.X, 0, look.Z))
    end
end)
`;

const clientTurretCode = `-- StarterPlayerScripts -> LocalScript
-- Points the tank turret towards the player's mouse position.

local player = game.Players.LocalPlayer
local mouse = player:GetMouse()
local runService = game:GetService("RunService")

-- Assumes the player is sitting in a VehicleSeat in a Tank model
runService.RenderStepped:Connect(function()
    local character = player.Character
    if not character then return end
    
    local humanoid = character:FindFirstChild("Humanoid")
    if not humanoid or not humanoid.SeatPart then return end
    
    local tank = humanoid.SeatPart.Parent
    local turretMotor = tank:FindFirstChild("TurretMotor", true)
    
    if turretMotor then
        local targetPos = mouse.Hit.Position
        local turretBase = turretMotor.Part0.Position
        
        -- Ignore Y axis for top-down or flat swivel
        local lookVector = Vector3.new(targetPos.X, turretBase.Y, targetPos.Z)
        
        -- Simple CFrame calculation to rotate the motor
        local cframe = CFrame.lookAt(turretBase, lookVector)
        local relative = turretMotor.Part0.CFrame:ToObjectSpace(cframe)
        local _, y, _ = relative:ToOrientation()
        
        turretMotor.C0 = CFrame.new(turretMotor.C0.Position) * CFrame.Angles(0, y, 0)
    end
end)
`;

export function RobloxGuide() {
  return (
    <div className="max-w-4xl mx-auto py-8 text-neutral-200">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">Exporting to Roblox Studio</h2>
        <p className="text-neutral-400 text-lg leading-relaxed">
          The playable game on the previous tab is built using web technologies (HTML5 Canvas and React) for the browser. 
          To build a real 3D version of this game on Roblox, you need to use <strong className="text-white">Roblox Studio</strong> and written <strong className="text-blue-400">Luau (Lua)</strong> scripts. Complete these steps to recreate the core mechanics.
        </p>
      </div>

      <div className="space-y-12">
        
        {/* Step 1 */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold">1</div>
            <h3 className="text-xl font-semibold text-white">Create the Tank Model</h3>
          </div>
          <p className="text-neutral-400 mb-4 ml-11">
            Build a tank out of basic parts using the Roblox Studio builder tools. You will need:
          </p>
          <ul className="list-disc list-inside space-y-2 text-neutral-300 ml-11">
            <li>A primary hull base <code className="bg-neutral-800 px-2 py-0.5 rounded text-red-300 text-sm">Part</code> named <strong>"Base"</strong></li>
            <li>A <code className="bg-neutral-800 px-2 py-0.5 rounded text-blue-300 text-sm">VehicleSeat</code> attached to the Base.</li>
            <li>A separate <code className="bg-neutral-800 px-2 py-0.5 rounded text-red-300 text-sm">Part</code> named <strong>"Turret"</strong>.</li>
            <li>A <code className="bg-neutral-800 px-2 py-0.5 rounded text-yellow-300 text-sm">Motor6D</code> constraint connecting "Base" to "Turret".</li>
          </ul>
        </section>

        {/* Step 2 */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold">2</div>
            <h3 className="text-xl font-semibold text-white">Tank Movement Script (Server)</h3>
          </div>
          <p className="text-neutral-400 mb-4 ml-11">
            Place this script inside the <code className="text-sm bg-neutral-800 text-neutral-300 px-1.5 rounded">VehicleSeat</code> so the tank moves via standard WASD/Mobile controls.
          </p>
          <div className="ml-11">
            <CodeBlock code={serverMovementCode} language="lua" filename="TankMovement.lua" />
          </div>
        </section>

        {/* Step 3 */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold">3</div>
            <h3 className="text-xl font-semibold text-white">Turret Aiming Script (Client)</h3>
          </div>
          <p className="text-neutral-400 mb-4 ml-11">
            Place this <code className="text-sm bg-neutral-800 text-neutral-300 px-1.5 rounded">LocalScript</code> inside <code className="text-sm bg-neutral-800 text-neutral-300 px-1.5 rounded">StarterPlayerScripts</code> to make the turret follow the mouse.
          </p>
          <div className="ml-11">
            <CodeBlock code={clientTurretCode} language="lua" filename="AimTurret.local.lua" />
          </div>
        </section>

      </div>
    </div>
  );
}

// Simple Code block component
function CodeBlock({ code, language, filename }: { code: string; language: string, filename: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#1e1e1e] rounded-lg border border-neutral-800 overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-black/20">
        <div className="flex items-center gap-2 text-neutral-400 text-sm font-mono">
          <Terminal size={14} />
          {filename}
        </div>
        <button 
          onClick={handleCopy}
          className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs bg-neutral-800 px-2 py-1 rounded"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-[#d4d4d4] leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
