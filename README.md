# Tank Base Defender (Tank Battlecade)

An arcade-grade top-down 2D canvas tank battle game featuring dynamic barrel ballistics, a 30-tier progressive weapon system, destructible environments, 25 campaign operations, responsive touch controls, and an accompanying Roblox vehicle physics guide.

---

## Key Features

- **Dynamic Barrel Ballistics & Muzzle Physics**:
  - **Muzzle Extension Slider (-15 to +60)**:
    - **Closest Muzzle Position (-15)**: Retracted mortar configuration firing the **broadest spread cone** (2.5× spread multiplier) and rapid heat dissipation.
    - **Neutral Position (0)**: Balanced standard tactical profile (1.0× multiplier).
    - **Extended Sniper Muzzle (+60)**: Pin-point laser accuracy (0.05× tightest alignment), up to **1.55× muzzle velocity**, and **1.5× kinetic impact damage**.
  - Smooth visual turret recoil, physical barrel length changes, and solid-obstacle muzzle clipping prevention.

- **30-Tier Weapon Evolution**:
  - Scaled caliber thickness, custom bullet colors, and projectile count progression (from single rounds up to an 8-bullet salvo).
  - Kinetic damage scaling, custom muzzle colors, and armor leveling.

- **25 Campaign Operations & Procedural Destructible Bricks**:
  - Diverse combat sectors from Training Grounds to God Mode Void Arena.
  - Four obstacle brick materials with individual durability and particle effects:
    - **Standard Clay**: Brittle red clay (4 HP).
    - **Reinforced Concrete**: Industrial grade defensive blocks (6 HP).
    - **Solid Steel**: Heavy armor plating (8 HP).
    - **Bunker Plating**: Deep-level core fortifications (12 HP).

- **Tactical Combat Aids**:
  - **Auto-Fire Toggle**: Hands-free sustained rapid-fire bombardment.
  - **Range Finder Auto-Lock**: Automatically tracks the closest hostile tank and adjusts turret angle and muzzle distance.
  - **Tactical Minimap**: Displays player, enemy fleet, and base structures with radar sweep.

- **Dual-Mode Platform**:
  - **Play Mode**: Full-screen canvas game with keyboard/mouse and responsive mobile touch joysticks.
  - **Roblox Guide**: Production-ready Luau scripts for building tank chassis physics and client-side mouse-aimed turrets in Roblox Studio.

---

## Controls

### Desktop Controls

| Action | Control |
|---|---|
| **Drive Tank** | `W`, `A`, `S`, `D` or Arrow Keys |
| **Aim Turret** | Mouse cursor / Sight crosshair |
| **Fire Main Cannon** | Left Mouse Button or `Spacebar` |
| **Adjust Muzzle Distance** | Tactical Range Slider (bottom right) |
| **Toggle Auto-Fire** | Auto Fire button (bottom right) |
| **Toggle Auto-Lock** | Auto Lock button (bottom right) |

### Mobile & Touch Controls

- **Left Floating Joystick**: Analog vehicle steering & throttle.
- **Right Floating Joystick**: 360° turret aiming and auto-tap firing.
- Responsive iOS and Android safe-area insets with compact HUD layout.

---

## Barrel Physics & Spread Mechanics

| Muzzle Extension (`ext`) | Configuration | Spread Multiplier | Velocity Multiplier | Damage Multiplier |
|---|---|---|---|---|
| **-15** (Closest) | Retracted / Wide Scatter | **2.50× (Broadest)** | 0.86× | 1.00× |
| **-7.5** | Compact Short Barrel | **1.75×** | 0.93× | 1.00× |
| **0** (Default) | Standard Field Barrel | **1.00×** | 1.00× | 1.00× |
| **+30** | Extended Marksman | **0.53×** | 1.28× | 1.25× |
| **+60** (Furthest) | Long-Range Sniper | **0.05× (Narrowest)** | **1.55×** | **1.50×** |

---

## Project Structure

```text
├── index.html                  # HTML entry point with synchronized metadata
├── metadata.json               # Applet capabilities and metadata
├── package.json                # Project dependencies and npm scripts
├── tsconfig.json               # TypeScript compiler configuration
├── vite.config.ts              # Vite + Tailwind CSS build pipeline
└── src/
    ├── App.tsx                 # Top navigation (Play / Roblox Guide)
    ├── main.tsx                # React entry point
    ├── index.css               # Global Tailwind CSS styles
    ├── components/
    │   ├── GameCanvas.tsx      # Main game loop, canvas lifecycle, HUD, ballistics
    │   └── RobloxGuide.tsx     # Roblox Luau script guide for vehicle & turret mechanics
    └── game/
        ├── config.ts           # Tank stats, tier tables, bullet specs, brick definitions
        ├── events.ts           # Lightweight pub/sub event bus
        ├── physics.ts          # Tank-tank collision, obstacle collisions, point checks
        ├── renderer.ts         # Canvas 2D rendering pipeline (tanks, treads, smoke, bullets)
        ├── touchLayout.ts      # Mobile touch joystick positioning & safe-area metrics
        ├── tours.ts            # Campaign operational tour configurations (1-25)
        ├── types.ts            # Core TypeScript interfaces for entities, bullets, obstacles
        └── layouts/
            ├── TourConfig.ts   # Layout configuration interface
            ├── generator.ts    # Procedural brick placement utilities
            ├── index.ts        # Level layout registry
            └── tours/          # Handcrafted ASCII level layouts (tour1.ts - tour20.ts)
```

---

## Getting Started

### Development

```bash
npm install
npm run dev
```

The game will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
```

### Type Checking & Linting

```bash
npm run lint
```

---

## Acknowledgments

Designed and built with [Google AI Studio](https://aistudio.google.com/).
