
import { BRICK_TYPES } from "../config";

export interface BrickParams {
  x: number;
  y: number;
  acx: number;
  acy: number;
  bw: number;
  bh: number;
  level: number;
  concreteRatio: number;
}

export function getProceduralBrick(params: BrickParams) {
  const { x, y, acx, acy, bw, bh, level, concreteRatio } = params;
  
  // Pattern Logic: vary based on level ID to create structured geometric layouts
  const patternType = level % 4; 
  
  const gridScale = 128; // Reduced scale for higher density
  const innerX = Math.abs(x - acx) % gridScale;
  const innerY = Math.abs(y - acy) % gridScale;
  
  let spawn = false;
  
  if (patternType === 0) {
    // "Thick Pillars" - High density grid of blocks
    const thickness = bw * 2;
    spawn = (innerX < thickness || innerX >= gridScale - thickness) && 
            (innerY < thickness || innerY >= gridScale - thickness);
  } else if (patternType === 1) {
    // "Thick Transverse" - Structured fat symmetric lines
    const mid = gridScale / 2;
    const thickness = bw * 3;
    spawn = (Math.abs(innerX - mid) < thickness) || 
            (Math.abs(innerY - mid) < thickness);
  } else if (patternType === 2) {
    // "Double Concentric" - Multiple nested frames for density
    const frame1 = bw;
    const frame2 = bw * 4;
    const isFrame1 = innerX < frame1 || innerX >= gridScale - frame1 || innerY < frame1 || innerY >= gridScale - frame1;
    const midStart = gridScale / 2 - bw * 2;
    const midEnd = gridScale / 2 + bw * 2;
    const isFrame2 = (innerX >= midStart && innerX < midEnd) || (innerY >= midStart && innerY < midEnd);
    spawn = isFrame1 || isFrame2;
  } else {
    // "Heavy Striped Fortification"
    const thickness = bw * 4;
    const cx = Math.floor(Math.abs(x - acx) / gridScale);
    const cy = Math.floor(Math.abs(y - acy) / gridScale);
    if ((cx + cy) % 2 === 0) {
      spawn = innerX < thickness;
    } else {
      spawn = innerY < thickness;
    }
  }

  if (!spawn) return null;

  // Boost concrete ratio slightly for high levels to feel more "ideal" and sturdy
  const adjustedRatio = Math.max(concreteRatio, 0.4);
  const useConcrete = Math.random() < adjustedRatio;
  const brickInfo = useConcrete ? BRICK_TYPES.CONCRETE : BRICK_TYPES.WALL;
  
  return {
    color: brickInfo.colors[Math.floor(Math.random() * brickInfo.colors.length)],
    hp: brickInfo.hp,
    type: brickInfo.type
  };
}
