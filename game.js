// --- JÁTÉK KONFIGURÁCIÓ ÉS VÁLTOZÓK ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- RESZPONZÍV KÉPERNYŐ KEZELÉS ---
let WIDTH = window.innerWidth;
let HEIGHT = window.innerHeight;
let SCALE = 1; 

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    WIDTH = canvas.width;
    HEIGHT = canvas.height;
    // Referencia méret: 1500x900. Ha kisebb a képernyő, mindent kicsinyítünk.
    SCALE = Math.min(WIDTH / 1500, HEIGHT / 900); 
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); 

// --- DESIGN KONSTANSOK ---
const COLORS = {
    neonGreen: '#31ED31', darkBlue: '#101820', panelBg: 'rgba(16, 24, 32, 0.9)',
    textWhite: '#FFFFFF', textGray: '#A0A0A0', accentBlue: '#00F0FF', redCard: '#FF4444', yellowCard: '#FFD700'
};

const getFont = (size, type = 'bold') => `${type} ${Math.floor(size * SCALE)}px 'Oswald', sans-serif`;

// Játékparaméterek (Skálázva lesznek használatkor)
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
const FOUL_KICK_PAUSE = 60;
const FOUL_LABDA_TAVOLSAG = 45;
const AIM_LINE_LENGTH = 200;
const GOAL_PAUSE_TIME = 60;
const INTRO_TEXT_TIME = 150;
const TIME_INTERVAL = 1000; 

// --- EFFEKT RENDSZER (RÉSZECSKÉK) ---
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
        p.life -= p.decay;
        p.x += p.vx; p.y += p.vy;
        if (p.type === 'confetti') p.vy += p.gravity; // Gravitáció a konfettinek
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        if (p.type === 'trail') {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * SCALE, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillRect(p.x, p.y, p.size * SCALE, p.size * SCALE);
        }
    });
    ctx.globalAlpha = 1.0;
}

// --- REPLAY RENDSZER ---
const REPLAY_DURATION = 180;
let replayBuffer = [];
let isReplaying = false;
let replayIndex = 0;

// --- PÁLYA ---
const PENALTY_BOX_WIDTH = 130;
const PENALTY_BOX_HEIGHT = 320;
const PENALTY_SPOT_DIST = 90;
const CENTER_CIRCLE_RADIUS = 90;

// --- KARRIER ÉS AI ADATOK ---
let OPPONENT_DIFFICULTY = 1.0;
let playerUpgradePoints = 0;
let playerStats = { baseSpeed: 1.0, maxSprintTime: 1.0, kickPower: 1.0 };
const UPGRADE_COST = 10;
const SPEED_BONUS_MULT = 0.05;
const SPRINT_BONUS_MULT = 0.10;
const KICK_BONUS_MULT = 0.15;

let currentMode = '1v1';
let isBotActive = false;
let playerName = "SAJÁT CSAPAT";
let currentNameInput = "";
let currentMatchDay = 1;
const MAX_MATCH_DAYS = 11;
let opponentName = "Ferencvárosi TC";
let lastMatchResult = null;

let leagueTable = [
    { name: "SAJÁT CSAPAT", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 0.8, isPlayer: true },
    { name: "Ferencvárosi TC", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 1.4, isPlayer: false },
    { name: "Fehérvár FC", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 1.2, isPlayer: false },
    { name: "Paksi FC", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 1.0, isPlayer: false },
    { name: "Debreceni VSC", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 0.9, isPlayer: false },
    { name: "Puskás Akadémia", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 1.1, isPlayer: false },
    { name: "Mezőkövesd Zsóry", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 0.7, isPlayer: false },
    { name: "Újpest FC", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 0.8, isPlayer: false },
    { name: "Zalaegerszegi TE", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 0.9, isPlayer: false },
    { name: "Diósgyőri VTK", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 0.7, isPlayer: false },
    { name: "Kisvárda FC", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 0.6, isPlayer: false },
    { name: "Kecskeméti TE", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 0.7, isPlayer: false },
    { name: "MTK Budapest", played: 0, points: 0, win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, difficulty: 1.0, isPlayer: false }
];

// --- ÁLLAPOTOK ---
let scoreBlue = 0, scoreRed = 0;
let gameState = 'intro'; 
let goalTimer = 0;
let introTimer = INTRO_TEXT_TIME;
let timeLeftSeconds = MATCH_DURATION_MINUTES * 60;
let lastTime = 0;
let kickerPlayer = null;
let frameCounter = 0;

let mainMenuItems = [{ text: "KARRIER INDÍTÁSA", action: 'start_career' }, { text: "HELYI MECCS (1v1)", action: 'start_1v1' }, { text: "SÚGÓ", action: 'controls' }];
let careerMenuItems = [{ text: "KÖVETKEZŐ MECCS", action: 'start_match' }, { text: "JÁTÉKOS FEJLESZTÉS", action: 'upgrade_menu' }, { text: "TABELLA", action: 'view_table' }, { text: "KILÉPÉS", action: 'exit_career' }];
let upgradeMenuItems = [{ text: "Sebesség növelése", action: 'upgrade_speed', stat: 'baseSpeed', cost: UPGRADE_COST, bonus: SPEED_BONUS_MULT }, { text: "Sprint Idő növelése", action: 'upgrade_sprint_time', stat: 'maxSprintTime', cost: UPGRADE_COST, bonus: SPRINT_BONUS_MULT }, { text: "Rúgás Erő növelése", action: 'upgrade_kick_power', stat: 'kickPower', cost: UPGRADE_COST, bonus: KICK_BONUS_MULT }, { text: "Vissza a Karrier Menübe", action: 'back_to_career' }];

let selectedMenuItem = 0;
let selectedUpgradeItem = 0;
let menuControlDownLastFrame = false;

// --- INPUT KEZELÉS ---
let keys = {};
let gamepads = [null, null];
let skipPressedLastFrame = false;
let lastKick1 = false, lastKick2 = false;
let lastSlide1 = false, lastSlide2 = false;

window.addEventListener('keydown', function(e) {
    if (gameState === 'name_input') {
        if (e.key === 'Backspace') { e.preventDefault(); handleNameInput('Backspace'); } 
        else if (e.key === 'Enter') { handleNameInput('Enter'); } 
        else if (e.key.length === 1) { handleNameInput(e.key); }
        return; 
    }
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
    keys[e.key] = true; keys[e.code] = true;
});
window.addEventListener('keyup', function(e) { keys[e.key] = false; keys[e.code] = false; });
window.addEventListener("gamepadconnected", (e) => { gamepads[e.gamepad.index] = e.gamepad; });
window.addEventListener("gamepaddisconnected", (e) => { gamepads[e.gamepad.index] = null; });

function updateGamepad() {
    const connectedPads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (connectedPads[0]) gamepads[0] = connectedPads[0];
    if (connectedPads[1]) gamepads[1] = connectedPads[1];
}

// --- JÁTÉK OBJEKTUMOK ---
let ball = { x: 0, y: 0, radius: 10, color: '#FFFFFF', vx: 0, vy: 0, friction: 0.98, speedCap: 14 };

function Player(xRatio, yRatio, color, team) {
    this.xRatio = xRatio; this.yRatio = yRatio; 
    this.x = WIDTH * xRatio; this.y = HEIGHT * yRatio;
    this.radius = 18; this.color = color; this.team = team;
    this.baseSpeed = BASE_SPEED; this.speed = BASE_SPEED;
    this.maxSprintTime = MAX_SPRINT_TIME; this.kickPower = KICK_POWER;
    this.sprintTime = this.maxSprintTime;
    this.vx = 0; this.vy = 0;
    this.moveDirX = 0; this.moveDirY = 0;
    this.slideTimer = 0; this.yellowCards = 0;
    this.aimDirX = (team === 'blue') ? 1 : -1; this.aimDirY = 0;
}

