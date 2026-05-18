export const LEVEL_COLORS = [
  // Levels 1-3: Slate, Steel, and Heavy Grey
  '#94a3b8', // Level 1: Light Slate Steel Grey
  '#4b5563', // Level 2: Durable Iron Grey
  '#1f2937', // Level 3: Deep Gunmetal Charcoal

  // Levels 4-6: Solar and Desert Amber/Yellow
  '#fde047', // Level 4: Soft Solar Yellow
  '#f59e0b', // Level 5: Pure Desert Gold
  '#b45309', // Level 6: Deep Amber Ochre

  // Levels 7-9: Plasma Volcanic Crimson Red
  '#fda4af', // Level 7: Neon Coral Red
  '#ef4444', // Level 8: Vibrant Plasma Fire Red
  '#881337', // Level 9: Deep Volcanic Crimson Noir

  // Levels 10-12: Light to Medium Emerald
  '#86efac', // Level 10: Neon Radioactive Eco-Green
  '#22c55e', // Level 11: Heavy Emerald Field Green
  '#15803d', // Level 12: Peak Military Deep Olive

  // Levels 13-15: Deep and Stealth Greens
  '#14532d', // Level 13: Dark Pine Sentinel Green
  '#064e3b', // Level 14: Deepest Abyssal Forest Jade
  '#0d9488', // Level 15: Cyber Bio-Teal Green

  // Levels 16-18: High Tech Quantum Greens
  '#0f766e', // Level 16: Dark Ocean Quantum Green
  '#5eead4', // Level 17: Glowing Radioactive Liquid Emerald
  '#2dd4bf', // Level 18: High energy Toxic Poison Jade

  // Levels 19-21: Cyber and Mint Greens
  '#047857', // Level 19: Elite Cybernetic Mint Green
  '#16a34a', // Level 20: Tactical Ranger Green
  '#15803d', // Level 21: Veteran Jungle Camo Green

  // Levels 22-24: Mystic and Forest Greens
  '#052e16', // Level 22: Shadows of the Deep Jungle
  '#22c55e', // Level 23: Pure Active Fusion Green
  '#10b981', // Level 24: Radioactive Plasma Green

  // Levels 25-27: Bio-hazard Tactical Greens
  '#065f46', // Level 25: Bio-hazard Combat Teal Green
  '#14532d', // Level 26: Heavy Golem Titanium Green
  '#022c22', // Level 27: Dark Matter Quantum Green

  // Levels 28+: Ultima Sage and Quantum Teal
  '#047857', // Level 28: Titan Forest Sage
  '#15803d', // Level 29: Elite Commando Green
  '#115e59', // Level 30+: High Commander Deep Cyber Teal
];

export function getTankColor(level: number) {
  const L = Math.floor(level);
  return LEVEL_COLORS[Math.min(Math.max(1, L) - 1, LEVEL_COLORS.length - 1)] || LEVEL_COLORS[0];
}

export function getBulletColorAndRadius(weaponLevel: number) {
  const wl = Math.min(30, Math.max(1, weaponLevel));
  
  // Setup fine-grained size progression from 3.0px to 6.6px
  const radius = 1.6 + wl * 0.40; 
  
  // Use the established level-based color scheme
  const color = getTankColor(wl);
  
  return { color, radius };
}

export const BRICK_TYPES = {
  WALL: {
    type: 'wall',
    hp: 4,
    colors: ["#b91c1c", "#c2410c", "#ca8a04", "#991b1b", "#ef4444"],
    label: "Standard Clay",
    description: "Brittle red clay. Slightly more durable."
  },
  CONCRETE: {
    type: 'concrete',
    hp: 6,
    colors: ["#475569", "#3f4f60", "#323f4b", "#52525b"],
    label: "Reinforced Concrete",
    description: "Industrial grade. Requires multiple direct hits."
  },
  IRON: {
    type: 'iron',
    hp: 8,
    colors: ["#1e293b", "#334155", "#475569"],
    label: "Solid Steel",
    description: "Heavy plating. Extremely durable defensive barrier."
  },
  CORE: {
    type: 'core',
    hp: 12,
    colors: ["#701a75", "#4a044e", "#a21caf"],
    label: "Bunker Plating",
    description: "Deep-level fortifications for high-value targets."
  }
};

export function getTankStats(level: number) {
  const L = Math.min(30, Math.max(1, Math.floor(level)));
  const bStats = getBulletColorAndRadius(L);
  
  return {
    radius: 25 + L * 1.5, // discrete tank size scaling
    color: getTankColor(level), // getTankColor also floors internally
    bulletSpeed: 7.0 + (L - 1) * 0.40, // Tangible bullet speed progression: 7.0 (Tier 1) -> 18.6 (Tier 30)
    bulletRadius: bStats.radius, // Share exact radius calculations!
    bulletDamage: 1.0, // 1 damage = 1 level decrease
    bulletLife: 3000,
    cooldown: Math.max(8, 35 - L * 1.0), // Controlled firing cadence
    speed: 2.2 + (L - 1) * 0.10, // Tangible tank speed progression: 2.2 (Tier 1) -> 5.1 (Tier 30)
  };
}

export function getBulletCount(level: number): number {
  const L = Math.min(30, Math.max(1, level));
  if (L >= 25) return 8;
  if (L >= 20) return 7;
  if (L >= 15) return 6;
  if (L >= 12) return 5;
  if (L >= 9) return 4;
  if (L >= 6) return 3;
  if (L >= 3) return 2;
  return 1;
}

export const GameConfig = {
  player: {
    startHp: 10, // 10 Lives initially
    acceleration: 0.8,
    friction: 0.85,
  },
  enemy: {
    baseHp: 1,
    detectionRange: 1800,
    attackRange: 800,
  },
  maxWeaponLevel: 30,
};
