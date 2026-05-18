import { useEffect, useRef, useState } from "react";
import {
  GameConfig,
  getTankStats,
  getBulletColorAndRadius,
  getBulletCount,
  BRICK_TYPES,
} from "../game/config";
import { LEVEL_LAYOUTS, getProceduralBrick } from "../game/layouts/index";
import { GameEvent, gameEvents } from "../game/events";
import {
  checkPointCollisionExtended,
  checkWallCollisionExtended,
  resolveTankTankCollision,
  resolveTankObstacleCollisions,
} from "../game/physics";
import {
  Bullet,
  Entity,
  Obstacle,
  Particle,
  Powerup,
  PowerupType,
  Spawner,
  Tank,
} from "../game/types";
import { drawGame } from "../game/renderer";
import { getMinimapMetrics, getTouchLayout } from "../game/touchLayout";
import {
  Lock,
  Unlock,
  Play,
  Award,
  Terminal,
  Flame,
  ShieldAlert,
  RotateCcw,
  Crosshair,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";

import { Tour, TOURS, getBrickDescription, parseBrickSize } from "../game/tours";
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCampaign, setShowCampaign] = useState(true);
  const [selectedTourId, setSelectedTourId] = useState(1);
  const [unlockedTours, setUnlockedTours] = useState<number[]>(() => {
    const saved = localStorage.getItem("tank_unlocked_tours");
    return saved ? JSON.parse(saved) : [1];
  });
  const [tourVictory, setTourVictory] = useState(false);

  const [currentLevel, setCurrentLevel] = useState(1);
  const [playerHp, setPlayerHp] = useState(GameConfig.player.startHp);
  const [playerWeaponLevel, setPlayerWeaponLevel] = useState<number>(() => {
    const saved = localStorage.getItem("tank_player_weapon_level");
    return saved ? Math.max(10, parseInt(saved)) : 10;
  });

  useEffect(() => {
    localStorage.setItem("tank_player_weapon_level", playerWeaponLevel.toString());
  }, [playerWeaponLevel]);
  const [autoFire, setAutoFire] = useState(false);
  const [autoGuidance, setAutoGuidance] = useState(false);
  const muzzleSliderRef = useRef<HTMLInputElement>(null);
  const sliderPointerIdRef = useRef<number | null>(null);

  const [prefersTouch, setPrefersTouch] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(hover: none) and (pointer: coarse)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const onChange = (e: MediaQueryListEvent) => setPrefersTouch(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Sync auto-fire state to ref for the game loop
  useEffect(() => {
    gameState.current.autoFire = autoFire;
  }, [autoFire]);

  // Sync auto-distance state to ref for the game loop
  useEffect(() => {
    gameState.current.autoGuidance = autoGuidance;
  }, [autoGuidance]);

  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState<
    { name: string; score: number }[]
  >(() => {
    const saved = localStorage.getItem("tank_highscores");
    return saved ? JSON.parse(saved) : [];
  });
  const [gameOver, setGameOver] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const touchState = useRef({
    moveActive: false,
    moveStartX: 0,
    moveStartY: 0,
    moveCurrentX: 0,
    moveCurrentY: 0,
    moveTouchId: null as number | null,
    aimActive: false,
    aimStartX: 0,
    aimStartY: 0,
    aimCurrentX: 0,
    aimCurrentY: 0,
    aimTouchId: null as number | null,
  });

  const DEFAULT_WORLD_SIZE = 1250;
  const CAMERA_ZOOM = 0.75;

  const createPlayer = (x: number, y: number, tier: number = 10): Tank => {
    const stats = getTankStats(tier);
    return {
      id: -1,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: stats.radius,
      color: stats.color,
      angle: 0,
      turretAngle: 0,
      targetTurretAngle: 0,
      hp: GameConfig.player.startHp, // HP is LIVES
      maxHp: GameConfig.player.startHp,
      cooldown: 0,
      recoil: 0,
      isPlayer: true,
      damageMultiplier: 1,
      speedMultiplier: 1,
      fireRateMultiplier: 1,
      weaponLevel: tier, // STARTING TIER
      weaponSizeLevel: 10,
      weaponSpeedLevel: 10,
      weaponColorLevel: 10,
      invisibleTimer: 180,
    };
  };

  const gameState = useRef({
    player: createPlayer(DEFAULT_WORLD_SIZE / 2, DEFAULT_WORLD_SIZE / 2, playerWeaponLevel),
    enemies: [] as Tank[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    obstacles: [] as Obstacle[],
    keys: {} as Record<string, boolean>,
    mouse: { x: 10000, y: 10000, isDown: false },
    screenMouseX: undefined as number | undefined,
    screenMouseY: undefined as number | undefined,
    score: 0,
    gameOver: false,
    isPaused: false,
    lastEnemySpawn: 50,
    width: 800,
    height: 600,
    worldWidth: DEFAULT_WORLD_SIZE,
    worldHeight: DEFAULT_WORLD_SIZE,
    camera: { x: 10000, y: 10000 },
    frameCount: 0,
    level: 1,
    enemiesToSpawn: 20,
    enemiesKilledInLevel: 0,
    powerups: [] as Powerup[],
    spawners: [] as Spawner[],
    autoFire: false,
    autoGuidance: false,
    muzzleLength: 250,
    isSliderActive: false,
    mouseActiveOnCanvas: false,
  });

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
        gameState.current.width = width;
        gameState.current.height = height;
      }
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    updateSize();

    return () => observer.disconnect();
  }, []);

  const spawnObstacles = (
    w: number,
    h: number,
    spawnClearRadius: number = 200,
    level: number = 1,
  ) => {
    // Read dimensions from the TOURS campaign config matching this level index
    const currentTour = TOURS.find((t) => t.id === level) || TOURS[0];
    const { w: bw, h: bh } = parseBrickSize(currentTour.brickSize);
    
    const obs: Obstacle[] = [];
    const occupied = new Uint8Array(w * h);

    const isAreaVacant = (
      ox: number,
      oy: number,
      width: number,
      height: number,
    ): boolean => {
      const xStart = Math.max(0, Math.floor(ox));
      const yStart = Math.max(0, Math.floor(oy));
      const xEnd = Math.min(w - 1, Math.floor(ox + width - 1));
      const yEnd = Math.min(h - 1, Math.floor(oy + height - 1));

      for (let y = yStart; y <= yEnd; y++) {
        const rowOffset = y * w;
        for (let x = xStart; x <= xEnd; x++) {
          if (occupied[rowOffset + x]) {
            return false;
          }
        }
      }
      return true;
    };

    const reserveArea = (
      ox: number,
      oy: number,
      width: number,
      height: number,
    ) => {
      const xStart = Math.max(0, Math.floor(ox));
      const yStart = Math.max(0, Math.floor(oy));
      const xEnd = Math.min(w - 1, Math.floor(ox + width - 1));
      const yEnd = Math.min(h - 1, Math.floor(oy + height - 1));

      for (let y = yStart; y <= yEnd; y++) {
        const rowOffset = y * w;
        for (let x = xStart; x <= xEnd; x++) {
          occupied[rowOffset + x] = 1;
        }
      }
    };

    // Clear zone around player start
    const centerX = w / 2;
    const centerY = h / 2;

    const acx = centerX;
    const acy = centerY;

    const drawIronSegment = (
      xStart: number,
      yStart: number,
      xEnd: number,
      yEnd: number,
    ) => {
      const dist = Math.hypot(xEnd - xStart, yEnd - yStart);
      const stepSize = Math.max(bw, bh);
      const steps = Math.max(1, Math.round(dist / stepSize));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = xStart + (xEnd - xStart) * t;
        const py = yStart + (yEnd - yStart) * t;

        // Align to the specific brick grid of the current tour
        const gridX = Math.round((px - acx) / bw) * bw + acx;
        const gridY = Math.round((py - acy) / bh) * bh + acy;

        // Verify distance from center to avoid trapping player
        const distToCenter = Math.hypot(gridX + bw / 2 - acx, gridY + bh / 2 - acy);
        if (distToCenter < spawnClearRadius + 40) continue;

        // Check vacancy and place
        if (isAreaVacant(gridX, gridY, bw, bh)) {
          reserveArea(gridX, gridY, bw, bh);
          obs.push({
            x: gridX,
            y: gridY,
            width: bw,
            height: bh,
            type: "iron",
            color: "#475569",
            hp: 4,
            maxHp: 4,
          });
        }
      }
    };

    const drawIronU = (cx: number, cy: number, size: number = 192) => {
      const half = size / 2;
      // Left stem
      drawIronSegment(cx - half, cy - half, cx - half, cy + half);
      // Bottom bar
      drawIronSegment(cx - half, cy + half, cx + half, cy + half);
      // Right stem
      drawIronSegment(cx + half, cy + half, cx + half, cy - half);
    };

    const drawIronG = (cx: number, cy: number, size: number = 192) => {
      const half = size / 2;
      // Top bar
      drawIronSegment(cx - half, cy - half, cx + half, cy - half);
      // Left stem
      drawIronSegment(cx - half, cy - half, cx - half, cy + half);
      // Bottom bar
      drawIronSegment(cx - half, cy + half, cx + half, cy + half);
      // Right upward stem
      drawIronSegment(cx + half, cy + half, cx + half, cy + bh);
      // Middle inward bar
      drawIronSegment(cx + half, cy + bh, cx + bw, cy + bh);
    };

    const drawIronH = (cx: number, cy: number, size: number = 192) => {
      const half = size / 2;
      // Left vertical stem
      drawIronSegment(cx - half, cy - half, cx - half, cy + half);
      // Right vertical stem
      drawIronSegment(cx + half, cy - half, cx + half, cy + half);
      // Central bridge
      drawIronSegment(cx - half, cy, cx + half, cy);
    };

    const drawIronCross = (cx: number, cy: number, size: number = 192) => {
      const half = size / 2;
      // Horiz line
      drawIronSegment(cx - half, cy, cx + half, cy);
      // Vert line
      drawIronSegment(cx, cy - half, cx, cy + half);
    };

    // Read dimensions from the TOURS campaign config matching this level index
    const layoutStr = LEVEL_LAYOUTS[level];
    if (layoutStr) {
      const rows = layoutStr
        .trim()
        .replace(/\r/g, "")
        .split("\n")
        .filter((r) => r.trim().length > 0);
      
      const targetCellSize = 80;
      const clusterX = Math.max(1, Math.floor(targetCellSize / bw));
      const clusterY = Math.max(1, Math.floor(targetCellSize / bh));

      const cellW = bw * clusterX;
      const cellH = bh * clusterY;

      const layoutWidth = rows[0].length * cellW;
      const layoutHeight = rows.length * cellH;

      const startX = acx - Math.floor((layoutWidth / 2) / bw) * bw;
      const startY = acy - Math.floor((layoutHeight / 2) / bh) * bh;

      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const char = rows[r][c];
          if (char === " " || char === ".") continue;

          const ox = startX + c * cellW;
          const oy = startY + r * cellH;

          const distToCenter = Math.hypot(
            ox + cellW / 2 - acx,
            oy + cellH / 2 - acy,
          );
          if (distToCenter < spawnClearRadius) continue;

          if (char === "#" || char === "C" || char === "W") {
            for (let wy = 0; wy < clusterY; wy++) {
              for (let wx = 0; wx < clusterX; wx++) {
                const partX = ox + wx * bw;
                const partY = oy + wy * bh;

                if (isAreaVacant(partX, partY, bw, bh)) {
                  reserveArea(partX, partY, bw, bh);
                  
                  let brickInfo;
                  if (char === "#") {
                    brickInfo = BRICK_TYPES.IRON;
                  } else if (char === "C") {
                    brickInfo = BRICK_TYPES.CONCRETE;
                  } else {
                    brickInfo = BRICK_TYPES.WALL;
                  }

                  const bColor = brickInfo.colors[Math.floor(Math.random() * brickInfo.colors.length)];

                  obs.push({
                    x: partX,
                    y: partY,
                    width: bw,
                    height: bh,
                    type: brickInfo.type as any,
                    color: bColor,
                    hp: brickInfo.hp,
                    maxHp: brickInfo.hp,
                  });
                }
              }
            }
          }
        }
      }
    } else {
      // Spawn the predictable iron shapes first so they reserve their coordinates!
      drawIronU(acx - 512, acy - 512, 192); // Northwest U
      drawIronG(acx + 512, acy + 512, 192); // Southeast G
      drawIronH(acx + 512, acy - 512, 192); // Northeast H
      drawIronCross(acx - 512, acy + 512, 192); // Southwest Cross

      // Strategic linear trenches/dividers
      drawIronSegment(acx - 800, acy - 256, acx - 224, acy - 256);
      drawIronSegment(acx + 224, acy - 256, acx + 800, acy - 256);
      drawIronSegment(acx - 800, acy + 256, acx - 224, acy + 256);
      drawIronSegment(acx + 224, acy + 256, acx + 800, acy + 256);

      // Vertical linear partitions
      drawIronSegment(acx - 256, acy - 800, acx - 256, acy - 224);
      drawIronSegment(acx + 256, acy - 800, acx + 256, acy - 224);
      drawIronSegment(acx - 256, acy + 224, acx - 256, acy + 800);
      drawIronSegment(acx + 256, acy + 224, acx + 256, acy + 800);

      const fillHalfSize = Math.max(w, h) / 2;

      const startX = acx - Math.floor(fillHalfSize / bw) * bw;
      const startY = acy - Math.floor(fillHalfSize / bh) * bh;

      for (let y = startY; y < acy + fillHalfSize; y += bh) {
        for (let x = startX; x < acx + fillHalfSize; x += bw) {
          // Distance check from the center of the block to player's spawn
          const distToCenter = Math.hypot(x + bw / 2 - acx, y + bh / 2 - acy);
          if (distToCenter < spawnClearRadius) continue;

          // Establish clear road networks (scaled road widths)
          const gridUnitsX = Math.round((x - acx) / bw);
          const gridUnitsY = Math.round((y - acy) / bh);
          
          // Original was every 192px (6 bricks of 32px), road was 64px (2 bricks)
          // We'll keep the "roughly 6 units repeat, 2 units road" logic
          const isRoadX = Math.abs(gridUnitsX) % 6 < 2;
          const isRoadY = Math.abs(gridUnitsY) % 6 < 2;
          
          if (isRoadX || isRoadY) {
            continue; // Keep highways clear
          }

          // Fill remaining spaces with bricks/concrete
          if (isAreaVacant(x, y, bw, bh)) {
            let blockType: "wall" | "concrete" = "wall";
            let color = "";
            let hp = 1;

            if (level > 10) {
              // Procedural Generation for High-Tier Tours - Structured & Dense
              const brickData = getProceduralBrick({
                x, y, acx, acy, bw, bh, level, 
                concreteRatio: currentTour.concreteRatio
              });
              
              if (!brickData) continue;

              color = brickData.color;
              hp = brickData.hp;
              blockType = brickData.type as any;
            } else {
              if (distToCenter < 350) {
                let brickInfo = Math.random() < 0.25 ? BRICK_TYPES.CONCRETE : BRICK_TYPES.WALL;
                color = brickInfo.colors[Math.floor(Math.random() * brickInfo.colors.length)];
                hp = brickInfo.hp;
                blockType = brickInfo.type as any;
              } else {
                const isNorth = y < acy;
                let brickInfo = isNorth ? BRICK_TYPES.WALL : BRICK_TYPES.CONCRETE;
                color = brickInfo.colors[Math.floor(Math.random() * brickInfo.colors.length)];
                hp = brickInfo.hp;
                blockType = brickInfo.type as any;
              }
            }

            reserveArea(x, y, bw, bh);
            obs.push({
              x,
              y,
              width: bw,
              height: bh,
              type: blockType,
              color,
              hp,
              maxHp: hp,
            });
          }
        }
      }
    }

    return { obs, spawners: [] };
  };

  const removeObstaclesNearTank = (
    state: any,
    tx: number,
    ty: number,
    radius: number,
  ) => {
    const buffer = 15; // Extra padding
    const checkRadius = radius + buffer;
    state.obstacles = state.obstacles.filter((obs: any) => {
      const closestX = Math.max(obs.x, Math.min(tx, obs.x + obs.width));
      const closestY = Math.max(obs.y, Math.min(ty, obs.y + obs.height));
      const dist = Math.hypot(tx - closestX, ty - closestY);
      return dist >= checkRadius;
    });
  };

  const spawnSingleEnemy = (state: typeof gameState.current, tour: Tour) => {
    if (state.enemiesToSpawn <= 0) return;

    const createEnemy = (
      tier: number,
      behavior: "random" | "stalker" = "stalker",
    ) => {
      let spawnX = 0,
        spawnY = 0;
      let dist = 0;
      let tries = 0;
      // make sure they don't spawn too close to player
      while (dist < 500 && tries < 20) {
        spawnX = Math.random() * (state.worldWidth - 150) + 75;
        spawnY = Math.random() * (state.worldHeight - 150) + 75;
        dist = Math.hypot(spawnX - state.player.x, spawnY - state.player.y);
        tries++;
      }
  
      const eStats = getTankStats(tier);
      state.enemies.push({
        id: Math.floor(Math.random() * 1000000),
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        radius: eStats.radius,
        color: eStats.color,
        angle: 0,
        turretAngle: 0,
        targetTurretAngle: 0,
        hp: 1,
        maxHp: 1,
        cooldown: eStats.cooldown,
        recoil: 0,
        isPlayer: false,
        moveAngle: Math.random() * Math.PI * 2,
        moveTimer: 60 + Math.random() * 60,
        weaponLevel: tier,
        behavior,
      });

      removeObstaclesNearTank(state, spawnX, spawnY, eStats.radius);
    };

    const hp = Math.max(
      1,
      Math.floor(Math.random() * (tour.maxEnemyHp - tour.minEnemyHp + 1)) +
        tour.minEnemyHp,
    );
    const behavior = Math.random() > 0.65 ? "random" : "stalker";
    
    // Check if we should spawn boss (last one)
    if (state.enemiesToSpawn === 1 && tour.hasBoss && tour.bossHp) {
      createEnemy(tour.bossHp, "stalker");
    } else {
      createEnemy(hp, behavior);
    }

    state.enemiesToSpawn--;
  };

  const spawnInitialEnemies = (state: typeof gameState.current, tour: Tour) => {
    // Spawn exactly 10 initially as requested, or the full tour limit if it's smaller
    const initialCount = Math.min(10, state.enemiesToSpawn);
    for (let i = 0; i < initialCount; i++) {
      spawnSingleEnemy(state, tour);
    }
  };

  const startGame = (tourId: number) => {
    const tour = TOURS.find((t) => t.id === tourId) || TOURS[0];

    const { w: bw, h: bh } = parseBrickSize(tour.brickSize);

    let w = DEFAULT_WORLD_SIZE;
    let h = DEFAULT_WORLD_SIZE;
    
    const scale = tour.worldScale || 1.1; // slight padding by default

    const layoutStr = LEVEL_LAYOUTS[tour.id];
    if (layoutStr) {
      const rows = layoutStr
        .trim()
        .replace(/\r/g, "")
        .split("\n")
        .filter((r) => r.trim().length > 0);
      const targetCellSize = 80;
      const clusterX = Math.max(1, Math.floor(targetCellSize / bw));
      const clusterY = Math.max(1, Math.floor(targetCellSize / bh));
      const layoutW = rows[0].length * bw * clusterX;
      const layoutH = rows.length * bh * clusterY;
      
      // Use exact layout dimensions to define the field size, and apply the scale for margins
      w = layoutW * scale;
      h = layoutH * scale;
    } else {
      w *= scale;
      h *= scale;
    }

    // Standardize the battlecade arena to a consistent uniform square across all campaign tours
    // Eliminates any perceptual or physical speed discrepancy caused by varying level/map dimensions
    const battlecadeDim = Math.max(2500, Math.max(w, h));
    w = battlecadeDim;
    h = battlecadeDim;

    const spawnX = w / 2;
    const spawnY = h / 2;

    // Clear radius and obstacles
    const { obs } = spawnObstacles(w, h, tour.clearRadius, tour.id);

    gameState.current = {
      player: createPlayer(spawnX, spawnY, playerWeaponLevel),
      enemies: [],
      bullets: [],
      particles: [],
      obstacles: obs,
      keys: {},
      mouse: { x: spawnX, y: spawnY, isDown: false },
      score: 0,
      gameOver: false,
      isPaused: false,
      lastEnemySpawn: 30, // Shorter delay for faster action
      width: gameState.current.width,
      height: gameState.current.height,
      worldWidth: w,
      worldHeight: h,
      camera: { x: spawnX, y: spawnY },
      frameCount: 0,
      level: tour.id,
      enemiesToSpawn: tour.enemiesToSpawn + (tour.hasBoss ? 1 : 0),
      enemiesKilledInLevel: 0,
      powerups: [],
      spawners: [],
      autoFire: gameState.current.autoFire,
    };

    removeObstaclesNearTank(
      gameState.current,
      spawnX,
      spawnY,
      gameState.current.player.radius,
    );

    spawnInitialEnemies(gameState.current, tour);

    setIsPlaying(true);
    setCurrentLevel(tour.id);
    setSelectedTourId(tour.id);
    setPlayerHp(GameConfig.player.startHp);
    setPlayerWeaponLevel((prev) => prev || 10);
    setScore(0);
    setGameOver(false);
    setTourVictory(false);
    setShowCampaign(false);
  };

  const updateHighScores = (finalScore: number) => {
    const name =
      prompt(
        "Game Over! Enter name:",
        "Player " + Math.floor(Math.random() * 100),
      ) || "Anonymous";
    const finalName = name.slice(0, 10);
    const newScores = [...highScores, { name: finalName, score: finalScore }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    setHighScores(newScores);
    localStorage.setItem("tank_highscores", JSON.stringify(newScores));
  };

  const showVictoryScreen = () => {
    setIsPlaying(false);
    setTourVictory(true);

    const nextTourId = currentLevel + 1;
    if (nextTourId <= TOURS.length) {
      setUnlockedTours((prev) => {
        if (!prev.includes(nextTourId)) {
          const updated = [...prev, nextTourId];
          localStorage.setItem("tank_unlocked_tours", JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  };

  const showUpgrades = () => {
    showVictoryScreen();
  };

  const nextLevel = () => {
    showVictoryScreen();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    // --- Observer Pattern / Event System ---
    const onEnemyDied = ({ enemy, state }: { enemy: Tank; state: any }) => {
      state.score += 10;
      state.enemiesKilledInLevel++;
      if (state.enemiesToSpawn <= 0 && state.enemies.length <= 1) {
        setTimeout(showUpgrades, 1000);
      }
    };
    const onObstacleDestroyed = ({
      obj,
      state,
    }: {
      obj: Obstacle;
      state: any;
    }) => {
      state.score += 50;
    };

    gameEvents.on(GameEvent.ENEMY_DIED, onEnemyDied);
    gameEvents.on(GameEvent.OBSTACLE_DESTROYED, onObstacleDestroyed);

    const handleKeyDown = (e: KeyboardEvent) => {
      gameState.current.keys[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      gameState.current.keys[e.key.toLowerCase()] = false;
    };
    const handleMouseMove = (e: MouseEvent) => {
      gameState.current.isKeyboardAiming = false;
      gameState.current.mouseActiveOnCanvas = true;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      gameState.current.screenMouseX = (e.clientX - rect.left) * scaleX;
      gameState.current.screenMouseY = (e.clientY - rect.top) * scaleY;
    };
    const handleMouseDown = () => {
      gameState.current.mouse.isDown = true;
      gameState.current.mouseActiveOnCanvas = true;
    };
    const handleMouseUp = () => {
      gameState.current.mouse.isDown = false;
      gameState.current.isSliderActive = false;
    };
    const handleMouseLeave = () => {
      gameState.current.mouseActiveOnCanvas = false;
    };
    const handleMouseEnter = () => {
      gameState.current.mouseActiveOnCanvas = true;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("mouseenter", handleMouseEnter);
    window.addEventListener("mouseup", handleMouseUp); // Window level to catch up events outside

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      setPrefersTouch(true);

      const rect = canvas.getBoundingClientRect();
      if (!rect) return;

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const layout = getTouchLayout(canvas.width, canvas.height, {
        prefersTouch: true,
        moveActive: touchState.current.moveActive,
        aimActive: touchState.current.aimActive,
      });

      const { moveCenter, aimCenter, hitRadius } = layout;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const tx = (touch.clientX - rect.left) * scaleX;
        const ty = (touch.clientY - rect.top) * scaleY;

        const distLeft = Math.hypot(tx - moveCenter.x, ty - moveCenter.y);
        const distRight = Math.hypot(tx - aimCenter.x, ty - aimCenter.y);

        if (distLeft < hitRadius) {
          if (!touchState.current.moveActive) {
            touchState.current.moveActive = true;
            touchState.current.moveTouchId = touch.identifier;
            touchState.current.moveStartX = rect.left + moveCenter.x / scaleX;
            touchState.current.moveStartY = rect.top + moveCenter.y / scaleY;
            touchState.current.moveCurrentX = touch.clientX;
            touchState.current.moveCurrentY = touch.clientY;
          }
        } else if (distRight < hitRadius) {
          if (!touchState.current.aimActive) {
            touchState.current.aimActive = true;
            touchState.current.aimTouchId = touch.identifier;
            touchState.current.aimStartX = rect.left + aimCenter.x / scaleX;
            touchState.current.aimStartY = rect.top + aimCenter.y / scaleY;
            touchState.current.aimCurrentX = touch.clientX;
            touchState.current.aimCurrentY = touch.clientY;
            
            // Break auto-guidance lock on manual touch aim
            if (gameState.current.autoGuidance) {
               setAutoGuidance(false);
            }
          }
        } else {
          gameState.current.screenMouseX = tx;
          gameState.current.screenMouseY = ty;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (!rect) return;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];

        if (
          touchState.current.moveActive &&
          touch.identifier === touchState.current.moveTouchId
        ) {
          touchState.current.moveCurrentX = touch.clientX;
          touchState.current.moveCurrentY = touch.clientY;
        } else if (
          touchState.current.aimActive &&
          touch.identifier === touchState.current.aimTouchId
        ) {
          touchState.current.aimCurrentX = touch.clientX;
          touchState.current.aimCurrentY = touch.clientY;

          const tx = (touch.clientX - rect.left) * scaleX;
          const ty = (touch.clientY - rect.top) * scaleY;
          gameState.current.screenMouseX = tx;
          gameState.current.screenMouseY = ty;
        } else if (touch.identifier !== touchState.current.moveTouchId && touch.identifier !== touchState.current.aimTouchId) {
          const tx = (touch.clientX - rect.left) * scaleX;
          const ty = (touch.clientY - rect.top) * scaleY;
          gameState.current.screenMouseX = tx;
          gameState.current.screenMouseY = ty;
        }
      }
    };

    const releaseTouch = (touch: Touch) => {
      if (
        touchState.current.moveActive &&
        touch.identifier === touchState.current.moveTouchId
      ) {
        touchState.current.moveActive = false;
        touchState.current.moveTouchId = null;
      } else if (
        touchState.current.aimActive &&
        touch.identifier === touchState.current.aimTouchId
      ) {
        touchState.current.aimActive = false;
        touchState.current.aimTouchId = null;
        gameState.current.mouse.isDown = false;
      } else {
        gameState.current.mouse.isDown = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        releaseTouch(e.changedTouches[i]);
      }
    };

    const handleTouchCancel = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        releaseTouch(e.changedTouches[i]);
      }
    };

    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchmove", handleTouchMove);
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchCancel);

    const spawnExplosion = (
      x: number,
      y: number,
      color: string,
      amount: number,
      shape: "circle" | "square" = "circle",
    ) => {
      // Performance guard - Cap active particle count to maintain steady frame rates
      if (gameState.current.particles.length > 250) {
        gameState.current.particles.splice(
          0,
          gameState.current.particles.length - 200,
        );
      }
      for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        gameState.current.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 0,
          color,
          life: 30,
          maxLife: 30,
          size: Math.random() * 4 + 2,
          shape,
        });
      }
    };

    const update = () => {
      const state = gameState.current;
      if (!isPlaying || state.gameOver) return;

      state.frameCount++;

      // Player Movement
      let dx = 0,
        dy = 0;
      if (state.keys["w"]) dy -= 1;
      if (state.keys["s"]) dy += 1;
      if (state.keys["a"]) dx -= 1;
      if (state.keys["d"]) dx += 1;

      // Touch movement override
      if (touchState.current.moveActive) {
        const touchLayout = getTouchLayout(state.width, state.height, {
          prefersTouch,
          moveActive: touchState.current.moveActive,
          aimActive: touchState.current.aimActive,
        });
        const tdx =
          touchState.current.moveCurrentX - touchState.current.moveStartX;
        const tdy =
          touchState.current.moveCurrentY - touchState.current.moveStartY;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (dist > 5) {
          const range = touchLayout.maxDeflection;
          const intensity = Math.min(1, dist / range);
          dx = (tdx / dist) * intensity;
          dy = (tdy / dist) * intensity;
        }
      } else {
        if (dx !== 0 && dy !== 0) {
          const length = Math.sqrt(dx * dx + dy * dy);
          dx /= length;
          dy /= length;
        }
      }

      // Move sight with arrow keys (Orbital rotation for infinite 360-degree aiming precision)
      let orbitDir = 0;
      let radiusDir = 0;
      if (state.keys["arrowleft"]) orbitDir -= 1;
      if (state.keys["arrowright"]) orbitDir += 1;
      if (state.keys["arrowup"]) {
        radiusDir += 1; // push sight further out
      }
      if (state.keys["arrowdown"]) {
        radiusDir -= 1; // pull sight closer
      }

      if (orbitDir !== 0 || radiusDir !== 0) {
        state.isKeyboardAiming = true;
        
        if (state.autoGuidance) {
          setAutoGuidance(false);
        }
        
        const currentAngle = Math.atan2(state.mouse.y - state.player.y, state.mouse.x - state.player.x);
        let currentRadius = Math.hypot(state.mouse.x - state.player.x, state.mouse.y - state.player.y);
        
        // Left/Right smoothly rotates the angle (infinite directions)
        // Inverse relationship: further sight = slower angular rotation for precision
        const angularSpeed = 0.07 * (100 / Math.max(60, currentRadius));
        const newAngle = currentAngle + orbitDir * angularSpeed;
        
        // Up/Down smoothly adjusts the distance of the sight
        currentRadius = Math.max(15, Math.min(600, currentRadius + radiusDir * 20));
        
        state.mouse.x = state.player.x + Math.cos(newAngle) * currentRadius;
        state.mouse.y = state.player.y + Math.sin(newAngle) * currentRadius;
      }

      // Synchronize HTML Muzzle range slider
      if (muzzleSliderRef.current) {
        if (!touchState.current.aimActive && !touchState.current.moveActive && !state.isSliderActive && !state.autoGuidance) {
          // Desktop/Keyboard sight distance adapts slider visually
          const currentRadius = Math.hypot(state.mouse.x - state.player.x, state.mouse.y - state.player.y);
          state.muzzleLength = currentRadius;
          muzzleSliderRef.current.value = String(Math.round(currentRadius));
        } else {
          // Touch controls or active slider reading sight distance directly from slider
          state.muzzleLength = Number(muzzleSliderRef.current.value);
        }
      }

      const isTouchActive = touchState.current.moveActive || touchState.current.aimActive;
      let targetTurretAngle = state.player.turretAngle;

      if (touchState.current.aimActive) {
        const adx = touchState.current.aimCurrentX - touchState.current.aimStartX;
        const ady = touchState.current.aimCurrentY - touchState.current.aimStartY;
        const dist = Math.hypot(adx, ady);
        if (dist > 5) {
          targetTurretAngle = Math.atan2(ady, adx);
          const len = state.muzzleLength || 250;
          state.mouse.x = state.player.x + Math.cos(targetTurretAngle) * len;
          state.mouse.y = state.player.y + Math.sin(targetTurretAngle) * len;
        }
      } else if (!isTouchActive && !state.isKeyboardAiming && state.screenMouseX !== undefined && state.screenMouseY !== undefined) {
        const dxMouse = state.camera.x + (state.screenMouseX - state.width / 2) / CAMERA_ZOOM - state.player.x;
        const dyMouse = state.camera.y + (state.screenMouseY - state.height / 2) / CAMERA_ZOOM - state.player.y;
        const angle = Math.atan2(dyMouse, dxMouse);

        if (state.isSliderActive || state.autoGuidance) {
          const len = state.muzzleLength || 250;
          state.mouse.x = state.player.x + Math.cos(angle) * len;
          state.mouse.y = state.player.y + Math.sin(angle) * len;
        } else if (state.mouseActiveOnCanvas) {
          state.mouse.x = state.camera.x + (state.screenMouseX - state.width / 2) / CAMERA_ZOOM;
          state.mouse.y = state.camera.y + (state.screenMouseY - state.height / 2) / CAMERA_ZOOM;
        }
      }

      // Auto-Targeting / Guidance
      let autoTargetAngle: number | null = null;
      let targetLen = state.muzzleLength || 250;
      
      if (state.autoGuidance && state.enemies.length > 0) {
        let closestEnemy = null;
        let minDistance = Infinity;
        for (const enemy of state.enemies) {
          const dist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
          if (dist < minDistance) {
            minDistance = dist;
            closestEnemy = enemy;
          }
        }
        
        if (closestEnemy && minDistance < 1200) {
          autoTargetAngle = Math.atan2(closestEnemy.y - state.player.y, closestEnemy.x - state.player.x);
          targetLen = Math.max(15, Math.min(600, minDistance));
          targetTurretAngle = autoTargetAngle; // Overwrite manual touch joystick angle
          
          state.mouse.x = state.player.x + Math.cos(autoTargetAngle) * targetLen;
          state.mouse.y = state.player.y + Math.sin(autoTargetAngle) * targetLen;
          state.muzzleLength = targetLen;
          
          if (muzzleSliderRef.current) {
            muzzleSliderRef.current.value = String(Math.round(targetLen));
          }
        }
      }

      // Turret & Aiming Logic
      let mouseDist = Math.hypot(
        state.mouse.x - state.player.x,
        state.mouse.y - state.player.y,
      );

      // 1:1 mapping for intuitive visual movement
      // Bind the sight to the barrel tip, but allow it to extend into the distance
      const sightOffset = 25; // How far the crosshair hovers past the barrel tip
      const baseBarrelLength = (state.player.radius || 25) * 2 - 12; // Dynamic tip matching tank size scaling
      
      let targetExtension = (mouseDist - sightOffset) - baseBarrelLength;
      
      // Clamp extension physically so only the close movement affects accuracy
      targetExtension = Math.max(-15, Math.min(60, targetExtension));

      // Smoothly interpolate to the target output to prevent abrupt visual snaps
      state.player.barrelExtension = (state.player.barrelExtension || 0) + (targetExtension - (state.player.barrelExtension || 0)) * 0.18;

      const isMoving = dx !== 0 || dy !== 0;

      if (!touchState.current.aimActive) {
        // Aim unconditionally at the custom sight when on desktop/pointer mode
        targetTurretAngle = Math.atan2(
          state.mouse.y - state.player.y,
          state.mouse.x - state.player.x,
        );
      }

      // Smooth turret rotation with differentiated joystick sensitivity for weapon moving
      let angleDiff = targetTurretAngle - state.player.turretAngle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      // Heavy turning penalty for long barrels; agile rotation for short barrels
      const extRatio = ((state.player.barrelExtension || 0) + 15) / 75; // 0 (short) to 1 (long)
      const turningMultiplier = 1.2 - extRatio * 0.8; // e.g. 1.2x at shortest, 0.4x at longest

      const lerpSpeed = (touchState.current.aimActive ? 0.15 : 0.2) * turningMultiplier;
      state.player.turretAngle += angleDiff * lerpSpeed;

      // Update Radius based on Tier (Level)
      const playerTier = Math.max(1, Math.floor(state.player.weaponLevel || 1));
      const stats = getTankStats(playerTier);
      state.player.radius = stats.radius;
      state.player.color = stats.color;

      const targetSpeed = stats.speed * (state.player.speedMultiplier || 1);
      
      // Smooth tank momentum with responsive tread traction
      state.player.vx = (state.player.vx || 0) * 0.72 + dx * targetSpeed * 0.28;
      state.player.vy = (state.player.vy || 0) * 0.72 + dy * targetSpeed * 0.28;
      
      // Clean stop threshold when input released
      if (Math.abs(state.player.vx) < 0.05 && dx === 0) state.player.vx = 0;
      if (Math.abs(state.player.vy) < 0.05 && dy === 0) state.player.vy = 0;

      const prevX = state.player.x;
      const prevY = state.player.y;

      state.player.x += state.player.vx;
      state.player.y += state.player.vy;

      // Obstacle collision & smooth 45-degree corner sliding for player
      const nearObstacles = state.obstacles.filter(
        (o) =>
          Math.abs(o.x + o.width / 2 - state.player.x) < state.player.radius + 100 &&
          Math.abs(o.y + o.height / 2 - state.player.y) < state.player.radius + 100,
      );

      resolveTankObstacleCollisions(
        state.player,
        nearObstacles,
        ["wall", "concrete", "iron"],
        3
      );

      // Always translate the sight with the tank during movement to eliminate relative draft/movement offset
      state.mouse.x += (state.player.x - prevX);
      state.mouse.y += (state.player.y - prevY);

      // Wrap/Clamp bounds
      state.player.x = Math.max(
        state.player.radius,
        Math.min(state.worldWidth - state.player.radius, state.player.x),
      );
      state.player.y = Math.max(
        state.player.radius,
        Math.min(state.worldHeight - state.player.radius, state.player.y),
      );

      // Update camera (smooth)
      state.camera.x += (state.player.x - state.camera.x) * 0.15;
      state.camera.y += (state.player.y - state.camera.y) * 0.15;

      // Clamp camera within map boundaries so it never shows too much out-of-bounds area
      const halfW = state.width / 2 / CAMERA_ZOOM;
      const halfH = state.height / 2 / CAMERA_ZOOM;

      if (state.worldWidth > halfW * 2) {
        state.camera.x = Math.max(
          halfW,
          Math.min(state.worldWidth - halfW, state.camera.x),
        );
      } else {
        state.camera.x = state.worldWidth / 2;
      }

      if (state.worldHeight > halfH * 2) {
        state.camera.y = Math.max(
          halfH,
          Math.min(state.worldHeight - halfH, state.camera.y),
        );
      } else {
        state.camera.y = state.worldHeight / 2;
      }

      // Player angles
      if (Math.hypot(state.player.vx || 0, state.player.vy || 0) > 0.1) {
        state.player.angle = Math.atan2(state.player.vy, state.player.vx);
      }

      // Weapon decay logic removed

      // Firing triggers
      const isTapFiring =
        touchState.current.aimActive &&
        !state.autoFire &&
        state.player.cooldown <= 0;
      const isAutoFiring = state.autoFire && !state.gameOver;
      const isMouseFiring = state.mouse.isDown || state.keys[" "];

      const shouldFire = isMouseFiring || isAutoFiring || isTapFiring;

      if (shouldFire && state.player.cooldown <= 0) {
        const angle = state.player.turretAngle;
        const currentTier = Math.max(1, Math.floor(state.player.weaponLevel || 1));
        const stats = getTankStats(currentTier);

        const ext = state.player.barrelExtension || 0;

        // Physical barrel dynamic modifiers (ext ranges from -15 to 60):
        // 1. Muzzle Velocity / Speed multiplier: up to 1.55x faster speed when fully extended
        const speedMultiplier = 1 + (ext / 60) * 0.55; 
        
        // 2. Kinetic Impact Damage: positive extension deals up to 1.5x damage on sniper shells
        const damageMultiplier = 1 + Math.max(0, ext / 60) * 0.5;

        // 3. Bullet Caliber Thickness: short barrels fire heavy chunkier modules, long barrels fire sleek narrow kinetic darts
        const sizeMultiplier = 1 - (ext / 60) * 0.35;

        // 4. Spread Accuracy: closest muzzle position (-15) fires the broadest spread, extended sniper barrel (+60) fires pin-point narrow
        const spreadMultiplier = ext >= 0 ? (1 - (ext / 60) * 0.95) : (1 + Math.abs(ext / 15) * 1.5);

        // 5. Reload Cooldown: short compact barrel dissipates heat faster allowing quick spam, long sniper barrel takes longer to load
        const cooldownMultiplier = 1 + (ext / 60) * 0.35;

        let bulletRadius = stats.bulletRadius * sizeMultiplier;
        let bulletDamage = stats.bulletDamage * damageMultiplier;
        const bulletSpeed = stats.bulletSpeed * speedMultiplier;

        // Bullet color based on weapon tier
        const bColors = getBulletColorAndRadius(currentTier);
        let bulletColor = bColors.color;

        // Adjust visual recoil based on muzzle velocity/power output
        state.player.recoil = Math.max(2, 12 - (currentTier - 1) * 1.5) * speedMultiplier;

        const shoot = (
          ang: number,
          bulletIdx: number = 0,
          totalBullets: number = 1,
        ) => {
          const scale = state.player.radius / 20;
          let spawnDist = (50 * scale) + ext - (state.player.recoil || 0);

          let startX =
            state.player.x + Math.cos(ang) * spawnDist;
          let startY =
            state.player.y + Math.sin(ang) * spawnDist;

          // Prevent spawning bullet past/inside close solid obstacles
          for (const obs of nearObstacles) {
            if (obs.type === "wall" || obs.type === "concrete" || obs.type === "iron") {
              const closestX = Math.max(obs.x, Math.min(startX, obs.x + obs.width));
              const closestY = Math.max(obs.y, Math.min(startY, obs.y + obs.height));
              const distToObs = Math.hypot(startX - closestX, startY - closestY);
              if (distToObs < 6) {
                // If muzzle is clipping into / past the obstacle, pull spawn point back to the tank surface
                spawnDist = state.player.radius + 2;
                startX = state.player.x + Math.cos(ang) * spawnDist;
                startY = state.player.y + Math.sin(ang) * spawnDist;
                break;
              }
            }
          }

          if (totalBullets > 1) {
            const pX = -Math.sin(angle);
            const pY = Math.cos(angle);
            const offsetPercent = bulletIdx - (totalBullets - 1) / 2;
            const lateralOffset =
              (offsetPercent * (state.player.radius * 0.65)) /
              (totalBullets - 1);
            startX += pX * lateralOffset;
            startY += pY * lateralOffset;
          }
          state.bullets.push({
            x: startX,
            y: startY,
            originX: startX,
            originY: startY,
            vx: Math.cos(ang) * bulletSpeed,
            vy: Math.sin(ang) * bulletSpeed,
            radius: totalBullets > 1 ? bulletRadius * 0.82 : bulletRadius,
            color: bulletColor,
            life: stats.bulletLife,
            ownerIsPlayer: true,
            ownerId: state.player.id,
            bounces: 0,
            damage: bulletDamage * (state.player.damageMultiplier || 1),
            weaponLevel: currentTier,
          });
        };

        // Bullet count based on tier
        const bulletsCount = getBulletCount(currentTier);
        if (bulletsCount === 1) {
          // Micro random deviation scales with spreadMultiplier: broadest at closest muzzle, laser straight at max extension
          const deviation = (Math.random() - 0.5) * 0.08 * spreadMultiplier;
          shoot(angle + deviation, 0, 1);
        } else {
          const adjustedSpread = 0.12 * spreadMultiplier;
          const startAngle = angle - (adjustedSpread * (bulletsCount - 1)) / 2;
          for (let i = 0; i < bulletsCount; i++) {
            shoot(startAngle + i * adjustedSpread, i, bulletsCount);
          }
        }

        state.player.cooldown =
          stats.cooldown * (state.player.fireRateMultiplier || 1) * cooldownMultiplier;
      }

      // Dynamic enemy spawning to maintain density
      if (state.enemiesToSpawn > 0 && state.enemies.length < 10) {
        state.lastEnemySpawn--;
        if (state.lastEnemySpawn <= 0) {
          const tour = TOURS.find((t) => t.id === state.level) || TOURS[0];
          spawnSingleEnemy(state, tour);
          state.lastEnemySpawn = 60 + Math.random() * 60; // Randomize next spawn timing for organic feel
        }
      }

      // Player cooldown & recoil decay
      if (state.player.cooldown > 0) state.player.cooldown--;
      if (state.player.recoil > 0) state.player.recoil *= 0.8;
      if (state.player.invisibleTimer && state.player.invisibleTimer > 0) {
        state.player.invisibleTimer--;
      }

      // Enemy logic
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];

        if (enemy.invisibleTimer && enemy.invisibleTimer > 0) {
          enemy.invisibleTimer--;
        }

        // Target player for turret rotation
        const target = state.player;
        const distToPlayer = Math.hypot(
          state.player.x - enemy.x,
          state.player.y - enemy.y,
        );
        const isPlayerInvisible =
          target.invisibleTimer && target.invisibleTimer > 0;

        let targetAngle: number;
        let speedMult = 1.0;

        if (enemy.behavior === "random" || isPlayerInvisible) {
          // Move randomly
          enemy.moveTimer = (enemy.moveTimer || 0) - 1;
          if (enemy.moveTimer <= 0) {
            enemy.moveAngle = Math.random() * Math.PI * 2;
            enemy.moveTimer = 100 + Math.random() * 200;
          }
          targetAngle = enemy.moveAngle;
        } else {
          const directAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
          // Tactical combat spacing: maintain optimal firing position rather than blindly colliding
          if (distToPlayer < 140) {
            // Reposition / back off to retain clear firing line
            targetAngle = directAngle + Math.PI + ((enemy.id || 0) % 2 === 0 ? 0.35 : -0.35);
            speedMult = 0.75;
          } else if (distToPlayer < 320) {
            // Mid-range skirmish: strafe perpendicular to take shots
            targetAngle = directAngle + ((enemy.id || 0) % 2 === 0 ? 0.7 : -0.7);
            speedMult = 0.85;
          } else {
            // Advance towards player
            targetAngle = directAngle;
            speedMult = 1.0;
          }
        }

        const turretTargetAngle =
          isPlayerInvisible ||
          (enemy.behavior === "random" && distToPlayer > 400)
            ? (enemy.moveAngle || enemy.angle || 0) +
              Math.sin(state.frameCount * 0.05) * 0.5 // Scan while wandering
            : Math.atan2(target.y - enemy.y, target.x - enemy.x); // Aim at player if near or stalker

        // Smooth enemy turret rotation
        let turretAngleDiff = turretTargetAngle - enemy.turretAngle;
        while (turretAngleDiff < -Math.PI) turretAngleDiff += Math.PI * 2;
        while (turretAngleDiff > Math.PI) turretAngleDiff -= Math.PI * 2;
        enemy.turretAngle += turretAngleDiff * 0.08;

        // Decay enemy recoil
        if (enemy.recoil > 0) enemy.recoil *= 0.8;

        // Moving towards target logic
        const eTier = Math.max(1, Math.floor(enemy.weaponLevel || 1));
        const eStats = getTankStats(eTier);
        enemy.radius = eStats.radius; // Scale based on Tier
        enemy.color = eStats.color;
        const moveSpeed = eStats.speed * 0.65 * speedMult; // Tactical, manageable enemy speed

        const evx = Math.cos(targetAngle) * moveSpeed;
        const evy = Math.sin(targetAngle) * moveSpeed;

        enemy.x += evx;
        enemy.y += evy;
        enemy.vx = evx;
        enemy.vy = evy;

        // Smooth obstacle collision & 45-degree corner sliding for enemies
        const nearObstacles = state.obstacles.filter(
          (o) =>
            Math.abs(o.x + o.width / 2 - enemy.x) < enemy.radius + 100 &&
            Math.abs(o.y + o.height / 2 - enemy.y) < enemy.radius + 100,
        );

        resolveTankObstacleCollisions(
          enemy,
          nearObstacles,
          ["wall", "concrete", "iron"],
          2
        );

        enemy.angle = targetAngle;

        // Hard Boundary Clamp for enemies
        enemy.x = Math.max(
          enemy.radius,
          Math.min(state.worldWidth - enemy.radius, enemy.x),
        );
        enemy.y = Math.max(
          enemy.radius,
          Math.min(state.worldHeight - enemy.radius, enemy.y),
        );

        // Enemy fire
        if (enemy.cooldown > 0) enemy.cooldown--;

        const halfW = state.width / 2 / 0.75 + 120;
        const halfH = state.height / 2 / 0.75 + 120;
        const isVisibleOnScreen =
          enemy.x > state.camera.x - halfW &&
          enemy.x < state.camera.x + halfW &&
          enemy.y > state.camera.y - halfH &&
          enemy.y < state.camera.y + halfH;
        const shouldEnemyFire =
          !isPlayerInvisible && isVisibleOnScreen;

        let willHitFriend = false;
        if (shouldEnemyFire) {
          // Check if any other enemy is in the line of fire
          const aimLine = {
            dx: Math.cos(enemy.turretAngle),
            dy: Math.sin(enemy.turretAngle),
          };
          for (const friend of state.enemies) {
            if (friend.id === enemy.id) continue;
            const toFriend = { dx: friend.x - enemy.x, dy: friend.y - enemy.y };
            const dist = Math.hypot(toFriend.dx, toFriend.dy);
            if (dist < distToPlayer) {
              const dot = toFriend.dx * aimLine.dx + toFriend.dy * aimLine.dy;
              if (dot > 0) {
                // Determine orthogonal distance
                const projX = aimLine.dx * dot;
                const projY = aimLine.dy * dot;
                const orthDist = Math.hypot(
                  toFriend.dx - projX,
                  toFriend.dy - projY,
                );
                if (orthDist < friend.radius + 15) {
                  willHitFriend = true;
                  break;
                }
              }
            }
          }
        }

        if (enemy.cooldown <= 0 && shouldEnemyFire && !willHitFriend) {
          const eTier = Math.max(1, Math.floor(enemy.weaponLevel || 1));
          const stats = getTankStats(eTier);
          enemy.recoil = 8;

          const eBstats = getBulletColorAndRadius(eTier);
          const enemyTurretAng = enemy.turretAngle;

          const shootEnemy = (
            ang: number,
            bulletIdx: number = 0,
            totalBullets: number = 1,
          ) => {
            const spread = (Math.random() - 0.5) * 0.15;
            let startX = enemy.x + Math.cos(ang) * (enemy.radius + 5);
            let startY = enemy.y + Math.sin(ang) * (enemy.radius + 5);
            if (totalBullets > 1) {
              const pX = -Math.sin(enemyTurretAng);
              const pY = Math.cos(enemyTurretAng);
              const offsetPercent = bulletIdx - (totalBullets - 1) / 2;
              const lateralOffset =
                (offsetPercent * (enemy.radius * 0.65)) / (totalBullets - 1);
              startX += pX * lateralOffset;
              startY += pY * lateralOffset;
            }
            state.bullets.push({
              x: startX,
              y: startY,
              originX: startX,
              originY: startY,
              vx: Math.cos(ang + spread) * stats.bulletSpeed,
              vy: Math.sin(ang + spread) * stats.bulletSpeed,
              radius: totalBullets > 1 ? eBstats.radius * 0.82 : eBstats.radius,
              color: eBstats.color,
              life: stats.bulletLife,
              ownerIsPlayer: false,
              ownerId: enemy.id,
              bounces: 0,
              damage: stats.bulletDamage,
              weaponLevel: eTier,
            });
          };

          const bulletsCount = getBulletCount(eTier);
          if (bulletsCount === 1) {
            shootEnemy(enemyTurretAng, 0, 1);
          } else {
            const spread = 0.15;
            const startAngle =
              enemyTurretAng - (spread * (bulletsCount - 1)) / 2;
            for (let i = 0; i < bulletsCount; i++) {
              shootEnemy(startAngle + i * spread, i, bulletsCount);
            }
          }

          enemy.cooldown = Math.max(35, Math.floor(stats.cooldown * 1.5 + 15));
        }
      }

      // Player vs Enemies
      for (const enemy of state.enemies) {
        resolveTankTankCollision(
          state.player,
          enemy,
          state.worldWidth,
          state.worldHeight,
        );
      }
      // Enemies vs Enemies
      for (let i = 0; i < state.enemies.length; i++) {
        for (let j = i + 1; j < state.enemies.length; j++) {
          resolveTankTankCollision(
            state.enemies[i],
            state.enemies[j],
            state.worldWidth,
            state.worldHeight,
          );
        }
      }

      // Bullets
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life--;

        let hit = false;

        // Bullet bounds collision - Bounce or Die
        if (b.x < 0 || b.x > state.worldWidth) {
          if (b.bounces > 0) {
            b.vx *= -1;
            b.bounces--;
            b.x = b.x < 0 ? 0 : state.worldWidth;
          } else {
            hit = true;
          }
        }
        if (b.y < 0 || b.y > state.worldHeight) {
          if (b.bounces > 0) {
            b.vy *= -1;
            b.bounces--;
            b.y = b.y < 0 ? 0 : state.worldHeight;
          } else {
            hit = true;
          }
        }

        // Bullet vs Wall collision
        if (!hit) {
          const nearObstacles = state.obstacles.filter(
            (o) => Math.abs(o.x - b.x) < 80 && Math.abs(o.y - b.y) < 80,
          );
          for (let j = nearObstacles.length - 1; j >= 0; j--) {
            const obs = nearObstacles[j];
            if (
              obs.type !== "wall" &&
              obs.type !== "concrete" &&
              obs.type !== "iron"
            )
              continue;

            // cheap Continuous Collision Detection (CCD) using a stretched sphere looking backwards
            const bSpeed = Math.hypot(b.vx, b.vy);
            const ccdRadius = b.radius * 0.6 + bSpeed / 3.5;
            const checkX = b.x - b.vx / 3;
            const checkY = b.y - b.vy / 3;

            const closestX = Math.max(
              obs.x,
              Math.min(checkX, obs.x + obs.width),
            );
            const closestY = Math.max(
              obs.y,
              Math.min(checkY, obs.y + obs.height),
            );
            const distanceX = checkX - closestX;
            const distanceY = checkY - closestY;
            const distSq = distanceX * distanceX + distanceY * distanceY;

            if (distSq < ccdRadius * ccdRadius) {
              // Determine bounce side
              const dxFromCenter = Math.abs(b.x - (obs.x + obs.width / 2));
              const dyFromCenter = Math.abs(b.y - (obs.y + obs.height / 2));

              // Pre-check: Don't collide if near muzzle
              const muzzleDist = Math.hypot(b.x - b.originX, b.y - b.originY);
              const owner = b.ownerIsPlayer ? state.player : state.enemies.find(e => e.id === b.ownerId);
              let isInside = false;
              if (owner) {
                const closestX = Math.max(obs.x, Math.min(owner.x, obs.x + obs.width));
                const closestY = Math.max(obs.y, Math.min(owner.y, obs.y + obs.height));
                if (Math.hypot(owner.x - closestX, owner.y - closestY) < owner.radius) {
                  isInside = true;
                }
              }

              if (muzzleDist < 20 || isInside) {
                j = -1; // Exit this inner loop entirely
                continue;
              }

              if (b.bounces > 0) {
                if (dxFromCenter / obs.width > dyFromCenter / obs.height) {
                  b.vx *= -1;
                } else {
                  b.vy *= -1;
                }
                b.bounces--;
                b.x += b.vx; // Nudge out
                b.y += b.vy;
              } else {
                hit = true;
              }

              // Bricks logic
              if (obs.hp !== undefined && b.damage) {
                const bWL = b.weaponLevel || 1;

                if (obs.type === "iron" && bWL < 8) {
                  // Low level tank cannot damage iron blocks, sparks visually!
                  spawnExplosion(b.x, b.y, "#cbd5e1", 4, "square");
                  hit = true;
                } else {
                  if (bWL >= 18) {
                    obs.hp = 0; // Tier 18+: Demolition Rounds instantly vaporize bricks
                  } else {
                    const damageBoost = bWL >= 7 ? 2.0 : 1.0; // Tier 7+: Double Damage to bricks
                    obs.hp -= b.damage * damageBoost;
                  }

                  if (obs.hp <= 0) {
                    const idx = state.obstacles.indexOf(obs);
                    if (idx !== -1) {
                      state.obstacles.splice(idx, 1);
                    }

                    // Spawn more particles for better visual feedback
                    spawnExplosion(
                      obs.x + obs.width / 2,
                      obs.y + obs.height / 2,
                      obs.color,
                      8 + Math.floor(b.damage * 2),
                      "square",
                    );

                    // Piercing rules
                    if (bWL >= 15) {
                      hit = false; // Tier 15: Piercing Rounds Tier 2 (always pierce bricks)
                    } else if (
                      bWL >= 10 &&
                      obs.type !== "concrete" &&
                      obs.type !== "iron"
                    ) {
                      if (b.bounces >= -1) {
                        // use bounces logic to allow up to 2 piercings
                        b.bounces--;
                        hit = false;
                      } else {
                        hit = true;
                      }
                    } else {
                      hit = true; // No piercing
                    }

                    if (b.ownerIsPlayer) {
                      // Higher damage weapons clear larger paths
                      const hitX = obs.x + obs.width / 2;
                      const hitY = obs.y + obs.height / 2;
                      // Widened blast clearance radius (minimum of 80px guarantees adjacent horizontal & vertical bricks are affected)
                      const clearRadius =
                        Math.max(85, state.player.radius * (1.3 + b.damage * 0.22));

                      for (let k = state.obstacles.length - 1; k >= 0; k--) {
                        const otherObs = state.obstacles[k];
                        if (
                          otherObs.type !== "wall" &&
                          otherObs.type !== "concrete" &&
                          otherObs.type !== "iron"
                        )
                          continue;
                        if (otherObs.type === "iron" && bWL < 8) continue; // Iron blocks only damaged by level >= 8

                        const oCenterX = otherObs.x + otherObs.width / 2;
                        const oCenterY = otherObs.y + otherObs.height / 2;
                        const dist = Math.hypot(
                          oCenterX - hitX,
                          oCenterY - hitY,
                        );

                        if (dist < clearRadius) {
                          // Enhanced collateral explosive splash damage (1.5x)
                          otherObs.hp = (otherObs.hp || 1) - b.damage * 1.5;
                          if (otherObs.hp <= 0) {
                            state.obstacles.splice(k, 1);
                            spawnExplosion(
                              oCenterX,
                              oCenterY,
                              otherObs.color,
                              4 + Math.floor(b.damage * 1.5),
                              "square",
                            );
                          } else {
                            spawnExplosion(
                              oCenterX,
                              oCenterY,
                              "#ffffff",
                              2,
                              "square",
                            );
                          }
                        }
                      }
                    }
                  } else {
                    // Small hit effect when brick doesn't outright break yet
                    spawnExplosion(b.x, b.y, obs.color, 2, "square");
                  }
                }
              }

              break;
            }
          }
        }

        // Hit spawners
        if (b.ownerIsPlayer && !hit) {
          for (let j = state.spawners.length - 1; j >= 0; j--) {
            const s = state.spawners[j];
            if (!s.active) continue;
            if (Math.hypot(s.x - b.x, s.y - b.y) < s.radius + b.radius * 0.6) {
              s.hp -= b.damage;
              hit = true;
              spawnExplosion(b.x, b.y, "#fbbf24", 15);
              if (s.hp <= 0) {
                s.active = false;
                gameEvents.emit(GameEvent.OBSTACLE_DESTROYED, {
                  obj: s,
                  state,
                });
                setTimeout(() => setScore(state.score), 0);
                spawnExplosion(s.x, s.y, "#ef4444", 60);
              }
              break;
            }
          }
        }

        // Hit player
        if (!b.ownerIsPlayer && !hit) {
          const isPlayerInvisible =
            state.player.invisibleTimer && state.player.invisibleTimer > 0;
          if (
            !isPlayerInvisible &&
            Math.hypot(state.player.x - b.x, state.player.y - b.y) <
              state.player.radius + b.radius * 0.5
          ) {
            hit = true;
            spawnExplosion(b.x, b.y, "#3b82f6", 15);

            // Decrease Weapon Level first
            state.player.weaponLevel = (state.player.weaponLevel || 1) - b.damage;
            
            if (state.player.weaponLevel < 1) {
              // Lose a Life
              state.player.hp -= 1;
              setPlayerHp(state.player.hp);
              
              if (state.player.hp <= 0) {
                state.gameOver = true;
                setGameOver(true);
                setIsPlaying(false);
                setPlayerWeaponLevel(10);
                spawnExplosion(state.player.x, state.player.y, "#3b82f6", 50);
                updateHighScores(state.score);
              } else {
                // Respawn
                state.player.x = state.worldWidth / 2;
                state.player.y = state.worldHeight / 2;
                state.player.weaponLevel = 10; // Restore to base tier on respawn
                setPlayerWeaponLevel(10);
                const pStats = getTankStats(10);
                state.player.radius = pStats.radius;
                state.player.color = pStats.color;
                state.player.invisibleTimer = 180;
                removeObstaclesNearTank(
                  state,
                  state.player.x,
                  state.player.y,
                  state.player.radius,
                );
              }
            } else {
              // Just tier down
              const newTier = Math.floor(state.player.weaponLevel);
              setPlayerWeaponLevel(newTier);
              const pStats = getTankStats(newTier);
              state.player.radius = pStats.radius;
              state.player.color = pStats.color;
            }
          }
        }

        // Hit enemies
        if (!hit) {
          for (let j = state.enemies.length - 1; j >= 0; j--) {
            const e = state.enemies[j];
            if (b.ownerId === e.id) continue;

            const isEnemyInvisible = e.invisibleTimer && e.invisibleTimer > 0;

            if (
              !isEnemyInvisible &&
              Math.hypot(e.x - b.x, e.y - b.y) < e.radius + b.radius * 0.5
            ) {
              // Decrease Enemy Tier
              e.weaponLevel = (e.weaponLevel || 1) - b.damage;
              
              const bWL = b.weaponLevel || 1;
              if (bWL >= 15 && b.bounces >= -2) {
                hit = false;
                b.bounces--;
              } else {
                hit = true;
              }

              spawnExplosion(
                b.x,
                b.y,
                b.ownerIsPlayer ? "#fbbf24" : "#f87171",
                15,
              );

              if (e.weaponLevel < 1) {
                if (b.ownerIsPlayer) {
                  gameEvents.emit(GameEvent.ENEMY_DIED, { enemy: e, state });
                  setTimeout(() => setScore(state.score), 0);
                } else {
                  state.enemiesKilledInLevel++;
                  if (state.enemiesToSpawn <= 0 && state.enemies.length <= 1) {
                    setTimeout(showUpgrades, 1000);
                  }
                }

                spawnExplosion(e.x, e.y, "#ef4444", 30);
                state.enemies.splice(j, 1);

                if (Math.random() < 0.25) {
                  const type =
                    Math.random() > 0.5
                      ? PowerupType.HEAL
                      : PowerupType.STRONG_WEAPON;
                  state.powerups.push({
                    x: e.x,
                    y: e.y,
                    vx: 0,
                    vy: 0,
                    radius: 15,
                    type,
                    life: 600,
                    color: type === PowerupType.HEAL ? "#22c55e" : "#f97316",
                  });
                }
              } else {
                // Update visuals for current tier
                const eStats = getTankStats(e.weaponLevel);
                e.radius = eStats.radius;
                e.color = eStats.color;
              }
              break;
            }
          }
        }

        // Bullet vs Bullet collision
        for (let j = state.bullets.length - 1; j >= 0; j--) {
          if (i === j) continue;
          const b2 = state.bullets[j];
          const dist = Math.hypot(b.x - b2.x, b.y - b2.y);
          const radiusSum = b.radius + b2.radius;

          const dot = b.vx * b2.vx + b.vy * b2.vy;
          const bSpeed = Math.hypot(b.vx, b.vy);
          const b2Speed = Math.hypot(b2.vx, b2.vy);
          
          let isMovingOpposite = false;
          if (bSpeed > 0.01 && b2Speed > 0.01) {
            const cosTheta = dot / (bSpeed * b2Speed);
            if (cosTheta < -0.4) {
              isMovingOpposite = true;
            }
          }
          
          // Use a larger radius for head-on collisions to prevent pass-through
          const collisionRadius = isMovingOpposite ? radiusSum * 1.5 : radiusSum;

          if (dist < collisionRadius) {
            hit = true;
            const midX = (b.x + b2.x) / 2;
            const midY = (b.y + b2.y) / 2;
            spawnExplosion(
              midX,
              midY,
              b.ownerIsPlayer ? "#fbbf24" : "#f87171",
              3,
              "circle",
            );
            state.bullets.splice(j, 1);
            if (j < i) i--; // Adjust index if we removed a preceding element
            break;
          }
        }

        if (b.life <= 0 || hit) {
          state.bullets.splice(i, 1);
        }
      }

      // Powerups
      for (let i = state.powerups.length - 1; i >= 0; i--) {
        const p = state.powerups[i];

        let powerupCollected = false;

        // Collision with player
        if (
          Math.hypot(p.x - state.player.x, p.y - state.player.y) <
          p.radius + state.player.radius
        ) {
          if (p.type === PowerupType.STRONG_WEAPON) {
            // Increase weapon level
            if (state.player.weaponLevel < GameConfig.maxWeaponLevel) {
              state.player.weaponLevel = Math.min(GameConfig.maxWeaponLevel, (state.player.weaponLevel || 1) + 1);
              
              setPlayerWeaponLevel(Math.floor(state.player.weaponLevel));
              const pStats = getTankStats(state.player.weaponLevel);
              state.player.radius = pStats.radius;
              state.player.color = pStats.color;
              spawnExplosion(p.x, p.y, pStats.color, 20);
            }
          } else if (p.type === PowerupType.HEAL) {
            // HP only
            state.player.hp += 1;
            state.player.maxHp = Math.max(state.player.maxHp, state.player.hp);
            setPlayerHp(state.player.hp);
            spawnExplosion(p.x, p.y, "#22c55e", 20);
          }
          
          powerupCollected = true;
        }

        // Collision with enemies
        if (!powerupCollected) {
          for (let j = 0; j < state.enemies.length; j++) {
            const e = state.enemies[j];
            if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
              if (p.type === PowerupType.STRONG_WEAPON) {
                // Increase enemy weapon level level
                e.weaponLevel = Math.min(GameConfig.maxWeaponLevel, (e.weaponLevel || 1) + 1);
                const eStats = getTankStats(e.weaponLevel);
                e.radius = eStats.radius;
                e.color = eStats.color;
                e.cooldown = eStats.cooldown;
                spawnExplosion(p.x, p.y, eStats.color, 20);
              } else if (p.type === PowerupType.HEAL) {
                // Heal enemy
                e.weaponLevel = (e.weaponLevel || 1) + 1; // Since HP is weaponLevel for enemies in this game
                const eStats = getTankStats(e.weaponLevel);
                e.radius = eStats.radius;
                e.color = eStats.color;
                e.cooldown = eStats.cooldown;
                spawnExplosion(p.x, p.y, "#22c55e", 20);
              }
              powerupCollected = true;
              break;
            }
          }
        }

        if (powerupCollected) {
          state.powerups.splice(i, 1);
        }
      }

      // Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.vx *= 0.95; // friction
        p.vy *= 0.95;
        if (p.life <= 0) {
          state.particles.splice(i, 1);
        }
      }
    };

    const draw = () => {
      drawGame(ctx, canvas, gameState.current, touchState, isPlaying, prefersTouch);
    };

    const loop = () => {
      if (!gameState.current.isPaused) {
        update();
      }
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      gameEvents.off(GameEvent.ENEMY_DIED, onEnemyDied);
      gameEvents.off(GameEvent.OBSTACLE_DESTROYED, onObstacleDestroyed);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      window.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [isPlaying, prefersTouch]);

  useEffect(() => {
    // Keep user in the campaign command center lobby on mount
    setShowCampaign(true);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-neutral-900 shadow-2xl overflow-hidden flex items-center justify-center"
    >
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="cursor-crosshair block bg-[#a8b5b2] touch-none"
      />


      {/* Stats Overlay (Left) */}
      {isPlaying && !gameOver && (
        <div className="absolute top-4 left-8 flex flex-col gap-3 z-[100] pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] items-start">
          <div className="grid grid-cols-2 gap-x-10 gap-y-1 px-1">
            {/* TOUR */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-black font-bold uppercase tracking-widest">Tour</span>
              <span className="font-mono text-sm font-black text-blue-400">{currentLevel}</span>
            </div>

            {/* UNITS */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-black font-bold uppercase tracking-widest">Units</span>
              <span className="font-mono text-sm font-black text-orange-400">
                {gameState.current.enemiesToSpawn +
                  gameState.current.enemies.length}
              </span>
            </div>

            {/* SPAWNS */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-black font-bold uppercase tracking-widest">Spawns</span>
              <span className="font-mono text-sm font-black text-red-500">{playerHp}</span>
            </div>

            {/* TANK LEVEL (WEAPON) */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-black font-bold uppercase tracking-widest">Lvl</span>
              <span className="font-mono text-sm font-black text-zinc-300">{playerWeaponLevel}</span>
            </div>
          </div>
          
          <button
            onClick={() => {
              setIsPlaying(false);
              setShowCampaign(true);
            }}
            className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-widest uppercase font-bold text-zinc-400 bg-black/40 border border-white/5 hover:border-white/20 hover:text-white rounded backdrop-blur-sm transition-all cursor-pointer"
          >
            <Terminal size={12} /> Abort to HQ
          </button>
        </div>
      )}

      {/* Points Overlay (Right) */}
      {isPlaying && !gameOver && (
        <div className="absolute top-4 right-8 flex flex-col items-end z-[100] pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
          <div className="text-[10px] text-black font-bold uppercase tracking-[0.3em] mb-0.5">
            Score
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tighter leading-none">
            {score.toLocaleString()}
          </div>
        </div>
      )}

      {/* Auto-Target tactical controls + muzzle slider */}
      {isPlaying && !gameOver && (() => {
        const compactUI = dimensions.width < 768 || prefersTouch;
        const { minimapSize, margin } = getMinimapMetrics(dimensions.width, compactUI);
        const touchStackTop = margin + minimapSize + 32; // Increased offset to push controls lower

        const controlShell = prefersTouch
          ? "absolute right-3 z-[100] pointer-events-auto flex flex-col items-end gap-3"
          : "";

        const controlStyle = prefersTouch
          ? { top: touchStackTop }
          : undefined;

        const autoFirePos = prefersTouch
          ? ""
          : "absolute bottom-[245px] right-[150px]";
        const autoDistPos = prefersTouch
          ? ""
          : "absolute bottom-[245px] right-[40px]";
        const sliderPos = prefersTouch
          ? ""
          : "absolute bottom-[215px] right-[40px] w-40";

        const toggleBtnClass = prefersTouch
          ? "min-h-[44px] min-w-[44px]"
          : "w-10 h-10";

        return (
          <div className={controlShell} style={controlStyle}>
            <div
              className={`${autoFirePos} w-[90px] pointer-events-auto flex flex-col items-center`}
            >
              <button
                id="auto-fire-toggle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setAutoFire(!autoFire);
                }}
                className="group flex flex-col items-center p-1.5 cursor-pointer active:scale-95 transition-all w-full"
                title="Toggle Auto-Weapon System"
              >
                <div
                  className={`${toggleBtnClass} rounded-lg flex items-center justify-center transition-all duration-300 ${autoFire ? "bg-orange-600/90 text-white shadow-[0_0_15px_rgba(234,88,12,0.4)]" : "bg-zinc-800/40 text-zinc-400 border border-white/5 hover:border-white/15"}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-500 ${autoFire ? "rotate-45 scale-110" : "rotate-0"}`}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="22" y1="12" x2="18" y2="12" />
                    <line x1="6" y1="12" x2="2" y2="12" />
                    <line x1="12" y1="6" x2="12" y2="2" />
                    <line x1="12" y1="22" x2="12" y2="18" />
                  </svg>
                </div>
                <span className="text-[9px] text-black font-bold uppercase mt-1 tracking-wider text-center select-none leading-tight drop-shadow-md">
                  Auto Fire
                </span>
              </button>
            </div>

            <div
              className={`${autoDistPos} w-[90px] pointer-events-auto flex flex-col items-center`}
            >
              <button
                id="auto-distance-toggle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setAutoGuidance(!autoGuidance);
                }}
                className="group flex flex-col items-center p-1.5 cursor-pointer active:scale-95 transition-all w-full"
                title="Range Finder Auto-Lock"
              >
                <div
                  className={`${toggleBtnClass} rounded-lg flex items-center justify-center transition-all duration-300 ${autoGuidance ? "bg-cyan-600/90 text-white shadow-[0_0_15px_rgba(8,145,178,0.4)]" : "bg-zinc-800/40 text-zinc-400 border border-white/5 hover:border-white/15"}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-500 ${autoGuidance ? "scale-110 rotate-90" : "rotate-0"}`}
                  >
                    <path d="M5 3H3v2" />
                    <path d="M19 3h2v2" />
                    <path d="M5 21H3v-2" />
                    <path d="M19 21h2v-2" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                  </svg>
                </div>
                <span className="text-[9px] text-black font-bold uppercase mt-1 tracking-wider text-center select-none leading-tight drop-shadow-md">
                  Auto Lock
                </span>
              </button>
            </div>

            <div
              className={`w-[90px] pointer-events-auto flex flex-col items-center ${
                !prefersTouch ? "absolute bottom-[215px] right-[40px] w-40" : ""
              }`}
            >
          <input
            ref={muzzleSliderRef}
            type="range"
            min="15"
            max="600"
            defaultValue="250"
            onPointerDown={(e) => {
              e.stopPropagation();
              sliderPointerIdRef.current = e.pointerId;
              gameState.current.isSliderActive = true;
            }}
            onPointerUp={(e) => {
              if (sliderPointerIdRef.current === e.pointerId) {
                gameState.current.isSliderActive = false;
                sliderPointerIdRef.current = null;
              }
            }}
            onPointerCancel={(e) => {
              if (sliderPointerIdRef.current === e.pointerId) {
                gameState.current.isSliderActive = false;
                sliderPointerIdRef.current = null;
              }
            }}
            onChange={(e) => {
              const val = Number(e.target.value);
              gameState.current.muzzleLength = val;
              
              // Disable autoGuidance if manually adjusting slider
              if (gameState.current.autoGuidance) {
                setAutoGuidance(false);
              }

              // Instantly update the custom crosshair sight position when slider moves
              const angle = gameState.current.player.turretAngle;
              gameState.current.mouse.x = gameState.current.player.x + Math.cos(angle) * val;
              gameState.current.mouse.y = gameState.current.player.y + Math.sin(angle) * val;
            }}
            style={{
              WebkitAppearance: "none",
              cursor: "pointer",
            }}
            className="w-full bg-zinc-800/80 border border-zinc-700 h-2.5 focus:outline-none rounded-lg outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00ff66] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-700 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#00ff66] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md shadow-lg"
            title="Muzzle Range"
          />
            </div>
          </div>
        );
      })()}

      {/* Operational Selection Command Hub */}
      {showCampaign && (
        <div className="absolute inset-0 bg-neutral-950 flex flex-col z-[200] p-6 sm:p-12 overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col gap-6 select-none">
            {/* Lobby Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-900 pb-6 gap-4">
              <div>
                <div className="flex items-center gap-2 text-blue-500 font-extrabold tracking-widest text-xs uppercase mb-1">
                  <Terminal size={14} className="animate-pulse" />
                  Tactical Operations Command Centre
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight font-sans">
                  CAMPAIGN DIVISION HQ
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                  Deploy tactical armored units to breach diverse enemy layouts
                  with unique brick geometries.
                </p>
              </div>

              {/* HQ Status Counters */}
              <div className="flex gap-4">
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 flex flex-col">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                    Tours Unlocked
                  </span>
                  <span className="font-mono text-xl font-black text-green-400">
                    {unlockedTours.length}{" "}
                    <span className="text-zinc-600 text-xs">/ {TOURS.length}</span>
                  </span>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 flex flex-col">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                    High Score
                  </span>
                  <span className="font-mono text-xl font-black text-yellow-500">
                    {highScores[0] ? highScores[0].score.toLocaleString() : "0"}
                  </span>
                </div>
              </div>
            </div>

            {/* Campaign Selection Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Tour list grid */}
              <div className="lg:col-span-2 space-y-3.5">
                <h2 className="text-xs font-black tracking-widest text-zinc-400 uppercase mb-4 flex items-center gap-2">
                  <Crosshair size={12} />
                  TACTICAL TOUR SECTOR MAP
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {TOURS.map((tour) => {
                    const isUnlocked = unlockedTours.includes(tour.id);
                    const isSelected = selectedTourId === tour.id;

                    let diffColor =
                      "bg-green-500/10 text-green-400 border-green-500/20";
                    if (tour.difficulty === "Tactical")
                      diffColor =
                        "bg-blue-500/10 text-blue-400 border-blue-500/20";
                    else if (tour.difficulty === "Heavy")
                      diffColor =
                        "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
                    else if (tour.difficulty === "Veteran")
                      diffColor =
                        "bg-orange-500/10 text-orange-400 border-orange-500/20";
                    else if (tour.difficulty === "Elite")
                      diffColor =
                        "bg-pink-500/10 text-pink-400 border-pink-500/20";
                    else if (tour.difficulty === "Extreme")
                      diffColor =
                        "bg-red-500/10 text-red-400 border-red-500/20";
                    else if (tour.difficulty === "Legendary")
                      diffColor =
                        "bg-purple-500/10 text-purple-400 border-purple-500/20";

                    return (
                      <button
                        key={tour.id}
                        disabled={!isUnlocked}
                        onClick={() => {
                          setSelectedTourId(tour.id);
                          startGame(tour.id);
                        }}
                        className={`w-full text-left rounded-xl border p-4 transition-all relative ${isSelected ? "bg-zinc-800 border-blue-500 shadow-xl shadow-blue-500/5 ring-1 ring-blue-500/20" : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40"} ${!isUnlocked ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="font-mono text-xs text-zinc-500 font-bold">
                            TOUR SECTION {String(tour.id).padStart(2, "0")}
                          </span>
                          <div className="flex gap-1.5">
                            {isUnlocked ? (
                              <span
                                className={`text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded border ${diffColor} uppercase`}
                              >
                                {tour.difficulty}
                              </span>
                            ) : (
                              <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-500 flex items-center gap-1 uppercase">
                                <Lock size={10} /> Locked
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="text-base font-extrabold text-white leading-tight mb-1 truncate">
                          {tour.name}
                        </h3>

                        <p className="text-zinc-500 text-xs line-clamp-1">
                          {tour.subtitle}
                        </p>

                        <div className="mt-3 pt-2.5 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-400 font-mono">
                          <span>
                            Brick Shape:{" "}
                            <b className="text-white">
                              {getBrickDescription(tour)}
                            </b>
                          </span>
                          <span>
                            Squad Strength:{" "}
                            <b className="text-white">
                              {tour.enemiesToSpawn}{" "}
                              {tour.hasBoss ? "+ BOSS" : ""}
                            </b>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Tour Detailed Intel Dashboard Component */}
              <div className="space-y-4">
                <h2 className="text-xs font-black tracking-widest text-zinc-400 uppercase flex items-center gap-2">
                  <ShieldAlert size={12} />
                  SQUAD OPERATIONS BRIEF
                </h2>

                {(() => {
                  const selectedTour =
                    TOURS.find((t) => t.id === selectedTourId) || TOURS[0];
                  const isUnlocked = unlockedTours.includes(selectedTour.id);

                  return (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />

                      <div>
                        <span className="font-mono text-[10px] font-extrabold text-blue-500 uppercase tracking-widest">
                          Operational Blueprint
                        </span>
                        <h3 className="text-2xl font-black text-white mt-1 leading-none tracking-tight">
                          {selectedTour.name}
                        </h3>
                        <div className="text-zinc-500 font-mono text-xs uppercase tracking-wider mt-1.5">
                          {selectedTour.subtitle}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800/80 text-zinc-300 text-xs italic">
                          "{selectedTour.tagline}"
                        </div>

                        <div className="space-y-2 font-mono text-xs pt-1">
                          <div className="flex justify-between text-zinc-500">
                            <span>Brick Shape:</span>
                            <span className="text-white font-bold">
                              {getBrickDescription(selectedTour)}
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-500">
                            <span>Physical Unit:</span>
                            <span className="text-zinc-400">
                              {selectedTour.brickSize}
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-500">
                            <span>Etalon Comparison (32x16):</span>
                            <span>
                              {selectedTour.brickSize === "32x16" ? (
                                <span className="text-green-400 font-semibold uppercase text-[10px]">
                                  Reference Shape
                                </span>
                              ) : (
                                <span className="text-yellow-500 font-semibold uppercase text-[10px]">
                                  Modified Shape
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-500">
                            <span>Composite Concrete Layout:</span>
                            <span className="text-white font-bold">
                              {(selectedTour.concreteRatio * 100).toFixed(0)}%
                              Fortified
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-500">
                            <span>Enemy Fleet Capacity:</span>
                            <span className="text-white font-bold">
                              {selectedTour.enemiesToSpawn} Tanks
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-500">
                            <span>Warlord Unit Signature:</span>
                            <span
                              className={
                                selectedTour.hasBoss
                                  ? "text-red-400 font-bold uppercase"
                                  : "text-zinc-600"
                              }
                            >
                              {selectedTour.hasBoss
                                ? "BOSS REGISTERED"
                                : "NONE DETECTED"}
                            </span>
                          </div>
                        </div>

                        {/* Tactical Intel Text */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                            Operational Cover Dossier
                          </span>
                          <p className="text-zinc-500 text-xs leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-800/50">
                            {selectedTour.intel}
                          </p>
                        </div>

                        {/* Fleets details */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                            Expected Force Signature
                          </span>
                          <p className="text-zinc-400 text-xs leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-840/50 font-mono text-red-400/90">
                            {selectedTour.squadDetails}
                          </p>
                        </div>
                      </div>

                      {isUnlocked ? (
                        <button
                          onClick={() => startGame(selectedTour.id)}
                          className="w-full mt-2 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.4)] active:scale-[0.98]"
                        >
                          <Play size={16} fill="currentColor" /> Deploy Battle
                          Tank
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full mt-2 py-4 bg-zinc-800 border border-zinc-700/50 text-zinc-500 font-black text-sm uppercase tracking-widest rounded-xl cursor-not-allowed flex items-center justify-center gap-2.5"
                        >
                          <Lock size={16} /> Operational Clearance Required
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tour Victory Overlay Splash Screen */}
      {tourVictory && (
        <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center z-[250] animate-in fade-in duration-500">
          <div className="flex flex-col items-center justify-center max-w-sm w-full border border-green-500/20 bg-zinc-900/80 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-green-500/10 border border-green-500 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.4)]">
              <CheckCircle2 className="text-green-500 w-8 h-8 mt-1 animate-bounce" />
            </div>

            <h2 className="text-2xl font-black text-green-400 uppercase tracking-widest mt-4">
              TOUR ACCOMPLISHED!
            </h2>
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-6">
              Sector {String(currentLevel).padStart(2, "0")} Breached
              Successfully
            </p>

            {/* Stats list */}
            <div className="space-y-3 w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 font-mono text-sm text-zinc-400 mb-8 self-stretch">
              <div className="flex justify-between">
                <span>Sector Number:</span>
                <span className="text-white font-bold">{currentLevel}</span>
              </div>
              <div className="flex justify-between">
                <span>Victory Score:</span>
                <span className="text-yellow-500 font-black">
                  {score.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Armor Level:</span>
                <span className="text-orange-400 font-bold">
                  {playerWeaponLevel}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {currentLevel < TOURS.length ? (
                <button
                  onClick={() => startGame(currentLevel + 1)}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white font-black text-sm uppercase tracking-widest rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_15px_rgba(34,197,94,0.3)]"
                >
                  Advance to Tour {currentLevel + 1}
                </button>
              ) : (
                <div className="border border-yellow-500/25 bg-yellow-500/10 rounded-xl p-4 text-yellow-500 font-extrabold text-xs uppercase tracking-widest flex items-center gap-2 justify-center">
                  🏆 CAMPAIGN COMPLETE: ULTIMATE VICTORY!
                </div>
              )}

              <button
                onClick={() => {
                  setTourVictory(false);
                  setShowCampaign(true);
                }}
                className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-bold text-xs uppercase tracking-widest rounded-xl cursor-pointer transition-all active:scale-[0.98]"
              >
                Return to HQ Selector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GameOver Overlays */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-20">
          <h2 className="text-4xl font-black text-red-500 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] mb-4">
            MISSION FAILED
          </h2>
          <div className="bg-zinc-900 border-2 border-zinc-800 rounded-xl p-8 max-w-sm w-full mb-8 shadow-2xl">
            <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-center border-b border-zinc-800 pb-2">
              Hall of Valor
            </h3>
            <div className="space-y-3 mb-6">
              {highScores.length > 0 ? (
                highScores.map((hs, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-sm font-mono group"
                  >
                    <span className="text-zinc-500 w-6 text-left">
                      {i + 1}.
                    </span>
                    <span className="text-zinc-100 flex-1 text-left uppercase truncate pr-4">
                      {hs.name}
                    </span>
                    <span className="text-yellow-500 font-bold">
                      {hs.score.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-zinc-700 text-xs italic py-4">
                  No records found...
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-zinc-800">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                Combat Performance
              </div>
              <div className="text-4xl font-black text-white">
                {score.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button
              onClick={() => startGame(currentLevel)}
              className="px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl shadow-[0_0_25px_rgba(220,38,38,0.45)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest cursor-pointer"
            >
              Re-deploy Unit
            </button>
            <button
              onClick={() => {
                setGameOver(false);
                setShowCampaign(false);
                setTourVictory(false);
                setShowCampaign(true);
              }}
              className="px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/40 text-zinc-300 font-extrabold text-sm rounded-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest cursor-pointer"
            >
              Command HQ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
