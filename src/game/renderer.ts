import { Tank, Spawner, Obstacle, Bullet, Particle, Powerup, PowerupType } from './types';
import { getTouchLayout } from './touchLayout';

export const CAMERA_ZOOM = 0.75;

export const drawRoundedRect = (ctx: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, rr: number) => {
  ctx.beginPath();
  ctx.moveTo(rx + rr, ry);
  ctx.lineTo(rx + rw - rr, ry);
  ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
  ctx.lineTo(rx + rw, ry + rh - rr);
  ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
  ctx.lineTo(rx + rr, ry + rh);
  ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
  ctx.lineTo(rx, ry + rr);
  ctx.quadraticCurveTo(rx, ry, rx + rr, ry);
  ctx.closePath();
};

export const drawJoystick = (
  ctx: CanvasRenderingContext2D, 
  canvas: HTMLCanvasElement,
  sx: number, 
  sy: number, 
  cx: number, 
  cy: number, 
  color: string,
  outerRadius = 60,
  maxDeflection = 50,
) => {
  const rect = canvas.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0) return;
  
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasStartX = (sx - rect.left) * scaleX;
  const canvasStartY = (sy - rect.top) * scaleY;
  
  const canvasCurX = (cx - rect.left) * scaleX;
  const canvasCurY = (cy - rect.top) * scaleY;

  const dx = canvasCurX - canvasStartX;
  const dy = canvasCurY - canvasStartY;
  const angle = Math.atan2(dy, dx);
  
  const currentDist = Math.sqrt(dx * dx + dy * dy);
  const dist = Math.min(maxDeflection, currentDist);
  const stickRadius = outerRadius * 0.43;

  ctx.save();
  
  // Outer circle ring
  ctx.beginPath();
  ctx.arc(canvasStartX, canvasStartY, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Subtle inner guideline ring
  ctx.beginPath();
  ctx.arc(canvasStartX, canvasStartY, outerRadius * 0.42, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Stick rendering
  const stickX = canvasStartX + Math.cos(angle) * dist;
  const stickY = canvasStartY + Math.sin(angle) * dist;

  if (!Number.isFinite(stickX) || !Number.isFinite(stickY)) {
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.arc(stickX, stickY, stickRadius, 0, Math.PI * 2);
  
  const gradient = ctx.createRadialGradient(stickX, stickY, 2, stickX, stickY, stickRadius);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.2, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0.65)');
  
  ctx.fillStyle = gradient;
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  ctx.restore();
};

export const drawAimPoint = (
  ctx: CanvasRenderingContext2D, 
  canvas: HTMLCanvasElement,
  cx: number, 
  cy: number, 
  color: string
) => {
  const rect = canvas.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0) return;
  const canvasX = (cx - rect.left) * (canvas.width / rect.width);
  const canvasY = (cy - rect.top) * (canvas.height / rect.height);

  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(canvasX, canvasY, 30, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(canvasX, canvasY, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
};

export const drawTank = (ctx: CanvasRenderingContext2D, tank: Tank) => {
  ctx.save(); // MASTER SAVE
  
  const isProtected = tank.invisibleTimer && tank.invisibleTimer > 0;
  if (isProtected) {
    const pulseFactor = Math.sin(Date.now() * 0.015) * 0.15 + 0.55; // ranges from 0.4 to 0.7
    ctx.globalAlpha = pulseFactor;
    
    // Draw glowing spawn protection aura/shield ring
    ctx.save();
    ctx.strokeStyle = tank.isPlayer ? 'rgba(59, 130, 246, 0.85)' : 'rgba(239, 68, 68, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tank.x, tank.y, tank.radius * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw a faint filled energy dome inside
    ctx.fillStyle = tank.isPlayer ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.1)';
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(tank.x, tank.y);
  
  const scale = tank.radius / 20;

  // Determine level-tier theme for cosmetic details
  const wl = Math.floor(tank.weaponLevel || 1);
  let treadRidgeColor = '#3f3f46';
  let barrelColor = '#52525b';
  let muzzleColor = '#27272a';
  let domeColor = '#27272a';
  let hatchColor = '#3f3f46';

  if (wl <= 3) {
    // Cyber Slate Steel Tier (Levels 1-3 Grey)
    treadRidgeColor = '#cbd5e1'; // Silver reflective treads
    barrelColor = '#334155'; // Charcoal slate barrel
    muzzleColor = '#1e293b'; 
    domeColor = '#475569'; // Grey metal turret dome
    hatchColor = '#1e293b';
  } else if (wl <= 6) {
    // Golden Solar Force Tier (Levels 4-6 Yellow)
    treadRidgeColor = '#fef08a'; // Glowing solar gold rails
    barrelColor = '#7c2d12'; // Bronze barrel
    muzzleColor = '#451a03';
    domeColor = '#ca8a04'; // Warm yellow dome cap
    hatchColor = '#78350f';
  } else if (wl <= 9) {
    // Volcanic Plasma Tier (Levels 7-9 Red)
    treadRidgeColor = '#f43f5e'; // Glowing red core trails
    barrelColor = '#4c0519'; // Obsidian red metallic barrel
    muzzleColor = '#1c0008';
    domeColor = '#881337'; // Deep blood crimson dome
    hatchColor = '#0f172a';
  } else {
    // Scientific Quantum Matrix Tier (Levels 10+ Green)
    treadRidgeColor = '#4ade80'; // Neon bio-radioactive tracks
    barrelColor = '#115e59'; // Scientific bio-hazard green barrel
    muzzleColor = '#042f2e';
    domeColor = '#064e3b'; // Dense military jungle green dome
    hatchColor = '#14532d';
  }

  ctx.rotate(tank.angle);
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-22 * scale, -22 * scale, 44 * scale, 44 * scale);

  // Body (Hull)
  ctx.fillStyle = tank.color;
  ctx.fillRect(-20 * scale, -15 * scale, 40 * scale, 30 * scale);
  
  // Treads
  ctx.fillStyle = '#171717';
  ctx.fillRect(-24 * scale, -20 * scale, 48 * scale, 8 * scale); // Left tread
  ctx.fillRect(-24 * scale, 12 * scale, 48 * scale, 8 * scale);  // Right tread
  
  // Tread ridges
  ctx.fillStyle = treadRidgeColor;
  for(let i=-20 * scale; i<=20 * scale; i+=8 * scale) {
      if(i > 20 * scale - 2) break;
      ctx.fillRect(i, -20 * scale, 2 * scale, 8 * scale);
      ctx.fillRect(i, 12 * scale, 2 * scale, 8 * scale);
  }

  // Adding Some extra details on hull
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-16 * scale, -11 * scale, 32 * scale, 22 * scale);
  
  ctx.restore();

  // Turret & Barrel
  ctx.save();
  ctx.translate(tank.x, tank.y);
  ctx.rotate(tank.turretAngle);
  
  // Recoil effect
  const recoilOffset = tank.recoil || 0;
  const ext = tank.barrelExtension || 0;
  
  // Barrel
  ctx.fillStyle = barrelColor;
  ctx.fillRect(-recoilOffset, -4 * scale, 38 * scale + ext, 8 * scale);
  // Muzzle
  ctx.fillStyle = muzzleColor;
  ctx.fillRect(34 * scale + ext - recoilOffset, -5 * scale, 6 * scale, 10 * scale);

  // Turret Dome
  ctx.fillStyle = domeColor;
  ctx.beginPath();
  ctx.arc(0, 0, 14 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Details on turret
  ctx.strokeStyle = tank.color;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, 10 * scale, 0, Math.PI * 2);
  ctx.stroke();

  // Hatch
  ctx.fillStyle = hatchColor;
  ctx.beginPath();
  ctx.arc(-4 * scale, 0, 6 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Weapon Level Number Text
  ctx.save();
  ctx.translate(tank.x, tank.y);
  ctx.fillStyle = 'white';
  const fontSize = Math.max(10, 14 * scale);
  ctx.font = `900 ${fontSize}px "Space Grotesk", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = 3 * scale;
  ctx.strokeText(`${wl}`, 0, 0);
  ctx.fillText(`${wl}`, 0, 0);
  ctx.restore();

  ctx.restore(); // MASTER RESTORE
};

export const drawSpawner = (ctx: CanvasRenderingContext2D, s: Spawner, frameCount: number = 0) => {
  if (!s.active) return;
  ctx.save();
  ctx.translate(s.x, s.y);
  
  // Base
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-45, -45, 90, 90);
  
  // Core
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  
  // Pulsing effect
  const pulse = Math.sin(frameCount * 0.1) * 5;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 30 + pulse, 0, Math.PI * 2);
  ctx.stroke();

  // HP Bar
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-30, -55, 60, 6);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(-30, -55, 60 * (s.hp / s.maxHp), 6);
  ctx.strokeStyle = 'white';
  ctx.strokeRect(-30, -55, 60, 6);

  ctx.restore();
};

export const drawGame = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: any,
  touchState: { current: any },
  isPlaying: boolean,
  prefersTouch = false,
) => {
  ctx.save();
  // Apply Camera Transform & Zoom out
  ctx.translate(state.width / 2, state.height / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-state.camera.x, -state.camera.y);

  // Draw World Background
  ctx.fillStyle = '#a8b5b2'; 
  ctx.fillRect(0, 0, state.worldWidth, state.worldHeight);
  
  // Draw Danger Zone (area outside bounds)
  ctx.fillStyle = '#1e293b'; 
  // Above
  ctx.fillRect(-5000, -5000, state.worldWidth + 10000, 5000);
  // Below
  ctx.fillRect(-5000, state.worldHeight, state.worldWidth + 10000, 5000);
  // Left
  ctx.fillRect(-5000, 0, 5000, state.worldHeight);
  // Right
  ctx.fillRect(state.worldWidth, 0, 5000, state.worldHeight);

  // Draw World Borders
  const isMobile = state.width < 600;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
  ctx.lineWidth = isMobile ? 20 : 40;
  ctx.strokeRect(0, 0, state.worldWidth, state.worldHeight);
  
  // Outer fence line
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
  ctx.lineWidth = isMobile ? 3 : 4;
  ctx.setLineDash([20, 20]);
  ctx.strokeRect(-10, -10, state.worldWidth + 20, state.worldHeight + 20);
  ctx.setLineDash([]);

  // Draw Spawners
  state.spawners.forEach((s: Spawner) => drawSpawner(ctx, s, state.frameCount));

  // Draw Obstacles (with performance-boosting view frustum culling)
  const viewLeft = state.camera.x - (state.width / 2) / CAMERA_ZOOM - 100;
  const viewRight = state.camera.x + (state.width / 2) / CAMERA_ZOOM + 100;
  const viewTop = state.camera.y - (state.height / 2) / CAMERA_ZOOM - 100;
  const viewBottom = state.camera.y + (state.height / 2) / CAMERA_ZOOM + 100;

  state.obstacles.forEach((o: Obstacle) => {
    if (o.x + o.width < viewLeft || o.x > viewRight || o.y + o.height < viewTop || o.y > viewBottom) {
      return; // Culling
    }
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x, o.y, o.width, o.height);
    
    if (o.type === 'wall' || o.type === 'concrete') {
        // Traditional tightly packed brick look for wall, flat look with heavier bevel for concrete
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = o.type === 'concrete' ? 3 : 1;
        ctx.strokeRect(o.x, o.y, o.width, o.height);
        
        // Bevel highlight
        ctx.fillStyle = o.type === 'concrete' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)';
        ctx.fillRect(o.x, o.y, o.width, o.type === 'concrete' ? 4 : 2);
        ctx.fillRect(o.x, o.y, o.type === 'concrete' ? 4 : 2, o.height);
        
        ctx.fillStyle = o.type === 'concrete' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(o.x, o.y + o.height - (o.type === 'concrete' ? 4 : 2), o.width, o.type === 'concrete' ? 4 : 2);
        ctx.fillRect(o.x + o.width - (o.type === 'concrete' ? 4 : 2), o.y, o.type === 'concrete' ? 4 : 2, o.height);
        
        if (o.type === 'concrete' && o.maxHp && o.hp !== undefined) {
           // Show minor cracks if damaged
           if (o.hp < o.maxHp) {
              ctx.strokeStyle = 'rgba(0,0,0,0.7)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(o.x + o.width * 0.2, o.y + o.height * 0.2);
              ctx.lineTo(o.x + o.width * 0.5, o.y + o.height * 0.4);
              ctx.lineTo(o.x + o.width * 0.4, o.y + o.height * 0.7);
              if (o.hp < o.maxHp * 0.5) {
                  ctx.moveTo(o.x + o.width * 0.5, o.y + o.height * 0.4);
                  ctx.lineTo(o.x + o.width * 0.8, o.y + o.height * 0.5);
              }
              ctx.stroke();
           }
        }
    } else if (o.type === 'iron') {
        // Heavy armor iron block design
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.strokeRect(o.x, o.y, o.width, o.height);
        
        // Bevel highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(o.x + 1, o.y + 1, o.width - 2, 3);
        ctx.fillRect(o.x + 1, o.y + 1, 3, o.height - 2);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(o.x + 1, o.y + o.height - 4, o.width - 2, 3);
        ctx.fillRect(o.x + o.width - 4, o.y + 1, 3, o.height - 2);

        // Heavy internal "X" diagonal support struts
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(o.x + 4, o.y + 4);
        ctx.lineTo(o.x + o.width - 4, o.y + o.height - 4);
        ctx.moveTo(o.x + o.width - 4, o.y + 4);
        ctx.lineTo(o.x + 4, o.y + o.height - 4);
        ctx.stroke();

        // Corner Rivets/Bolts
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.5;
        const rivets = [
          { rx: o.x + 3.5, ry: o.y + 3.5 },
          { rx: o.x + o.width - 3.5, ry: o.y + 3.5 },
          { rx: o.x + 3.5, ry: o.y + o.height - 3.5 },
          { rx: o.x + o.width - 3.5, ry: o.y + o.height - 3.5 }
        ];
        rivets.forEach(rivet => {
          ctx.beginPath();
          ctx.arc(rivet.rx, rivet.ry, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Hard industrial/iron fractures when damaged
        if (o.maxHp && o.hp !== undefined && o.hp < o.maxHp) {
           ctx.strokeStyle = '#020617';
           ctx.lineWidth = 2;
           ctx.beginPath();
           ctx.moveTo(o.x + o.width * 0.5, o.y + o.height * 0.5);
           ctx.lineTo(o.x + o.width * 0.3, o.y + o.height * 0.7);
           if (o.hp < o.maxHp * 0.5) {
              ctx.moveTo(o.x + o.width * 0.5, o.y + o.height * 0.5);
              ctx.lineTo(o.x + o.width * 0.75, o.y + o.height * 0.35);
           }
           ctx.stroke();
        }
    }
  });

  // Draw Powerups
  state.powerups.forEach((p: Powerup) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(state.frameCount * 0.05);
      
      // Outer box
      ctx.fillStyle = p.color;
      ctx.fillRect(-12, -12, 24, 24);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(-12, -12, 24, 24);
      
      // Symbol
      ctx.fillStyle = 'white';
      if (p.type === PowerupType.HEAL) {
          ctx.fillRect(-8, -2, 16, 4);
          ctx.fillRect(-2, -8, 4, 16);
      } else {
          ctx.beginPath();
          ctx.moveTo(-6, 6); ctx.lineTo(0, -8); ctx.lineTo(6, 6);
          ctx.fill();
      }
      ctx.restore();
  });

  // Draw enemies
  state.enemies.forEach((e: Tank) => {
      drawTank(ctx, e);
      
      // Target highlight if this is the auto-aim target
      const isTargeted = !touchState.current.aimActive && !state.mouse.isDown;
      if (isTargeted && state.enemies.length > 0) {
        let nearestDist = 1200;
        let nearestEnemy = null;
        for (const en of state.enemies) {
          const d = Math.hypot(en.x - state.player.x, en.y - state.player.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestEnemy = en;
          }
        }
        if (nearestEnemy === e) {
          ctx.save();
          const pulse = Math.sin(state.frameCount * 0.15) * 2;
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius + 8 + pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
  });

  // Draw Laser Sight for Player
  if (isPlaying && !state.gameOver) {
    ctx.save();
    const laserLen = 600;
    const startX = state.player.x + Math.cos(state.player.turretAngle) * 35;
    const startY = state.player.y + Math.sin(state.player.turretAngle) * 35;
    const endX = state.player.x + Math.cos(state.player.turretAngle) * laserLen;
    const endY = state.player.y + Math.sin(state.player.turretAngle) * laserLen;
    
    if (!Number.isFinite(startX) || !Number.isFinite(startY) || !Number.isFinite(endX) || !Number.isFinite(endY)) {
      ctx.restore();
      return;
    }

    ctx.beginPath();
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -state.frameCount * 0.4;
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  }

  // Draw Player if alive
  if (!state.gameOver) {
    drawTank(ctx, state.player);
  }

  // Draw custom sight (crosshair) during play
  if (!state.gameOver) {
    ctx.save();
    
    const mx = state.mouse.x;
    const my = state.mouse.y;
    
    const isDown =
      state.mouse.isDown ||
      (touchState.current.aimActive && !state.autoFire);

    // Apply high-visibility laser green shadow glow
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = isDown ? 15 : 8;

    // 1. Surrounding prominent glow halo
    ctx.beginPath();
    ctx.arc(mx, my, 26, 0, Math.PI * 2);
    ctx.fillStyle = isDown ? 'rgba(0, 255, 102, 0.15)' : 'rgba(0, 255, 102, 0.05)';
    ctx.fill();

    // 2. Thick Pulsing Outer Circle (dashed for tech look)
    const pulseOffset = Math.sin(state.frameCount * 0.12) * 2.5;
    const outerRadius = 20 + pulseOffset;
    
    ctx.beginPath();
    ctx.arc(mx, my, outerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 3]);
    ctx.stroke();

    // 3. Crisp Solid Inner Ring
    ctx.beginPath();
    ctx.arc(mx, my, 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.stroke();

    // 4. Four sturdy reticle ticks (North, South, East, West)
    const tickLen = 8;
    const tickStart = 12;
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    
    // North
    ctx.moveTo(mx, my - tickStart);
    ctx.lineTo(mx, my - tickStart - tickLen);
    // South
    ctx.moveTo(mx, my + tickStart);
    ctx.lineTo(mx, my + tickStart + tickLen);
    // West
    ctx.moveTo(mx - tickStart, my);
    ctx.lineTo(mx - tickStart - tickLen, my);
    // East
    ctx.moveTo(mx + tickStart, my);
    ctx.lineTo(mx + tickStart + tickLen, my);
    
    ctx.stroke();

    // 5. Center Core dot with a sharp high-contrast white center
    ctx.beginPath();
    ctx.arc(mx, my, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff66';
    ctx.fill();

    // No-glow white dot for extreme central contrast
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(mx, my, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  // Draw bullets
  state.bullets.forEach((b: Bullet) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));

    const r = b.radius;
    const wl = b.weaponLevel || 1;

    if (wl <= 3) {
      // Sleek pointed kinetic projectile
      // Outer shell
      ctx.fillStyle = b.color; // Slate metal
      ctx.beginPath();
      ctx.moveTo(-r * 1.8, -r * 0.9);
      ctx.lineTo(r * 1.2, -r * 0.9);
      ctx.lineTo(r * 3.2, 0); // Tip
      ctx.lineTo(r * 1.2, r * 0.9);
      ctx.lineTo(-r * 1.8, r * 0.9);
      ctx.closePath();
      ctx.fill();

      // Side grooves for realism
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = r * 0.15;
      ctx.beginPath();
      ctx.moveTo(-r * 1.2, -r * 0.4);
      ctx.lineTo(r * 0.8, -r * 0.4);
      ctx.moveTo(-r * 1.2, r * 0.4);
      ctx.lineTo(r * 0.8, r * 0.4);
      ctx.stroke();

      // Sharp white core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.35);
      ctx.lineTo(r * 1.0, -r * 0.35);
      ctx.lineTo(r * 2.4, 0);
      ctx.lineTo(r * 1.0, r * 0.35);
      ctx.lineTo(-r * 0.8, r * 0.35);
      ctx.closePath();
      ctx.fill();

    } else if (wl <= 6) {
      // Golden Solar Spindle with booster stabilizers
      // Side stabilizer winglets
      ctx.fillStyle = '#b45309'; // Dark amber contrast
      ctx.beginPath();
      ctx.moveTo(-r * 2.0, -r * 1.6);
      ctx.lineTo(-r * 0.8, -r * 0.9);
      ctx.lineTo(-r * 2.0, -r * 0.9);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-r * 2.0, r * 1.6);
      ctx.lineTo(-r * 0.8, r * 0.9);
      ctx.lineTo(-r * 2.0, r * 0.9);
      ctx.closePath();
      ctx.fill();

      // Main Energy Spindle
      ctx.fillStyle = b.color; // Bright amber orange
      ctx.beginPath();
      ctx.moveTo(-r * 2.2, 0);
      ctx.lineTo(-r * 0.8, -r * 1.05);
      ctx.lineTo(r * 1.8, -r * 1.05);
      ctx.lineTo(r * 3.6, 0); // Front energy needle
      ctx.lineTo(r * 1.8, r * 1.05);
      ctx.lineTo(-r * 0.8, r * 1.05);
      ctx.closePath();
      ctx.fill();

      // Glowing core segment
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      ctx.moveTo(-r * 1.0, 0);
      ctx.lineTo(-r * 0.3, -r * 0.5);
      ctx.lineTo(r * 1.6, -r * 0.5);
      ctx.lineTo(r * 2.8, 0);
      ctx.lineTo(r * 1.6, r * 0.5);
      ctx.lineTo(-r * 0.3, r * 0.5);
      ctx.closePath();
      ctx.fill();

      // Micro thruster spark stream at tail
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(-r * 2.7, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();

    } else if (wl <= 9) {
      // Volcanic Plasma Slug (Faceted, Heavy Armor Piercing Rail missile)
      // Large heavy stabilizing delta fin at tail
      ctx.fillStyle = '#4c0519'; // Deep obsidian red
      ctx.beginPath();
      ctx.moveTo(-r * 2.2, -r * 1.9);
      ctx.lineTo(-r * 0.4, -r * 0.95);
      ctx.lineTo(-r * 1.6, -r * 0.95);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-r * 2.2, r * 1.9);
      ctx.lineTo(-r * 0.4, r * 0.95);
      ctx.lineTo(-r * 1.6, r * 0.95);
      ctx.closePath();
      ctx.fill();

      // Outer heavy armored plasma sheath
      ctx.fillStyle = b.color; // Glowing crimson
      ctx.beginPath();
      ctx.moveTo(-r * 2.4, -r * 0.95);
      ctx.lineTo(r * 1.4, -r * 0.95);
      ctx.lineTo(r * 2.8, -r * 0.45);
      ctx.lineTo(r * 3.8, 0); // Piercing sharp vulcan tip
      ctx.lineTo(r * 2.8, r * 0.45);
      ctx.lineTo(r * 1.4, r * 0.95);
      ctx.lineTo(-r * 2.4, r * 0.95);
      ctx.closePath();
      ctx.fill();

      // Plasma vents (horizontal vents)
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = r * 0.15;
      ctx.beginPath();
      ctx.moveTo(-r * 1.3, -r * 0.5);
      ctx.lineTo(-r * 0.3, -r * 0.5);
      ctx.moveTo(-r * 1.3, r * 0.5);
      ctx.lineTo(-r * 0.3, r * 0.5);
      ctx.stroke();

      // Blazing pure white hot thermal core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-r * 1.0, -r * 0.4);
      ctx.lineTo(r * 1.6, -r * 0.4);
      ctx.lineTo(r * 2.8, 0);
      ctx.lineTo(r * 1.6, r * 0.4);
      ctx.lineTo(-r * 1.0, r * 0.4);
      ctx.closePath();
      ctx.fill();

    } else {
      // Quantum Bio Disruptor Core (Level 10+)
      // Orbiting plasma shield arcs/wings
      ctx.strokeStyle = b.color; // Quantum Green
      ctx.lineWidth = r * 0.25;
      
      // Top bio rail
      ctx.beginPath();
      ctx.moveTo(-r * 2.5, -r * 1.55);
      ctx.quadraticCurveTo(-r * 0.5, -r * 1.9, r * 1.5, -r * 1.55);
      ctx.stroke();

      // Bottom bio rail
      ctx.beginPath();
      ctx.moveTo(-r * 2.5, r * 1.55);
      ctx.quadraticCurveTo(-r * 0.5, r * 1.9, r * 1.5, r * 1.55);
      ctx.stroke();

      // Quantum Core Main Slug
      ctx.fillStyle = b.color; 
      ctx.beginPath();
      ctx.moveTo(-r * 2.6, 0);
      ctx.lineTo(-r * 1.4, -r * 1.15);
      ctx.lineTo(r * 1.4, -r * 1.15);
      ctx.lineTo(r * 4.0, 0); // Quantum convergence tip
      ctx.lineTo(r * 1.4, r * 1.15);
      ctx.lineTo(-r * 1.4, r * 1.15);
      ctx.closePath();
      ctx.fill();

      // Horizontal central core separation grid
      ctx.fillStyle = '#022c22';
      ctx.fillRect(-r * 1.2, -r * 0.1, r * 2.4, r * 0.2);

      // Hyper glow dual fusion cores
      ctx.fillStyle = '#f0fdf4';

      // Upper Fusion Channel
      ctx.beginPath();
      ctx.moveTo(-r * 1.4, -r * 0.8);
      ctx.lineTo(r * 1.2, -r * 0.8);
      ctx.lineTo(r * 2.4, -r * 0.2);
      ctx.lineTo(-r * 0.8, -r * 0.2);
      ctx.closePath();
      ctx.fill();

      // Lower Fusion Channel
      ctx.beginPath();
      ctx.moveTo(-r * 1.4, r * 0.8);
      ctx.lineTo(r * 1.2, r * 0.8);
      ctx.lineTo(r * 2.4, r * 0.2);
      ctx.lineTo(-r * 0.8, r * 0.2);
      ctx.closePath();
      ctx.fill();

      // Cybernetic stabilizer dots aligned vertically near standard nozzle
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(-r * 2.0, -r * 0.5, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 2.0, r * 0.5, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });

  // Draw particles
  state.particles.forEach((p: Particle) => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    if (p.shape === 'square') {
      ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  });
  
  // Exit camera space to draw elements fixed to screen space (e.g., joysticks, minimap)
  ctx.restore();
  
  // Draw Touch Controls
  const rect = canvas.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0 && canvas.width > 0 && canvas.height > 0) {
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const layout = getTouchLayout(state.width, state.height, {
      prefersTouch,
      moveActive: touchState.current.moveActive,
      aimActive: touchState.current.aimActive,
    });

    const joyOpts = [layout.outerRadius, layout.maxDeflection] as const;

    const drawGhost = (
      canvasX: number,
      canvasY: number,
    ) => {
      const jsStartX = rect.left + canvasX / scaleX;
      const jsStartY = rect.top + canvasY / scaleY;
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawJoystick(
        ctx,
        canvas,
        jsStartX,
        jsStartY,
        jsStartX,
        jsStartY,
        'rgba(100, 116, 139, 0.3)',
        ...joyOpts,
      );
      ctx.restore();
    };

    // --- LEFT JOYSTICK (Movement) ---
    if (touchState.current.moveActive) {
      drawJoystick(
        ctx,
        canvas,
        touchState.current.moveStartX,
        touchState.current.moveStartY,
        touchState.current.moveCurrentX,
        touchState.current.moveCurrentY,
        '#3b82f6',
        ...joyOpts,
      );
    } else if (layout.showControls) {
      drawGhost(layout.moveCenter.x, layout.moveCenter.y);
    }

    // --- RIGHT JOYSTICK (Aiming / Muzzle joystick) ---
    if (touchState.current.aimActive) {
      drawJoystick(
        ctx,
        canvas,
        touchState.current.aimStartX,
        touchState.current.aimStartY,
        touchState.current.aimCurrentX,
        touchState.current.aimCurrentY,
        '#22c55e',
        ...joyOpts,
      );
    } else if (layout.showControls) {
      drawGhost(layout.aimCenter.x, layout.aimCenter.y);
    }
  }

  // Draw Minimap in fixed screen space (Top Right Corner)
  if (isPlaying && !state.gameOver) {
    ctx.save();
    
    const compactUI = state.width < 768 || prefersTouch;
    const minimapSize = compactUI ? 85 : 130;
    const margin = compactUI ? 12 : 20;
    const mapX = state.width - minimapSize - margin;
    const mapY = margin;

    // Draw Map Background (slate-900 transparent) with a sleek thin border (slate-700)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; 
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.7)'; 
    ctx.lineWidth = 1.5;

    drawRoundedRect(ctx, mapX, mapY, minimapSize, minimapSize, compactUI ? 8 : 12);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    // Clip everything inside the rounded rect
    drawRoundedRect(ctx, mapX, mapY, minimapSize, minimapSize, compactUI ? 8 : 12);
    ctx.clip();

    // Show whole field setup
    const scale = minimapSize / Math.max(state.worldWidth, state.worldHeight);
    const centeringOffsetX = (minimapSize - state.worldWidth * scale) / 2;
    const centeringOffsetY = (minimapSize - state.worldHeight * scale) / 2;

    const getMapCoords = (worldX: number, worldY: number) => {
      return {
        x: mapX + centeringOffsetX + worldX * scale,
        y: mapY + centeringOffsetY + worldY * scale
      };
    };

    // Draw World Borders on radar
    const bTL = getMapCoords(0, 0);
    const bBR = getMapCoords(state.worldWidth, state.worldHeight);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bTL.x, bTL.y, bBR.x - bTL.x, bBR.y - bTL.y);

    // Draw Spawners
    state.spawners.forEach((s: Spawner) => {
      const mPos = getMapCoords(s.x, s.y);
      ctx.fillStyle = '#6366f1'; 
      ctx.beginPath();
      ctx.arc(mPos.x, mPos.y, compactUI ? 2 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Powerups
    state.powerups.forEach((p: Powerup) => {
      const mPos = getMapCoords(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(mPos.x, mPos.y, compactUI ? 1.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Camera Screen bounds
    const topLeftMap = getMapCoords(state.camera.x - (state.width / 2) / CAMERA_ZOOM, state.camera.y - (state.height / 2) / CAMERA_ZOOM);
    const bottomRightMap = getMapCoords(state.camera.x + (state.width / 2) / CAMERA_ZOOM, state.camera.y + (state.height / 2) / CAMERA_ZOOM);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(topLeftMap.x, topLeftMap.y, bottomRightMap.x - topLeftMap.x, bottomRightMap.y - topLeftMap.y);

    // Draw Enemies
    state.enemies.forEach((e: Tank) => {
      const mPos = getMapCoords(e.x, e.y);
      // Draw solid, clear red dot
      ctx.fillStyle = '#ef4444'; 
      ctx.beginPath();
      ctx.arc(mPos.x, mPos.y, compactUI ? 2.2 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Heading vector line
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mPos.x, mPos.y);
      ctx.lineTo(mPos.x + Math.cos(e.angle) * (compactUI ? 3.5 : 5), mPos.y + Math.sin(e.angle) * (compactUI ? 3.5 : 5));
      ctx.stroke();
    });

    // Draw Player Location
    const pPos = getMapCoords(state.player.x, state.player.y);
    ctx.save();
    ctx.translate(pPos.x, pPos.y);
    ctx.rotate(state.player.angle);

    // Directional arrow representing user tank
    ctx.fillStyle = '#3b82f6'; 
    ctx.beginPath();
    const arrowMult = compactUI ? 0.7 : 1.0;
    ctx.moveTo(4.5 * arrowMult, 0);
    ctx.lineTo(-4.5 * arrowMult, -4 * arrowMult);
    ctx.lineTo(-2.5 * arrowMult, 0);
    ctx.lineTo(-4.5 * arrowMult, 4 * arrowMult);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Player turret pointer line
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = compactUI ? 0.9 : 1.2;
    ctx.beginPath();
    ctx.moveTo(pPos.x, pPos.y);
    ctx.lineTo(pPos.x + Math.cos(state.player.turretAngle) * (compactUI ? 4.5 : 6.5), pPos.y + Math.sin(state.player.turretAngle) * (compactUI ? 4.5 : 6.5));
    ctx.stroke();

    ctx.restore(); // Exit clip context
    ctx.restore(); // Exit minimap draw context
  }
};
