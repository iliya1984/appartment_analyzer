// Places a little illustrative furniture in a plan spec (cm, [x, y, w, h] rectangles), by room
// type: beds and wardrobes against solid walls, kitchen counters, a sofa facing a TV, tables at
// the dining label, bathroom fixtures. Every piece stays inside its room, off the walls and
// openings, out of door swings (90 cm in front of doors) and away from the other pieces.

const DOOR_CLEAR = 90;
const SLIDER_CLEAR = 70;
const WINDOW_CLEAR = 45; // tall pieces (wardrobes, fridges) do not stand in front of windows
const TALL = new Set(['wardrobe', 'fridge']);

const overlap = (a, b) =>
  Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
const grow = (r, m) => [r[0] - m, r[1] - m, r[2] + 2 * m, r[3] + 2 * m];
/** True when every point of r (sampled every 5 cm, edges included) lies in one of the rects. */
export function insideUnion(r, rects) {
  const xs = [];
  const ys = [];
  for (let x = r[0]; x < r[0] + r[2]; x += 5) xs.push(x + 0.5);
  xs.push(r[0] + r[2] - 0.5);
  for (let y = r[1]; y < r[1] + r[3]; y += 5) ys.push(y + 0.5);
  ys.push(r[1] + r[3] - 0.5);
  return xs.every((x) => ys.every((y) => rects.some((q) => x >= q[0] && y >= q[1] && x <= q[0] + q[2] && y <= q[1] + q[3])));
}
const bboxOf = (rects) => {
  const x0 = Math.min(...rects.map((q) => q[0]));
  const y0 = Math.min(...rects.map((q) => q[1]));
  return [x0, y0, Math.max(...rects.map((q) => q[0] + q[2])) - x0, Math.max(...rects.map((q) => q[1] + q[3])) - y0];
};
const largest = (rects) => rects.reduce((m, r) => (r[2] * r[3] > m[2] * m[3] ? r : m));

/** The opening's rectangle pushed out by `d` cm on both faces of its wall. */
function zone(o, d) {
  const [x, y, w, h] = o.rect;
  return w >= h ? [x - 5, y - d, w + 10, h + 2 * d] : [x - d, y - 5, w + 2 * d, h + 10];
}

/** The item's rectangle for a placement against side `s` of R at offset t along that side. */
function along(R, s, t, len, dep) {
  const [x, y, w, h] = R;
  if (s === 'n') return [x + t, y, len, dep];
  if (s === 's') return [x + t, y + h - dep, len, dep];
  if (s === 'w') return [x, y + t, dep, len];
  return [x + w - dep, y + t, dep, len];
}
const sideLen = (R, s) => (s === 'n' || s === 's' ? R[2] : R[3]);
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };

/** A thin band just behind `r` on side s (to test that a wall backs it). */
function behind(r, s) {
  const [x, y, w, h] = r;
  if (s === 'n') return [x, y - 8, w, 8];
  if (s === 's') return [x, y + h, w, 8];
  if (s === 'w') return [x - 8, y, 8, h];
  return [x + w, y, 8, h];
}

