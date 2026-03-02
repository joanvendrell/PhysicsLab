export interface MaterialDef {
  name: string;
  thermal_conductivity?: number;
  density: number;
  specific_heat?: number;
  youngs_modulus?: number;
  poissons_ratio?: number;
}

export interface GeometryRegion {
  /** "circle", "rectangle", "polygon" */
  shape: string;
  /** "hole" = void, "material" = filled with a specific material */
  type: 'hole' | 'material';
  /** material index into materials[] when type === "material" */
  material_index?: number;
  /** centre for circle */
  center?: { x: number; y: number };
  /** radius for circle (in metres) */
  radius?: number;
  /** for rectangle: top-left x,y + width,height */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface SimulationConfig {
  type: 'heat_transfer' | 'solid_mechanics' | 'wave_propagation';
  title: string;
  description: string;
  geometry: {
    shape: string;
    dimensions: Record<string, number>;
    /** Optional regions for holes / multi-material zones */
    regions?: GeometryRegion[];
  };
  /** Primary (base) material */
  material: MaterialDef;
  /** Additional materials referenced by geometry regions */
  materials?: MaterialDef[];
  boundary_conditions: {
    type: string;
    left: { type: string; value: number };
    right: { type: string; value: number };
    top?: { type: string; value: number };
    bottom?: { type: string; value: number };
  };
  simulation: {
    grid_resolution: number;
    time_steps: number;
    dt: number;
    total_time: number;
  };
  initial_conditions: {
    temperature?: number;
    displacement?: number;
  };
}

export interface SimulationResult {
  field: number[][];
  mesh: { x: number[]; y: number[] };
  timeSteps: number[];
  min: number;
  max: number;
  config: SimulationConfig;
  /** Per-cell mask: 0 = void/hole, 1+ = material id (1 = base material) */
  mask: number[];
}

// --------------- Geometry mask builder ---------------

function buildMask(config: SimulationConfig, nx: number, ny: number): number[] {
  const Lx = config.geometry.dimensions.length || 0.01;
  const Ly = config.geometry.dimensions.width || config.geometry.dimensions.height || Lx * 0.6;
  const mask = new Array(ny * nx).fill(1); // 1 = base material

  const regions = config.geometry.regions;
  if (!regions) return mask;

  for (const region of regions) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const px = (i / (nx - 1)) * Lx;
        const py = (j / (ny - 1)) * Ly;
        let inside = false;

        if (region.shape === 'circle' && region.center && region.radius) {
          const dx = px - region.center.x;
          const dy = py - region.center.y;
          inside = dx * dx + dy * dy <= region.radius * region.radius;
        } else if (region.shape === 'rectangle' && region.x !== undefined && region.y !== undefined && region.width && region.height) {
          inside = px >= region.x && px <= region.x + region.width &&
                   py >= region.y && py <= region.y + region.height;
        }

        if (inside) {
          const idx = j * nx + i;
          if (region.type === 'hole') {
            mask[idx] = 0;
          } else if (region.type === 'material' && region.material_index !== undefined) {
            mask[idx] = region.material_index + 2; // 2+ for additional materials
          }
        }
      }
    }
  }
  return mask;
}

function getMaterialForCell(config: SimulationConfig, materialId: number): MaterialDef {
  if (materialId <= 1) return config.material;
  const idx = materialId - 2;
  return config.materials?.[idx] ?? config.material;
}

// --------------- Heat Transfer Solver ---------------

