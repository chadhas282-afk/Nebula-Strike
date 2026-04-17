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