export function furnish(spec, opts = {}) {
  const out = [];
  if (opts.none) return out;
  const solids = [...spec.walls, ...spec.openings.map((o) => o.rect)];
  const doorZones = spec.openings
    .filter((o) => o.kind === 'door' || o.kind === 'entrance' || o.kind === 'slider')
    .map((o) => zone(o, o.kind === 'slider' ? SLIDER_CLEAR : DOOR_CLEAR));
  const windowZones = spec.openings.filter((o) => o.kind === 'window').map((o) => zone(o, WINDOW_CLEAR));
  const windows = spec.openings.filter((o) => o.kind === 'window').map((o) => o.rect);

  const free = (r, kind, room) => {
    if (!insideUnion(r, room.rects)) return false;
    if (solids.some((s) => overlap(r, s) > 0)) return false;
    if (doorZones.some((z) => overlap(r, z) > 0)) return false;
    if (TALL.has(kind) && windowZones.some((z) => overlap(r, z) > 0)) return false;
    return !out.some((f) => overlap(grow(f.rect, 5), r) > 0);
  };

  /**
   * Against a wall: tries the room's rectangles (largest first), then the sizes and sides in
   * order, positions nearest the preferred spot first. Low pieces may also stand under a window.
   */
  const wallPlace = (room, kind, sizes, { sides = ['n', 'e', 's', 'w'], prefer = 'center', near = null } = {}) => {
    const backing = TALL.has(kind) ? spec.walls : [...spec.walls, ...windows];
    const backArea = (r) => backing.reduce((s, w) => s + overlap(r, w), 0);
    const rects = [bboxOf(room.rects), ...[...room.rects].sort((p, q) => q[2] * q[3] - p[2] * p[3])];
    for (const [len, dep] of sizes)
      for (const R of rects)
        for (const s of sides) {
          const L = sideLen(R, s);
          const across = s === 'n' || s === 's' ? R[3] : R[2];
          if (L < len || across < dep) continue;
          const ts = [];
          for (let t = 0; t <= L - len; t += 5) ts.push(t);
          if (!ts.includes(L - len)) ts.push(L - len);
          const key = (t) => {
            const r = along(R, s, t, len, dep);
            if (near) return Math.hypot(r[0] + r[2] / 2 - near[0], r[1] + r[3] / 2 - near[1]);
            return prefer === 'end' ? Math.min(t, L - len - t) : Math.abs(t - (L - len) / 2);
          };
          ts.sort((a, b) => key(a) - key(b));
          for (const t of ts) {
            const r = along(R, s, t, len, dep).map(Math.round);
            if (!free(r, kind, room)) continue;
            const back = behind(r, s);
            if (backArea(back) < back[2] * back[3] * 0.6) continue; // a wall (or window) behind it
            const f = { kind, rect: r, side: s };
            out.push(f);
            return f;
          }
        }
    return null;
  };

  /** Free-standing (tables): the free spot nearest `target`, with `margin` cm around it. */
  const freePlace = (room, kind, [w, h], target, margin = 60) => {
    const R = largest(room.rects);
    let best = null;
    let bd = Infinity;
    for (const [ww, hh] of [
      [w, h],
      [h, w],
    ])
      for (let x = R[0]; x + ww <= R[0] + R[2]; x += 5)
        for (let y = R[1]; y + hh <= R[1] + R[3]; y += 5) {
          const r = [x, y, ww, hh];
          if (!free(r, kind, room) || solids.some((s) => overlap(grow(r, margin), s) > 0)) continue;
          if (doorZones.some((z) => overlap(grow(r, margin / 2), z) > 0)) continue;
          if (out.some((f) => overlap(grow(f.rect, margin), r) > 0)) continue;
          const d = Math.hypot(x + ww / 2 - target[0], y + hh / 2 - target[1]);
          if (d < bd) {
            bd = d;
            best = r;
          }
        }
    if (!best) return null;
    const f = { kind, rect: best };
    out.push(f);
    return f;
  };

  const centre = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];
  const seedOf = (room, re) => room.anchors?.find((a) => re.test(a[2]))?.slice(0, 2) ?? null;

  for (const room of spec.rooms) {
    const R = largest(room.rects);
    const names = room.label;
    switch (room.type) {
      case 'master':
        wallPlace(room, 'bed-double', [[160, 200], [140, 190], [120, 190]]);
        wallPlace(room, 'wardrobe', [[240, 60], [180, 60], [120, 60]], { prefer: 'end' });
        break;
      case 'bed':
      case 'mamad':
        wallPlace(room, 'bed-single', [[90, 190], [80, 180]], { prefer: 'end' });
        wallPlace(room, 'wardrobe', [[160, 60], [120, 60], [90, 55]], { prefer: 'end' });
        wallPlace(room, 'desk', [[120, 60], [100, 55]], { prefer: 'end' });
        break;
      case 'salon':
      case 'kitchen':
      case 'dining': {
        const hasKitchen = room.type === 'kitchen' || /מטבח/.test(names);
        const hasDining = room.type === 'dining' || /אוכל/.test(names);
        const hasSalon = room.type === 'salon';
        if (hasKitchen) {
          const near = seedOf(room, /מטבח/) ?? (room.type === 'kitchen' ? centre(R) : null);
          const c = wallPlace(room, 'counter', [[300, 60], [240, 60], [180, 60], [120, 60]], { near });
          if (c) wallPlace(room, 'fridge', [[70, 70]], { near: centre(c.rect) });
        }
        if (hasSalon) {
          const near = seedOf(room, /סלון|דיור/) ?? centre(R);
          let sofa = wallPlace(room, 'sofa', [[220, 90], [180, 85], [150, 80]], { near });
          if (!sofa) {
            // open plan with glazing all round: a free-standing sofa, back to the room
            const p = freePlace(room, 'sofa', [200, 90], near, 40);
            if (p && p.rect[2] >= p.rect[3]) sofa = Object.assign(p, { side: 'n' });
            else if (p) sofa = Object.assign(p, { side: 'w' });
          }
          if (sofa) {
            const [x, y, w, h] = sofa.rect;
            const ct =
              sofa.side === 'n' ? [x + w / 2 - 55, y + h + 40, 110, 55]
              : sofa.side === 's' ? [x + w / 2 - 55, y - 40 - 55, 110, 55]
              : sofa.side === 'w' ? [x + w + 40, y + h / 2 - 55, 55, 110]
              : [x - 40 - 55, y + h / 2 - 55, 55, 110];
            if (free(ct, 'coffee-table', room)) out.push({ kind: 'coffee-table', rect: ct.map(Math.round) });
            wallPlace(room, 'tv', [[160, 40], [120, 40]], { sides: [OPP[sofa.side]], near: centre(sofa.rect) });
          }
        }
        if (hasDining) {
          const target = seedOf(room, /אוכל/) ?? centre(R);
          freePlace(room, 'table', [180, 90], target) ?? freePlace(room, 'table', [140, 80], target, 45);
        }
        break;
      }
      case 'bath': {
        const tub = R[2] >= 170 && R[3] >= 150 ? [[170, 75]] : R[3] >= 170 && R[2] >= 150 ? [[170, 75]] : [];
        if (!(tub.length && wallPlace(room, 'bathtub', tub, { prefer: 'end' })))
          wallPlace(room, 'shower', [[90, 90], [80, 80]], { prefer: 'end' });
        wallPlace(room, 'toilet', [[40, 65]], { prefer: 'end' });
        wallPlace(room, 'sink', [[80, 45], [60, 45], [50, 40]]);
        break;
      }
      case 'wc':
        if (/מקלחת/.test(names)) wallPlace(room, 'shower', [[90, 90], [80, 80]], { prefer: 'end' });
        wallPlace(room, 'toilet', [[40, 65]], { prefer: 'end' });
        wallPlace(room, 'sink', [[50, 40], [40, 35]]);
        break;
      case 'service':
        wallPlace(room, 'washer', [[60, 60]], { prefer: 'end' });
        wallPlace(room, 'washer', [[60, 60]], { prefer: 'end' });
        break;
      default:
        break;
    }
  }
  for (const o of spec.outdoor) {
    if (!['balcony', 'roof-terrace', 'garden'].includes(o.type)) continue;
    const area = o.rects.reduce((s, r) => s + r[2] * r[3], 0) / 1e4;
    if (area >= 6) freePlace(o, 'table', [120, 80], centre(largest(o.rects)), 50);
  }
  return out;
}