let player1 = new Player(0.25, 0.5, '#1A2A40', 'blue');
let player2 = new Player(0.75, 0.5, '#D63031', 'red');
let players = [player1, player2];

function applyPlayerUpgrades() {
    player1.baseSpeed = BASE_SPEED * playerStats.baseSpeed;
    player1.maxSprintTime = MAX_SPRINT_TIME * playerStats.maxSprintTime;
    player1.kickPower = KICK_POWER * playerStats.kickPower;
    player1.speed = player1.baseSpeed;
    player1.sprintTime = Math.min(player1.sprintTime, player1.maxSprintTime);
}

function setOpponentDifficulty() {
    if (currentMode !== 'career' || !isBotActive) {
        OPPONENT_DIFFICULTY = 1.0;
        player2.baseSpeed = BASE_SPEED;
        return;
    }
    const opponentTeam = leagueTable.find(team => team.name === opponentName);
    OPPONENT_DIFFICULTY = opponentTeam ? opponentTeam.difficulty : 1.0;
    player2.baseSpeed = BASE_SPEED * OPPONENT_DIFFICULTY;
    player2.speed = player2.baseSpeed;
    player2.maxSprintTime = MAX_SPRINT_TIME * OPPONENT_DIFFICULTY;
    player2.kickPower = KICK_POWER * (0.8 + (OPPONENT_DIFFICULTY * 0.2));
}

// --- SZIMULÁCIÓ ---
function simulateOtherMatches() {
    let otherTeams = leagueTable.filter(t => !t.isPlayer && t.name !== opponentName);
    otherTeams.sort(() => Math.random() - 0.5);

    while (otherTeams.length >= 2) {
        const teamA = otherTeams.pop();
        const teamB = otherTeams.pop();

        const strengthA = teamA.difficulty;
        const strengthB = teamB.difficulty;

        let goalsA = Math.floor(Math.random() * 3) + (strengthA > strengthB ? 1 : 0);
        let goalsB = Math.floor(Math.random() * 3) + (strengthB > strengthA ? 1 : 0);
        
        if(strengthA > strengthB + 0.3) goalsA++;
        if(strengthB > strengthA + 0.3) goalsB++;

        teamA.played++; teamB.played++;
        teamA.goalsFor += goalsA; teamA.goalsAgainst += goalsB; teamA.diff = teamA.goalsFor - teamA.goalsAgainst;
        teamB.goalsFor += goalsB; teamB.goalsAgainst += goalsA; teamB.diff = teamB.goalsFor - teamB.goalsAgainst;

        if (goalsA > goalsB) { teamA.points += 3; teamA.win++; teamB.loss++; }
        else if (goalsB > goalsA) { teamB.points += 3; teamB.win++; teamA.loss++; }
        else { teamA.points++; teamB.points++; teamA.draw++; teamB.draw++; }
    }
    
    leagueTable.sort((a, b) => (b.points - a.points) || (b.diff - a.diff) || (b.goalsFor - a.goalsFor));
}

function finishCareerMatch() {
    const playerTeam = leagueTable.find(t => t.isPlayer);
    const opponentTeam = leagueTable.find(t => t.name === opponentName);
    
    if (scoreBlue > scoreRed) { playerTeam.points += 3; playerTeam.win++; lastMatchResult = "GYŐZELEM"; playerUpgradePoints += 15; } 
    else if (scoreBlue < scoreRed) { opponentTeam.points += 3; opponentTeam.win++; lastMatchResult = "VERESÉG"; playerUpgradePoints += 2; } 
    else { playerTeam.points++; opponentTeam.points++; playerTeam.draw++; opponentTeam.draw++; lastMatchResult = "DÖNTETLEN"; playerUpgradePoints += 5; }
    
    playerTeam.played++; opponentTeam.played++;
    playerTeam.goalsFor += scoreBlue; playerTeam.goalsAgainst += scoreRed; playerTeam.diff = playerTeam.goalsFor - playerTeam.goalsAgainst;
    opponentTeam.goalsFor += scoreRed; opponentTeam.goalsAgainst += scoreBlue; opponentTeam.diff = opponentTeam.goalsFor - opponentTeam.goalsAgainst;
    
    simulateOtherMatches(); 
    
    currentMatchDay++;
    if (currentMatchDay <= MAX_MATCH_DAYS) {
        const otherTeams = leagueTable.filter(t => !t.isPlayer);
        const nextOpponent = otherTeams[Math.floor(Math.random() * otherTeams.length)];
        if(nextOpponent) opponentName = nextOpponent.name;
    }
    gameState = 'finished';
}

function isInsidePenaltyBox(x, y, team) {
    const pW = PENALTY_BOX_WIDTH * SCALE; const pH = PENALTY_BOX_HEIGHT * SCALE;
    if (team === 'blue') return (x < pW && y > HEIGHT/2 - pH/2 && y < HEIGHT/2 + pH/2);
    else return (x > WIDTH - pW && y > HEIGHT/2 - pH/2 && y < HEIGHT/2 + pH/2);
}

function resetBall() {
    ball.x = WIDTH/2; ball.y = HEIGHT/2; ball.vx = 0; ball.vy = 0;
    player1.x = WIDTH * 0.25; player1.y = HEIGHT * 0.5;
    player2.x = WIDTH * 0.75; player2.y = HEIGHT * 0.5;
    applyPlayerUpgrades(); setOpponentDifficulty();
    player1.sprintTime = player1.maxSprintTime; player2.sprintTime = player2.maxSprintTime;
    player1.slideTimer = 0; player2.slideTimer = 0;
    kickerPlayer = null; replayBuffer = [];
    particles = []; // Töröljük a részecskéket
    if (currentMode === 'career' && gameState === 'main_menu') {
        leagueTable.forEach(team => { team.played = 0; team.points = 0; team.win = 0; team.draw = 0; team.loss = 0; team.goalsFor = 0; team.goalsAgainst = 0; team.diff = 0; });
        playerUpgradePoints = 0; playerStats = { baseSpeed: 1.0, maxSprintTime: 1.0, kickPower: 1.0 };
    }
}
// --- REPLAY RENDSZER ---
function saveFrame() {
    replayBuffer.push({ bx: ball.x, by: ball.y, p1x: player1.x, p1y: player1.y, p1s: player1.slideTimer, p2x: player2.x, p2y: player2.y, p2s: player2.slideTimer });
    if (replayBuffer.length > REPLAY_DURATION) replayBuffer.shift();
}

function playReplay() {
    if (replayIndex < replayBuffer.length) {
        const frame = replayBuffer[replayIndex];
        ball.x = frame.bx; ball.y = frame.by;
        player1.x = frame.p1x; player1.y = frame.p1y; player1.slideTimer = frame.p1s;
        player2.x = frame.p2x; player2.y = frame.p2y; player2.slideTimer = frame.p2s;
        replayIndex++;
    } else { isReplaying = false; gameState = 'goal_scored'; goalTimer = GOAL_PAUSE_TIME; }
}

// --- FIZIKA ---
function applySprintLogic(player, isSprintingAttempt) {
    const isMoving = Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1;
    if (isSprintingAttempt && player.sprintTime > 0 && isMoving) {
        player.speed = player.baseSpeed * SPRINT_MULTIPLIER;
        player.sprintTime = Math.max(0, player.sprintTime - SPRINT_DRAIN_RATE);
    } else {
        player.speed = player.baseSpeed;
        player.sprintTime = Math.min(player.maxSprintTime, player.sprintTime + SPRINT_RECHARGE_RATE);
    }
}
function dist(x1, y1, x2, y2) { return Math.sqrt((x1 - x2)**2 + (y1 - y2)**2); }

