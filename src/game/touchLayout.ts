export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TouchLayout = {
  moveCenter: { x: number; y: number };
  aimCenter: { x: number; y: number };
  hitRadius: number;
  outerRadius: number;
  maxDeflection: number;
  showControls: boolean;
  safeArea: SafeAreaInsets;
  compactMinimap: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Read iOS safe-area insets from computed env() values on documentElement. */
export function readSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const el = document.documentElement;
  const style = getComputedStyle(el);
  const parse = (name: string) => {
    const raw = style.getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    top: parse("padding-top"),
    right: parse("padding-right"),
    bottom: parse("padding-bottom"),
    left: parse("padding-left"),
  };
}

export function getTouchLayout(
  width: number,
  height: number,
  opts: {
    prefersTouch: boolean;
    moveActive: boolean;
    aimActive: boolean;
    safeArea?: SafeAreaInsets;
  },
): TouchLayout {
  const safe = opts.safeArea ?? readSafeAreaInsets();
  const minDim = Math.min(width, height);

  const bottomInset = Math.max(24, height * 0.08, safe.bottom);
  const leftInset = Math.max(20, width * 0.05, safe.left);
  const rightInset = Math.max(20, width * 0.05, safe.right);

  const hitRadius = clamp(minDim * 0.14, 90, 130);
  const outerRadius = hitRadius * 0.55;
  const maxDeflection = hitRadius * 0.45;

  const moveCenter = {
    x: leftInset + outerRadius,
    y: height - bottomInset - outerRadius,
  };

  const aimCenter = {
    x: width - rightInset - outerRadius,
    y: height - bottomInset - outerRadius,
  };

  const showControls =
    opts.prefersTouch || opts.moveActive || opts.aimActive;
  const compactMinimap = width < 768 || opts.prefersTouch;

  return {
    moveCenter,
    aimCenter,
    hitRadius,
    outerRadius,
    maxDeflection,
    showControls,
    safeArea: safe,
    compactMinimap,
  };
}

/** Minimap size/margin for overlay positioning (matches renderer). */
export function getMinimapMetrics(width: number, compactUI: boolean) {
  const minimapSize = compactUI ? 85 : 130;
  const margin = compactUI ? 12 : 20;
  return { minimapSize, margin, mapY: margin };
}
