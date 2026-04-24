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
      enemyGlow: ["#ff0033", "#e05010", "#c8a000", "#7000ff"],
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
    }else {
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