function checkFoul(slidingPlayer, targetPlayer) {
    const d = dist(slidingPlayer.x, slidingPlayer.y, targetPlayer.x, targetPlayer.y);
    if (d < (slidingPlayer.radius + targetPlayer.radius + 5) * SCALE) {
        if (slidingPlayer.slideTimer > SLIDE_RECOVERY) {
            const distSlideToBall = dist(slidingPlayer.x, slidingPlayer.y, ball.x, ball.y);
            const distTargetToBall = dist(targetPlayer.x, targetPlayer.y, ball.x, ball.y);
            if (!(distSlideToBall < FOUL_LABDA_TAVOLSAG * SCALE && distTargetToBall > distSlideToBall)) {
                const isPenalty = isInsidePenaltyBox(slidingPlayer.x, slidingPlayer.y, targetPlayer.team);
                slidingPlayer.yellowCards++;
                gameState = isPenalty ? 'penalty' : 'foul_kick';
                goalTimer = FOUL_KICK_PAUSE;
                setupFoulKick(targetPlayer, isPenalty);
                return true;
            }
        }
    }
    return false;
}

function setupFoulKick(foulVictim, isPenalty) {
    const topBar = 60 * SCALE;
    const pitchCenterY = topBar + (HEIGHT - topBar) / 2;

    const isVictimBlue = foulVictim.team === 'blue';
    const opponent = isVictimBlue ? player2 : player1;
    kickerPlayer = foulVictim; ball.vx = 0; ball.vy = 0; players.forEach(p => { p.vx = 0; p.vy = 0; p.slideTimer = 0; });
    foulVictim.aimDirX = isVictimBlue ? 1 : -1; foulVictim.aimDirY = 0;
    const pd = PENALTY_SPOT_DIST * SCALE;
    
    if (isPenalty) {
        ball.x = isVictimBlue ? pd : WIDTH - pd; ball.y = pitchCenterY;
        foulVictim.x = ball.x + (isVictimBlue ? -20*SCALE : 20*SCALE); foulVictim.y = ball.y;
        opponent.x = isVictimBlue ? WIDTH - (GOAL_WIDTH*SCALE) - opponent.radius - 10*SCALE : (GOAL_WIDTH*SCALE) + opponent.radius + 10*SCALE; opponent.y = pitchCenterY;
        players.forEach(p => { if (p !== foulVictim && p !== opponent) { p.x = WIDTH/2; p.y = pitchCenterY; } });
    } else {
        ball.x = Math.max(50*SCALE + ball.radius * 2, Math.min(WIDTH - 50*SCALE - ball.radius * 2, ball.x));
        ball.y = Math.max(topBar + 40*SCALE + ball.radius * 2, Math.min(HEIGHT - 40*SCALE - ball.radius * 2, ball.y));
        foulVictim.x = ball.x + (isVictimBlue ? -20*SCALE : 20*SCALE); foulVictim.y = ball.y;
        players.forEach(p => { if (p !== foulVictim && dist(p.x, p.y, ball.x, ball.y) < CENTER_CIRCLE_RADIUS * 1.5 * SCALE) { p.x = WIDTH/2; p.y = pitchCenterY; } });
    }
    foulVictim.moveDirX = 0; foulVictim.moveDirY = 0;
}

function checkCollision(p) {
    if (gameState === 'foul_kick' || gameState === 'penalty') return;
    const dx = ball.x - p.x; const dy = ball.y - p.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = (ball.radius + p.radius) * SCALE; 
    if (distance < minDistance) {
        const normalX = dx / distance; const normalY = dy / distance;
        const overlap = minDistance - distance;
        ball.x += normalX * overlap; ball.y += normalY * overlap;
        if (p.slideTimer > SLIDE_RECOVERY) {
            ball.vx = normalX * p.kickPower * 1.5; ball.vy = normalY * p.kickPower * 1.5; p.slideTimer = SLIDE_RECOVERY;
        } else {
             ball.vx = p.vx * 1.5 + normalX * 1; ball.vy = p.vy * 1.5 + normalY * 1;
        }
        const spd = Math.sqrt(ball.vx**2 + ball.vy**2);
        if(spd > ball.speedCap * SCALE) { ball.vx=(ball.vx/spd)*ball.speedCap * SCALE; ball.vy=(ball.vy/spd)*ball.speedCap * SCALE; }
    }
}

function applyKickLogic(player, isKickAttempt) {
    const isFreeKickState = gameState === 'foul_kick' || gameState === 'penalty';
    const isKicker = isFreeKickState ? player === kickerPlayer : true;
    if (!isKicker) return;
    if (!isKickAttempt) { player.slideTimer = 0; if (!isFreeKickState) return; }
    const d = dist(ball.x, ball.y, player.x, player.y);
    if (d < (player.radius + ball.radius) * SCALE + (KICK_DISTANCE * SCALE)) {
        let kx, ky;
        if (isFreeKickState) { kx = player.aimDirX; ky = player.aimDirY; }
        else { kx = player.moveDirX; ky = player.moveDirY; }
        if (kx === 0 && ky === 0) { const a = Math.atan2(ball.y - player.y, ball.x - player.x); kx = Math.cos(a); ky = Math.sin(a); }
        const mag = Math.sqrt(kx*kx + ky*ky);
        if(mag > 0) { kx/=mag; ky/=mag; }
        ball.vx = kx * player.kickPower * SCALE; ball.vy = ky * player.kickPower * SCALE; 
        if (isFreeKickState) { gameState = 'playing'; kickerPlayer = null; players.forEach(checkCollision); }
    }
}

// --- JAVÍTOTT BECSÚSZÁS LOGIKA ---
function applySlideLogic(player, isSlideAttempt, moveX, moveY) {
    // Ha már csúszik
    if (player.slideTimer > 0) {
        player.slideTimer--;
        
        // FŰ EFFEKT GENERÁLÁSA (Ha van részecske rendszer)
        if (player.slideTimer > SLIDE_RECOVERY && frameCounter % 3 === 0 && typeof createParticle !== 'undefined') {
            createParticle(player.x, player.y + 15*SCALE, 'grass', '#2E8B57');
        }

        if (player.slideTimer > SLIDE_RECOVERY) { 
            player.vx *= SLIDE_FRICTION; 
            player.vy *= SLIDE_FRICTION; 
        } else { 
            // Csúszás vége (felkelés)
            player.vx = 0; 
            player.vy = 0; 
            player.speed = player.baseSpeed; 
            player.sprintTime = Math.min(player.maxSprintTime, player.sprintTime + SPRINT_RECHARGE_RATE); 
        }
        return true; // Jelezzük, hogy csúszás van, ne kezelje a sima mozgást
    }

    // Csúszás indítása (Csak ha mozog!)
    if (isSlideAttempt && (Math.abs(moveX) > 0 || Math.abs(moveY) > 0)) {
        player.slideTimer = SLIDE_TIME + SLIDE_RECOVERY;
        player.moveDirX = moveX; 
        player.moveDirY = moveY;
        
        const d = Math.sqrt(moveX**2 + moveY**2);
        if(d > 0) { 
            player.vx = (moveX/d) * player.baseSpeed * SLIDE_BOOST * SCALE; 
            player.vy = (moveY/d) * player.baseSpeed * SLIDE_BOOST * SCALE; 
        }
        
        player.sprintTime = Math.max(0, player.sprintTime - player.maxSprintTime / 4);
        
        // KEZDŐ FŰCSOMÓK
        if (typeof createParticle !== 'undefined') {
            for(let i=0; i<5; i++) createParticle(player.x, player.y + 15*SCALE, 'grass', '#32CD32');
        }
        
        return true;
    }
    return false;
}

