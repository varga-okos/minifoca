// --- JÁTÉK KONFIGURÁCIÓ ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let WIDTH = window.innerWidth;
let HEIGHT = window.innerHeight;
let SCALE = 1; 

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    WIDTH = canvas.width;
    HEIGHT = canvas.height;
    SCALE = Math.min(WIDTH / 1500, HEIGHT / 900); 
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); 

// --- MP3 HANGOK BETÖLTÉSE ---
const audioKick = new Audio('kick.mp3');
const audioWhistle = new Audio('whistle.mp3');
// Előre betöltjük, hogy ne akadjon
audioKick.preload = 'auto';
audioWhistle.preload = 'auto';

// --- DESIGN ÉS KONSTANSOK ---
const COLORS = {
    neonGreen: '#31ED31', 
    darkBlue: '#101820', 
    panelBg: 'rgba(16, 24, 32, 0.9)',
    textWhite: '#FFFFFF', 
    textGray: '#A0A0A0', 
    accentBlue: '#00F0FF', 
    redCard: '#FF4444', 
    yellowCard: '#FFD700'
};

const getFont = (size, type = 'bold') => `${type} ${Math.floor(size * SCALE)}px 'Oswald', sans-serif`;
function dist(x1, y1, x2, y2) { return Math.sqrt((x1 - x2)**2 + (y1 - y2)**2); }

const GOAL_WIDTH = 15;
const GOAL_HEIGHT = 160; 
const MATCH_DURATION_MINUTES = 2;
const BASE_SPEED = 4; 
const SPRINT_MULTIPLIER = 1.7;
const MAX_SPRINT_TIME = 300; 
const SPRINT_DRAIN_RATE = 3;
const SPRINT_RECHARGE_RATE = 1;
const KICK_POWER = 18;
const KICK_DISTANCE = 30;
const SLIDE_TIME = 25;
const SLIDE_BOOST = 1.9;
const SLIDE_RECOVERY = 30;
const SLIDE_FRICTION = 0.95;
const GOAL_PAUSE_TIME = 60;
const INTRO_TEXT_TIME = 150;
const TIME_INTERVAL = 1000; 
const PENALTY_BOX_WIDTH = 130;
const PENALTY_BOX_HEIGHT = 320;
const CENTER_CIRCLE_RADIUS = 90;

// --- EFFEKT RENDSZER ---
let particles = [];
function createParticle(x, y, type, color) {
    let p = { x: x, y: y, type: type, life: 1.0, color: color };
    if (type === 'grass') {
        p.vx = (Math.random() - 0.5) * 4; p.vy = (Math.random() - 0.5) * 4;
        p.size = Math.random() * 5 + 2; p.decay = 0.05;
    } else if (type === 'trail') {
        p.vx = 0; p.vy = 0; p.size = ball.radius * 0.8; p.decay = 0.1;
    } else if (type === 'confetti') {
        p.vx = (Math.random() - 0.5) * 10; p.vy = (Math.random() - 2) * 8;
        p.size = Math.random() * 8 + 4; p.decay = 0.005; p.gravity = 0.2;
    }
    particles.push(p);
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= p.decay; p.x += p.vx; p.y += p.vy;
        if (p.type === 'confetti') p.vy += p.gravity;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        if (p.type === 'trail') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * SCALE, 0, Math.PI*2); ctx.fill(); } 
        else { ctx.fillRect(p.x, p.y, p.size * SCALE, p.size * SCALE); }
    });
    ctx.globalAlpha = 1.0;
}

// --- HANG RENDSZER (HIBRID: MP3 + SYNTH) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = true;

function playSound(type) {
    // 1. MP3 lejátszása (Rúgás és Síp)
    if (type === 'kick') {
        if (soundEnabled) {
            audioKick.currentTime = 0; // Visszatekerjük az elejére, ha gyorsan rúgunk
            audioKick.play().catch(e => console.log("Nincs kick.mp3 betöltve"));
        }
        return;
    }
    if (type === 'whistle') {
        if (soundEnabled) {
            audioWhistle.currentTime = 0;
            audioWhistle.play().catch(e => console.log("Nincs whistle.mp3 betöltve"));
        }
        return;
    }

    // 2. Egyéb hangok (Generált)
    if (!soundEnabled || audioCtx.state === 'suspended') { audioCtx.resume(); }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'wall') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    }
    else if (type === 'goal') {
        const notes = [261.63, 329.63, 392.00, 523.25]; // C major
        notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'sawtooth';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.1, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
            o.start(now + i * 0.05); o.stop(now + 1.5);
        });
    }
    else if (type === 'menu') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    }
}

// --- GLOBÁLIS JÁTÉK ÁLLAPOTOK ---
let gameState = 'intro';
let scoreBlue = 0, scoreRed = 0;
let timeLeftSeconds = MATCH_DURATION_MINUTES * 60;
let goalTimer = 0, introTimer = INTRO_TEXT_TIME, frameCounter = 0, lastTime = 0;
let kickerPlayer = null;
let currentMode = '1v1', isBotActive = false;
let playerName = "SAJÁT CSAPAT", currentNameInput = "", opponentName = "Ferencvárosi TC";
let replayBuffer = [], isReplaying = false, replayIndex = 0; const REPLAY_DURATION = 180;

let ball = { x: 0, y: 0, radius: 10, color: '#FFFFFF', vx: 0, vy: 0, friction: 0.98, speedCap: 14 };

// Karrier adatok
let currentMatchDay = 1; const MAX_MATCH_DAYS = 11;
let playerUpgradePoints = 0; const UPGRADE_COST = 10;
let playerStats = { baseSpeed: 1.0, maxSprintTime: 1.0, kickPower: 1.0 };
let OPPONENT_DIFFICULTY = 1.0;

let leagueTable = [
    { name: "SAJÁT CSAPAT", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 0.8, isPlayer: true },
    { name: "Ferencvárosi TC", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 1.4, isPlayer: false },
    { name: "Fehérvár FC", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 1.2, isPlayer: false },
    { name: "Paksi FC", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 1.0, isPlayer: false },
    { name: "Debreceni VSC", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 0.9, isPlayer: false },
    { name: "Puskás Akadémia", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 1.1, isPlayer: false },
    { name: "Mezőkövesd Zsóry", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 0.7, isPlayer: false },
    { name: "Újpest FC", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 0.8, isPlayer: false },
    { name: "Zalaegerszegi TE", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 0.9, isPlayer: false },
    { name: "Diósgyőri VTK", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 0.7, isPlayer: false },
    { name: "Kisvárda FC", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 0.6, isPlayer: false },
    { name: "Kecskeméti TE", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 0.7, isPlayer: false },
    { name: "MTK Budapest", played: 0, points: 0, win: 0, draw: 0, loss: 0, difficulty: 1.0, isPlayer: false }
];
