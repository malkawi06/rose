/*
  Browser port of the procedural renderer in rose.py.
  Original code art: JIN2 (@jin_22ee), 2026.
  This canvas draws glyphs every frame; it does not use a rose image.
*/

(() => {
  "use strict";

  const canvas = document.querySelector("#roseCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const W = 1080;
  const H = 960;
  const CW = 9;
  const CH = 14;
  const FONT_PX = 15;
  const COLS = Math.floor(W / CW);
  const ROWS = Math.floor(H / CH);
  const CELLS = COLS * ROWS;
  const ASPECT = (COLS * CW) / (ROWS * CH);
  const TAU = Math.PI * 2;
  const LOOP = 20;
  const FLOOR = -1.22;
  const HEAD_Y = 0.22;
  const DRAW_START = 0.3;
  const DRAW_END = 5.4;
  const ORDER_MAX = 1.66;

  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const TAG = {
    STEM: 0,
    LEAF: 1,
    SEPAL: 2,
    PETAL: 3,
    EDGE: 4,
    GLINT: 5,
    FIRE_R: 6,
    FIRE_B: 7,
    DUST: 8,
    REFL: 9,
  };

  // The original palette, with the flower changed from pink/red to white.
  const COLORS = [
    [70, 214, 96], [52, 196, 84], [80, 206, 100],
    [248, 246, 249], [229, 226, 232], [255, 255, 255],
    [255, 176, 204], [188, 220, 255], [255, 214, 150], [140, 60, 76],
  ];
  const DIM = "rgb(110, 104, 120)";
  const PINK = "rgb(255, 122, 182)";
  const POOLS = ["1il!;:", "rtfjcvxz=+", "aeoun0{}[]<>", "08B$#&%Q"];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = (value) => {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };
  const length3 = (x, y, z) => Math.hypot(x, y, z) || 1;
  const normalise = (x, y, z) => {
    const n = length3(x, y, z);
    return [x / n, y / n, z / n];
  };
  const cross = (ax, ay, az, bx, by, bz) => [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ];
  const dot = (ax, ay, az, bx, by, bz) => ax * bx + ay * by + az * bz;

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function stemCurve(s) {
    return [
      0.045 * Math.sin(s * 3.1 + 0.4) - 0.02,
      -1.15 + s * (HEAD_Y + 1.15),
      0.02 * Math.sin(s * 2),
    ];
  }

  // Static geometry: stem and leaves. The flower surface and sepals are
  // evaluated every frame, just as they are in the Python source.
  const staticPoints = [];
  function addStatic(x, y, z, nx, ny, nz, part, kind, order) {
    staticPoints.push({ x, y, z, nx, ny, nz, part, kind, order });
  }

  function createStem() {
    const slices = 260;
    const sides = 14;
    for (let j = 0; j < sides; j += 1) {
      const phi = TAU * j / sides;
      const nx = Math.cos(phi);
      const nz = Math.sin(phi);
      for (let i = 0; i < slices; i += 1) {
        const s = i / (slices - 1);
        const [cx, cy, cz] = stemCurve(s);
        const radius = 0.026 + 0.006 * (1 - s);
        addStatic(cx + nx * radius, cy, cz + nz * radius, nx, 0, nz, 0, TAG.STEM, s);
      }
    }
  }

  function createLeaf(at, side, length, lift, twist, part) {
    const [bx, by, bz] = stemCurve(at);
    let [dx, dy, dz] = normalise(side * Math.cos(lift), Math.sin(lift), 0.25 * twist);
    let [wx, wy, wz] = normalise(...cross(dx, dy, dz, 0, 0, 1));
    const [ux, uy, uz] = cross(wx, wy, wz, dx, dy, dz);
    const widthSteps = 25;
    const lengthSteps = 70;
    for (let wi = 0; wi < widthSteps; wi += 1) {
      const w = -1 + 2 * wi / (widthSteps - 1);
      for (let si = 0; si < lengthSteps; si += 1) {
        const s = si / (lengthSteps - 1);
        const halfWidth = 0.15 * Math.sin(Math.PI * s) ** 0.75 * length / 0.42;
        const x = bx + dx * 0.07 + dx * s * length + wx * w * halfWidth + ux * (0.05 * Math.abs(w) - 0.10 * s * s);
        const y = by + dy * 0.07 + dy * s * length + wy * w * halfWidth + uy * (0.05 * Math.abs(w) - 0.10 * s * s);
        const z = bz + dz * 0.07 + dz * s * length + wz * w * halfWidth + uz * (0.05 * Math.abs(w) - 0.10 * s * s);
        const [nx, ny, nz] = normalise(ux + wx * w * 0.35, uy + wy * w * 0.35, uz + wz * w * 0.35);
        addStatic(x, y, z, nx, ny, nz, part, TAG.LEAF, at + 0.05 + s * 0.25);
      }
    }
  }

  createStem();
  createLeaf(0.32, -1, 0.42, 0.35, 1, 1);
  createLeaf(0.55, 1, 0.36, 0.45, -1, 2);

  // Full-detail flower mesh on desktop. Phones use fewer points only because
  // their smaller screens cannot display the extra character cells.
  const compact = window.matchMedia("(max-width: 700px)").matches;
  const PETAL_T = compact ? 760 : 1300;
  const PETAL_X = compact ? 30 : 40;
  const PETAL_COUNT = PETAL_T * PETAL_X;
  const petalTheta = new Float32Array(PETAL_COUNT);
  const petalV = new Float32Array(PETAL_COUNT);
  const petalS = new Float32Array(PETAL_COUNT);
  const petalOrder = new Float32Array(PETAL_COUNT);
  const petalId = new Int16Array(PETAL_COUNT);
  const petalEdge = new Uint8Array(PETAL_COUNT);
  const petalX = new Float32Array(PETAL_COUNT);
  const petalY = new Float32Array(PETAL_COUNT);
  const petalZ = new Float32Array(PETAL_COUNT);
  const dewMask = new Uint8Array(PETAL_COUNT);
  const dewGlow = new Float32Array(PETAL_COUNT);
  const outerPetals = [];

  function preparePetalMesh() {
    const minTheta = 2.2 * Math.PI;
    const maxTheta = 20 * Math.PI;
    let index = 0;
    for (let xi = 0; xi < PETAL_X; xi += 1) {
      const v = xi / (PETAL_X - 1);
      for (let ti = 0; ti < PETAL_T; ti += 1) {
        const theta = minTheta + (maxTheta - minTheta) * ti / (PETAL_T - 1);
        const s = (theta - minTheta) / (maxTheta - minTheta);
        petalTheta[index] = theta;
        petalV[index] = v;
        petalS[index] = 1 - s;
        petalId[index] = Math.floor(3.6 * theta / TAU);
        petalEdge[index] = v > 0.93 ? 1 : 0;
        petalOrder[index] = 1.10 + v * 0.42 + (1 - s) * 0.10;
        if (1 - s > 0.55) outerPetals.push(index);
        index += 1;
      }
    }
  }
  preparePetalMesh();

  const randomDew = seededRandom(31);
  const dewSeeds = Array.from({ length: 40 }, () => [randomDew(), randomDew()]);
  const randomGlitter = seededRandom(21);
  const glitterSeeds = Array.from({ length: 700 }, () => [
    randomGlitter(), randomGlitter(), randomGlitter(), randomGlitter(), randomGlitter(),
  ]);
  const randomSpark = seededRandom(13);
  const sparkSeeds = Array.from({ length: 220 }, () => [
    randomSpark(), randomSpark(), randomSpark(), randomSpark(), randomSpark(),
  ]);

  const EYE = [0, 1.75, 4];
  const FWD = normalise(0, -1.8, -4);
  const RIGHT = normalise(...cross(FWD[0], FWD[1], FWD[2], 0, 1, 0));
  const UP = cross(RIGHT[0], RIGHT[1], RIGHT[2], FWD[0], FWD[1], FWD[2]);
  const VIEW = [-FWD[0], -FWD[1], -FWD[2]];

  const part = new Int16Array(CELLS);
  const depth = new Float32Array(CELLS);
  const luminance = new Float32Array(CELLS);
  const tag = new Uint8Array(CELLS);
  const glyph = Array(CELLS).fill(" ");
  const particleDepth = new Float32Array(CELLS);
  const particleLum = new Float32Array(CELLS);
  const particleTag = new Uint8Array(CELLS);
  const particleGlyph = Array(CELLS).fill(" ");
  let projectedCell = -1;
  let projectedDepth = 99;

  function clearGrid() {
    part.fill(-1);
    depth.fill(99);
    luminance.fill(0);
    tag.fill(TAG.DUST);
    particleDepth.fill(99);
    particleLum.fill(0);
    particleTag.fill(TAG.DUST);
    particleGlyph.fill(" ");
  }

  function bloom(time) {
    const u = clamp((time - 5.5) / 9, 0, 1);
    return u * (2 - u) * 0.55 + u * u * (3 - 2 * u) * 0.45;
  }

  function sway(time) {
    return 0.22 * Math.sin(Math.max(time - 7, 0) * 0.35) * smooth((time - 7) / 4);
  }

  function makeState(time) {
    const yaw = sway(time);
    const key = normalise(-0.35, 0.85, 0.65);
    const rim = normalise(Math.cos(time * 0.8), 0.4, Math.sin(time * 0.8));
    const halfKey = normalise(key[0] + VIEW[0], key[1] + VIEW[1], key[2] + VIEW[2]);
    const halfRim = normalise(rim[0] + VIEW[0], rim[1] + VIEW[1], rim[2] + VIEW[2]);
    return {
      time,
      open: bloom(time),
      yaw,
      cosYaw: Math.cos(yaw),
      sinYaw: Math.sin(yaw),
      velocity: (sway(time + 0.05) - sway(time - 0.05)) / 0.1,
      key,
      rim,
      halfKey,
      halfRim,
    };
  }

  function project(x, y, z) {
    const rx = x - EYE[0];
    const ry = y - EYE[1];
    const rz = z - EYE[2];
    const cameraX = dot(rx, ry, rz, RIGHT[0], RIGHT[1], RIGHT[2]);
    const cameraY = dot(rx, ry, rz, UP[0], UP[1], UP[2]);
    const cameraZ = dot(rx, ry, rz, FWD[0], FWD[1], FWD[2]);
    if (cameraZ <= 0.2) return false;
    const sx = (0.5 + cameraX / cameraZ * 2.9 * 0.5) * COLS;
    const sy = (0.5 - cameraY / cameraZ * 2.9 * 0.5 * ASPECT) * ROWS;
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    if (ix < 0 || ix >= COLS || iy < 0 || iy >= ROWS) return false;
    projectedCell = iy * COLS + ix;
    projectedDepth = cameraZ;
    return true;
  }

  function plotBody(x, y, z, nx, ny, nz, bodyPart, kind, order, petalDepth, state, highlight = 0) {
    const head = (state.time - DRAW_START) / (DRAW_END - DRAW_START) * ORDER_MAX;
    const reveal = smooth((head - order) / (order >= 1 ? 0.09 : 0.05));
    const isTip = Math.abs(head - order) < 0.03 && order < 1;
    if (reveal < 0.96 && !isTip) return;

    const px = state.cosYaw * x + state.sinYaw * z;
    const pz = -state.sinYaw * x + state.cosYaw * z;
    const rx = state.cosYaw * nx + state.sinYaw * nz;
    const rz = -state.sinYaw * nx + state.cosYaw * nz;
    if (!project(px, y, pz) || projectedDepth >= depth[projectedCell]) return;

    let shade;
    let finalTag = kind;
    if (reveal < 0.96) {
      shade = 1.2;
      finalTag = TAG.GLINT;
    } else {
      const diffuse = Math.max(0, dot(rx, ny, rz, state.key[0], state.key[1], state.key[2]));
      const keySpec = Math.max(0, dot(rx, ny, rz, state.halfKey[0], state.halfKey[1], state.halfKey[2])) ** 24;
      const rimSpec = Math.max(0, dot(rx, ny, rz, state.halfRim[0], state.halfRim[1], state.halfRim[2])) ** 18;
      const specular = keySpec + 0.7 * rimSpec;
      shade = (0.62 + 0.60 * diffuse + (kind >= TAG.PETAL ? 0.35 : 0.25) * specular) * petalDepth;
      if (highlight) shade = Math.max(shade, highlight);
    }

    part[projectedCell] = bodyPart;
    depth[projectedCell] = projectedDepth;
    luminance[projectedCell] = shade;
    tag[projectedCell] = finalTag;
  }

  function renderStatic(state) {
    for (const point of staticPoints) {
      plotBody(point.x, point.y, point.z, point.nx, point.ny, point.nz,
        point.part, point.kind, point.order, 1, state);
    }
  }

  function renderSepals(state) {
    const open = state.open;
    const length = 0.36 - 0.06 * open;
    for (let sepal = 0; sepal < 5; sepal += 1) {
      const baseAngle = TAU * sepal / 5 + 0.3;
      for (let wi = 0; wi < 9; wi += 1) {
        const w = -1 + 2 * wi / 8;
        for (let si = 0; si < 34; si += 1) {
          const s = si / 33;
          const beta = (1.05 + 0.35 * open) + (0.55 + 0.75 * open) * s;
          const radius = 0.045 + length * s * Math.sin(beta);
          const angle = baseAngle + w * 0.10 * (1 - s) ** 1.3 / Math.max(radius / 0.2, 0.25);
          const x = Math.cos(angle) * radius;
          const y = HEAD_Y + 0.02 + length * s * Math.cos(beta);
          const z = Math.sin(angle) * radius;
          const nx = Math.cos(angle) * Math.cos(beta);
          const ny = -Math.sin(beta);
          const nz = Math.sin(angle) * Math.cos(beta);
          plotBody(x, y, z, nx, ny, nz, 3, TAG.SEPAL, 1 + 0.10 * s, 1, state);
        }
      }
    }
  }

  function makePetalGeometry(open) {
    const A = 1.60 + 4.00 * open;
    for (let index = 0; index < PETAL_COUNT; index += 1) {
      const theta = petalTheta[index];
      const v = petalV[index];
      const outer = petalS[index];
      const phi = (Math.PI / 2) * Math.exp(-theta / (A * Math.PI));
      const phase = (3.6 * theta) % TAU;
      const shape = 1 - 0.5 * (1.25 * (1 - phase / Math.PI) ** 2 - 0.25) ** 2;
      const yy = 1.95653 * v * v * (1.27689 * v - 1) ** 2 * Math.sin(phi);
      const radius = shape * (v * Math.sin(phi) + yy * Math.cos(phi));
      let x = radius * Math.sin(theta) * 0.80;
      let y = shape * (v * Math.cos(phi) - yy * Math.sin(phi)) * 0.80;
      let z = radius * Math.cos(theta) * 0.80;
      y *= 0.84 + 0.16 * open;
      x *= 1.05 - 0.05 * open;
      z *= 1.05 - 0.05 * open;
      y += HEAD_Y;

      const budRadius = 0.170 * v ** 0.70 * (1 - v) ** 0.75 / 0.367 * (1 - 0.30 * outer) + 0.003;
      const budX = budRadius * Math.sin(theta);
      const budY = HEAD_Y + 0.03 + 0.52 * v * (1 - 0.06 * outer);
      const budZ = budRadius * Math.cos(theta);
      const blend = smooth(open / 0.6);
      petalX[index] = budX * (1 - blend) + x * blend;
      petalY[index] = budY * (1 - blend) + y * blend;
      petalZ[index] = budZ * (1 - blend) + z * blend;
    }
  }

  let petalNormalX = 0;
  let petalNormalY = 1;
  let petalNormalZ = 0;

  function setPetalNormal(index) {
    const row = Math.floor(index / PETAL_T);
    const column = index - row * PETAL_T;
    const left = row * PETAL_T + Math.max(0, column - 1);
    const right = row * PETAL_T + Math.min(PETAL_T - 1, column + 1);
    const top = Math.max(0, row - 1) * PETAL_T + column;
    const bottom = Math.min(PETAL_X - 1, row + 1) * PETAL_T + column;
    const dux = petalX[right] - petalX[left];
    const duy = petalY[right] - petalY[left];
    const duz = petalZ[right] - petalZ[left];
    const dvx = petalX[bottom] - petalX[top];
    const dvy = petalY[bottom] - petalY[top];
    const dvz = petalZ[bottom] - petalZ[top];
    let nx = duy * dvz - duz * dvy;
    let ny = duz * dvx - dux * dvz;
    let nz = dux * dvy - duy * dvx;
    const normalLength = length3(nx, ny, nz);
    nx /= normalLength;
    ny /= normalLength;
    nz /= normalLength;
    const theta = petalTheta[index];
    if (dot(nx, ny, nz, Math.sin(theta), 0.2, Math.cos(theta)) < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    petalNormalX = nx;
    petalNormalY = ny;
    petalNormalZ = nz;
  }

  function markDew(state) {
    dewMask.fill(0);
    dewGlow.fill(0);
    if (state.open <= 0.85) return;
    for (const [spot, phase] of dewSeeds) {
      const index = outerPetals[Math.floor(spot * outerPetals.length)];
      const twinkle = clamp(Math.sin(state.time * 3 + phase * 30), 0, 1) ** 8;
      if (twinkle > 0.4) {
        dewMask[index] = 1;
        dewGlow[index] = 0.6 + 0.6 * twinkle;
      }
    }
  }

  function renderPetals(state) {
    makePetalGeometry(state.open);
    markDew(state);
    for (let index = 0; index < PETAL_COUNT; index += 1) {
      const v = petalV[index];
      const outer = petalS[index];
      const loose = clamp((outer - 0.45) / 0.55, 0, 1) * v * v * state.open;
      const ripple = 0.010 * Math.sin(state.time * 2.4 + petalId[index] * 1.7) * smooth((state.time - 8) / 2);
      const x = petalX[index] - 0.10 * state.velocity * loose;
      const y = petalY[index] + (ripple - 0.006 * Math.abs(state.velocity)) * loose;
      const z = petalZ[index];
      setPetalNormal(index);
      const kind = dewMask[index] ? TAG.GLINT : (petalEdge[index] ? TAG.EDGE : TAG.PETAL);
      plotBody(x, y, z, petalNormalX, petalNormalY, petalNormalZ, 10 + petalId[index], kind, petalOrder[index],
        0.74 + 0.26 * outer, state, dewGlow[index]);
    }
  }

  function plotParticle(x, y, z, strength, kind) {
    if (!project(x, y, z) || projectedDepth >= particleDepth[projectedCell]) return;
    particleDepth[projectedCell] = projectedDepth;
    particleLum[projectedCell] = strength;
    particleTag[projectedCell] = kind;
    particleGlyph[projectedCell] = strength > 0.7 ? "*" : (strength > 0.35 ? "+" : ".");
  }

  function renderGlitter(state) {
    for (const seed of glitterSeeds) {
      const [g0, g1, g2, g3, g4] = seed;
      const angle = g0 * TAU + state.time * (0.05 + 0.08 * g1);
      const radius = 0.55 + 1.6 * g2 ** 0.7;
      const x = Math.cos(angle) * radius;
      const y = -1.1 + 2.3 * g3 + 0.05 * Math.sin(state.time * 0.6 + g4 * TAU);
      const z = Math.sin(angle) * radius * 0.6 - 0.35;
      const twinkle = clamp(Math.sin(state.time * (1.2 + 2.5 * g1) + g4 * 40), 0, 1) ** 6;
      const strength = (0.10 + 0.85 * twinkle) * smooth((state.time - 1 - g3 * 3) / 1.5);
      const kind = g4 < 0.12 ? TAG.FIRE_B : (g4 < 0.3 ? TAG.FIRE_R : TAG.GLINT);
      plotParticle(x, y, z, strength, kind);
    }
  }

  function renderSparks(state) {
    if (state.time > DRAW_END + 0.2) return;
    const growth = clamp((state.time - DRAW_START) / (DRAW_END - DRAW_START), 0, 1);
    const [baseX, baseY, baseZ] = stemCurve(growth);
    for (const seed of sparkSeeds) {
      const [s0, s1, s2, s3, s4] = seed;
      const age = (state.time * 1.7 + s1) % 1;
      const angle = s2 * TAU;
      const speed = 0.3 + 0.5 * s3;
      const vx = Math.cos(angle) * speed;
      const vy = 0.3 + 0.7 * s4;
      const vz = Math.sin(angle) * speed;
      const u = age * 0.55;
      const x = baseX + vx * u;
      const y = baseY + vy * u - 0.5 * 1.4 * u * u;
      const z = baseZ + vz * u;
      const strength = (1 - age) ** 1.4 * (0.6 + 0.4 * Math.sin(age * 25 + angle));
      plotParticle(x, y, z, strength, s3 > 0.6 ? TAG.GLINT : TAG.DUST);
    }
  }

  function outlineGlyph(gx, gy) {
    const ax = Math.abs(gx);
    const ay = Math.abs(gy);
    if (ax + ay === 0) return "+";
    if (ax > 2 * ay) return "|";
    if (ay > 2 * ax) return gy > 0 ? "_" : "-";
    return gx * gy > 0 ? "/" : "\\";
  }

  function addRay(row, column, character, value) {
    if (row < 0 || row >= ROWS || column < 0 || column >= COLS) return;
    const index = row * COLS + column;
    if (luminance[index] >= value) return;
    glyph[index] = character;
    luminance[index] = value;
    tag[index] = TAG.GLINT;
  }

  function addRays(row, column, reach, strength = 1) {
    for (let distance = 1; distance <= reach; distance += 1) {
      const fade = (1 - distance / (reach + 1)) * strength;
      addRay(row, column + distance * 2, "-", fade);
      addRay(row, column - distance * 2, "-", fade);
      addRay(row + distance, column, "|", fade);
      addRay(row - distance, column, "|", fade);
      if (distance <= Math.floor(reach / 2)) {
        addRay(row + distance, column + distance, "\\", fade * 0.7);
        addRay(row - distance, column - distance, "\\", fade * 0.7);
        addRay(row + distance, column - distance, "/", fade * 0.7);
        addRay(row - distance, column + distance, "/", fade * 0.7);
      }
    }
    addRay(row, column, "*", 1);
  }

  function buildGlyphGrid(time) {
    glyph.fill(" ");
    let bodyCount = 0;
    const phase = Math.floor(time * 4);
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLS; column += 1) {
        const index = row * COLS + column;
        if (part[index] < 0) continue;
        bodyCount += 1;
        let edge = false;
        let gx = 0;
        let gy = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nr = row + dy;
            const nc = column + dx;
            const neighbour = nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS ? -1 : part[nr * COLS + nc];
            const neighbourDepth = nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS ? 99 : depth[nr * COLS + nc];
            const out = neighbour < 0 || (neighbour !== part[index] && neighbourDepth > depth[index] + 0.035);
            if (out) {
              gx += dx;
              gy += dy;
              if (dx === 0 || dy === 0) edge = true;
            }
          }
        }
        const hash = (row * 7919 + column * 104729) % 9973;
        const level = clamp(Math.floor(luminance[index] * 3.2), 0, 3);
        const pool = POOLS[level];
        glyph[index] = edge ? outlineGlyph(gx, gy) : pool[(hash + phase + (hash % 11)) % pool.length];
        if (tag[index] === TAG.GLINT) glyph[index] = "*";
        luminance[index] = edge ? Math.max(0.85, luminance[index]) : clamp(0.45 + 0.55 * luminance[index] / 0.9, 0.45, 1);
      }
    }

    for (let index = 0; index < CELLS; index += 1) {
      if (particleLum[index] <= 0) continue;
      if (part[index] >= 0 && particleDepth[index] >= depth[index]) continue;
      if (particleLum[index] >= luminance[index] || part[index] < 0) {
        glyph[index] = particleGlyph[index];
        luminance[index] = clamp(particleLum[index], 0, 1);
        tag[index] = particleTag[index];
      }
    }

    const bright = [];
    for (let index = 0; index < CELLS; index += 1) {
      if (tag[index] === TAG.GLINT && luminance[index] > 0.72) bright.push(index);
    }
    bright.sort((a, b) => luminance[b] - luminance[a]);
    for (let i = 0; i < Math.min(4, bright.length); i += 1) {
      const index = bright[i];
      const row = Math.floor(index / COLS);
      const column = index % COLS;
      addRays(row, column, Math.floor(4 + 6 * (0.5 + 0.5 * Math.sin(time * 7 + i * 1.7))));
    }
    return bodyCount;
  }

  function drawCanvas(state, bodyCount) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.font = `${FONT_PX}px Consolas, Menlo, "DejaVu Sans Mono", "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLS; column += 1) {
        const index = row * COLS + column;
        if (luminance[index] <= 0.02 || glyph[index] === " ") continue;
        const color = COLORS[tag[index]] || COLORS[TAG.GLINT];
        ctx.globalAlpha = clamp(luminance[index], 0.08, 1);
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        if (tag[index] === TAG.GLINT || tag[index] === TAG.FIRE_B || tag[index] === TAG.FIRE_R) {
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = tag[index] === TAG.GLINT ? 7 : 4;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillText(glyph[index], column * CW + CW / 2, row * CH + CH / 2 - 1);
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.font = "17px Consolas, Menlo, \"DejaVu Sans Mono\", \"Courier New\", monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgb(120, 112, 128)";
    ctx.fillText("@jin_22ee · 2026", 64, H - 96);
    ctx.fillStyle = DIM;
    ctx.fillText(`bloom ${(state.open * 100).toFixed(1)}%   sway ${((state.yaw * 180 / Math.PI + 360) % 360).toFixed(2).padStart(6, "0")}°`, 64, H - 70);
    ctx.fillText(`letters ${String(bodyCount).padStart(5, " ")}`, 64, H - 44);
    ctx.textAlign = "right";
    ctx.fillStyle = PINK;
    ctx.fillText(`● t ${state.time.toFixed(2).padStart(5, "0")}s`, W - 64, 43);
  }

  function render(time) {
    clearGrid();
    const state = makeState(time);
    renderStatic(state);
    renderSepals(state);
    renderPetals(state);
    renderGlitter(state);
    renderSparks(state);
    const bodyCount = buildGlyphGrid(time);
    drawCanvas(state, bodyCount);
  }

  let time = 15.25; // The completed bloom is visible immediately on load.
  let paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastTime = performance.now();
  let lastDraw = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    const elapsed = Math.min((now - lastTime) / 1000, 1 / 15);
    lastTime = now;
    if (now - lastDraw < 1000 / 30) return;
    lastDraw = now;
    if (!paused) {
      time += elapsed;
      if (time > LOOP) time = 0;
    }
    render(time);
  }

  function saveScreenshot() {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `rose-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      paused = !paused;
    } else if (event.key.toLowerCase() === "r") {
      time = 0;
      paused = false;
      render(time);
    } else if (event.key.toLowerCase() === "s") {
      saveScreenshot();
    }
  });

  render(time);
  requestAnimationFrame(animate);
})();