// --- AI ---
function getBotMove() {
    const topBar = 60 * SCALE; 
    const bot = player2; const isBotRed = bot.team === 'red';
    const pitchCenterY = topBar + (HEIGHT - topBar) / 2;
    const goalX = isBotRed ? 0 : WIDTH; const goalY = pitchCenterY;
    const botGoalX = isBotRed ? WIDTH : 0; 
    const buffer = 50 * SCALE; 

    if (bot.slideTimer > SLIDE_RECOVERY) return { moveX: 0, moveY: 0, isKick: false, isSlide: false };

    let futureBallX = ball.x + ball.vx * 10;
    let futureBallY = ball.y + ball.vy * 10;
    
    futureBallX = Math.max(buffer, Math.min(WIDTH - buffer, futureBallX));
    futureBallY = Math.max(topBar + buffer, Math.min(HEIGHT - buffer, futureBallY));

    const distBall = dist(ball.x, ball.y, bot.x, bot.y);
    const distBallToOwnGoal = dist(ball.x, ball.y, botGoalX, goalY);

    let moveX = 0, moveY = 0, isKick = false, isSlide = false;
    let targetX, targetY;
    let strategy = 'ATTACK';

    if (Math.abs(ball.x - botGoalX) < Math.abs(bot.x - botGoalX)) {
        strategy = 'EMERGENCY_DEFEND';
    } else if (distBallToOwnGoal < WIDTH * 0.4) {
        strategy = 'DEFEND';
    }

    if (strategy === 'EMERGENCY_DEFEND') {
        targetX = botGoalX + (isBotRed ? -50*SCALE : 50*SCALE);
        targetY = Math.max(pitchCenterY - 100*SCALE, Math.min(pitchCenterY + 100*SCALE, ball.y)); 
        if (distBall < 80 * SCALE) isSlide = true;
    } else if (strategy === 'DEFEND') {
        const ratio = 0.4;
        targetX = ball.x + (botGoalX - ball.x) * ratio;
        targetY = ball.y + (goalY - ball.y) * ratio * 0.5;
        if (distBall < 120 * SCALE) { targetX = futureBallX; targetY = futureBallY; }
    } else { 
        targetX = futureBallX;
        targetY = futureBallY;
    }

    if (targetX < buffer) targetX = buffer;
    if (targetX > WIDTH - buffer) targetX = WIDTH - buffer;
    if (targetY < topBar + buffer) targetY = topBar + buffer;
    if (targetY > HEIGHT - buffer) targetY = HEIGHT - buffer;

    if ((bot.x < 60*SCALE || bot.x > WIDTH - 60*SCALE) && (bot.y < topBar + 60*SCALE || bot.y > HEIGHT - 60*SCALE)) {
        targetX = WIDTH / 2; targetY = pitchCenterY;
    }

    const dxTarget = targetX - bot.x;
    const dyTarget = targetY - bot.y;
    const distTarget = Math.sqrt(dxTarget**2 + dyTarget**2);

    if (distTarget > 10 * SCALE) {
        moveX = dxTarget / distTarget;
        moveY = dyTarget / distTarget;
    }

    if (distBall < (bot.radius + ball.radius + KICK_DISTANCE) * SCALE) {
        isKick = true;
        const aimTop = dist(ball.x, ball.y, goalX, goalY - GOAL_HEIGHT/2) < dist(ball.x, ball.y, goalX, goalY + GOAL_HEIGHT/2);
        const aimY = aimTop ? goalY - GOAL_HEIGHT/2 + 20 : goalY + GOAL_HEIGHT/2 - 20;
        const dxG = goalX - ball.x; const dyG = aimY - ball.y;
        const mag = Math.sqrt(dxG**2 + dyG**2);
        bot.aimDirX = dxG / mag; bot.aimDirY = dyG / mag;
    } else {
        if(moveX !== 0 || moveY !== 0) { bot.aimDirX = moveX; bot.aimDirY = moveY; }
    }

    const isSprint = (distTarget > 150 * SCALE);
    applySprintLogic(bot, isSprint);

    return { moveX, moveY, isKick, isSlide };
}

function drawGameObjects(state, p1, p2, b) {
    const r = ball.radius * SCALE;
    // Árnyék
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 5*SCALE, r, r * 0.6, 0, 0, Math.PI*2); ctx.fill();
    // Labda
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill();
    drawPlayer(p1, state === 'playing' && p1.team === 'blue');
    drawPlayer(p2, state === 'playing' && !isBotActive && p2.team === 'red');
    if (state === 'playing') { drawStaminaBar(p1); if (!isBotActive) drawStaminaBar(p2); }
}

function drawPlayer(p, isActive) {
    const pr = p.radius * SCALE;
    const isSliding = p.slideTimer > SLIDE_RECOVERY;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath();
    ctx.ellipse(p.x, p.y + (isSliding?5:10)*SCALE, isSliding?pr*1.5:pr, isSliding?pr*0.8:pr*0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 4*SCALE; ctx.beginPath(); ctx.moveTo(p.x - 8*SCALE, p.y - 8*SCALE); ctx.lineTo(p.x + 8*SCALE, p.y + 8*SCALE); ctx.stroke();
    if (isActive || (currentMode==='1v1' && !isBotActive && !isActive && p.team === 'red')) {
        const triY = p.y - 30*SCALE; ctx.fillStyle = p.team === 'blue' ? COLORS.accentBlue : COLORS.redCard;
        ctx.beginPath(); ctx.moveTo(p.x, triY + 8*SCALE); ctx.lineTo(p.x - 6*SCALE, triY); ctx.lineTo(p.x + 6*SCALE, triY); ctx.closePath(); ctx.fill();
    }
}

function drawStaminaBar(p) {
    if(p.slideTimer > 0) return;
    const barW = 30*SCALE; const barH = 4*SCALE; const ratio = p.sprintTime / p.maxSprintTime;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.x - barW/2, p.y + 25*SCALE, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? COLORS.neonGreen : (ratio > 0.2 ? 'orange' : 'red');
    ctx.fillRect(p.x - barW/2, p.y + 25*SCALE, barW * ratio, barH);
}

// --- JAVÍTOTT PÁLYA RAJZOLÁS ---
function drawPitch() {
    const topBar = 60 * SCALE; // FIX 60px magas sáv
    const fieldHeight = HEIGHT - topBar; 
    
    // Fű
    const C_GRASS1 = '#2E5E2E'; const C_GRASS2 = '#346934'; const STRIPE_W = WIDTH / 12;
    for (let i = 0; i < 12; i++) { 
        ctx.fillStyle = (i % 2 === 0) ? C_GRASS1 : C_GRASS2; 
        ctx.fillRect(i * STRIPE_W, topBar, STRIPE_W, fieldHeight); 
    }
    
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3*SCALE; ctx.lineJoin = 'round';
    
    // Külső vonal (A sáv ALATT kezdődik + Margó)
    ctx.strokeRect(50*SCALE, topBar + 40*SCALE, WIDTH-100*SCALE, fieldHeight-80*SCALE);
    
    // Felező
    const midY = topBar + fieldHeight/2;
    ctx.beginPath(); ctx.moveTo(WIDTH/2, topBar + 40*SCALE); ctx.lineTo(WIDTH/2, HEIGHT-40*SCALE); ctx.stroke();
    ctx.beginPath(); ctx.arc(WIDTH/2, midY, CENTER_CIRCLE_RADIUS*SCALE, 0, Math.PI*2); ctx.stroke();
    
    // 16-osok
    const boxY = midY - (PENALTY_BOX_HEIGHT*SCALE)/2;
    ctx.strokeRect(50*SCALE, boxY, PENALTY_BOX_WIDTH*SCALE, PENALTY_BOX_HEIGHT*SCALE);
    ctx.strokeRect(WIDTH-50*SCALE-PENALTY_BOX_WIDTH*SCALE, boxY, PENALTY_BOX_WIDTH*SCALE, PENALTY_BOX_HEIGHT*SCALE);
    
    // Kapuk
    const netColor = 'rgba(255,255,255,0.3)';
    ctx.fillStyle = netColor; 
    ctx.fillRect(0, midY - (GOAL_HEIGHT*SCALE)/2, 50*SCALE, GOAL_HEIGHT*SCALE);
    ctx.fillRect(WIDTH-50*SCALE, midY - (GOAL_HEIGHT*SCALE)/2, 50*SCALE, GOAL_HEIGHT*SCALE);
}

// --- EREDMÉNYJELZŐ ---
function drawScoreboard() {
    const topBarHeight = 60 * SCALE; // FIX MÉRET

    // Fekete sáv
    ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, WIDTH, topBarHeight);
    ctx.fillStyle = '#333'; ctx.fillRect(0, topBarHeight, WIDTH, 2*SCALE);

    // Reklám
    ctx.font = getFont(20, 'bold'); ctx.fillStyle = '#444'; ctx.textAlign = 'left';
    ctx.fillText("PIZZA KING  |  SPORT FOGADÁS  |  BEST CARS  |  MEGA MARKET", 20 * SCALE, 38 * SCALE);

    // Eredményjelző középen
    const centerX = WIDTH / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath(); ctx.roundRect(centerX - 160*SCALE, 0, 320*SCALE, topBarHeight + 5*SCALE, 10*SCALE);
    ctx.fill(); ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.stroke();

    ctx.font = getFont(24, 'bold'); ctx.fillStyle = 'white';
    ctx.textAlign = 'right'; ctx.fillText(playerName.substring(0, 3).toUpperCase(), centerX - 60 * SCALE, 38 * SCALE);
    ctx.textAlign = 'left'; ctx.fillText(currentMode === 'career' ? opponentName.substring(0, 3).toUpperCase() : "VEN", centerX + 60 * SCALE, 38 * SCALE);

    ctx.fillStyle = COLORS.neonGreen; ctx.font = getFont(36, 'bold'); ctx.textAlign = 'center';
    ctx.fillText(`${scoreBlue} - ${scoreRed}`, centerX, 38 * SCALE);

    const min = Math.floor(timeLeftSeconds / 60); const sec = timeLeftSeconds % 60;
    ctx.fillStyle = '#AAA'; ctx.font = getFont(16);
    ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, centerX, 58 * SCALE);

    // BNZ SPORT & ÉLŐ
    const logoX = WIDTH - 140 * SCALE;
    ctx.textAlign = 'right'; ctx.font = getFont(26, 'bold italic'); ctx.fillStyle = 'white';
    ctx.fillText("BNZ", logoX, 30 * SCALE);
    ctx.fillStyle = COLORS.accentBlue; ctx.fillText("SPORT", WIDTH - 20 * SCALE, 30 * SCALE);

    ctx.fillStyle = '#CC0000'; ctx.fillRect(WIDTH - 70 * SCALE, 40 * SCALE, 50 * SCALE, 20 * SCALE);
    ctx.fillStyle = 'white'; ctx.font = getFont(14, 'bold'); ctx.textAlign = 'center';
    ctx.fillText("ÉLŐ", WIDTH - 45 * SCALE, 55 * SCALE);
}

