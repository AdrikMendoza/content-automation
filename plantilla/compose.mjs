// Reel template: virtual camera over a 3D board, 3D cards, voice-reactive waveform. Colors, fonts and
// signature come from brand.json (run the "configurar" skill). Script/timings here are only an example.
// flat in a chip, chapter bar, selection tags, word-pop captions. Builds index.html + sfx_cues.json from tiempos.json.
//   node compose.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const T = JSON.parse(fs.readFileSync(path.join(DIR, "tiempos.json"), "utf8"));
const BRAND_FILE = [path.join(DIR, "brand.json"), path.join(DIR, "..", "brand.json"), path.join(DIR, "..", "..", "brand.json")].find((p) => fs.existsSync(p));
const BRAND = JSON.parse(fs.readFileSync(BRAND_FILE, "utf8"));
const K = BRAND.colores;
// the template was drawn with these placeholder colors; every one is swapped for the brand palette at build time
const RECOLOR = { "#3366ff": K.acento, "#99b3ff": K.acento2, "#f5f5f5": K.texto, "#8c8c8c": K.secundario,
  "#0a0a0a": K.fondo, "#08090c": K.fondo, "#0b0c10": K.fondo, "#1a1c24": K.fondo_luz, "#16161a": K.tarjeta, "#1d1d23": K.tarjeta };
