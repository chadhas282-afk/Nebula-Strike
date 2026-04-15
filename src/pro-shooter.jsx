import { useEffect, useRef, useState, useCallback } from "react";

const W = 720, H = 540;
const PLAYER_SPD = 5.2;
const BULLET_SPD = 9;
const ENEMY_BULLET_SPD = 3.4;
const ROWS = 4, COLS = 10;