function drawMenuOption(text, index, isSelected, x, startY) {
    const y = startY + index * (80*SCALE);
    if(isSelected) {
        ctx.fillStyle = COLORS.neonGreen; ctx.fillRect(x - 20*SCALE, y - 40*SCALE, 10*SCALE, 50*SCALE);
        ctx.font = getFont(50); ctx.fillStyle = 'white'; ctx.fillText(text, x, y);
    } else { ctx.font = getFont(40); ctx.fillStyle = COLORS.textGray; ctx.fillText(text, x, y); }
}
// --- MENÜK ÉS JÁTÉKMENET ---

function drawKey(key, x, y, w = 50, h = 50) {
    const sW = w * SCALE; const sH = h * SCALE;
    const radius = 8 * SCALE;
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.roundRect(x, y + 5*SCALE, sW, sH, radius); ctx.fill();
    ctx.fillStyle = '#333'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2 * SCALE;
    ctx.beginPath(); ctx.roundRect(x, y, sW, sH, radius); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'white'; ctx.font = getFont(20, 'bold'); ctx.textAlign = 'center';
    ctx.fillText(key, x + sW/2, y + sH/2 + 8*SCALE);
}

function drawControls() {
    drawPitch(); 
    ctx.fillStyle = 'rgba(16, 24, 32, 0.96)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.neonGreen; ctx.font = getFont(50);
    ctx.fillText("JÁTÉK ÚTMUTATÓ", WIDTH/2, 70*SCALE);

    const leftColX = WIDTH * 0.25; const rightColX = WIDTH * 0.75;
    const rowStart = 150 * SCALE;

    // BAL OLDAL
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.accentBlue; ctx.font = getFont(30);
    ctx.fillText("BILLENTYŰZET", leftColX, rowStart - 40*SCALE);
    drawKey("W", leftColX - 25*SCALE, rowStart);
    drawKey("A", leftColX - 80*SCALE, rowStart + 55*SCALE);
    drawKey("S", leftColX - 25*SCALE, rowStart + 55*SCALE);
    drawKey("D", leftColX + 30*SCALE, rowStart + 55*SCALE);
    ctx.fillStyle = '#AAA'; ctx.font = getFont(18); ctx.fillText("MOZGÁS", leftColX - 25*SCALE + 25*SCALE, rowStart + 130*SCALE);
    const actY = rowStart + 180 * SCALE;
    drawKey("SHIFT", leftColX - 120*SCALE, actY, 100); ctx.textAlign='left'; ctx.fillText("SPRINT (Vigyázz, fáraszt!)", leftColX, actY + 30*SCALE);
    drawKey("SPACE", leftColX - 120*SCALE, actY + 70*SCALE, 100); ctx.fillText("RÚGÁS / SZERELÉS", leftColX, actY + 100*SCALE);
    drawKey("CTRL", leftColX - 120*SCALE, actY + 140*SCALE, 100); ctx.fillText("BECSÚSZÁS (Veszélyes!)", leftColX, actY + 170*SCALE);

    // JOBB OLDAL
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.neonGreen; ctx.font = getFont(30);
    ctx.fillText("PRO TIPPEK", rightColX, rowStart - 40*SCALE);
    ctx.textAlign = 'left'; ctx.fillStyle = 'white'; ctx.font = getFont(22);
    const startTipY = rowStart + 20*SCALE;
    ctx.fillStyle = 'orange'; ctx.fillText("⚡ ÁLLÓKÉPESSÉG:", rightColX - 150*SCALE, startTipY);
    ctx.fillStyle = '#DDD'; ctx.font = getFont(18); ctx.fillText("A Sprint csökkenti az energiádat.", rightColX - 150*SCALE, startTipY + 30*SCALE);
    
    const tip2Y = startTipY + 100*SCALE;
    ctx.fillStyle = COLORS.redCard; ctx.font = getFont(22); ctx.fillText("🟥 SZABÁLYTALANSÁG:", rightColX - 150*SCALE, tip2Y);
    ctx.fillStyle = '#DDD'; ctx.font = getFont(18); ctx.fillText("Ha nem a labdát találod el,", rightColX - 150*SCALE, tip2Y + 30*SCALE); ctx.fillText("szabadrúgás vagy 11-es jár!", rightColX - 150*SCALE, tip2Y + 55*SCALE);

    ctx.textAlign = 'center'; ctx.fillStyle = '#AAA'; ctx.font = getFont(20); 
    ctx.fillText("NYOMJ ENTERT A VISSZALÉPÉSHEZ", WIDTH/2, HEIGHT - 50*SCALE);
}

