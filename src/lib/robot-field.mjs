// ASCII robot floor behind every page, after stackedlol/ascii-sharks: the same cell
// grid, fixed-step loop and diffusing wake, with robots in place of fish and sharks.
// Small AMRs drive aisle convoys, large AMRs scan lidar on Manhattan routes, and
// fixed arms pick robots up and set them down. The floor scrolls with the page,
// and cells behind text are dimmed so reading contrast is kept.
// GSAP's ticker drives the fixed-step simulation alongside Lenis; quickTo eases the arms.
import { gsap } from 'gsap';
import { scroll } from './smooth-scroll.mjs';
import '../styles/robot-field.css';

{
  const STEP = 1 / 60, MAX_STEPS = 4, LEVELS = 8, TAU = Math.PI * 2;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const NOSE = '▸▾◂▴';
  const RAMP = '.:-=+*#%@';
  const EDGE = '.,:;';
  const SUB = [[.2, .25], [.8, .25], [.2, .75], [.8, .75]];
  const QUIET = 'main :is(h1,h2,h3,h4,p,li,dt,dd,figcaption,blockquote,pre,table,.action,.secondary-action),.site-navigation';
  // Frosted-glass diagrams (.project-drawing, .practice-orbit) let the floor show through, softened.
  const HIDDEN = 'main :is(figure:not(.project-drawing),img,video,iframe)';
  const LIGHT = (() => { const l = Math.hypot(-.45, -.55, .7); return [-.45 / l, -.55 / l, .7 / l]; })();
  const rand = (a, b) => gsap.utils.random(a, b);
  const clamp = (v, a, b) => gsap.utils.clamp(a, b, v);
  const angleDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  // Lambert against a fixed top-left light: 0 shadow .. 1 lit.
  const lit = (nx, ny, nz) => clamp(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, 1) * .85 + .15;

  const canvas = document.createElement('canvas');
  canvas.className = 'robot-field';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const grid = document.createElement('canvas');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const font = 'ui-monospace,SFMono-Regular,Menlo,Consolas,"DejaVu Sans Mono",monospace';

  let W = 0, H = 0, docH = 0, dpr = 1, cw = 12, ch = 17, cols = 0, rowsDoc = 0, vrows = 0, row0 = 0, camY = 0;
  let heat = new Float32Array(0), heatTmp = heat, quiet = new Uint8Array(0);
  let cellChar = [], cellLevel = new Uint8Array(0);
  let robots = [], fleets = [], amrs = [], arms = [];
  let head = new Int32Array(0), next = new Int32Array(0), bcols = 0, brows = 0, bsize = 40;
  let dark = false, styles = [], dotStyles = [], gridStyle = '';
  let time = 0, acc = 0, boost = 1, hitShade = 0, hitGlyph = '';
  const buckets = Array.from({ length: LEVELS * 2 }, () => []);
  const pointer = { cx: 0, cy: 0, active: false };

  function readTheme() {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    const m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    const rgb = m ? m.slice(1).map(h => parseInt(h, 16)).join(',') : '32,33,31';
    dark = document.documentElement.dataset.resolved === 'dark';
    // ponytail: alpha ceilings tuned by eye against both paper colours; text cells drop to 30%.
    const maxA = dark ? .5 : .46, maxDot = dark ? .42 : .38;
    styles = []; dotStyles = [];
    for (const q of [1, .3]) for (let l = 0; l < LEVELS; l++) {
      styles.push(`rgba(${rgb},${(maxA * (.22 + .78 * l / (LEVELS - 1)) * q).toFixed(3)})`);
      dotStyles.push(`rgba(${rgb},${(maxDot * (l + 1) / LEVELS * q).toFixed(3)})`);
    }
    gridStyle = `rgba(${rgb},${dark ? .06 : .05})`;
    paintGrid();
  }

  function paintGrid() {
    grid.width = Math.round(W * dpr);
    grid.height = Math.round((H + ch * 2) * dpr);
    const g = grid.getContext('2d');
    g.strokeStyle = gridStyle;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= W; x += cw) { const p = Math.round(x * dpr) + .5; g.moveTo(p, 0); g.lineTo(p, grid.height); }
    for (let y = 0; y <= H + ch * 2; y += ch) { const p = Math.round(y * dpr) + .5; g.moveTo(0, p); g.lineTo(grid.width, p); }
    g.stroke();
  }

  function layout() {
    const w = document.documentElement.clientWidth, d = Math.max(document.documentElement.scrollHeight, innerHeight);
    const widthChanged = w !== W;
    W = w; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (widthChanged) { cw = clamp(Math.round(W / 124), 8, 13); ch = Math.round(cw * 1.45); cols = Math.ceil(W / cw); bsize = Math.max(ch * 3, cw * 5); }
    if (widthChanged || d !== docH) {
      docH = d; rowsDoc = Math.ceil(docH / ch) + 1;
      heat = new Float32Array(cols * rowsDoc); heatTmp = new Float32Array(cols * rowsDoc); quiet = new Uint8Array(cols * rowsDoc);
      seed(widthChanged);
    }
    vrows = Math.ceil(H / ch) + 2;
    cellChar = new Array(cols * vrows).fill(''); cellLevel = new Uint8Array(cols * vrows);
    readTheme();
    markQuiet();
    if (reduced.matches) still();
  }

  // Text keeps its contrast: cells under readable elements draw at 30% alpha (1),
  // and figures and media keep a clean ground with nothing drawn behind them (2).
  function markQuiet() {
    quiet.fill(0);
    for (const [selector, value] of [[QUIET, 1], [HIDDEN, 2]]) for (const e of document.querySelectorAll(selector)) {
      const b = e.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const top = b.top + scrollY;
      const c0 = Math.max(0, Math.floor((b.left - 6) / cw)), c1 = Math.min(cols - 1, Math.floor((b.right + 6) / cw));
      const r0 = Math.max(0, Math.floor((top - 4) / ch)), r1 = Math.min(rowsDoc - 1, Math.floor((top + b.height + 4) / ch));
      for (let r = r0; r <= r1; r++) for (let i = r * cols + c0; i <= r * cols + c1; i++) quiet[i] = Math.max(quiet[i], value);
    }
  }

  function seed(full) {
    // Arms: sparse fixed stations, one per ~2.5 screens, alternating page edges.
    for (const r of robots) r.carried = null;
    const R = clamp(Math.min(W * .34, H * .45), 130, 320);
    arms = [];
    // The first arm fills the empty space under the portrait, reaching down and left.
    const portrait = document.querySelector('.hero-portrait')?.getBoundingClientRect();
    for (let k = portrait ? 1 : 0, y = portrait ? portrait.bottom + scrollY + R * .3 : H * .62; y < docH - R * .4; k++, y += H * 2.5) {
      const left = k % 2 === 0, bx = left ? R * .2 : W - R * .2, home = left ? 0 : Math.PI - (arms.length ? 0 : .35);
      arms.push({ bx, by: y, R, L1: R * .5, L2: R * .36, L2e: R * .5, home, elbow: 1, elbowTo: 1,
        ex: bx + Math.cos(home) * R * .6, ey: y, state: 'idle', timer: rand(.5, 2.5),
        phase: rand(0, TAU), grip: 0, gripTo: 0, carry: null, target: null, dropX: 0, dropY: 0 });
    }
    for (const a of arms) {
      // Fast start, soft landing: the gripper eases onto moving targets like a servo.
      a.toX = gsap.quickTo(a, 'ex', { duration: .55, ease: 'power3' });
      a.toY = gsap.quickTo(a, 'ey', { duration: .55, ease: 'power3' });
      a.toGrip = gsap.quickTo(a, 'grip', { duration: .2, ease: 'power2' });
      ik(a);
    }

    // Small AMRs travel as convoys: one heading per fleet, robots in a column behind the leader.
    const target = clamp(Math.round(W * docH / 120000), 6, 120);
    if (full) { robots = []; fleets = []; }
    robots.length = Math.min(robots.length, target);
    while (robots.length < target) {
      const dir = Math.random() < .7 ? (Math.random() < .5 ? 0 : 2) : (Math.random() < .5 ? 1 : 3);
      const f = { dir, cruise: rand(26, 44), turnAt: time + rand(2, 8) };
      fleets.push(f);
      const n = Math.min(Math.round(rand(2, 4)), target - robots.length);
      const x = rand(0, W), y = rand(0, docH), [dx, dy] = DIRS[dir];
      for (let k = 0; k < n; k++) {
        const lane = (k % 2) * (dx ? ch * 2 : cw * 3);
        robots.push({ x: x - dx * k * cw * 2.4 + (dy ? lane : 0), y: y - dy * k * ch * 1.8 + (dx ? lane : 0),
          vx: dx * f.cruise, vy: dy * f.cruise, fleet: f, depth: rand(.7, 1), carried: null, on: false });
      }
    }
    for (const r of robots) { r.x = (r.x + W) % W; r.y = (r.y + docH) % docH; }

    // Large AMRs: one per ~1.4 screens, axis-aligned routes with on-the-spot turns.
    const count = Math.max(2, Math.round(docH / (H * 1.4)));
    if (full || amrs.length !== count) {
      const len = clamp(Math.min(W, H) * .19, 70, 170);
      amrs = Array.from({ length: count }, (_, k) => {
        const m = { x: rand(W * .2, W * .8), y: (k + .5) / count * docH, h: Math.floor(rand(0, 4)) * Math.PI / 2,
          v: 0, len, wid: len * .66, tx: 0, ty: 0, wait: rand(0, 1.5), scan: rand(0, TAU) };
        pickRoute(m);
        return m;
      });
    }
    for (const m of amrs) m.y = clamp(m.y, m.len, docH - m.len);
  }

  function pickRoute(m) {
    if (Math.random() < .5) { m.tx = rand(m.len, W - m.len); m.ty = m.y; }
    else { m.tx = m.x; m.ty = clamp(m.y + rand(-.6, .6) * H, m.len, docH - m.len); }
  }

  function deposit(x, y, v) {
    const c = Math.floor(x / cw), r = Math.floor(y / ch);
    if (c < 0 || c >= cols || r < 0 || r >= rowsDoc) return;
    const i = r * cols + c;
    heat[i] = Math.min(1.5, heat[i] + v);
  }

  function step(dt) {
    time += dt;
    camY = scrollY;
    // Scrolling hurries the floor along: convoys and lidar speed up with Lenis velocity.
    boost += (1 + clamp(Math.abs(scroll.lenis?.velocity ?? 0) / 25, 0, 1.5) - boost) * Math.min(1, dt * 4);
    // ponytail: only the band around the viewport simulates; robots further away wait in place.
    const lo = camY - H, hi = camY + H * 2;
    stepRobots(dt, lo, hi);
    for (const m of amrs) if (m.y > lo && m.y < hi) stepAmr(m, dt);
    for (const a of arms) if (a.by > lo && a.by < hi) stepArm(a, dt);
  }

  function stepRobots(dt, lo, hi) {
    bcols = Math.ceil(W / bsize) + 1; brows = Math.ceil(docH / bsize) + 1;
    if (head.length !== bcols * brows) head = new Int32Array(bcols * brows);
    if (next.length !== robots.length) next = new Int32Array(robots.length);
    head.fill(-1);
    for (let i = 0; i < robots.length; i++) {
      const r = robots[i];
      r.on = !r.carried && r.y > lo && r.y < hi;
      if (!r.on) continue;
      const b = Math.floor(r.y / bsize) * bcols + Math.floor(r.x / bsize);
      next[i] = head[b]; head[b] = i;
    }
    for (const f of fleets) if (time > f.turnAt) {
      f.dir = (f.dir + (Math.random() < .5 ? 1 : 3)) % 4;
      f.turnAt = time + (f.dir % 2 ? rand(1.2, 3) : rand(3, 8));
    }
    const sepX = cw * 2.2, sepY = ch * 1.3, px = pointer.cx, py = pointer.cy + camY;
    for (let i = 0; i < robots.length; i++) {
      const r = robots[i];
      if (!r.on) continue;
      const f = r.fleet, [dx, dy] = DIRS[f.dir];
      let ax = (dx * f.cruise * boost - r.vx) * 2, ay = (dy * f.cruise * boost - r.vy) * 2;
      // Robots hold the centre of their aisle so convoys read as crisp rows of cells.
      if (dx) ay += ((Math.floor(r.y / ch) + .5) * ch - r.y) * 6;
      else ax += ((Math.floor(r.x / cw) + .5) * cw - r.x) * 6;
      const bc = Math.floor(r.x / bsize), br = Math.floor(r.y / bsize);
      for (let y = Math.max(0, br - 1); y <= Math.min(brows - 1, br + 1); y++) {
        for (let x = Math.max(0, bc - 1); x <= Math.min(bcols - 1, bc + 1); x++) {
          for (let j = head[y * bcols + x]; j !== -1; j = next[j]) {
            if (j === i) continue;
            const qx = (r.x - robots[j].x) / sepX, qy = (r.y - robots[j].y) / sepY, q2 = qx * qx + qy * qy;
            if (q2 >= 1 || q2 < 1e-6) continue;
            const k = (1 - Math.sqrt(q2)) * 260;
            ax += qx * k; ay += qy * k;
          }
        }
      }
      // Yield to the big AMRs and to the cursor: break sideways out of their path.
      for (const m of amrs) {
        const ox = r.x - m.x, oy = r.y - m.y, d = Math.hypot(ox, oy), R = m.len * .95;
        if (d >= R || d < 1e-3) continue;
        const w = (1 - d / R) ** 2;
        ax += ox / d * 900 * w; ay += oy / d * 900 * w;
      }
      if (pointer.active) {
        const ox = r.x - px, oy = r.y - py, d = Math.hypot(ox, oy);
        if (d < 110 && d > 1e-3) { const w = (1 - d / 110) ** 2; ax += ox / d * 1400 * w; ay += oy / d * 1400 * w; }
      }
      r.vx += ax * dt; r.vy += ay * dt;
      const s = Math.hypot(r.vx, r.vy), cap = f.cruise * 2.4 * boost;
      if (s > cap) { r.vx *= cap / s; r.vy *= cap / s; }
      r.x = gsap.utils.wrap(0, W, r.x + r.vx * dt);
      r.y = gsap.utils.wrap(0, docH, r.y + r.vy * dt);
      deposit(r.x, r.y, .02);
    }
  }

  function stepAmr(m, dt) {
    m.scan += dt * 4.5 * boost;
    const lx = m.x + Math.cos(m.h) * m.len * .26, ly = m.y + Math.sin(m.h) * m.len * .26, range = m.len * 1.8;
    for (let s = cw; s < range; s += cw * .8) deposit(lx + Math.cos(m.scan) * s, ly + Math.sin(m.scan) * s, .07 * (1 - s / range));
    if (m.wait > 0) { m.wait -= dt; m.v = 0; return; }
    const ox = m.tx - m.x, oy = m.ty - m.y, d = Math.hypot(ox, oy);
    if (d < 6) { m.wait = rand(.8, 2.4); pickRoute(m); return; }
    // Differential drive: turn on the spot, then drive.
    const err = angleDiff(m.h, Math.atan2(oy, ox));
    m.h += clamp(err, -2.4 * dt, 2.4 * dt);
    const want = Math.abs(err) > .08 ? 0 : 58 * Math.min(1, d / 70);
    m.v += (want - m.v) * Math.min(1, dt * 3);
    m.x += Math.cos(m.h) * m.v * dt; m.y += Math.sin(m.h) * m.v * dt;
    const sx = -Math.sin(m.h) * m.wid * .55, sy = Math.cos(m.h) * m.wid * .55;
    deposit(m.x + sx, m.y + sy, .05); deposit(m.x - sx, m.y - sy, .05);
  }

  function stepArm(a, dt) {
    const px = pointer.cx, py = pointer.cy + camY;
    let gripTo = a.carry ? 1 : 0;
    if (pointer.active && Math.hypot(px - a.bx, py - a.by) < a.R * 1.05) {
      a.tx = px; a.ty = py; if (!a.carry) gripTo = .45;
    } else if (a.state === 'reach') {
      const r = a.target;
      if (r.carried || !r.on || Math.hypot(r.x - a.bx, r.y - a.by) > a.R * .97) { a.state = 'idle'; a.timer = .8; }
      else {
        a.tx = r.x; a.ty = r.y;
        if (Math.hypot(a.gx - r.x, a.gy - r.y) < cw * 1.4) {
          r.carried = a; a.carry = r; a.state = 'lift';
          const ang = a.home + rand(-1.1, 1.1), dist = rand(.45, .9) * a.R;
          a.dropX = clamp(a.bx + Math.cos(ang) * dist, cw, W - cw); a.dropY = a.by + Math.sin(ang) * dist;
          burst(r.x, r.y, .5);
        }
      }
    } else if (a.state === 'lift') {
      a.tx = a.dropX; a.ty = a.dropY;
      if (Math.hypot(a.gx - a.dropX, a.gy - a.dropY) < 5) {
        const r = a.carry;
        r.carried = null; r.vx = r.vy = 0; r.x = clamp(a.gx, 0, W - 1);
        a.carry = null; a.state = 'idle'; a.timer = rand(1.5, 4);
        burst(r.x, r.y, .5);
      }
    } else {
      const sway = a.home + Math.sin(time * .35 + a.phase) * .6;
      a.tx = a.bx + Math.cos(sway) * a.R * .62; a.ty = a.by + Math.sin(sway) * a.R * .62;
      if ((a.timer -= dt) <= 0) {
        let best = null, bestD = Infinity;
        for (const r of robots) {
          if (!r.on) continue;
          const d = Math.hypot(r.x - a.bx, r.y - a.by);
          if (d > a.R * .3 && d < a.R * .9 && d < bestD && Math.abs(angleDiff(a.home, Math.atan2(r.y - a.by, r.x - a.bx))) < 1.3) { best = r; bestD = d; }
        }
        if (best) { a.target = best; a.state = 'reach'; } else a.timer = .4;
      }
    }
    a.toX(a.tx); a.toY(a.ty);
    if (gripTo !== a.gripTo) a.toGrip(a.gripTo = gripTo);
    // Bend the elbow toward the arm's home side so it never folds off the page edge.
    // The sign flips with hysteresis and blends, so the elbow swings through instead of snapping.
    const side = angleDiff(a.home, Math.atan2(a.ey - a.by, a.ex - a.bx));
    if (Math.abs(side) > .2) a.elbowTo = Math.sign(side);
    a.elbow += (a.elbowTo - a.elbow) * Math.min(1, dt * 4);
    ik(a);
    if (a.carry) { a.carry.x = a.gx; a.carry.y = a.gy; }
  }

  // Two-link planar IK. The gripper extends the forearm, so L2e = forearm + grip reach.
  function ik(a) {
    const dx = a.ex - a.bx, dy = a.ey - a.by, L1 = a.L1, L2 = a.L2e;
    const dc = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1, L1 + L2 - 1);
    const q2 = a.elbow * Math.acos(clamp((dc * dc - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
    const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    a.fa = q1 + q2;
    a.jx = a.bx + Math.cos(q1) * L1; a.jy = a.by + Math.sin(q1) * L1;
    a.wx = a.jx + Math.cos(a.fa) * a.L2; a.wy = a.jy + Math.sin(a.fa) * a.L2;
    a.gx = a.jx + Math.cos(a.fa) * L2; a.gy = a.jy + Math.sin(a.fa) * L2;
  }

  function burst(x, y, v) {
    for (let k = 0; k < 24; k++) { const t = k / 24 * TAU; deposit(x + Math.cos(t) * cw * 2, y + Math.sin(t) * ch * 1.3, v); }
  }

  function pulse(x, y) {
    for (let k = 0; k < 48; k++) { const t = k / 48 * TAU; deposit(x + Math.cos(t) * cw * 4, y + Math.sin(t) * ch * 2.6, .9); }
    for (const r of robots) {
      if (!r.on) continue;
      const ox = r.x - x, oy = r.y - y, d = Math.hypot(ox, oy);
      if (d < 200 && d > 1e-3) { r.vx += ox / d * (1 - d / 200) * 220; r.vy += oy / d * (1 - d / 200) * 220; }
    }
  }

  function diffuse(dt) {
    const k = Math.exp(-dt * 1.6) * .125;
    const r0 = Math.max(1, row0 - 2), r1 = Math.min(rowsDoc - 2, row0 + vrows + 2);
    for (let r = r0; r <= r1; r++) {
      for (let c = 1, i = r * cols + 1; c < cols - 1; c++, i++) {
        heatTmp[i] = (heat[i] * 4 + heat[i - 1] + heat[i + 1] + heat[i - cols] + heat[i + cols]) * k;
      }
    }
    for (let r = r0; r <= r1; r++) heat.set(heatTmp.subarray(r * cols + 1, r * cols + cols - 1), r * cols + 1);
  }

  // Scratch outputs of the samplers, to avoid allocating per sample.
  const hit = (shade, glyph) => { hitShade = shade; hitGlyph = glyph; return true; };

  function tube(px, py, x0, y0, x1, y1, r0, r1) {
    const dx = x1 - x0, dy = y1 - y0, t = clamp(((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const qx = px - x0 - dx * t, qy = py - y0 - dy * t, r = r0 + (r1 - r0) * t;
    if (qx * qx + qy * qy >= r * r) return false;
    const nx = qx / r, ny = qy / r;
    return hit(lit(nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))), '');
  }

  function joint(px, py, cx, cy, r) {
    const nx = (px - cx) / r, ny = (py - cy) / r, q2 = nx * nx + ny * ny;
    if (q2 >= 1) return false;
    if (q2 > .5) return hit(.18, ''); // machined rim
    if (q2 < .08) return hit(.5, '+'); // axis pin
    return hit(lit(nx * .6, ny * .6, Math.sqrt(1 - q2 * .36)), '');
  }

  function sampleArm(a, px, py) {
    const R = a.R, ux = Math.cos(a.fa), uy = Math.sin(a.fa), ox = px - a.wx, oy = py - a.wy;
    const u = ox * ux + oy * uy, v = -ox * uy + oy * ux, open = R * (.035 + .045 * (1 - a.grip)), fw = R * .018;
    if (u > 0 && u < R * .15 && Math.abs(Math.abs(v) - open) < fw) return hit(.3, '');
    if (u > -R * .035 && u < R * .02 && Math.abs(v) < open + fw) return hit(lit(-uy * v / (open + fw), ux * v / (open + fw), .6), '');
    if (joint(px, py, a.wx, a.wy, R * .045)) return true;
    if (tube(px, py, a.jx, a.jy, a.wx, a.wy, R * .045, R * .034)) return true;
    if (joint(px, py, a.jx, a.jy, R * .068)) return true;
    if (tube(px, py, a.bx, a.by, a.jx, a.jy, R * .062, R * .048)) return true;
    if (joint(px, py, a.bx, a.by, R * .095)) return true;
    const bx = (px - a.bx) / (R * .16), by = (py - a.by) / (R * .16), q2 = bx * bx + by * by;
    if (q2 >= 1) return false;
    if (q2 > .78) return hit(.3, '');
    const ang = Math.atan2(by, bx) / TAU * 6;
    return q2 > .45 && q2 < .62 && Math.abs(ang - Math.round(ang)) < .12 ? hit(.2, 'o') : hit(.62, '');
  }

  function sampleAmr(m, px, py) {
    const c = Math.cos(m.h), s = Math.sin(m.h), ox = px - m.x, oy = py - m.y;
    const u = ox * c + oy * s, v = -ox * s + oy * c, a = m.len / 2, b = m.wid / 2, au = Math.abs(u), av = Math.abs(v);
    const lr = b * .32, lu = (u - a * .52) / lr, lv = v / lr, l2 = lu * lu + lv * lv;
    if (l2 < 1) return l2 < .3 ? hit(.12, '@') : hit(lit((lu * c - lv * s) * .7, (lu * s + lv * c) * .7, .7), '');
    if (au < a * .24 && av > b * .96 && av < b * 1.22) return hit(.08, '█'); // drive wheels
    const rr = b * .45, ex = Math.max(au - (a - rr), 0), ey = Math.max(av - (b - rr), 0);
    if (ex * ex + ey * ey > rr * rr) return false;
    const eu = a - au, ev = b - av;
    if (Math.min(eu, ev) < Math.min(cw, b * .3)) {
      // Chamfered edge: the face normal points out of the nearest side.
      const nu = eu < ev ? Math.sign(u) : 0, nv = eu < ev ? 0 : Math.sign(v);
      return hit(lit((nu * c - nv * s) * .8, (nu * s + nv * c) * .8, .6), '');
    }
    if (u > a * .74) return hit(.3, ''); // bumper
    if (Math.abs(u + a * .12) < ch * .3) return hit(.42, '');
    return hit(.72, '');
  }

  function put(c, r, glyph, ink) {
    const i = (r - row0) * cols + c;
    cellChar[i] = glyph || RAMP[Math.round(ink * (RAMP.length - 1))];
    cellLevel[i] = Math.round(ink * (LEVELS - 1));
  }

  function raster(x0, y0, x1, y1, sample, obj) {
    const c0 = Math.max(0, Math.floor(x0 / cw)), c1 = Math.min(cols - 1, Math.floor(x1 / cw));
    const r0 = Math.max(row0, Math.floor(y0 / ch)), r1 = Math.min(row0 + vrows - 1, rowsDoc - 1, Math.floor(y1 / ch));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = c * cw, y = r * ch;
      if (sample(obj, x + cw / 2, y + ch / 2)) { put(c, r, hitGlyph, .3 + .7 * (dark ? hitShade : 1 - hitShade)); continue; }
      let hits = 0;
      for (const [sx, sy] of SUB) if (sample(obj, x + sx * cw, y + sy * ch)) hits++;
      if (hits) put(c, r, EDGE[hits - 1], .15);
    }
  }

  function render() {
    camY = scrollY;
    row0 = Math.floor(camY / ch);
    const lo = row0 * ch, hi = lo + vrows * ch;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(grid, 0, -Math.round((camY - lo) * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, -camY * dpr);

    for (const b of buckets) b.length = 0;
    for (let r = row0; r < Math.min(rowsDoc, row0 + vrows); r++) {
      for (let c = 0, i = r * cols; c < cols; c++, i++) {
        const v = heat[i];
        if (v > .05 && quiet[i] !== 2) buckets[Math.min(LEVELS - 1, (v * LEVELS) | 0) + (quiet[i] ? LEVELS : 0)].push(i);
      }
    }
    const dot = Math.max(1.5, cw * .2);
    for (let b = 0; b < buckets.length; b++) {
      if (!buckets[b].length) continue;
      ctx.fillStyle = dotStyles[b];
      for (const i of buckets[b]) ctx.fillRect((i % cols + .5) * cw - dot / 2, ((i / cols | 0) + .5) * ch - dot / 2, dot, dot);
    }

    cellChar.fill('');
    for (const r of robots) {
      if (r.carried || r.y < lo || r.y >= hi) continue;
      const dir = Math.abs(r.vx) > Math.abs(r.vy) ? (r.vx > 0 ? 0 : 2) : (r.vy > 0 ? 1 : 3);
      const c = Math.floor(r.x / cw), row = Math.floor(r.y / ch), nc = c + DIRS[dir][0], nr = row + DIRS[dir][1];
      put(c, row, '■', .9 * r.depth);
      if (nc >= 0 && nc < cols && nr >= row0 && nr < row0 + vrows) put(nc, nr, NOSE[dir], .6 * r.depth);
    }
    for (const m of amrs) if (m.y + m.len > lo && m.y - m.len < hi) raster(m.x - m.len * .7, m.y - m.len * .7, m.x + m.len * .7, m.y + m.len * .7, sampleAmr, m);
    for (const a of arms) {
      if (a.by + a.R * 1.2 < lo || a.by - a.R * 1.2 > hi) continue;
      const pad = a.R * .2;
      raster(Math.min(a.bx, a.jx, a.gx) - pad, Math.min(a.by, a.jy, a.gy) - pad, Math.max(a.bx, a.jx, a.gx) + pad, Math.max(a.by, a.jy, a.gy) + pad, sampleArm, a);
      if (a.carry && a.gy >= lo && a.gy < hi) put(Math.floor(clamp(a.gx, 0, W - 1) / cw), Math.floor(a.gy / ch), '■', 1);
    }

    for (const b of buckets) b.length = 0;
    for (let i = 0; i < cellChar.length; i++) {
      if (cellChar[i] && quiet[row0 * cols + i] !== 2) buckets[cellLevel[i] + (quiet[row0 * cols + i] ? LEVELS : 0)].push(i);
    }
    ctx.font = `600 ${Math.round(ch * .74)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let b = 0; b < buckets.length; b++) {
      if (!buckets[b].length) continue;
      ctx.fillStyle = styles[b];
      for (const i of buckets[b]) ctx.fillText(cellChar[i], (i % cols + .5) * cw, (row0 + (i / cols | 0) + .5) * ch);
    }
  }

  function frame(_, deltaTime) {
    const dt = Math.min(.1, deltaTime / 1000);
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS) { step(STEP); acc -= STEP; n++; }
    if (n === MAX_STEPS) acc = 0;
    diffuse(dt);
    render();
  }

  // Reduced motion: let the floor settle, then draw single frames on scroll only.
  function still() {
    if (time < 4) for (let i = 0; i < 240; i++) { step(STEP); if (i % 4 === 0) { row0 = Math.floor(scrollY / ch); diffuse(STEP * 4); } }
    render();
  }

  let pending = 0;
  const relayout = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; layout(); }); };
  new ResizeObserver(relayout).observe(document.body);
  addEventListener('resize', relayout);
  addEventListener('scroll', () => { if (reduced.matches) requestAnimationFrame(render); }, { passive: true });
  new MutationObserver(() => { readTheme(); if (reduced.matches) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-resolved'] });
  addEventListener('pointermove', e => { pointer.cx = e.clientX; pointer.cy = e.clientY; pointer.active = e.pointerType !== 'touch'; }, { passive: true });
  addEventListener('pointerdown', e => { if (!reduced.matches) pulse(e.clientX, e.clientY + scrollY); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; });
  addEventListener('blur', () => { pointer.active = false; });

  layout();
  gsap.matchMedia().add({ motion: '(prefers-reduced-motion: no-preference)' }, ({ conditions }) => {
    if (!conditions.motion) { still(); return; }
    gsap.ticker.add(frame);
    return () => gsap.ticker.remove(frame);
  });
}
