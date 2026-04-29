import { useEffect, useRef, useState, useCallback } from "react";

const W = 720, H = 540;
const PLAYER_SPD = 5.2;
const BULLET_SPD = 9;
const ENEMY_BULLET_SPD = 3.4;
const ROWS = 4, COLS = 10;
const EW = 38, EH = 26;
const PW = 52, PH = 36;
const BW = 4, BH = 16;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = (lo, hi) => Math.random() * (hi - lo) + lo;
const rndInt = (lo, hi) => Math.floor(rnd(lo, hi + 1));
const rect = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

function mkStars(n) {
  return Array.from({ length: n }, () => ({
    x: rnd(0, W), y: rnd(0, H),
    spd: rnd(0.08, 0.9), r: rnd(0.3, 1.6),
    bright: rnd(0.2, 0.9),
  }));
}
function mkNebula() {
  return Array.from({ length: 6 }, () => ({
    x: rnd(0, W), y: rnd(0, H),
    rx: rnd(60, 180), ry: rnd(40, 120),
    hue: rndInt(180, 290), alpha: rnd(0.018, 0.055),
  }));
}
function mkEnemies(level) {
  const out = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      out.push({
        id: r * COLS + c, r, c, alive: true, hp: r === 0 ? 2 : 1,
        x: 55 + c * (EW + 14), y: 52 + r * (EH + 18),
        flashAge: 0,
      });
  return out;
}
function mkExplosion(x, y, color, count = 16) {
  return {
    x, y, age: 0, maxAge: 38,
    particles: Array.from({ length: count }, () => ({
      vx: rnd(-5, 5), vy: rnd(-5, 5),
      r: rnd(1.5, 4.5), color,
      drag: rnd(0.92, 0.97),
    })),
  };
}
function mkPowerup(x, y) {
  const types = ["shield", "rapid", "bomb"];
  return { x, y, type: types[rndInt(0, 2)], vy: 1.2, age: 0, alive: true };
}

const PALETTE = {
  bg: "#03060f",
  player: "#d0f0ff",
  playerGlow: "#00d4ff",
  bullet: "#80ffee",
  bulletGlow: "#00ffcc",
  enemyColors: ["#ff4d6d", "#ff8c42", "#ffd700", "#b07cff"],
  enemyGlow:   ["#ff0033", "#e05010", "#c8a000", "#7000ff"],
  hud: "#00d4ff",
  hudDim: "#0a3a50",
  accent: "#ff4d6d",
  green: "#39ff88",
  amber: "#ffa030",
  shield: "#40c8ff",
  rapid: "#ff6bff",
  bomb: "#ff4d6d",
  scanline: "rgba(0,0,0,0.18)",
};