function drawMatchSetup() {
    drawPitch();
    ctx.fillStyle = 'rgba(16, 24, 32, 0.95)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const midY = HEIGHT / 2;
    ctx.textAlign = 'right'; ctx.font = getFont(80, 'bold'); ctx.fillStyle = COLORS.accentBlue;
    ctx.fillText(playerName, WIDTH/2 - 100*SCALE, midY);
    ctx.textAlign = 'center'; ctx.font = getFont(100, 'italic bold'); ctx.fillStyle = 'white';
    ctx.fillText("VS", WIDTH/2, midY + 20*SCALE);
    ctx.textAlign = 'left'; ctx.font = getFont(80, 'bold'); ctx.fillStyle = '#FF4444';
    ctx.fillText(currentMode === 'career' ? opponentName : "VENDÉG", WIDTH/2 + 100*SCALE, midY);
    ctx.font = getFont(30); ctx.fillStyle = '#AAA'; ctx.textAlign = 'center';
    ctx.fillText("NYOMJ MEG EGY GOMBOT A KEZDÉSHEZ", WIDTH/2, HEIGHT - 100*SCALE);
}

function drawCareerTable() {
    drawPitch();
    ctx.fillStyle = 'rgba(16, 24, 32, 0.98)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.neonGreen; ctx.font = getFont(60);
    ctx.fillText("BAJNOKSÁG ÁLLÁSA", WIDTH/2, 80*SCALE);
    const startY = 160 * SCALE; const rowHeight = 45 * SCALE; const wHalf = WIDTH/2;
    const pos = { name: -350, p: 50, w: 120, d: 190, l: 260, pts: 350 };
    ctx.fillStyle = COLORS.textGray; ctx.font = getFont(24);
    ctx.textAlign = 'left'; ctx.fillText("CSAPAT", wHalf + pos.name * SCALE, startY - 20*SCALE);
    ctx.textAlign = 'center'; 
    ctx.fillText("M", wHalf + pos.p * SCALE, startY - 20*SCALE); ctx.fillText("GY", wHalf + pos.w * SCALE, startY - 20*SCALE);
    ctx.fillText("D", wHalf + pos.d * SCALE, startY - 20*SCALE); ctx.fillText("V", wHalf + pos.l * SCALE, startY - 20*SCALE);
    ctx.fillText("P", wHalf + pos.pts * SCALE, startY - 20*SCALE);
    leagueTable.forEach((team, index) => {
        const y = startY + index * rowHeight;
        if (team.isPlayer) { ctx.fillStyle = 'rgba(49, 237, 49, 0.15)'; ctx.fillRect(wHalf - 400*SCALE, y - 30*SCALE, 800*SCALE, rowHeight - 5*SCALE); ctx.fillStyle = COLORS.neonGreen; } else { ctx.fillStyle = 'white'; }
        ctx.font = getFont(26, team.isPlayer ? 'bold' : 'normal');
        ctx.textAlign = 'left'; ctx.fillText(`${index + 1}. ${team.name}`, wHalf + pos.name * SCALE, y);
        ctx.textAlign = 'center';
        ctx.fillText(team.played, wHalf + pos.p * SCALE, y); ctx.fillText(team.win, wHalf + pos.w * SCALE, y);
        ctx.fillText(team.draw, wHalf + pos.d * SCALE, y); ctx.fillText(team.loss, wHalf + pos.l * SCALE, y);
        ctx.font = getFont(28, 'bold'); ctx.fillText(team.points, wHalf + pos.pts * SCALE, y);
    });
    ctx.fillStyle = '#AAA'; ctx.font = getFont(20); ctx.fillText("NYOMJ ENTERT A VISSZALÉPÉSHEZ", WIDTH/2, HEIGHT - 50*SCALE);
}

function drawCareerMenu() {
    drawPitch(); ctx.fillStyle = 'rgba(16, 24, 32, 0.9)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.textAlign = 'left'; ctx.font = getFont(100, 'italic 900'); ctx.fillStyle = 'white'; ctx.fillText("KARRIER", 100*SCALE, 180*SCALE);
    ctx.fillStyle = COLORS.neonGreen; ctx.fillText("MÓD", 520*SCALE, 180*SCALE);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(100*SCALE, 220*SCALE, 400*SCALE, 150*SCALE);
    ctx.fillStyle = COLORS.accentBlue; ctx.fillRect(100*SCALE, 220*SCALE, 5*SCALE, 150*SCALE);
    ctx.font = getFont(40); ctx.fillStyle = 'white'; ctx.fillText(playerName, 120*SCALE, 270*SCALE);
    ctx.font = getFont(24); ctx.fillStyle = '#AAA'; ctx.fillText(`KÖVETKEZŐ MECCS: ${currentMatchDay} / ${MAX_MATCH_DAYS}`, 120*SCALE, 310*SCALE);
    ctx.fillStyle = COLORS.neonGreen; ctx.fillText(`ELLENFÉL: ${opponentName.toUpperCase()}`, 120*SCALE, 345*SCALE);
    careerMenuItems.forEach((item, i) => drawMenuOption(item.text, i, i===selectedMenuItem, WIDTH - 400*SCALE, 400*SCALE));
}

function drawMainMenu() {
    drawPitch(); ctx.fillStyle = 'rgba(16, 24, 32, 0.9)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.font = getFont(30, 'bold'); ctx.fillStyle = '#AAA'; ctx.textAlign = 'left'; 
    ctx.fillText("BNZ STUDIO PRESENTS", 100*SCALE, 80*SCALE);
    ctx.font = getFont(120, 'italic 900'); ctx.fillStyle = 'white'; ctx.fillText("MINI", 100*SCALE, 180*SCALE);
    ctx.fillStyle = COLORS.neonGreen; ctx.fillText("FOCA", 340*SCALE, 180*SCALE);
    mainMenuItems.forEach((item, i) => drawMenuOption(item.text, i, i===selectedMenuItem, 100*SCALE, 400*SCALE));
}

function handleNameInput(key) {
    if (key === 'Backspace') {
        if (currentNameInput.length > 0) currentNameInput = currentNameInput.slice(0, -1);
    } else if (key === 'Enter') {
        if (currentNameInput.trim().length > 0) {
            playerName = currentNameInput.trim();
            const pTeam = leagueTable.find(t => t.isPlayer);
            if (pTeam) pTeam.name = playerName; 
            gameState = 'career_menu';
        }
    } else if (currentNameInput.length < 15) {
        if (/^[a-zA-Z0-9 ]$/.test(key)) {
            currentNameInput += key.toUpperCase();
        }
    }
}

function drawNameInput() { 
    drawPitch(); 
    ctx.fillStyle='rgba(16, 24, 32, 0.95)'; ctx.fillRect(0,0,WIDTH,HEIGHT); 
    ctx.textAlign='center';
    ctx.fillStyle='white'; ctx.font=getFont(50); 
    ctx.fillText("ÚJ KARRIER KEZDÉSE", WIDTH/2, HEIGHT/2 - 100*SCALE);
    ctx.fillStyle='#AAA'; ctx.font=getFont(30); 
    ctx.fillText("ÍRD BE A CSAPATOD NEVÉT:", WIDTH/2, HEIGHT/2 - 40*SCALE);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(WIDTH/2 - 200*SCALE, HEIGHT/2, 400*SCALE, 60*SCALE);
    ctx.strokeStyle = COLORS.neonGreen; ctx.lineWidth = 3;
    ctx.strokeRect(WIDTH/2 - 200*SCALE, HEIGHT/2, 400*SCALE, 60*SCALE);
    ctx.fillStyle=COLORS.neonGreen; ctx.font=getFont(40); 
    const cursor = (Math.floor(Date.now() / 500) % 2 === 0) ? "|" : "";
    ctx.fillText(currentNameInput + cursor, WIDTH/2, HEIGHT/2 + 45*SCALE); 
    ctx.fillStyle='#AAA'; ctx.font=getFont(20); 
    ctx.fillText("NYOMJ ENTERT A FOLYTATÁSHOZ", WIDTH/2, HEIGHT/2 + 100*SCALE);
}

