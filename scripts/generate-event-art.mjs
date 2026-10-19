import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const W = 1200;
const H = 800;
const C = {
  ink: [23, 32, 31], panel: [34, 48, 45], paper: [238, 227, 199],
  ticket: [213, 170, 69], action: [189, 67, 52], success: [79, 128, 103],
  border: [111, 127, 121], white: [255, 250, 240],
};
const pixels = Buffer.alloc(W * H * 3);
let seed = 1;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }
function dot(x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  pixels[i] = color[0]; pixels[i + 1] = color[1]; pixels[i + 2] = color[2];
}
function rect(x, y, w, h, color) {
  for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(H, y + h); yy++)
    for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(W, x + w); xx++) dot(xx, yy, color);
}
function circle(cx, cy, radius, color) {
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(H, cy + radius); y++) {
    const spread = Math.sqrt(Math.max(0, radius ** 2 - (y - cy) ** 2));
    rect(cx - spread, y, spread * 2, 1, color);
  }
}
function line(x1, y1, x2, y2, width, color) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color);
  }
}
function poly(points, color) {
  const ys = points.map((point) => point[1]);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(H, Math.ceil(Math.max(...ys))); y++) {
    const crossings = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i]; const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) crossings.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) rect(crossings[i], y, crossings[i + 1] - crossings[i], 1, color);
  }
}
function ring(x, y, outer, inner, color, center = C.paper) { circle(x, y, outer, color); circle(x, y, inner, center); }
function base(id) {
  seed = 1000 + id * 919;
  rect(0, 0, W, H, C.paper);
  rect(0, 0, W, 26, C.ink); rect(0, H - 26, W, 26, C.ink);
  rect(42, 54, 17, H - 108, C.action); rect(W - 59, 54, 17, H - 108, C.success);
  for (let i = 0; i < 7; i++) {
    const y = 108 + i * 91;
    circle(50, y, 18, C.ink); circle(W - 50, y, 18, C.ink);
  }
  for (let i = 0; i < 36; i++) {
    const y = 65 + i * 19;
    rect(86, y, 12, 4, C.border); rect(1102, y, 12, 4, C.border);
  }
}
function tracks(y = 646) {
  line(105, y, 1090, y, 15, C.ink); line(105, y + 61, 1090, y + 61, 15, C.ink);
  for (let x = 130; x < 1090; x += 94) rect(x, y - 8, 24, 84, C.ink);
}
function grain() {
  for (let i = 0; i < 115000; i++) {
    const x = Math.floor(random() * W); const y = Math.floor(random() * H);
    const p = (y * W + x) * 3;
    const strength = random() < .5 ? -13 : 10;
    for (let c = 0; c < 3; c++) pixels[p + c] = Math.max(0, Math.min(255, pixels[p + c] + strength));
  }
  for (let i = 0; i < 3200; i++) {
    const x = random() * W; const y = random() * H;
    rect(x, y, 2 + random() * 5, 1, random() < .5 ? C.border : C.white);
  }
}
function classicMarket() {
  tracks(645);
  for (const [x, height] of [[170, 290], [440, 360], [740, 305]]) {
    rect(x, 605 - height, 235, height, C.panel);
    rect(x - 15, 605 - height, 265, 44, C.ticket);
    for (let j = 0; j < 5; j++) poly([[x - 15 + j * 53, 649 - height], [x + 10 + j * 53, 680 - height], [x + 38 + j * 53, 649 - height]], j % 2 ? C.action : C.white);
    rect(x + 26, 605 - height + 96, 183, 90, C.paper);
    for (let j = 0; j < 4; j++) circle(x + 50 + j * 43, 605 - height + 141, 17, j % 2 ? C.action : C.success);
  }
}
function classicHealth() {
  tracks(660);
  rect(240, 145, 700, 500, C.panel); rect(270, 175, 640, 440, C.white);
  rect(510, 225, 130, 320, C.action); rect(415, 320, 320, 130, C.action);
  for (const x of [150, 960]) { rect(x, 370, 95, 210, C.success); circle(x + 47, 330, 57, C.ink); }
  line(290, 590, 890, 590, 18, C.ticket);
}
function classicMoney() {
  tracks(672);
  for (const [x, count] of [[180, 3], [365, 5], [580, 7], [825, 4]]) {
    for (let j = 0; j < count; j++) {
      rect(x, 580 - j * 55, 145, 49, j % 2 ? C.ticket : C.action);
      rect(x + 10, 580 - j * 55, 125, 7, C.ink);
    }
    ring(x + 72, 532 - count * 55, 59, 31, C.ticket, C.ink);
  }
}
function classicSystem() {
  tracks(672);
  rect(125, 185, 950, 95, C.panel); rect(180, 280, 840, 350, C.success);
  for (const x of [220, 455, 690, 925]) {
    rect(x, 300, 52, 280, C.ink); rect(x - 36, 344, 130, 28, C.ticket);
    ring(x + 26, 485, 29, 13, C.white, C.action);
  }
  poly([[180, 630], [1020, 630], [960, 660], [240, 660]], C.action);
}
function modernMarket() {
  tracks(672);
  for (const [x, h] of [[125, 230], [285, 365], [480, 285], [685, 425], [920, 300]]) {
    rect(x, 620 - h, 130, h, C.panel);
    for (let y = 650 - h; y < 595; y += 60) rect(x + 25, y, 38, 28, C.ticket);
  }
  rect(160, 507, 875, 103, C.action); rect(180, 520, 835, 58, C.paper);
  for (let x = 226; x < 990; x += 116) circle(x, 550, 19, x % 2 ? C.success : C.ticket);
}
function modernWeather() {
  tracks(690);
  for (const [x, y, r] of [[295, 250, 108], [450, 210, 132], [630, 258, 118], [825, 220, 150]]) circle(x, y, r, C.panel);
  for (let x = 210; x < 1000; x += 83) {
    for (let y = 400; y < 600; y += 97) line(x + (y % 3) * 9, y, x - 25 + (y % 3) * 9, y + 57, 13, C.success);
  }
  poly([[360, 560], [470, 430], [600, 390], [730, 430], [840, 560]], C.action);
  line(600, 418, 600, 645, 19, C.ink); ring(632, 635, 36, 22, C.ink, C.paper);
}
function modernCredit() {
  tracks(687);
  rect(178, 143, 390, 485, C.panel); rect(205, 173, 336, 419, C.white);
  rect(240, 215, 265, 72, C.ticket); rect(240, 312, 195, 25, C.success);
  for (let i = 0; i < 4; i++) rect(240, 380 + i * 43, 245 - i * 23, 17, C.border);
  poly([[490, 375], [890, 260], [1025, 497], [625, 615]], C.action);
  ring(770, 430, 125, 74, C.ticket, C.panel); circle(770, 430, 35, C.success);
}
function modernIdentity() {
  tracks(680);
  rect(146, 159, 930, 480, C.panel); rect(173, 185, 874, 426, C.white);
  circle(390, 344, 115, C.ink); poly([[220, 560], [250, 457], [320, 432], [460, 432], [530, 457], [562, 560]], C.success);
  rect(630, 260, 340, 32, C.action); rect(630, 327, 278, 25, C.border);
  rect(630, 393, 320, 25, C.ticket); rect(630, 459, 240, 25, C.border);
  for (let x = 650; x < 961; x += 39) rect(x, 530, 18, 48, C.ink);
}

const scenes = [classicMarket, classicHealth, classicMoney, classicSystem,
  modernMarket, modernWeather, modernCredit, modernIdentity];
const names = ['classic-market', 'classic-health', 'classic-money', 'classic-system',
  'modern-market', 'modern-weather', 'modern-credit', 'modern-identity'];
const destination = resolve('public/assets/events');
mkdirSync(destination, { recursive: true });
const temp = mkdtempSync(join(tmpdir(), 'beijing-art-'));
try {
  scenes.forEach((scene, index) => {
    base(index);
    scene();
    grain();
    const ppm = join(temp, `${names[index]}.ppm`);
    writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), pixels]));
    const result = spawnSync('cwebp', ['-quiet', '-q', '86', ppm, '-o', join(destination, `${names[index]}.webp`)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`cwebp failed for ${names[index]}: ${result.stderr}`);
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