function glow(ctx, color, blur, fn) {
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawPlayer(ctx, x, y, frame, shieldHp, rapidTimer, hitFlash) {
  const cx = x + PW / 2, cy = y + PH / 2;
  ctx.save(); ctx.translate(cx, cy);

  const flicker = Math.sin(frame * 0.35) * 0.3 + 0.7;
  glow(ctx, "#ff8020", 18, () => {
    ctx.fillStyle = `rgba(255,140,40,${0.6 * flicker})`;
    ctx.beginPath();
    ctx.ellipse(0, PH / 2 + 2, 8, 14 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = `rgba(255,220,100,${0.4 * flicker})`;
  ctx.beginPath();
  ctx.ellipse(0, PH / 2 - 2, 4, 6 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();

  const flashAlpha = hitFlash > 0 ? hitFlash / 8 : 0;
  const bodyColor = flashAlpha > 0 ? `rgba(255,80,80,${flashAlpha + 0.6})` : PALETTE.player;
  glow(ctx, PALETTE.playerGlow, rapidTimer > 0 ? 22 : 12, () => {
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(0, -PH / 2);
    ctx.lineTo(PW / 2, PH / 2 - 4);
    ctx.lineTo(PW * 0.28, PH / 2 - 10);
    ctx.lineTo(-PW * 0.28, PH / 2 - 10);
    ctx.lineTo(-PW / 2, PH / 2 - 4);
    ctx.closePath();
    ctx.fill();
  });

  glow(ctx, "#80ffee", 8, () => {
    ctx.fillStyle = rapidTimer > 0 ? "#ff80ff" : "#80ffee";
    ctx.beginPath();
    ctx.ellipse(0, -4, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = PALETTE.playerGlow;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(-PW * 0.35, PH * 0.1); ctx.lineTo(-PW * 0.12, -PH * 0.18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PW * 0.35, PH * 0.1); ctx.lineTo(PW * 0.12, -PH * 0.18); ctx.stroke();
  ctx.globalAlpha = 1;

  if (shieldHp > 0) {
    const age = (frame * 0.04);
    glow(ctx, PALETTE.shield, 18, () => {
      ctx.strokeStyle = `rgba(64,200,255,${0.55 + Math.sin(age * 3) * 0.2})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, PW * 0.72, PH * 0.82, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.strokeStyle = `rgba(64,200,255,0.18)`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, PW * 0.72, PH * 0.82, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnemy(ctx, e, frame) {
  if (!e.alive) return;
  const cx = e.x + EW / 2, cy = e.y + EH / 2;
  const bob = Math.sin(frame * 0.07 + e.c * 0.4 + e.r) * 1.8;
  const flash = e.flashAge > 0;
  const col = flash ? "#ffffff" : PALETTE.enemyColors[e.r % 4];
  const gcol = flash ? "#ffffff" : PALETTE.enemyGlow[e.r % 4];
  ctx.save(); ctx.translate(cx, cy + bob);

  glow(ctx, gcol, 14, () => {
    ctx.fillStyle = col;
    if (e.r === 0) {
      ctx.beginPath();
      ctx.ellipse(0, 0, EW / 2, EH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-EW * 0.52, 2, 5, 4, -0.4, 0, Math.PI * 2);
      ctx.ellipse(EW * 0.52, 2, 5, 4, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.r === 1) {
      ctx.beginPath();
      ctx.moveTo(0, -EH / 2);
      ctx.bezierCurveTo(EW / 2, -EH / 2, EW / 2, EH * 0.2, 0, EH * 0.3);
      ctx.bezierCurveTo(-EW / 2, EH * 0.2, -EW / 2, -EH / 2, 0, -EH / 2);
      ctx.fill();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 7, EH * 0.28);
        ctx.quadraticCurveTo(i * 7 + Math.sin(frame * 0.12 + i) * 4, EH * 0.28 + 8, i * 7, EH * 0.28 + 13);
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      }
    } else if (e.r === 2) {
      ctx.beginPath();
      ctx.moveTo(0, -EH / 2); ctx.lineTo(EW / 2, 0);
      ctx.lineTo(0, EH / 2); ctx.lineTo(-EW / 2, 0);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, -2, EW / 2, EH * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 4, EW * 0.28, EH * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.ellipse(-6, -3, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -3, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = gcol;
  ctx.beginPath(); ctx.ellipse(-6, -3, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -3, 2, 2, 0, 0, Math.PI * 2); ctx.fill();

  if (e.hp > 1) {
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, EH / 2 + 5, 3, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function drawBullet(ctx, b) {
  ctx.save();
  glow(ctx, PALETTE.bulletGlow, 14, () => {
    const grad = ctx.createLinearGradient(b.x + BW / 2, b.y, b.x + BW / 2, b.y + BH);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, PALETTE.bullet);
    ctx.fillStyle = grad;
    roundRect(ctx, b.x, b.y, BW, BH, 2); ctx.fill();
  });
  ctx.restore();
}

function drawEnemyBullet(ctx, b, frame) {
  ctx.save();
  const flicker = Math.sin(frame * 0.4 + b.x) * 0.3 + 0.7;
  glow(ctx, "#ff2050", 12 * flicker, () => {
    ctx.fillStyle = `rgba(255,60,80,${flicker})`;
    ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 6, 3.5, 8, 0, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 5, 1.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawExplosion(ctx, ex) {
  const t = ex.age / ex.maxAge;
  ctx.save(); ctx.globalAlpha = 1 - t;
  ex.particles.forEach((p) => {
    const px = ex.x + p.vx * ex.age * p.drag;
    const py = ex.y + p.vy * ex.age * p.drag;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(px, py, p.r * (1 - t * 0.6), 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

function drawPowerup(ctx, p, frame) {
  if (!p.alive) return;
  const spin = frame * 0.06;
  const colors = { shield: PALETTE.shield, rapid: PALETTE.rapid, bomb: PALETTE.bomb };
  const labels = { shield: "S", rapid: "R", bomb: "B" };
  ctx.save(); ctx.translate(p.x + 14, p.y + 14);
  ctx.rotate(spin);
  glow(ctx, colors[p.type], 16, () => {
    ctx.strokeStyle = colors[p.type]; ctx.lineWidth = 2;
    roundRect(ctx, -12, -12, 24, 24, 5); ctx.stroke();
  });
  ctx.fillStyle = colors[p.type];
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(labels[p.type], 0, 0);
  ctx.restore();
}

function drawHUD(ctx, state) {
  const { score, lives, shieldHp, rapidTimer, bombs, combo, comboTimer, level, bossHp, bossMaxHp } = state;

  ctx.fillStyle = "rgba(0,5,18,0.82)";
  ctx.fillRect(0, 0, W, 44);
  ctx.strokeStyle = "rgba(0,212,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(W, 44); ctx.stroke();

  ctx.fillStyle = PALETTE.hudDim; ctx.font = "10px 'Courier New', monospace";
  ctx.fillText("SCORE", 18, 16);
  glow(ctx, PALETTE.hud, 8, () => {
    ctx.fillStyle = PALETTE.hud; ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillText(String(score).padStart(7, "0"), 16, 36);
  });

  ctx.fillStyle = PALETTE.hudDim; ctx.font = "10px 'Courier New', monospace";
  ctx.fillText("LEVEL", W / 2 - 20, 16);
  glow(ctx, PALETTE.amber, 6, () => {
    ctx.fillStyle = PALETTE.amber; ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillText(String(level).padStart(2, "0"), W / 2 - 12, 36);
  });

  ctx.fillStyle = PALETTE.hudDim; ctx.font = "10px 'Courier New', monospace";
  ctx.fillText("FLEET", W - 130, 16);
  for (let i = 0; i < lives; i++) {
    const lx = W - 122 + i * 22, ly = 26;
    glow(ctx, PALETTE.playerGlow, 6, () => {
      ctx.fillStyle = i < lives ? PALETTE.player : "rgba(0,200,255,0.15)";
      ctx.beginPath();
      ctx.moveTo(lx + 8, ly - 8); ctx.lineTo(lx + 16, ly + 4); ctx.lineTo(lx, ly + 4);
      ctx.closePath(); ctx.fill();
    });
  }

  if (shieldHp > 0) {
    ctx.fillStyle = PALETTE.hudDim; ctx.font = "9px 'Courier New', monospace";
    ctx.fillText("SHIELD", 18, 58);
    ctx.fillStyle = "rgba(40,100,160,0.3)";
    roundRect(ctx, 18, 62, 100, 6, 3); ctx.fill();
    glow(ctx, PALETTE.shield, 6, () => {
      ctx.fillStyle = PALETTE.shield;
      roundRect(ctx, 18, 62, (shieldHp / 3) * 100, 6, 3); ctx.fill();
    });
  }

  for (let i = 0; i < bombs; i++) {
    ctx.fillStyle = PALETTE.bomb;
    ctx.shadowColor = PALETTE.bomb; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(W - 22 - i * 16, 58, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (comboTimer > 0 && combo > 1) {
    const alpha = Math.min(1, comboTimer / 40);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = PALETTE.amber;
    ctx.font = "bold 22px 'Courier New', monospace";
    ctx.textAlign = "center";
    glow(ctx, PALETTE.amber, 14, () => {
      ctx.fillText(`${combo}× COMBO`, W / 2, H - 20);
    });
    ctx.restore();
  }

  if (rapidTimer > 0) {
    ctx.fillStyle = PALETTE.rapid;
    ctx.font = "10px 'Courier New', monospace";
    glow(ctx, PALETTE.rapid, 10, () => ctx.fillText("⚡ RAPID", 140, 36));
  }

  if (bossHp > 0 && bossMaxHp > 0) {
    ctx.fillStyle = "rgba(0,5,18,0.7)"; ctx.fillRect(W / 2 - 160, H - 46, 320, 28);
    ctx.strokeStyle = "rgba(255,50,80,0.3)"; ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - 160, H - 46, 320, 28);
    ctx.fillStyle = PALETTE.hudDim; ctx.font = "9px 'Courier New', monospace";
    ctx.textAlign = "center"; ctx.fillText("BOSS", W / 2, H - 34);
    ctx.fillStyle = "rgba(80,0,20,0.5)";
    roundRect(ctx, W / 2 - 150, H - 30, 300, 10, 3); ctx.fill();
    const bpct = clamp(bossHp / bossMaxHp, 0, 1);
    glow(ctx, "#ff2050", 8, () => {
      const grad = ctx.createLinearGradient(W / 2 - 150, 0, W / 2 + 150, 0);
      grad.addColorStop(0, "#ff4d6d"); grad.addColorStop(1, "#ff8020");
      ctx.fillStyle = grad;
      roundRect(ctx, W / 2 - 150, H - 30, 300 * bpct, 10, 3); ctx.fill();
    });
  }
}

function drawScanlines(ctx) {
  ctx.save(); ctx.globalAlpha = 0.045;
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, y, W, 1.5);
  }
  ctx.restore();
}

function drawVignette(ctx) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.82);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,8,0.55)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
}

function drawTitleScreen(ctx, frame) {
  ctx.fillStyle = PALETTE.bg; ctx.fillRect(0, 0, W, H);

  [
    { x: W * 0.3, y: H * 0.4, rx: 200, ry: 130, hue: 220, a: 0.04 },
    { x: W * 0.72, y: H * 0.55, rx: 160, ry: 100, hue: 280, a: 0.035 },
  ].forEach(n => {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.rx);
    g.addColorStop(0, `hsla(${n.hue},80%,55%,${n.a})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });

  const pulse = Math.sin(frame * 0.04) * 0.12 + 0.88;
  ctx.save(); ctx.textAlign = "center";
  ctx.font = "bold 64px 'Courier New', monospace";
  glow(ctx, "#00d4ff", 40 * pulse, () => {
    ctx.fillStyle = `rgba(0,212,255,${pulse})`;
    ctx.fillText("NEBULA", W / 2, H * 0.34);
  });
  glow(ctx, "#ff4d6d", 30 * pulse, () => {
    ctx.fillStyle = `rgba(255,77,109,${pulse})`;
    ctx.fillText("STRIKE", W / 2, H * 0.34 + 68);
  });

  ctx.fillStyle = "rgba(140,200,220,0.7)";
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillText("DEFEND THE GALAXY — DESTROY THE HORDE", W / 2, H * 0.34 + 106);

  if (Math.floor(frame / 35) % 2 === 0) {
    glow(ctx, PALETTE.amber, 10, () => {
      ctx.fillStyle = PALETTE.amber;
      ctx.font = "15px 'Courier New', monospace";
      ctx.fillText("PRESS  SPACE  OR  ENTER  TO  LAUNCH", W / 2, H * 0.78);
    });
  }

  ctx.fillStyle = "rgba(80,130,160,0.7)"; ctx.font = "12px 'Courier New', monospace";
  ctx.fillText("← → MOVE   SPACE FIRE   B BOMB   COLLECT POWER-UPS", W / 2, H * 0.88);

  ctx.restore();
}

function drawGameOver(ctx, score, frame, win) {
  ctx.fillStyle = "rgba(2,4,20,0.88)"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  const col = win ? PALETTE.green : PALETTE.accent;
  glow(ctx, col, 30, () => {
    ctx.fillStyle = col; ctx.font = "bold 54px 'Courier New', monospace";
    ctx.fillText(win ? "VICTORY!" : "GAME OVER", W / 2, H * 0.38);
  });
    ctx.fillStyle = "rgba(160,210,230,0.85)"; ctx.font = "18px 'Courier New', monospace";
  ctx.fillText(`FINAL SCORE  ${String(score).padStart(7, "0")}`, W / 2, H * 0.38 + 54);
  if (Math.floor(frame / 35) % 2 === 0) {
    glow(ctx, PALETTE.amber, 10, () => {
      ctx.fillStyle = PALETTE.amber; ctx.font = "14px 'Courier New', monospace";
      ctx.fillText("PRESS  SPACE  TO  PLAY  AGAIN", W / 2, H * 0.72);
    });
  }
}

export default function App() {
  const cvs = useRef(null);
  const G = useRef(null);
  const raf = useRef(null);
  const [uiScore, setUiScore] = useState(0);
  const [phase, setPhase] = useState("title");


  const initGame = useCallback(() => {
    G.current = {
      phase: "playing",
      frame: 0,
      score: 0,
      level: 1,
      lives: 3,
      shieldHp: 0,
      rapidTimer: 0,
      bombs: 2,
      combo: 0,
      comboTimer: 0,
      screenShake: 0,
      player: { x: W / 2 - PW / 2, y: H - 80 },
      bullets: [],
      enemyBullets: [],
      enemies: mkEnemies(1),
      explosions: [],
      powerups: [],
      stars: mkStars(120),
      nebula: mkNebula(),
      enemyDir: 1,
      enemyStepTimer: 0,
      enemyStepInterval: 34,
      enemyShootTimer: 0,
      enemyShootInterval: 78,
      bulletCooldown: 0,
       keys: {},
      bossHp: 0,
      bossMaxHp: 0,
      lastKillFrame: -999,
    };
    setPhase("playing");
  }, []);

  useEffect(() => {
    const dn = (e) => {
      if (G.current) G.current.keys[e.code] = true;
      if (["Space", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if ((e.code === "Space" || e.code === "Enter")) {
        const ph = G.current ? G.current.phase : "title";
        if (ph === "title" || ph === "gameover" || ph === "win") initGame();
      }
      if (e.code === "KeyB" && G.current && G.current.phase === "playing") {
        const g = G.current;
        if (g.bombs > 0) {
          g.bombs--;
          g.enemies.forEach(e => { if (e.alive) { e.alive = false; g.score += 30; } });
          g.enemyBullets = [];
          g.screenShake = 20;
          const cx = W / 2, cy = H / 2;
          for (let i = 0; i < 5; i++)
            g.explosions.push(mkExplosion(rnd(80, W - 80), rnd(60, H - 120), ["#ff4d6d","#ffa030","#ffd700"][i % 3], 24));
        }
      }
    };
    const up = (e) => { if (G.current) G.current.keys[e.code] = false; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [initGame]);

    useEffect(() => {
    const canvas = cvs.current;
    const ctx = canvas.getContext("2d");

    if (!G.current) {
      G.current = {
        phase: "title", frame: 0, score: 0, level: 1,
        stars: mkStars(120), nebula: mkNebula(), keys: {},
        lives: 3, shieldHp: 0, rapidTimer: 0, bombs: 2, combo: 0, comboTimer: 0,
         screenShake: 0, player: { x: W / 2 - PW / 2, y: H - 80 },
        bullets: [], enemyBullets: [], enemies: mkEnemies(1), explosions: [], powerups: [],
        enemyDir: 1, enemyStepTimer: 0, enemyStepInterval: 34,
        enemyShootTimer: 0, enemyShootInterval: 78, bulletCooldown: 0,
         bossHp: 0, bossMaxHp: 0, lastKillFrame: -999,
      };
    }

    function tick() {
      const g = G.current;
      const dt = 1;
      g.frame += dt;

       g.stars.forEach(s => { s.y += s.spd * dt; if (s.y > H) { s.y = 0; s.x = rnd(0, W); } });
      g.nebula.forEach(n => { n.y += 0.04 * dt; if (n.y > H + n.ry) n.y = -n.ry; });

      if (g.phase !== "playing") {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = PALETTE.bg; ctx.fillRect(0, 0, W, H);
        g.stars.forEach(s => {
          ctx.globalAlpha = s.bright * 0.7;
          ctx.fillStyle = "#c8dcff";
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        });
        if (g.phase === "title") drawTitleScreen(ctx, g.frame);
        else drawGameOver(ctx, g.score, g.frame, g.phase === "win");
        drawScanlines(ctx);
        raf.current = requestAnimationFrame(tick);
        return;
      }

      const p = g.player;
      const spd = PLAYER_SPD * dt;
      if ((g.keys["ArrowLeft"] || g.keys["KeyA"]) && p.x > 0) p.x -= spd;
      if ((g.keys["ArrowRight"] || g.keys["KeyD"]) && p.x < W - PW) p.x += spd;

      if (g.bulletCooldown > 0) g.bulletCooldown -= dt;
      const cooldown = g.rapidTimer > 0 ? 5 : 13;
      if ((g.keys["Space"] || g.keys["ArrowUp"]) && g.bulletCooldown <= 0) {
        g.bullets.push({ x: p.x + PW / 2 - BW / 2, y: p.y - BH });
        if (g.rapidTimer > 0) {
          g.bullets.push({ x: p.x + 6, y: p.y });
          g.bullets.push({ x: p.x + PW - 10, y: p.y });
           }
        g.bulletCooldown = cooldown;
      }

      g.bullets = g.bullets.filter(b => { b.y -= BULLET_SPD * dt; return b.y > -BH; });
      g.enemyBullets = g.enemyBullets.filter(b => { b.y += ENEMY_BULLET_SPD * dt; return b.y < H; });
      if (g.rapidTimer > 0) g.rapidTimer -= dt;
      if (g.comboTimer > 0) g.comboTimer -= dt;
      else if (g.comboTimer <= 0 && g.combo > 0) g.combo = 0;

       g.enemies.forEach(e => { if (e.flashAge > 0) e.flashAge--; });
      const alive = g.enemies.filter(e => e.alive);
      const speedMult = Math.max(0.32, 1 - (alive.length / (ROWS * COLS)) * 0.68);
      g.enemyStepTimer += dt;
       if (g.enemyStepTimer >= g.enemyStepInterval * speedMult) {
        g.enemyStepTimer = 0;
        const minX = Math.min(...alive.map(e => e.x));
        const maxX = Math.max(...alive.map(e => e.x));
        if ((g.enemyDir > 0 && maxX + EW + 10 >= W) || (g.enemyDir < 0 && minX - 10 <= 0)) {
          g.enemyDir *= -1;
          g.enemies.forEach(e => { if (e.alive) e.y += 16; });
           } else {
          g.enemies.forEach(e => { if (e.alive) e.x += 20 * g.enemyDir; });
        }
      }


      g.enemyShootTimer += dt;
      if (g.enemyShootTimer >= g.enemyShootInterval && alive.length > 0) {
        g.enemyShootTimer = 0;
        const cols = [...new Set(alive.map(e => e.c))];
        const col = cols[rndInt(0, cols.length - 1)];
        const colE = alive.filter(e => e.c === col);
         const shooter = colE.reduce((a, b) => a.y > b.y ? a : b);
        g.enemyBullets.push({ x: shooter.x + EW / 2 - 3, y: shooter.y + EH });
        if (g.level >= 3 && rnd(0, 1) < 0.35) {
          const s2 = alive[rndInt(0, alive.length - 1)];
          g.enemyBullets.push({ x: s2.x + EW / 2 - 3, y: s2.y + EH });
        }
      }

      for (const b of g.bullets) {
        for (const e of g.enemies) {
          if (e.alive && rect(b.x, b.y, BW, BH, e.x, e.y, EW, EH)) {
            b.y = -9999;
             e.hp--;
            e.flashAge = 5;
            if (e.hp <= 0) {
              e.alive = false;
              const gap = g.frame - g.lastKillFrame;
              g.lastKillFrame = g.frame;
              if (gap < 50) { g.combo++; g.comboTimer = 90; }
              else { g.combo = 1; g.comboTimer = 90; }
              const pts = (ROWS - e.r) * 10 * Math.max(1, g.combo);
              g.score += pts;
              const ecol = PALETTE.enemyColors[e.r % 4];
              g.explosions.push(mkExplosion(e.x + EW / 2, e.y + EH / 2, ecol, 18));
              g.screenShake = Math.min(g.screenShake + 3, 10);
               if (rnd(0, 1) < 0.12) g.powerups.push(mkPowerup(e.x + EW / 2 - 14, e.y));
            }
          }
        }
      }

      for (const b of g.enemyBullets) {
        if (rect(b.x, b.y, 6, 14, p.x + 8, p.y, PW - 16, PH)) {
          b.y = H + 999;
          if (g.shieldHp > 0) {
             g.shieldHp--;
            g.screenShake = 5;
          } else {
            g.lives--;
            g.screenShake = 16;
             g.explosions.push(mkExplosion(p.x + PW / 2, p.y + PH / 2, PALETTE.playerGlow, 22));
            if (g.lives <= 0) { g.phase = "gameover"; setPhase("gameover"); }
          }
        }
      }