export function runHeatTransfer(config: SimulationConfig): SimulationResult {
  const nx = config.simulation.grid_resolution;
  const ny = Math.max(10, Math.round(nx * 0.6));
  const nt = config.simulation.time_steps;
  const dt = config.simulation.dt;

  const Lx = config.geometry.dimensions.length || 0.01;
  const Ly = config.geometry.dimensions.width || config.geometry.dimensions.height || Lx * 0.6;
  const dx = Lx / (nx - 1);
  const dy = Ly / (ny - 1);

  const mask = buildMask(config, nx, ny);

  // Pre-compute per-cell diffusivity
  const alpha = new Float64Array(ny * nx);
  for (let idx = 0; idx < ny * nx; idx++) {
    if (mask[idx] === 0) { alpha[idx] = 0; continue; }
    const mat = getMaterialForCell(config, mask[idx]);
    const k = mat.thermal_conductivity || 50;
    const rho = mat.density;
    const cp = mat.specific_heat || 500;
    alpha[idx] = k / (rho * cp);
  }

  const T0 = config.initial_conditions.temperature || 300;
  let current = Array.from({ length: ny }, () => Array(nx).fill(T0));

  // Set holes to NaN for display
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (mask[j * nx + i] === 0) current[j][i] = NaN;
    }
  }

  const Tleft = config.boundary_conditions.left.value;
  const Tright = config.boundary_conditions.right.value;
  const Ttop = config.boundary_conditions.top?.value ?? T0;
  const Tbottom = config.boundary_conditions.bottom?.value ?? T0;

  for (let j = 0; j < ny; j++) {
    if (mask[j * nx] !== 0) current[j][0] = Tleft;
    if (mask[j * nx + nx - 1] !== 0) current[j][nx - 1] = Tright;
  }
  for (let i = 0; i < nx; i++) {
    if (mask[i] !== 0) current[0][i] = Ttop;
    if (mask[(ny - 1) * nx + i] !== 0) current[ny - 1][i] = Tbottom;
  }

  const results: number[][] = [];
  const storeEvery = Math.max(1, Math.floor(nt / 100));
  results.push(current.flat());

  // Stability: find max alpha
  let maxAlpha = 0;
  for (const a of alpha) { if (a > maxAlpha) maxAlpha = a; }
  const maxR = 0.25;
  const stableDt = maxAlpha > 0 ? maxR * Math.min(dx * dx, dy * dy) / maxAlpha : dt;
  const effectiveDt = Math.min(dt, stableDt);

  for (let t = 0; t < nt; t++) {
    const next = current.map(row => [...row]);

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = j * nx + i;
        if (mask[idx] === 0) continue; // skip holes

        const a = alpha[idx];
        const rx = a * effectiveDt / (dx * dx);
        const ry = a * effectiveDt / (dy * dy);

        // Neighbours: treat hole neighbours as adiabatic (use current cell value)
        const Tl = mask[idx - 1] !== 0 ? current[j][i - 1] : current[j][i];
        const Tr = mask[idx + 1] !== 0 ? current[j][i + 1] : current[j][i];
        const Tu = mask[(j - 1) * nx + i] !== 0 ? current[j - 1][i] : current[j][i];
        const Td = mask[(j + 1) * nx + i] !== 0 ? current[j + 1][i] : current[j][i];

        next[j][i] = current[j][i] +
          rx * (Tr - 2 * current[j][i] + Tl) +
          ry * (Td - 2 * current[j][i] + Tu);
      }
    }

    // Re-apply BCs
    for (let j = 0; j < ny; j++) {
      if (mask[j * nx] !== 0) next[j][0] = Tleft;
      if (mask[j * nx + nx - 1] !== 0) next[j][nx - 1] = Tright;
    }
    for (let i = 0; i < nx; i++) {
      if (mask[i] !== 0) next[0][i] = Ttop;
      if (mask[(ny - 1) * nx + i] !== 0) next[ny - 1][i] = Tbottom;
    }

    current = next;
    if ((t + 1) % storeEvery === 0) {
      results.push(current.flat());
    }
  }

  let minVal = Infinity, maxVal = -Infinity;
  for (const frame of results) {
    for (const v of frame) {
      if (isNaN(v)) continue;
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }

  return {
    field: results,
    mesh: {
      x: Array.from({ length: nx }, (_, i) => (i / (nx - 1)) * Lx),
      y: Array.from({ length: ny }, (_, j) => (j / (ny - 1)) * Ly),
    },
    timeSteps: results.map((_, i) => i * storeEvery * effectiveDt),
    min: minVal,
    max: maxVal,
    config,
    mask,
  };
}

// --------------- Solid Mechanics Solver ---------------

export function runSolidMechanics(config: SimulationConfig): SimulationResult {
  const nx = config.simulation.grid_resolution;
  const ny = Math.max(10, Math.round(nx * 0.3));
  const nt = config.simulation.time_steps;

  const L = config.geometry.dimensions.length || 1;
  const H = config.geometry.dimensions.height || config.geometry.dimensions.width || L * 0.2;

  const mask = buildMask(config, nx, ny);

  const force = config.boundary_conditions.right?.value || 1000;
  const I_base = (config.geometry.dimensions.width || H) * Math.pow(H, 3) / 12;

  const results: number[][] = [];

  for (let t = 0; t <= nt; t++) {
    const progress = t / nt;
    const field: number[] = [];

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = j * nx + i;
        if (mask[idx] === 0) {
          field.push(NaN);
          continue;
        }
        const mat = getMaterialForCell(config, mask[idx]);
        const E = mat.youngs_modulus || 200e9;
        const x = (i / (nx - 1)) * L;
        const y = (j / (ny - 1)) * H - H / 2;

        const deflection = progress * (force * x * x * (3 * L - x)) / (6 * E * I_base);
        const stress = progress * (force * (L - x) * y) / I_base;
        field.push(Math.abs(stress));
      }
    }

    if (t % Math.max(1, Math.floor(nt / 100)) === 0) {
      results.push(field);
    }
  }

  let minVal = Infinity, maxVal = -Infinity;
  for (const frame of results) {
    for (const v of frame) {
      if (isNaN(v)) continue;
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }

  return {
    field: results,
    mesh: {
      x: Array.from({ length: nx }, (_, i) => (i / (nx - 1)) * L),
      y: Array.from({ length: ny }, (_, j) => (j / (ny - 1)) * H),
    },
    timeSteps: results.map((_, i) => i * (config.simulation.total_time / results.length)),
    min: minVal,
    max: maxVal,
    config,
    mask,
  };
}

export function runSimulation(config: SimulationConfig): SimulationResult {
  switch (config.type) {
    case 'heat_transfer':
      return runHeatTransfer(config);
    case 'solid_mechanics':
      return runSolidMechanics(config);
    case 'wave_propagation':
      return runHeatTransfer(config);
    default:
      return runHeatTransfer(config);
  }
}