function handleMenuInput(menuItems, moveY, isKick) {
    let currentControlDown = (moveY > 0.5) || keys['s'] || keys['ArrowDown'];
    let currentControlUp = (moveY < -0.5) || keys['w'] || keys['ArrowUp'];
    let menuControlTriggered = (currentControlDown || currentControlUp) && !menuControlDownLastFrame;
    menuControlDownLastFrame = currentControlDown || currentControlUp;
    if (menuControlTriggered) {
        let menuIndex = (gameState === 'upgrade_selection') ? selectedUpgradeItem : selectedMenuItem;
        let setMenuIndex = (i) => { if(gameState === 'upgrade_selection') selectedUpgradeItem = i; else selectedMenuItem = i; };
        if (currentControlDown) setMenuIndex((menuIndex + 1) % menuItems.length);
        else if (currentControlUp) setMenuIndex((menuIndex - 1 + menuItems.length) % menuItems.length);
    }
    if (isKick) {
        const action = menuItems[(gameState === 'upgrade_selection') ? selectedUpgradeItem : selectedMenuItem].action;
        if (gameState === 'main_menu') {
            if (action === 'start_career') { currentMode = 'career'; isBotActive = true; currentNameInput = ""; gameState = 'name_input'; }
            else if (action === 'start_1v1') { currentMode = '1v1'; isBotActive = false; playerName = "HAZAI"; setOpponentDifficulty(); gameState = 'match_setup'; }
            else if (action === 'controls') { gameState = 'controls'; }
        } else if (gameState === 'career_menu') {
            if (action === 'start_match') { setOpponentDifficulty(); gameState = 'match_setup'; }
            else if (action === 'upgrade_menu') { gameState = 'upgrade_selection'; selectedUpgradeItem = 0; }
            else if (action === 'view_table') { gameState = 'career_table'; }
            else if (action === 'exit_career') { currentMatchDay = 1; gameState = 'main_menu'; resetBall(); }
        } else if (gameState === 'upgrade_selection') {
            const selectedItem = upgradeMenuItems[selectedUpgradeItem];
            if (selectedItem.action === 'back_to_career') gameState = 'career_menu';
            else if (selectedItem.action.startsWith('upgrade_') && playerUpgradePoints >= selectedItem.cost) {
                playerUpgradePoints -= selectedItem.cost; playerStats[selectedItem.stat] += selectedItem.bonus; applyPlayerUpgrades();
            }
        }
    }
}

// --- FŐ UPDATE LOOP ---
function update() {
    frameCounter++; updateGamepad();
    
    updateParticles(); // Effektek

    if (isReplaying) { playReplay(); return; }
    if (gameState === 'name_input') { return; } 

    let moveX1 = 0, moveY1 = 0, isSprint1 = false, isKick1 = false, isSlide1 = false;
    if(keys['w']||keys['ArrowUp']) moveY1 = -1; if(keys['s']||keys['ArrowDown']) moveY1 = 1;
    if(keys['a']||keys['ArrowLeft']) moveX1 = -1; if(keys['d']||keys['ArrowRight']) moveX1 = 1;
    isSprint1 = keys['Shift'];
    let kickKey = keys[' '] || keys['x'] || keys['Enter']; let slideKey = keys['Control'] || keys['c'];
    if(gamepads[0]) {
        if(Math.abs(gamepads[0].axes[0]) > 0.1) moveX1 = gamepads[0].axes[0]; if(Math.abs(gamepads[0].axes[1]) > 0.1) moveY1 = gamepads[0].axes[1];
        if(gamepads[0].buttons[0].pressed) kickKey = true; if(gamepads[0].buttons[1].pressed) slideKey = true; if(gamepads[0].buttons[5].pressed) isSprint1 = true;
    }
    isKick1 = kickKey && !lastKick1; lastKick1 = kickKey; isSlide1 = slideKey && !lastSlide1; lastSlide1 = slideKey;
    let isSkip = keys['Enter'] && !skipPressedLastFrame; skipPressedLastFrame = keys['Enter'];

    if (gameState === 'intro') { introTimer--; if (introTimer <= 0 || isSkip) gameState = 'main_menu'; return; }
    if (gameState === 'main_menu') { handleMenuInput(mainMenuItems, moveY1, isKick1); return; }
    if (gameState === 'career_menu') { handleMenuInput(careerMenuItems, moveY1, isKick1); return; }
    if (gameState === 'upgrade_selection') { handleMenuInput(upgradeMenuItems, moveY1, isKick1); return; }
    if (gameState === 'match_setup') { if(isSkip || isKick1) { scoreBlue=0; scoreRed=0; timeLeftSeconds=MATCH_DURATION_MINUTES*60; gameState='playing'; resetBall(); } return; }
    if (gameState === 'controls') { if(isSkip) gameState = 'main_menu'; return; }
    if (gameState === 'career_table') { if(isSkip) gameState = 'career_menu'; return; }
    if (gameState === 'finished') { if(isSkip || isKick1) { if(currentMode==='career') gameState='career_menu'; else gameState='main_menu'; } return; }

    if (gameState === 'playing' || gameState === 'foul_kick' || gameState === 'penalty') {
        applySprintLogic(player1, isSprint1);
        if(!applySlideLogic(player1, isSlide1, moveX1, moveY1)) { player1.vx = moveX1 * player1.speed * SCALE; player1.vy = moveY1 * player1.speed * SCALE; }
        player1.x += player1.vx; player1.y += player1.vy;
        if(Math.abs(moveX1) > 0 || Math.abs(moveY1) > 0) { player1.moveDirX = moveX1; player1.moveDirY = moveY1; }
        applyKickLogic(player1, isKick1);

        let moveX2 = 0, moveY2 = 0, isSprint2 = false, isKick2 = false, isSlide2 = false;
        if (isBotActive) {
            const bot = getBotMove(); moveX2 = bot.moveX; moveY2 = bot.moveY; isKick2 = bot.isKick; isSlide2 = bot.isSlide; isSprint2 = (bot.moveX !== 0 || bot.moveY !== 0);
            if(!applySlideLogic(player2, isSlide2, moveX2, moveY2)) { player2.vx = moveX2 * player2.speed * SCALE; player2.vy = moveY2 * player2.speed * SCALE; }
            player2.x += player2.vx; player2.y += player2.vy;
            applySprintLogic(player2, isSprint2);
        } else {
            if(keys['ArrowUp']) moveY2 = -1; if(keys['ArrowDown']) moveY2 = 1; if(keys['ArrowLeft']) moveX2 = -1; if(keys['ArrowRight']) moveX2 = 1; isSprint2 = keys['ShiftRight'];
            let kickKey2 = keys['.']; let slideKey2 = keys['-'];
            isKick2 = kickKey2 && !lastKick2; lastKick2 = kickKey2; isSlide2 = slideKey2 && !lastSlide2; lastSlide2 = slideKey2;
            applySprintLogic(player2, isSprint2);
            if(!applySlideLogic(player2, isSlide2, moveX2, moveY2)) { player2.vx = moveX2 * player2.speed * SCALE; player2.vy = moveY2 * player2.speed * SCALE; }
            player2.x += player2.vx; player2.y += player2.vy;
            if(Math.abs(moveX2)>0||Math.abs(moveY2)>0) { player2.moveDirX=moveX2; player2.moveDirY=moveY2; }
            applyKickLogic(player2, isKick2);
        }
        if(isBotActive) applyKickLogic(player2, isKick2);

        // --- JAVÍTOTT, RAGADÁSMENTES HATÁROK ---
        const TOP_BAR_H = 60 * SCALE; // Felső sáv fix magassága
        const MARGIN = 40 * SCALE;    // Margó a vonaltól
        
        // Pálya határainak pontos kiszámítása (ahol a vonalak vannak)
        // Bal: 50 | Jobb: WIDTH - 50
        // Fent: 60 (sáv) + 40 (margó) = 100
        // Lent: HEIGHT - 40
        const MIN_X = 50 * SCALE + player1.radius * SCALE;
        const MAX_X = WIDTH - 50 * SCALE - player1.radius * SCALE;
        const MIN_Y = TOP_BAR_H + MARGIN + player1.radius * SCALE;
        const MAX_Y = HEIGHT - MARGIN - player1.radius * SCALE;

        players.forEach(p => { 
            // Egyszerű "Clamping" (Nem nullázzuk a sebességet, így nem ragad be)
            if (p.x < MIN_X) p.x = MIN_X;
            if (p.x > MAX_X) p.x = MAX_X;
            if (p.y < MIN_Y) p.y = MIN_Y;
            if (p.y > MAX_Y) p.y = MAX_Y;
        });

        if(gameState === 'playing') {
            players.forEach(checkCollision);
            ball.vx *= ball.friction; ball.vy *= ball.friction; ball.x += ball.vx; ball.y += ball.vy;
            
            if (Math.abs(ball.vx) > 5 * SCALE || Math.abs(ball.vy) > 5 * SCALE) {
                 createParticle(ball.x, ball.y, 'trail', 'rgba(255, 255, 255, 0.4)');
            }

            // GÓL DETEKTÁLÁS (Középen a pályán)
            const PITCH_CENTER_Y = TOP_BAR_H + (HEIGHT - TOP_BAR_H) / 2;
            const isGoalY = ball.y > PITCH_CENTER_Y - (GOAL_HEIGHT*SCALE)/2 && 
                           ball.y < PITCH_CENTER_Y + (GOAL_HEIGHT*SCALE)/2;

            if (isGoalY) {
                if (ball.x < 50*SCALE) { scoreRed++; triggerGoal(); } 
                else if (ball.x > WIDTH - 50*SCALE) { scoreBlue++; triggerGoal(); }
            }
            
            // FALS ÉS HATÁROK (Labda)
            if (ball.x < 50*SCALE + ball.radius && !isGoalY) { ball.x = 50*SCALE + ball.radius; ball.vx = -ball.vx; }
            else if (ball.x > WIDTH - 50*SCALE - ball.radius && !isGoalY) { ball.x = WIDTH - 50*SCALE - ball.radius; ball.vx = -ball.vx; }
            
            // Labda Y határok (Ugyanott, mint a játékosoknál, de sugár korrekcióval)
            const BALL_MIN_Y = TOP_BAR_H + MARGIN + ball.radius;
            const BALL_MAX_Y = HEIGHT - MARGIN - ball.radius;
            
            if (ball.y < BALL_MIN_Y) { ball.y = BALL_MIN_Y; ball.vy = -ball.vy; }
            if (ball.y > BALL_MAX_Y) { ball.y = BALL_MAX_Y; ball.vy = -ball.vy; }
            
            saveFrame();
        }
    } 

    if (gameState === 'goal_scored') {
        goalTimer--;
        if (goalTimer <= 0) {
            if (timeLeftSeconds <= 0) { if (currentMode === 'career') finishCareerMatch(); else gameState = 'finished'; } 
            else { gameState = 'playing'; resetBall(); }
        }
    }
}

