export interface Entity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export interface Tank extends Entity {
  id?: number;
  angle: number;
  turretAngle: number;
  targetTurretAngle?: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  recoil: number;
  isPlayer: boolean;
  moveAngle?: number;
  moveTimer?: number;
  damageMultiplier?: number;
  speedMultiplier?: number;
  fireRateMultiplier?: number;
  weaponLevel?: number;
  weaponSizeLevel?: number;
  weaponSpeedLevel?: number;
  weaponColorLevel?: number;
  behavior?: 'random' | 'stalker';
  invisibleTimer?: number;
  barrelExtension?: number;
}

export interface Spawner extends Entity {
  hp: number;
  maxHp: number;
  active: boolean;
}

export enum PowerupType {
  HEAL = 'HEAL',
  STRONG_WEAPON = 'STRONG_WEAPON'
}

export interface Powerup extends Entity {
  type: PowerupType;
  life: number;
}

export interface Bullet extends Entity {
  life: number;
  ownerIsPlayer: boolean;
  ownerId?: number;
  originX: number;
  originY: number;
  bounces: number;
  damage: number;
  weaponLevel?: number;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  size: number;
  shape?: 'circle' | 'square';
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type: 'wall' | 'concrete' | 'iron';
  hp?: number;
  maxHp?: number;
}
