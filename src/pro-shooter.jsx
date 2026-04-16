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