function triggerGoal() {
    isReplaying = true; replayIndex = 0; gameState = 'replay';
    for(let i=0; i<50; i++) {
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
        createParticle(WIDTH/2, HEIGHT/2 - 200*SCALE, 'confetti', colors[Math.floor(Math.random()*colors.length)]);
    }
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    
    // INTRO
    if (gameState === 'intro') { 
        drawPitch(); ctx.fillStyle='rgba(16, 24, 32, 0.95)'; ctx.fillRect(0,0,WIDTH,HEIGHT); 
        ctx.textAlign = 'center'; ctx.font = getFont(150, 'italic 900'); 
        ctx.fillStyle = 'white'; ctx.fillText("MINI", WIDTH/2 - 120*SCALE, HEIGHT/2 - 20*SCALE);
        ctx.fillStyle = COLORS.neonGreen; ctx.fillText("FOCA", WIDTH/2 + 180*SCALE, HEIGHT/2 - 20*SCALE);
        ctx.font = getFont(40, 'bold'); ctx.fillStyle = '#AAAAAA'; ctx.fillText("BNZ STUDIO", WIDTH/2, HEIGHT/2 + 50*SCALE);
        return; 
    }

    if (gameState === 'main_menu') { drawMainMenu(); return; }
    if (gameState === 'career_menu') { drawCareerMenu(); return; } 
    if (gameState === 'upgrade_selection') { drawUpgradeMenu(); return; }
    if (gameState === 'name_input') { drawNameInput(); return; }
    if (gameState === 'match_setup') { drawMatchSetup(); return; }
    if (gameState === 'controls') { drawControls(); return; }
    if (gameState === 'career_table') { drawCareerTable(); return; }
    if (gameState === 'finished') {
        drawPitch(); ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
        ctx.fillStyle = 'white'; ctx.textAlign='center'; ctx.font=getFont(50); ctx.fillText("MECCS VÉGE", WIDTH/2, HEIGHT/2 - 50*SCALE);
        ctx.font = getFont(90); ctx.fillStyle = (scoreBlue > scoreRed) ? COLORS.neonGreen : COLORS.redCard; ctx.fillText(`${scoreBlue} - ${scoreRed}`, WIDTH/2, HEIGHT/2 + 50*SCALE);
        ctx.font = getFont(20); ctx.fillStyle = '#AAA'; ctx.fillText("NYOMJ ENTERT", WIDTH/2, HEIGHT/2 + 200*SCALE);
        return;
    }

    drawPitch(); 
    drawParticles(); // Effektek
    drawGameObjects(gameState, player1, player2, ball);

    if (isReplaying) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = 'white'; ctx.font = getFont(40); ctx.textAlign = 'right'; ctx.fillText("VISSZAJÁTSZÁS", WIDTH - 50*SCALE, 50*SCALE);
    }

    if(gameState === 'goal_scored') {
        ctx.fillStyle = 'rgba(49, 237, 49, 0.8)'; ctx.fillRect(0, HEIGHT/2 - 60*SCALE, WIDTH, 120*SCALE);
        ctx.fillStyle = 'white'; ctx.font = getFont(100, 'italic 900'); ctx.textAlign = 'center'; 
        ctx.shadowColor='black'; ctx.shadowBlur=20; ctx.fillText("GÓÓÓL!", WIDTH/2, HEIGHT/2 + 35*SCALE); ctx.shadowBlur=0;
    } 
    drawScoreboard();
}

function drawUpgradeMenu() { drawPitch(); ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.fillRect(0,0,WIDTH,HEIGHT); upgradeMenuItems.forEach((item,i)=>drawMenuOption(item.text + (item.cost?` (${item.cost}p)`:""),i,i===selectedUpgradeItem, 100*SCALE, 200*SCALE)); }

function gameLoop(timestamp) {
    if (gameState === 'playing' && timeLeftSeconds > 0 && timestamp - lastTime > TIME_INTERVAL) {
        timeLeftSeconds--; lastTime = timestamp;
        if (timeLeftSeconds <= 0) { if (currentMode === 'career') finishCareerMatch(); else gameState = 'finished'; }
    }
    update(); draw(); requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