const recolor = (s) => s.replace(/#[0-9a-fA-F]{6}\b/g, (h) => RECOLOR[h.toLowerCase()] ?? h);
const P = T.frases.map((f) => ({ a: f.inicio, b: f.fin, t: f.texto_pantalla, w: f.palabras_pantalla }));
if (P.length !== 43) throw new Error(`expected 43 phrases, got ${P.length}`);
const f3 = (n) => (+n).toFixed(3);
const A = (i) => P[i].a, B = (i) => P[i].b;
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const W = (i, word, fb) => { const n = norm(word); const h = P[i].w.find((x) => norm(x.w).startsWith(n)); return h ? h.inicio : (fb ?? A(i)); };
const FPS = 30, COMP = "agente";
const TOTAL = Math.ceil((T.duracion + 1.0) * FPS) / FPS;

// ---------------------------------------------------------------- scenes, camera, transitions
const MAP = [[0, 8], [9, 13], [14, 21], [22, 27], [28, 32], [33, 37], [38, 42]];
const cut = (k) => (B(MAP[k - 1][1]) + A(MAP[k][0])) / 2;
const C = MAP.map((_, k) => (k === 0 ? 0 : cut(k)));
const OV = 0.15;
const sc = MAP.map((_, k) => { const s = k === 0 ? 0 : C[k] - OV; const e = k === MAP.length - 1 ? TOTAL : C[k + 1] + OV; return { s, e, d: e - s }; });
const G = [[0, 0], [0, 1600], [760, 3200], [0, 4800], [-760, 6400], [0, 8000], [0, 9600]];
const TRANS = [null, "travel", "wipe", "travel", "flash", "travel", "wipe"];

const CUES = [];
const cue = (t, kind, gain = 1, p = 0) => CUES.push([+f3(t), kind, gain, p]);
const typeCues = (t0, n, per, gain = 1) => { for (let i = 0; i < n; i++) cue(t0 + i * per, "key", gain); };
const L = [];
const tl = (s) => L.push(s);
const maskIn = (sel, t, stag = 0.14, dur = 0.36) => tl(`tl.fromTo("${sel} .line",{yPercent:110},{yPercent:0,duration:${dur},ease:E,stagger:${stag}},${f3(t)});`);
const maskOut = (sel, t) => tl(`tl.to("${sel} .line",{yPercent:-110,duration:0.18,ease:"power2.in",stagger:0.03},${f3(t)});`);
const showAt = (sel, t) => { tl(`tl.set("${sel}",{autoAlpha:0},0);`); tl(`tl.set("${sel}",{autoAlpha:1},${f3(t)});`); };
const hideAt = (sel, t) => tl(`tl.set("${sel}",{autoAlpha:0},${f3(t)});`);
const fadeUp = (sel, t, y = 50, d = 0.32) => tl(`tl.fromTo("${sel}",{y:${y},opacity:0},{y:0,opacity:1,duration:${d},ease:E},${f3(t)});`);
const off = (sels, t) => { tl(`tl.to(${JSON.stringify(sels)},{opacity:0,duration:0.18,ease:"power2.in"},${f3(t)});`); sels.forEach((s) => hideAt(s, t + 0.2)); };
const blk = (sel, t) => tl(`tl.fromTo("${sel}",{scaleX:0},{scaleX:1,duration:0.26,ease:E},${f3(t)});`);
const draw = (sel, t, d = 0.45) => tl(`tl.fromTo("${sel}",{strokeDashoffset:1},{strokeDashoffset:0,duration:${d},ease:"power2.out",stagger:0.06},${f3(t)});`);
const slam = (sel, t, from = 1.7) => { tl(`tl.fromTo("${sel}",{scale:${from}},{scale:1,duration:0.22,ease:"expo.out"},${f3(t)});`); cue(t, "impact", 0.8); };
const shake = (sel, t, amp = 16) => tl(`tl.to("${sel}",{keyframes:{x:[-${amp},${amp * 0.8},-${amp * 0.55},${amp * 0.35},0]},duration:0.15,ease:"none"},${f3(t)});`);
const punch = (sel, t, s = 1.1, origin = "50% 45%") => {
  tl(`tl.to("${sel}",{scale:${s},duration:0.2,ease:"expo.out",transformOrigin:"${origin}"},${f3(t)});`); shake(sel, t);
  tl(`tl.to("${sel}",{scale:1,duration:0.35,ease:"power2.inOut"},${f3(t + 0.45)});`); cue(t, "impact", 1);
};
const glitch = (sel, t) => {
  tl(`tl.to("${sel}",{textShadow:"6px 0 0 #3366ff, -6px 0 0 #99b3ff",duration:0.03},${f3(t)});`);
  tl(`tl.to("${sel}",{textShadow:"0px 0 0 rgba(0,0,0,0), 0px 0 0 rgba(0,0,0,0)",duration:0.05},${f3(t + 0.09)});`);
};
const card3d = (sel, t, dir = 1) => { tl(`tl.fromTo("${sel}",{z:-1000,rotationX:50,rotationY:${-10 * dir},opacity:0},{z:0,rotationX:5,rotationY:${-4 * dir},opacity:1,duration:0.9,ease:"expo.out"},${f3(t)});`); cue(t, "whoosh", 0.45, 0.2); };
const chipIn = (sel, t) => { tl(`tl.fromTo("${sel}",{z:-800,scale:0.8,opacity:0},{z:0,scale:1,opacity:1,duration:0.7,ease:"expo.out"},${f3(t)});`); cue(t, "pop", 0.7, 900); };
const pillIn = (sel, t) => { tl(`tl.fromTo("${sel}",{scale:0.4,opacity:0},{scale:1,opacity:1,duration:0.3,ease:"expo.out"},${f3(t)});`); cue(t, "pop", 0.6, 1100); };
const camPush = (k) => tl(`tl.fromTo("#cam${k}",{scale:1},{scale:1.04,duration:${f3(sc[k].d)},ease:"none"},${f3(sc[k].s)});`);
const titleCard = (k, phraseTitle) => {
  const tin = sc[k].s + 0.3;
  fadeUp(`#ttl${k} .num`, tin, 20, 0.28); maskIn(`#ttl${k}`, tin + 0.05);
  cue(tin + 0.05, "pop", 0.7, 700); cue(tin + 0.19, "pop", 0.7, 900);
  const tout = B(phraseTitle) + 0.05;
  maskOut(`#ttl${k}`, tout); tl(`tl.to("#ttl${k} .num",{opacity:0,duration:0.15},${f3(tout)});`); hideAt(`#ttl${k}`, tout + 0.25);
  return tout;
};
const D = {};

// camera
tl(`tl.set("#world",{x:${-G[0][0]},y:${-G[0][1]},z:0},0);`); tl(`tl.set("#rig",{rotationX:3,rotationY:0},0);`);
const TR_HTML = [];
for (let k = 1; k < MAP.length; k++) {
  const c = C[k], kind = TRANS[k], prev = k - 1, [gx, gy] = G[k], s = k % 2 ? 1 : -1;
  if (kind === "travel") {
    tl(`tl.to("#world",{x:${-gx},y:${-gy},z:0,duration:0.8,ease:"power3.inOut"},${f3(c - 0.4)});`); tl(`tl.to("#rig",{rotationX:9,rotationY:${5 * s},duration:0.8,ease:"power3.inOut"},${f3(c - 0.4)});`);
    tl(`tl.to("#rig",{rotationX:3,rotationY:${1 * s},duration:0.5,ease:"power2.out"},${f3(c + 0.4)});`);
    tl(`tl.to("#cam${prev}",{opacity:0,duration:0.2},${f3(c - 0.35)});`);
    tl(`tl.set("#cam${k}",{opacity:0},0);`); tl(`tl.to("#cam${k}",{opacity:1,duration:0.25},${f3(c + 0.05)});`);
    cue(c - 0.35, "whoosh", 0.9, 0.45);
  } else {
    if (kind === "wipe") {
      TR_HTML.push(`<div id="wipeL${k}" class="clip" data-start="${f3(c - 0.35)}" data-duration="0.7" data-track-index="${20 + k}"><div class="wipe" id="wipe${k}"></div></div>`);
      tl(`tl.fromTo("#wipe${k}",{x:1300},{x:-2000,duration:0.65,ease:"power3.inOut"},${f3(c - 0.33)});`);
      cue(c - 0.3, "whoosh", 0.9, 0.45);
    } else {
      TR_HTML.push(`<div id="flashL${k}" class="clip" data-start="${f3(c - 0.15)}" data-duration="0.5" data-track-index="${20 + k}"><div class="flash" id="flash${k}"></div></div>`);
      tl(`tl.fromTo("#flash${k}",{opacity:0},{opacity:1,duration:0.1,ease:"none"},${f3(c - 0.1)});`);
      tl(`tl.to("#flash${k}",{opacity:0,duration:0.3,ease:"power2.out"},${f3(c + 0.05)});`);
      cue(c - 0.2, "whoosh", 0.8, 0.4); cue(c, "impact", 0.5);
    }
    tl(`tl.set("#world",{x:${-gx},y:${-gy},z:0},${f3(c)});`); tl(`tl.set("#rig",{rotationX:3,rotationY:0},${f3(c)});`);
    tl(`tl.set("#cam${prev}",{opacity:0},${f3(c)});`);
    tl(`tl.set("#cam${k}",{opacity:0},0);`); tl(`tl.set("#cam${k}",{opacity:1},${f3(c)});`);
  }
}

// chapter bar (scenes 1-5)
const CHAP = ["01 1 AM", "02 VOZ", "03 VIDEO", "04 MÚSICA", "05 REVISOR"];
tl(`tl.fromTo("#chap",{y:-160,opacity:0},{y:0,opacity:1,duration:0.6,ease:"expo.out"},${f3(C[1])});`);
for (let i = 0; i < 5; i++) {
  if (i > 0) { tl(`tl.to("#ind",{x:${i * 176},duration:0.35,ease:"expo.out"},${f3(C[i + 1])});`); cue(C[i + 1] + 0.05, "tick", 0.6); }
  tl(`tl.set("#ch${i}",{color:"#f5f5f5"},${f3(C[i + 1])});`);
  if (i < 4) tl(`tl.set("#ch${i}",{color:"#8c8c8c"},${f3(C[i + 2])});`);
}
tl(`tl.to("#chap",{y:-160,opacity:0,duration:0.3,ease:"power2.in"},${f3(C[6] - 0.3)});`);

// ===== 0: hook
{
  camPush(0);
  maskIn("#h0a", A(0), 0.18, 0.34); cue(A(0), "pop", 0.7, 700); cue(A(0) + 0.18, "pop", 0.7, 900);
  showAt("#no0a", A(1)); fadeUp("#no0a", A(1), 30, 0.25); blk("#st0a", W(1, "grabe", A(1)) + 0.2); cue(W(1, "grabe", A(1)) + 0.2, "click", 0.9);
  showAt("#no0b", A(2)); fadeUp("#no0b", A(2), 30, 0.25); blk("#st0b", W(2, "edite", A(2)) + 0.2); cue(W(2, "edite", A(2)) + 0.2, "click", 0.9);
  const t3 = A(3);
  maskOut("#h0a", t3 - 0.12); hideAt("#h0a", t3 + 0.1); off(["#no0a", "#no0b"], t3 - 0.1);
  showAt("#h0b", t3); slam("#h0b", t3, 1.5);
  showAt("#wave0", t3); card3d("#wave0", t3);
  showAt("#tag0", A(4)); slam("#tag0", A(4), 1.4);
  D.w0 = t3;
  const t6 = A(6);
  off(["#h0b", "#wave0", "#tag0"], t6 - 0.1);
  showAt("#h0c", t6); maskIn("#h0c", t6, 0.12, 0.3); blk("#blk0c", W(6, "tarjeta", t6 + 0.3));
  showAt("#gpu0", t6 + 0.05); card3d("#gpu0", t6 + 0.05, -1);
  tl(`tl.fromTo("#gpu0 .fan",{rotation:0},{rotation:1440,duration:${f3(A(7) - t6)},ease:"power1.in"},${f3(t6)});`);
  const t7 = A(7);
  maskOut("#h0c", t7 - 0.12); hideAt("#h0c", t7 + 0.1); off(["#gpu0"], t7 - 0.1);
  showAt("#h0d", t7); maskIn("#h0d", t7, 0.12, 0.3); blk("#blk0d", W(7, "agente", t7 + 0.3)); cue(W(7, "agente", t7 + 0.3), "impact", 0.7);
  const t8 = A(8);
  showAt("#def0", t8); card3d("#def0", t8);
  ["#dot0", "#dot1", "#dot2", "#dot3", "#dot4"].forEach((d, i) => { const t = W(8, "paso", t8 + 1.6) + i * 0.14; tl(`tl.to("${d}",{backgroundColor:"#f5f5f5",scale:1.25,duration:0.12},${f3(t)});`); tl(`tl.to("${d}",{scale:1,duration:0.2},${f3(t + 0.12)});`); cue(t, "tick", 0.5); });
}

// ===== 1: 1 AM
{
  const k = 1; camPush(k); const tt = titleCard(k, 10);
  const t0 = A(11) - 0.1;
  showAt("#clock1", t0); card3d("#clock1", t0); chipIn("#cchip1", t0 + 0.2);
  D.term1 = t0 + 0.4; typeCues(D.term1, 8, 0.05, 0.6);
  const tS = A(12);
  ["#src1a", "#src1b", "#src1c"].forEach((s, i) => { showAt(s, tS + 0.25 + i * 0.25); pillIn(s, tS + 0.25 + i * 0.25); });
  D.term1b = tS; typeCues(tS, 8, 0.05, 0.5);
  const tG = A(13);
  off(["#clock1", "#cchip1", "#src1a", "#src1b", "#src1c"], tG - 0.08);
  ["#doc1a", "#doc1b", "#doc1c"].forEach((s, i) => { showAt(s, tG + i * 0.12); tl(`tl.fromTo("${s}",{z:-900,rotationX:40,opacity:0},{z:0,rotationX:5,opacity:1,duration:0.7,ease:"expo.out"},${f3(tG + i * 0.12)});`); cue(tG + i * 0.12, "whoosh", 0.35, 0.18); });
  const t3 = W(13, "3", tG + 0.4);
  showAt("#g3x1", t3); slam("#g3x1", t3, 1.8); blk("#blk1", t3 + 0.05);
  void tt;
}

// ===== 2: la voz
{
  const k = 2; camPush(k); titleCard(k, 15);
  const t0 = A(16) - 0.05;
  showAt("#hchip2", t0); chipIn("#hchip2", t0);
  showAt("#wa2", t0 + 0.15); card3d("#wa2", t0 + 0.15);
  D.wa0 = t0 + 0.3; D.wa1 = W(16, "segundos", t0 + 1.5) + 0.4;
  const tC = A(17);
  showAt("#wb2", tC); card3d("#wb2", tC, -1); cue(tC, "ding", 0.7);
  D.wb0 = tC; D.wbRobot = A(18); D.wbPause = A(19); D.wbEnergy = W(20, "energia", A(20));
  shake("#wb2", D.wbRobot, 14); cue(D.wbRobot, "buzz", 0.8); glitch("#wbtag2", D.wbRobot);
  cue(D.wbPause, "click", 0.8); cue(D.wbEnergy, "impact", 0.6);
  const tA = A(21);
  off(["#hchip2", "#wa2"], tA - 0.08);
  showAt("#asi2", tA); slam("#asi2", tA, 2.0); blk("#blk2", tA + 0.03); punch("#punch2", tA + 0.02, 1.1);
}

// ===== 3: el video
const CODE = ["// compose.mjs", "slam(\"#hook\", 0.08);", "cue(0.08, \"whoosh\");", "caption(\"¿Este video?\");"];
{
  const k = 3; camPush(k); titleCard(k, 23);
  const t0 = A(24) - 0.05;
  showAt("#code3", t0); card3d("#code3", t0);
  D.code0 = t0 + 0.3; D.codePer = 0.022; typeCues(D.code0, 24, 0.05, 0.5);
  [["#p3a", "animaciones"], ["#p3b", "efectos"], ["#p3c", "subtitulos"]].forEach(([s, w], i) => { const t = W(24, w, t0 + i * 0.5); showAt(s, t); pillIn(s, t); });
  const tT = A(25);
  showAt("#todo3", tT); slam("#todo3", tT, 1.6); blk("#blk3", W(25, "codigo", tT + 0.4));
  const tK = A(26);
  off(["#code3", "#p3a", "#p3b", "#p3c", "#todo3"], tK - 0.08);
  showAt("#kar3", tK);
  P[26].w.forEach((w, i) => tl(`tl.fromTo("#kw${i}",{opacity:0,y:40,scale:0.7},{opacity:1,y:0,scale:1,duration:0.22,ease:"expo.out"},${f3(w.inicio)});`));
  const tE = A(27);
  off(["#kar3"], tE - 0.08);
  showAt("#como3", tE); fadeUp("#como3", tE, 30, 0.22);
  const tEs = W(27, "esta", tE + 0.3);
  showAt("#esta3", tEs); tl(`tl.set("#esta3",{transformOrigin:"0% 50%"},0);`); slam("#esta3", tEs, 1.8); blk("#blk3b", tEs + 0.03); punch("#punch3", tEs + 0.02, 1.08, "10% 40%");
}

// ===== 4: la música
{
  const k = 4; camPush(k); titleCard(k, 29);
  const t0 = A(30) - 0.05;
  showAt("#play4", t0); card3d("#play4", t0, -1);
  D.pl0 = t0 + 0.2; D.famosa = A(31); D.mute = W(32, "silencia", A(32) + 0.6);
  const tCp = W(30, "copyright", t0 + 0.8);
  showAt("#libre4", tCp); slam("#libre4", tCp, 1.5);
  hideAt("#libre4", D.famosa); cue(D.famosa, "click", 0.8);
  showAt("#mute4", D.mute); slam("#mute4", D.mute, 1.8); shake("#play4", D.mute, 14); cue(D.mute, "buzz", 0.9);
  showAt("#mtag4", D.mute + 0.15); slam("#mtag4", D.mute + 0.15, 1.4);
}

// ===== 5: el revisor
{
  const k = 5; camPush(k); titleCard(k, 34);
  const t0 = A(35) - 0.05;
  showAt("#chk5", t0); card3d("#chk5", t0);
  [["#ck5a", "textos"], ["#ck5b", "volumen"], ["#ck5c", "colores"]].forEach(([s, w], i) => { const t = W(35, w, t0 + 0.3 + i * 0.6) + 0.15; draw(`${s} path`, t, 0.3); cue(t, "tick", 0.7); });
  D.fail = A(36) + 0.1; D.fix = W(37, "vuelve", A(37) + 0.8);
  tl(`tl.to("#ck5a path",{opacity:0,duration:0.05},${f3(D.fail)});`);
  showAt("#x5", D.fail); slam("#x5", D.fail, 1.6); shake("#chk5", D.fail, 16); cue(D.fail, "buzz", 1);
  showAt("#ftag5", D.fail + 0.1); slam("#ftag5", D.fail + 0.1, 1.4);
  const tF = A(37);
  showAt("#cchip5", tF); chipIn("#cchip5", tF);
  hideAt("#x5", D.fix); hideAt("#ftag5", D.fix); tl(`tl.to("#ck5a path",{opacity:1,duration:0.05},${f3(D.fix)});`); draw("#ck5a path", D.fix, 0.3); cue(D.fix, "ding", 1);
  showAt("#otag5", D.fix + 0.05); slam("#otag5", D.fix + 0.05, 1.4);
}

// ===== 6: closer
{
  const k = 6; camPush(k);
  const tM = A(38);
  showAt("#am6", tM); fadeUp("#am6", tM, 30, 0.3);
  ["#v6a", "#v6b", "#v6c"].forEach((s, i) => { showAt(s, tM + 0.1 + i * 0.15); tl(`tl.fromTo("${s}",{z:-900,rotationX:40,opacity:0},{z:0,rotationX:5,opacity:1,duration:0.7,ease:"expo.out"},${f3(tM + 0.1 + i * 0.15)});`); cue(tM + 0.1 + i * 0.15, "whoosh", 0.35, 0.2); });
  const t3 = W(39, "videos", A(39) + 0.5);
  showAt("#ready6", t3); slam("#ready6", t3, 1.4);
  const tC = A(40);
  off(["#am6", "#v6a", "#v6b", "#v6c", "#ready6"], tC - 0.08);
  showAt("#closer1", tC); maskIn("#closer1", tC, 0.16); [0, 0.16, 0.32].forEach((d, i) => cue(tC + d, "pop", 0.6, 650 + i * 150));
  const t2 = A(41);
  maskOut("#closer1", t2 - 0.2); hideAt("#closer1", t2 + 0.02); cue(t2 - 0.2, "whoosh", 0.5, 0.2);
  showAt("#closer2", t2); maskIn("#closer2", t2, 0.12, 0.28);
  const tCu = W(41, "cual", t2 + 0.5); blk("#blk6", tCu); punch("#punch6", W(41, "sube", tCu + 0.4), 1.1, "30% 50%");
  const tCta = A(42);
  fadeUp("#follow6", tCta, 30, 0.3); cue(tCta, "pop", 0.6, 1300);
  tl(`tl.fromTo("#sig6",{opacity:0,x:-20},{opacity:1,x:0,duration:0.3,ease:E},${f3(tCta + 0.25)});`);
  const bf = tCta + 0.25, bn = Math.max(2, Math.floor((TOTAL - bf) / 0.53));
  tl(`tl.fromTo("#bcur6",{opacity:1},{opacity:0,duration:${f3(bn * 0.53)},ease:"steps(${bn})"},${f3(bf)});`);
}

// ---------------------------------------------------------------- captions (84 px, one line, words pop in)
const SCENE_FIRST = new Set(MAP.map(([a]) => a));
const words = P.flatMap((p, pi) => p.w.map((w, wi) => ({ ...w, pi, sceneStart: wi === 0 && SCENE_FIRST.has(pi) })));
const chunks = []; let cur = [];
for (let i = 0; i < words.length; i++) {
  const w = words[i], len = cur.map((x) => x.w).join(" ").length + w.w.length + 1;
  if (cur.length && (cur.length >= 4 || len > 19 || w.sceneStart)) { chunks.push(cur); cur = []; }
  cur.push(w);
  const next = words[i + 1];
  if (/[.?!…:]["”]?$/.test(w.w) && next && (cur.length >= 2 || next.inicio - w.fin > 0.3)) { chunks.push(cur); cur = []; }
}
if (cur.length) chunks.push(cur);
// no captions while the big karaoke line of scene 3 is on screen (it already shows every word)
const KAR = [A(26) - 0.05, B(27) + 0.05];
const CAPS = chunks.map((c, i) => ({ s: c[0].inicio - 0.03, e: i + 1 < chunks.length ? chunks[i + 1][0].inicio - 0.03 : Math.min(TOTAL - 0.1, c[c.length - 1].fin + 0.6), words: c.map((x) => ({ w: x.w, t: x.inicio })) }))
  .filter((c) => !(c.words[0].t >= KAR[0] && c.words[0].t <= KAR[1]));
const capsEnd = CAPS[CAPS.length - 1].e;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
for (const [i, c] of CAPS.entries()) {
  tl(`tl.set("#cap${i}",{autoAlpha:0},0);`); tl(`tl.set("#cap${i}",{autoAlpha:1},${f3(c.s)});`);
  c.words.forEach((w, k) => {
    const sel = `#cap${i} .w:nth-child(${k + 1})`, end = k + 1 < c.words.length ? c.words[k + 1].t : Math.min(c.e, w.t + 0.6);
    tl(`tl.fromTo("${sel}",{opacity:0,y:40,scale:0.6},{opacity:1,y:0,scale:1,duration:0.3,ease:"expo.out"},${f3(w.t)});`);
    tl(`tl.set("${sel}",{color:"#3366ff"},${f3(w.t)});`); tl(`tl.set("${sel}",{color:"#f5f5f5"},${f3(end)});`);
  });
  tl(`tl.set("#cap${i}",{autoAlpha:0},${f3(Math.min(c.e, c.words[0].t < KAR[0] && c.e > KAR[0] ? KAR[0] : c.e))});`);
}

// ---------------------------------------------------------------- HTML
const chipLogo = (id, logo, name, style) => `<div class="chip3" id="${id}" style="${style}"><div class="tile"><img src="assets/logos/${logo}" alt=""></div><div class="nm mono">${name}</div></div>`;
const chipIni = (id, ini, name, style) => `<div class="chip3" id="${id}" style="${style}"><div class="tile"><span class="ini">${ini}</span></div><div class="nm mono">${name}</div></div>`;
const bars = (id, n) => `<div class="bars" id="${id}">${Array.from({ length: n }, () => `<i></i>`).join("")}</div>`;
const check = (id) => `<svg class="ck" id="${id}" width="44" height="44" viewBox="0 0 44 44"><path pathLength="1" d="M8 23 L18 33 L36 12" fill="none" stroke="#99b3ff" stroke-width="6" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
const grp = (k, inner) => `<div class="grp" id="g${k}" style="left:${G[k][0]}px;top:${G[k][1]}px">${inner}</div>`;
const doc = (id, n, x, rot) => `<div class="card doc" id="${id}" style="left:${x}px;top:-260px;transform:rotate(${rot}deg)"><div class="mono dh">guion_${n}.txt</div><div class="dl"></div><div class="dl"></div><div class="dl s"></div><div class="dl"></div><div class="dl s"></div></div>`;
const vid = (id, n, x) => `<div class="card vid" id="${id}" style="left:${x}px;top:-300px"><div class="mono vh">reel_${n}.mp4</div><div class="vt"></div><div class="vt s"></div><div class="vplay"></div></div>`;
const WORLD = [
  grp(0, `<div class="card wave" id="wave0" style="left:-420px;top:-130px;width:840px"><div class="mono wh">voz.wav</div>${bars("wv0", 36)}</div>
    <div class="tag" id="tag0" style="left:120px;top:-200px">NO LA GRABÉ</div>
    <div class="card gpu" id="gpu0" style="left:-400px;top:-140px;width:800px;height:300px"><div class="fan" style="left:70px"><i></i><i></i><i></i></div><div class="fan" style="left:430px"><i></i><i></i><i></i></div><div class="mono gl">TARJETA GRÁFICA</div></div>
    <div class="card def" id="def0" style="left:-420px;top:-30px;width:840px"><div class="mono dk">a·gen·te</div><div class="dd">Una IA que trabaja sola, paso por paso.</div><div class="dots"><i id="dot0"></i><i id="dot1"></i><i id="dot2"></i><i id="dot3"></i><i id="dot4"></i></div></div>`),
  grp(1, `<div class="card term" id="clock1" style="left:-430px;top:-560px;width:860px"><div class="clk mono">01:00<span>AM</span></div>
      <div class="tl mono"><span class="pr">$</span> <span id="term1"></span></div><div class="tl mono"><span class="pr">$</span> <span id="term1b"></span></div></div>
    ${chipIni("cchip1", "C", "CLAUDE", "left:250px;top:-760px;transform:scale(0.8);transform-origin:50% 0")}
    <div class="src mono" id="src1a" style="left:-430px;top:20px">NOTICIAS</div><div class="src mono" id="src1b" style="left:-140px;top:20px">YOUTUBE</div><div class="src mono" id="src1c" style="left:150px;top:20px">TIKTOK</div>
    ${doc("doc1a", 1, -470, -6)}${doc("doc1b", 2, -150, 0)}${doc("doc1c", 3, 170, 6)}`),
  grp(2, `${chipIni("hchip2", "HF", "HUGGING FACE", "left:-430px;top:-610px;transform:scale(0.8);transform-origin:50% 0")}
    <div class="card wave" id="wa2" style="left:-430px;top:-330px;width:860px"><div class="mono wh">muestra.wav <span class="cnt" id="cnt2">0:00</span></div>${bars("wva", 36)}</div>
    <div class="card wave" id="wb2" style="left:-430px;top:-30px;width:860px"><div class="mono wh">clon.wav</div>${bars("wvb", 36)}<div class="tag" id="wbtag2" style="right:30px;top:-30px">CLON</div></div>`),
  grp(3, `<div class="card code" id="code3" style="left:-450px;top:-300px;width:900px"><div class="mono ch">compose.mjs</div><div class="cl mono"><span id="c0" class="cm"></span></div><div class="cl mono"><span id="c1"></span></div><div class="cl mono"><span id="c2"></span></div><div class="cl mono"><span id="c3"></span></div></div>
    <div class="src mono" id="p3a" style="left:-450px;top:120px">ANIMACIONES</div><div class="src mono" id="p3b" style="left:-90px;top:120px">EFECTOS</div><div class="src mono" id="p3c" style="left:200px;top:120px">SUBTÍTULOS</div>`),
  grp(4, `<div class="card play" id="play4" style="left:-430px;top:-330px;width:860px"><div class="mono ph">musica.json</div>
      <div class="trk" id="trk4">Pista libre</div><div class="art mono" id="art4">mood: hype · licencia libre</div>
      <div class="prog"><i id="pbar4"></i></div>${bars("wvp", 30)}
      <svg class="mute" id="mute4" viewBox="0 0 120 120"><path d="M18 45 H40 L66 22 V98 L40 75 H18 Z" fill="#f5f5f5"/><path d="M82 44 L108 76 M108 44 L82 76" stroke="#3366ff" stroke-width="10" stroke-linecap="round"/></svg></div>
    <div class="tag" id="libre4" style="left:90px;top:-400px">SIN COPYRIGHT</div><div class="tag" id="mtag4" style="left:90px;top:-400px">AUDIO SILENCIADO</div>`),
  grp(5, `<div class="card chk" id="chk5" style="left:-430px;top:-300px;width:860px"><div class="mono ph">revisor</div>
      <div class="row"><span>Textos cortados</span>${check("ck5a")}<span class="x mono" id="x5">FALLA</span></div>
      <div class="row"><span>Volumen −14 LUFS</span>${check("ck5b")}</div>
      <div class="row"><span>Colores de marca</span>${check("ck5c")}</div></div>
    <div class="tag" id="ftag5" style="left:60px;top:-370px">TEXTO CORTADO</div><div class="tag ok" id="otag5" style="left:60px;top:-370px">INTENTO 2: OK</div>
    ${chipIni("cchip5", "C", "CLAUDE", "left:-90px;top:140px;transform:scale(0.8);transform-origin:50% 0")}`),
  grp(6, `${vid("v6a", 1, -460)}${vid("v6b", 2, -140)}${vid("v6c", 3, 180)}<div class="tag" id="ready6" style="left:-120px;top:240px">3 LISTOS</div>`),
];
const ttl = (k, l1, l2) => `<div class="ttl" id="ttl${k}"><div class="num mono">PASO 0${k}/05</div><span class="mask"><span class="line">${l1}</span></span><span class="mask"><span class="line">${l2}</span></span></div>`;
const front = (k, inner) => `<div id="scene${k}" class="clip" data-start="${f3(sc[k].s)}" data-duration="${f3(sc[k].d)}" data-track-index="${k + 2}"><div class="cam" id="cam${k}"><div class="punch" id="punch${k}">${inner}</div></div></div>`;
const karaoke = P[26].w.map((w, i) => `<span class="kw" id="kw${i}">${esc(w.w)}</span>`).join(" ");
const FRONT = [
  front(0, `<div class="hook" id="h0a"><span class="mask"><span class="line">¿Este</span></span><span class="mask"><span class="line">video?</span></span></div>
    <div class="no" id="no0a" style="top:720px"><span class="st">No lo grabé.<span class="sk" id="st0a"></span></span></div>
    <div class="no" id="no0b" style="top:820px"><span class="st">No lo edité.<span class="sk" id="st0b"></span></span></div>
    <div class="hook hollow" id="h0b">¿Y esta<br>voz?</div>
    <div class="hook sm" id="h0c"><span class="mask"><span class="line">La hizo mi</span></span><span class="mask"><span class="line"><span class="hl"><span class="blk" id="blk0c"></span>tarjeta</span></span></span><span class="mask"><span class="line">gráfica.</span></span></div>
    <div class="hook sm" id="h0d"><span class="mask"><span class="line">Un <span class="hl"><span class="blk" id="blk0d"></span>agente</span></span></span><span class="mask"><span class="line">que armé yo.</span></span></div>`),
  front(1, `${ttl(1, "La 1 de", "la mañana.")}<div class="slam" id="g3x1" style="top:380px"><span class="hl"><span class="blk" id="blk1"></span>3</span> guiones.</div>`),
  front(2, `${ttl(2, "La", "voz.")}<div class="slam big2x" id="asi2" style="top:420px"><span class="hl"><span class="blk" id="blk2"></span>¡Así!</span></div>`),
  front(3, `${ttl(3, "El", "video.")}<div class="slam" id="todo3" style="top:330px;font-size:120px">Todo es <span class="hl"><span class="blk" id="blk3"></span>código.</span></div>
    <div class="kar" id="kar3">${karaoke}</div>
    <div class="como" id="como3">como</div><div class="esta" id="esta3"><span class="hl"><span class="blk" id="blk3b"></span>esta.</span></div>`),
  front(4, `${ttl(4, "La", "música.")}`),
  front(5, `${ttl(5, "El", "revisor.")}`),
  front(6, `<div class="am mono" id="am6">EN LA MAÑANA…</div>
    <div class="closer" id="closer1"><span class="mask"><span class="line">La IA hace</span></span><span class="mask"><span class="line">el trabajo</span></span><span class="mask"><span class="line">pesado…</span></span></div>
    <div class="closer" id="closer2"><span class="mask"><span class="line">¡Y tú eliges</span></span><span class="mask"><span class="line"><span class="hl"><span class="blk" id="blk6"></span>cuál sube!</span></span></span></div>
    <div class="follow mono" id="follow6">${BRAND.cta}</div><div class="sig" id="sig6">${BRAND.nombre}<span id="bcur6"></span></div>`),
];
const HIDDEN = ["#no0a", "#no0b", "#h0b", "#h0c", "#h0d", "#wave0", "#tag0", "#gpu0", "#def0", "#clock1", "#cchip1", "#src1a", "#src1b", "#src1c", "#doc1a", "#doc1b", "#doc1c", "#g3x1",
  "#hchip2", "#wa2", "#wb2", "#asi2", "#code3", "#p3a", "#p3b", "#p3c", "#todo3", "#kar3", "#como3", "#esta3", "#play4", "#libre4", "#mute4", "#mtag4",
  "#chk5", "#x5", "#ftag5", "#otag5", "#cchip5", "#am6", "#v6a", "#v6b", "#v6c", "#ready6", "#closer1", "#closer2"];
const capHTML = CAPS.map((c, i) => `<div class="cap" id="cap${i}">${c.words.map((x) => `<span class="w">${esc(x.w)}</span>`).join(" ")}</div>`).join("\n        ");

const html = `<!doctype html>
<html lang="es" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <!-- GENERATED by compose.mjs from tiempos.json. Edit compose.mjs and re-run: node compose.mjs -->
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face { font-family:"Inter"; font-weight:600; src:url("assets/fonts/titulo-600.woff2") format("woff2"); }
      @font-face { font-family:"Inter"; font-weight:700; src:url("assets/fonts/titulo-700.woff2") format("woff2"); }
      @font-face { font-family:"Inter"; font-weight:900; src:url("assets/fonts/titulo-700.woff2") format("woff2"); }
      @font-face { font-family:"InterTight"; font-weight:600; src:url("assets/fonts/cifras-600.woff2") format("woff2"); }
      @font-face { font-family:"JBM"; font-weight:500; src:url("assets/fonts/mono-500.woff2") format("woff2"); }
      @font-face { font-family:"JBM"; font-weight:700; src:url("assets/fonts/mono-700.woff2") format("woff2"); }
      :root { --bg:#0a0a0a; --ink:#f5f5f5; --acc:#3366ff; --acc2:#99b3ff; --gray:#8c8c8c; --card:#16161a; }
      * { margin:0; padding:0; box-sizing:border-box; }
      html, body { width:1080px; height:1920px; overflow:hidden; background:var(--bg); }
      #root { position:relative; width:1080px; height:1920px; overflow:hidden; font-family:"Inter",sans-serif; color:var(--ink); background:#08090c; }
      .clip { position:absolute; inset:0; }
      .mono { font-family:"JBM",monospace; }
      #grain { position:absolute; inset:0; background:radial-gradient(110% 45% at 50% 0%,#1a1c24 0%,#0b0c10 55%,#08090c 100%); }
      #grain::before { content:""; position:absolute; left:560px; top:700px; width:900px; height:900px; border-radius:50%; background:radial-gradient(circle,rgba(120,140,255,.06),transparent 65%); }
      #grain::after { content:""; position:absolute; inset:0; background:radial-gradient(ellipse 75% 60% at 50% 45%,transparent 55%,rgba(0,0,0,.55) 100%); }
      .stage { position:absolute; inset:0; perspective:1900px; perspective-origin:50% 50%; }
      .rig { position:absolute; left:540px; top:960px; width:0; height:0; transform-style:preserve-3d; transform-origin:0 0; }
      .world { position:absolute; left:0; top:0; width:0; height:0; transform-style:preserve-3d; transform-origin:0 0; }
      .grp { position:absolute; width:0; height:0; transform-style:preserve-3d; }
      .card { position:absolute; background:var(--card); border:1px solid rgba(255,255,255,0.08); border-radius:28px; box-shadow:0 30px 60px rgba(0,0,0,0.45); }
      .cam, .punch { position:absolute; inset:0; }
      .mask { display:block; overflow:hidden; padding:6px 0; }
      .line { display:block; position:relative; }
      .hl { position:relative; display:inline-block; z-index:0; padding:0 18px 0 4px; }
      .blk { position:absolute; left:-14px; right:-4px; top:8px; bottom:0; background:var(--acc); transform-origin:left center; transform:scaleX(0); z-index:-1; }
      .tag { position:absolute; background:var(--acc); color:var(--ink); font-family:"JBM",monospace; font-weight:700; font-size:30px; letter-spacing:0.12em; padding:12px 20px; border-radius:8px; white-space:nowrap; }
      .tag.ok { background:var(--ink); color:var(--bg); }
      .chip3 { position:absolute; width:180px; text-align:center; }
      .tile { width:180px; height:180px; border-radius:46px; background:#1D1D23; border:1px solid rgba(255,255,255,0.10); box-shadow:0 30px 60px rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; overflow:hidden; margin:0 auto; }
      .tile img { width:100%; height:100%; object-fit:contain; padding:24%; }
      .tile .ini { font-weight:900; font-size:80px; letter-spacing:-0.04em; }
      .chip3 .nm { margin-top:16px; font-size:24px; letter-spacing:0.14em; color:var(--gray); white-space:nowrap; }
      .src { position:absolute; border:3px solid var(--acc2); color:var(--acc2); padding:14px 24px; border-radius:999px; font-size:30px; font-weight:700; letter-spacing:0.06em; white-space:nowrap; }
      /* hook */
      .hook { position:absolute; left:90px; top:400px; font-weight:900; font-size:150px; line-height:1.0; letter-spacing:-0.035em;  }
      .hook.sm { font-size:124px; top:380px; }
      .hollow { color:#0b0c10; -webkit-text-stroke:10px var(--ink); paint-order:stroke fill; }
      .no { position:absolute; left:90px; font-weight:900; font-size:76px;  letter-spacing:-0.035em; color:var(--gray); }
      .st { position:relative; display:inline-block; } .sk { position:absolute; left:-6px; right:-6px; top:50%; height:10px; background:var(--ink); transform-origin:left center; transform:scaleX(0); }
      .wave { padding:30px 36px; } .wh { font-size:28px; color:var(--gray); margin-bottom:20px; display:flex; justify-content:space-between; } .cnt { color:var(--ink); }
      .bars { display:flex; align-items:center; gap:8px; height:180px; } .bars i { flex:1; height:30%; background:var(--ink); border-radius:6px; }
      .gpu { display:block; } .fan { position:absolute; top:30px; width:240px; height:240px; border-radius:50%; border:6px solid #3a3a42; }
      .fan i { position:absolute; left:50%; top:50%; width:100px; height:34px; margin:-17px 0 0 0; background:#8c8c8c; border-radius:0 30px 30px 0; transform-origin:0 50%; }
      .fan i:nth-child(2) { transform:rotate(120deg); } .fan i:nth-child(3) { transform:rotate(240deg); }
      .gl { position:absolute; right:-10px; bottom:-60px; font-size:28px; color:var(--gray); letter-spacing:0.12em; }
      .def { padding:36px 40px; } .dk { font-size:34px; color:var(--gray); } .dd { font-weight:700; font-size:56px; line-height:1.12; margin-top:12px; }
      .dots { display:flex; gap:20px; margin-top:28px; } .dots i { width:34px; height:34px; border-radius:50%; background:#2a2a30; }
      /* scene 1 */
      .term { padding:40px 44px; } .clk { font-weight:700; font-size:190px; line-height:1; letter-spacing:-0.035em; } .clk span { font-size:56px; color:var(--gray); margin-left:16px; }
      .tl { font-size:32px; margin-top:26px; white-space:pre; height:44px; } .pr { color:var(--acc2); }
      .doc { width:300px; height:400px; padding:26px; } .dh { font-size:24px; color:var(--gray); margin-bottom:26px; }
      .dl { height:16px; border-radius:8px; background:#2e2e35; margin-bottom:20px; } .dl.s { width:60%; }
      /* titles + slams */
      .ttl { position:absolute; left:90px; top:620px; font-weight:900; font-size:132px; line-height:1.0; letter-spacing:-0.035em;  }
      .ttl .num { font-size:36px; font-weight:500; color:var(--gray); letter-spacing:0.08em; margin-bottom:26px; }
      .slam { position:absolute; left:0; right:0; text-align:center; font-weight:900; font-size:150px; line-height:1;  letter-spacing:-0.035em; }
      .big2x { font-size:240px; }
      /* scene 3 */
      .code { padding:30px 40px; } .ch { font-size:26px; color:var(--gray); margin-bottom:18px; } .cl { font-size:34px; line-height:1.8; white-space:pre; height:62px; } .cm { color:var(--gray); }
      .kar { position:absolute; left:90px; right:90px; top:420px; font-weight:900; font-size:112px; line-height:1.05;  letter-spacing:-0.035em; }
      .kw { display:inline-block; opacity:0; }
      .como { position:absolute; left:90px; top:420px; font-weight:900; font-size:96px;  color:var(--gray); }
      .esta { position:absolute; left:100px; top:540px; font-family:"InterTight"; font-weight:600; font-size:250px; line-height:1;  letter-spacing:-0.04em; }
      /* scene 4 */
      .play { padding:34px 40px; } .ph { font-size:26px; color:var(--gray); margin-bottom:18px; }
      .trk { font-weight:700; font-size:64px; } .art { font-size:28px; color:var(--gray); margin-top:8px; }
      .prog { height:12px; border-radius:6px; background:#2a2a30; margin:30px 0; overflow:hidden; } .prog i { display:block; height:100%; width:0; background:var(--ink); }
      .play .bars { height:120px; }
      .mute { position:absolute; right:40px; top:30px; width:150px; height:150px; }
      /* scene 5 */
      .chk { padding:34px 40px; } .chk .row { display:flex; align-items:center; justify-content:space-between; font-size:48px; font-weight:600; padding:22px 0; border-top:1px solid #222; position:relative; }
      .x { position:absolute; right:0; font-size:30px; font-weight:700; color:var(--ink); background:var(--acc); padding:8px 16px; border-radius:8px; }
      /* closer */
      .vid { width:300px; height:520px; padding:22px; } .vh { font-size:22px; color:var(--gray); } .vt { height:26px; border-radius:6px; background:var(--ink); margin-top:200px; } .vt.s { width:60%; margin-top:14px; background:#3a3a42; }
      .vplay { position:absolute; left:50%; top:110px; margin-left:-30px; width:0; height:0; border-left:60px solid #3a3a42; border-top:36px solid transparent; border-bottom:36px solid transparent; }
      .am { position:absolute; left:90px; top:400px; font-size:48px; font-weight:700; color:var(--gray); letter-spacing:0.06em; }
      .closer { position:absolute; left:90px; top:480px; font-weight:900; font-size:136px; line-height:1.0; letter-spacing:-0.035em;  }
      .follow { position:absolute; left:90px; top:1050px; font-size:44px; font-weight:700; color:var(--acc2); letter-spacing:0.04em; opacity:0; } .follow b { color:var(--ink); }
      .sig { position:absolute; left:90px; top:1130px; display:flex; align-items:center; font-weight:900; font-size:56px; letter-spacing:-0.035em; opacity:0; }
      #bcur6 { display:inline-block; width:12px; height:48px; margin-left:8px; background:var(--acc); }
      /* hud, overlays, captions */
      #chap { position:absolute; top:240px; left:92px; width:896px; display:flex; gap:6px; padding:8px; border-radius:999px; background:rgba(19,19,22,0.92); border:1px solid rgba(255,255,255,0.08); opacity:0; }
      #chap .it { position:relative; z-index:1; width:170px; text-align:center; font-size:22px; letter-spacing:0.06em; padding:14px 0; border-radius:999px; color:var(--gray); white-space:nowrap; }
      #ind { position:absolute; left:8px; top:8px; width:170px; height:calc(100% - 16px); border-radius:999px; background:var(--acc); z-index:0; }
      .wipe { position:absolute; top:-200px; left:0; width:1700px; height:2400px; background:var(--acc); transform:translateX(1300px) skewX(-18deg); }
      .flash { position:absolute; inset:0; background:var(--ink); opacity:0; }
      ${HIDDEN.join(", ")} { visibility:hidden; opacity:0; }
      #caps .cap { position:absolute; left:40px; right:40px; top:1370px; text-align:center; font-weight:700; font-size:84px; line-height:1.0; letter-spacing:-0.035em; white-space:nowrap; }
      #caps .w { display:inline-block; margin:0 10px; transform-origin:50% 80%; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${COMP}" data-start="0" data-duration="${f3(TOTAL)}" data-width="1080" data-height="1920" data-fps="30">
      <div id="bg" class="clip" data-start="0" data-duration="${f3(TOTAL)}" data-track-index="0"><div id="grain"></div></div>
      <div id="board" class="clip" data-start="0" data-duration="${f3(TOTAL)}" data-track-index="1" data-layout-allow-overflow>
        <div class="stage"><div class="rig" id="rig"><div class="world" id="world">
          ${WORLD.join("\n          ")}
        </div></div></div>
      </div>
      ${FRONT.join("\n      ")}
      ${TR_HTML.join("\n      ")}
      <div id="hud" class="clip" data-start="${f3(C[1] - OV)}" data-duration="${f3(C[6] + OV - C[1] + OV)}" data-track-index="29">
        <div id="chap" class="mono"><div id="ind"></div>${CHAP.map((c, i) => `<div class="it" id="ch${i}">${c}</div>`).join("")}</div>
      </div>
      <div id="caps" class="clip" data-start="0" data-duration="${f3(capsEnd)}" data-track-index="30">
        ${capHTML}
      </div>
      <audio id="mix" src="assets/mezcla.wav" data-start="0" data-duration="${f3(TOTAL)}" data-track-index="40" data-volume="1"></audio>
    </div>

    <script>
      const D = ${JSON.stringify(D)};
      const tl = gsap.timeline({ paused: true });
      const E = "cubic-bezier(0.16,1,0.3,1)";
      ${HIDDEN.map((s) => `tl.set("${s}",{autoAlpha:0},0);`).join(" ")}

      ${L.join("\n      ")}

      /* procedural parts (seek-safe, deterministic) */
      const CODE = ${JSON.stringify(CODE)};
      const typ = (t, t0, str, per) => t < t0 ? "" : str.slice(0, Math.min(str.length, Math.floor((t - t0) / per) + 1));
      const $ = (s) => document.querySelector(s);
      const B0 = [...document.querySelectorAll("#wv0 i")], BA = [...document.querySelectorAll("#wva i")], BB = [...document.querySelectorAll("#wvb i")], BP = [...document.querySelectorAll("#wvp i")];
      const amp = (i, t) => 0.18 + 0.82 * Math.abs(Math.sin(i * 0.71 + t * 9.3) * Math.sin(i * 0.23 + t * 3.1));
      const setBars = (bs, f) => bs.forEach((b, i) => { b.style.height = (Math.max(0.04, Math.min(1, f(i))) * 100).toFixed(1) + "%"; });
      const fmtS = (s) => "0:" + String(Math.floor(s)).padStart(2, "0");
      function frame(t) {
        setBars(B0, (i) => t >= D.w0 ? amp(i, t) : 0.2);
        // scene 1 terminal
        $("#term1").textContent = typ(t, D.term1, "agente despierta…", 0.05);
        $("#term1b").textContent = typ(t, D.term1b, "buscando temas de IA", 0.05);
        // scene 2 sample + clone
        const ka = Math.min(1, Math.max(0, (t - D.wa0) / (D.wa1 - D.wa0)));
        $("#cnt2").textContent = fmtS(ka * 10) + " / 0:10";
        setBars(BA, (i) => (i / BA.length <= ka ? amp(i, t) : 0.06));
        let tag = "CLON", mode = 0;
        if (t >= D.wbRobot) { tag = "ROBOT"; mode = 1; }
        if (t >= D.wbPause) { tag = "PAUSAS"; mode = 2; }
        if (t >= D.wbEnergy) { tag = "ENERGÍA"; mode = 3; }
        $("#wbtag2").textContent = tag;
        setBars(BB, (i) => {
          if (t < D.wb0) return 0.06;
          if (mode === 1) return 0.35 + 0.3 * (Math.floor(i / 4 + t * 6) % 2);
          if (mode === 2) return (i % 12) < 3 ? 0.04 : amp(i, t) * 0.8;
          if (mode === 3) return Math.min(1, amp(i, t) * 1.5 + 0.15);
          return amp(i, t);
        });
        // scene 3 code
        let budget = Math.max(0, Math.floor((t - D.code0) / D.codePer));
        CODE.forEach((line, i) => { const take = Math.min(line.length, budget); budget -= take; $("#c" + i).textContent = t >= D.code0 ? line.slice(0, take) : ""; });
        // scene 4 player
        const famous = t >= D.famosa;
        $("#trk4").textContent = famous ? "Canción famosa" : "Pista libre";
        $("#art4").textContent = famous ? "Artista famoso · con copyright" : "mood: hype · licencia libre";
        const muted = t >= D.mute;
        $("#pbar4").style.width = (Math.min(1, Math.max(0, (t - D.pl0) / 6)) * 100).toFixed(1) + "%";
        setBars(BP, (i) => (t < D.pl0 ? 0.06 : muted ? 0.04 : amp(i, t) * 0.9));
      }
      const drv = { t: 0 };
      tl.fromTo(drv, { t: 0 }, { t: ${f3(TOTAL)}, duration: ${f3(TOTAL)}, ease: "none", onUpdate: () => frame(drv.t) }, 0);
      frame(0);
      // register LAST, with the key = data-composition-id
      window.__timelines = window.__timelines || {};
      window.__timelines["${COMP}"] = tl;
    </script>
  </body>
</html>
`;
fs.writeFileSync(path.join(DIR, "index.html"), recolor(html));
fs.writeFileSync(path.join(DIR, "sfx_cues.json"), JSON.stringify({ total: TOTAL, cues: CUES.sort((a, b) => a[0] - b[0]) }));
console.log(`index.html: ${f3(TOTAL)} s, ${MAP.length} escenas, cortes ${C.slice(1).map((c) => f3(c)).join(" ")}, ${CAPS.length} subtitulos, ${CUES.length} efectos`);
