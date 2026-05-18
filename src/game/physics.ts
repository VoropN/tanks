import { Obstacle, Tank } from './types';

/**
 * Resolves collision between two tanks by pushing them apart when they overlap.
 */
export function resolveTankTankCollision(t1: Tank, t2: Tank, worldWidth: number, worldHeight: number) {
  const dx = t2.x - t1.x;
  const dy = t2.y - t1.y;
  const distSq = dx * dx + dy * dy;
  const minDist = t1.radius + t2.radius;
  
  if (distSq < minDist * minDist && distSq > 0) {
    const dist = Math.sqrt(distSq);
    const overlap = minDist - dist;
    const nx = dx / dist;
    const ny = dy / dist;
    
    const massRatio1 = t1.isPlayer ? 0 : (t2.isPlayer ? 1 : 0.5);
    const massRatio2 = t2.isPlayer ? 0 : (t1.isPlayer ? 1 : 0.5);

    t1.x -= nx * overlap * massRatio1;
    t1.y -= ny * overlap * massRatio1;
    t2.x += nx * overlap * massRatio2;
    t2.y += ny * overlap * massRatio2;
    
    // clamp to world boundaries
    t1.x = Math.max(t1.radius, Math.min(worldWidth - t1.radius, t1.x));
    t1.y = Math.max(t1.radius, Math.min(worldHeight - t1.radius, t1.y));
    t2.x = Math.max(t2.radius, Math.min(worldWidth - t2.radius, t2.x));
    t2.y = Math.max(t2.radius, Math.min(worldHeight - t2.radius, t2.y));
  }
}

/**
 * Resolves collision between a circular tank and rectangular obstacles by pushing
 * the tank out along the collision normal, allowing smooth sliding around corners
 * and along walls without getting stuck at 45-degree angles or brick seams.
 */
export function resolveTankObstacleCollisions(
  tank: { x: number; y: number; radius: number; vx?: number; vy?: number },
  obstacles: Obstacle[],
  filter: string[] = ["wall", "concrete", "iron"],
  iterations: number = 2
) {
  for (let iter = 0; iter < iterations; iter++) {
    for (const obs of obstacles) {
      if (!filter.includes(obs.type)) continue;

      // Find closest point on the obstacle rectangle to the circle center
      const closestX = Math.max(obs.x, Math.min(tank.x, obs.x + obs.width));
      const closestY = Math.max(obs.y, Math.min(tank.y, obs.y + obs.height));

      const dx = tank.x - closestX;
      const dy = tank.y - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < tank.radius * tank.radius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = tank.radius - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Push the tank out along the collision normal
          tank.x += nx * overlap;
          tank.y += ny * overlap;

          // Slide velocity along the wall surface (eliminate velocity component into the wall)
          if (tank.vx !== undefined && tank.vy !== undefined) {
            const dot = tank.vx * nx + tank.vy * ny;
            if (dot < 0) {
              tank.vx -= dot * nx;
              tank.vy -= dot * ny;
            }
          }
        } else {
          // If the center is exactly on the edge or inside, push along the shallowest penetration
          const leftDist = Math.abs(tank.x - obs.x);
          const rightDist = Math.abs(obs.x + obs.width - tank.x);
          const topDist = Math.abs(tank.y - obs.y);
          const bottomDist = Math.abs(obs.y + obs.height - tank.y);

          const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
          if (minDist === leftDist) tank.x = obs.x - tank.radius;
          else if (minDist === rightDist) tank.x = obs.x + obs.width + tank.radius;
          else if (minDist === topDist) tank.y = obs.y - tank.radius;
          else tank.y = obs.y + obs.height + tank.radius;
        }
      }
    }
  }
}

/**
 * Checks if a circular entity (like a tank) is colliding with a rectangular obstacle.
 */
export function checkWallCollisionExtended(x: number, y: number, radius: number, obstacles: Obstacle[], filter: string[]): boolean {
  for (const obs of obstacles) {
    if (!filter.includes(obs.type)) continue;
    
    const closestX = Math.max(obs.x, Math.min(x, obs.x + obs.width));
    const closestY = Math.max(obs.y, Math.min(y, obs.y + obs.height));
    const distanceX = x - closestX;
    const distanceY = y - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    
    if (distanceSquared < radius * radius) return true;
  }
  return false;
}

/**
 * Checks if a point is inside any obstacle of a given type.
 */
export function checkPointCollisionExtended(x: number, y: number, obstacles: Obstacle[], type: string): boolean {
  for (const obs of obstacles) {
    if (obs.type === type && x >= obs.x && x <= obs.x + obs.width && y >= obs.y && y <= obs.y + obs.height) return true;
  }
  return false;
}
