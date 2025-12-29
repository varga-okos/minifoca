// --- MENÜ VÁLTOZÓK ---
let mainMenuItems = [{ text: "KARRIER INDÍTÁSA", action: 'start_career' }, { text: "HELYI MECCS (1v1)", action: 'start_1v1' }, { text: "SÚGÓ", action: 'controls' }];
let careerMenuItems = [{ text: "KÖVETKEZŐ MECCS", action: 'start_match' }, { text: "JÁTÉKOS FEJLESZTÉS", action: 'upgrade_menu' }, { text: "TABELLA", action: 'view_table' }, { text: "KILÉPÉS", action: 'exit_career' }];
let upgradeMenuItems = [{ text: "Sebesség növelése", action: 'upgrade_speed', stat: 'baseSpeed', cost: UPGRADE_COST, bonus: 0.05 }, { text: "Sprint Idő növelése", action: 'upgrade_sprint_time', stat: 'maxSprintTime', cost: UPGRADE_COST, bonus: 0.1 }, { text: "Rúgás Erő növelése", action: 'upgrade_kick_power', stat: 'kickPower', cost: UPGRADE_COST, bonus: 0.15 }, { text: "Vissza a Karrier Menübe", action: 'back_to_career' }];

let selectedMenuItem = 0;
let selectedUpgradeItem = 0;
let menuControlDownLastFrame = false;

// --- INPUT KEZELÉS ---
let keys = {};
let gamepads = [null, null];
let lastKick1 = false, lastKick2 = false;
let lastSlide1 = false, lastSlide2 = false;
let skipPressedLastFrame = false;

window.addEventListener('keydown', function(e) {
    if (gameState === 'name_input') {
        playSound('menu');
        if (e.key === 'Backspace') { e.preventDefault(); handleNameInput('Backspace'); } 
        else if (e.key === 'Enter') { handleNameInput('Enter'); } 
        else if (e.key.length === 1) { handleNameInput(e.key); }
        return; 
    }
    
    // --- "Q" GOMB: VÉSZFÉK ---
    if (e.key === 'q' || e.key === 'Q') {
        keys = {}; 
        if (typeof player1 !== 'undefined') { player1.vx = 0; player1.vy = 0; player1.moveDirX = 0; player1.moveDirY = 0; }
        if (typeof player2 !== 'undefined') { player2.vx = 0; player2.vy = 0; player2.moveDirX = 0; player2.moveDirY = 0; }
        return; 
    }

    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
    if (!e.repeat) { keys[e.key] = true; keys[e.code] = true; }
});

window.addEventListener('keyup', function(e) { keys[e.key] = false; keys[e.code] = false; });
window.addEventListener('blur', function() { keys = {}; });
window.addEventListener("gamepadconnected", (e) => { gamepads[e.gamepad.index] = e.gamepad; });
window.addEventListener("gamepaddisconnected", (e) => { gamepads[e.gamepad.index] = null; });

function updateGamepad() { const connectedPads = navigator.getGamepads ? navigator.getGamepads() : []; if (connectedPads[0]) gamepads[0] = connectedPads[0]; }

// --- LOGIKA SEGÉDFÜGGVÉNYEK ---
function saveFrame() { replayBuffer.push({ bx: ball.x, by: ball.y, p1x: player1.x, p1y: player1.y, p1s: player1.slideTimer, p2x: player2.x, p2y: player2.y, p2s: player2.slideTimer }); if (replayBuffer.length > REPLAY_DURATION) replayBuffer.shift(); }
function playReplay() {
    if (replayIndex < replayBuffer.length) {
        const frame = replayBuffer[replayIndex];
        ball.x = frame.bx; ball.y = frame.by; player1.x = frame.p1x; player1.y = frame.p1y; player1.slideTimer = frame.p1s; player2.x = frame.p2x; player2.y = frame.p2y; player2.slideTimer = frame.p2s;
        replayIndex++;
    } else { isReplaying = false; gameState = 'goal_scored'; goalTimer = GOAL_PAUSE_TIME; }
}

function resetBall() {
    ball.x = WIDTH/2; ball.y = HEIGHT/2; ball.vx = 0; ball.vy = 0;
    player1.x = WIDTH * 0.25; player1.y = HEIGHT * 0.5; player2.x = WIDTH * 0.75; player2.y = HEIGHT * 0.5;
    applyPlayerUpgrades(); setOpponentDifficulty();
    player1.sprintTime = player1.maxSprintTime; player2.sprintTime = player2.maxSprintTime;
    particles = []; replayBuffer = [];
    playSound('whistle'); // KEZDŐ SÍPSZÓ
}

function setOpponentDifficulty() {
    if (currentMode !== 'career' || !isBotActive) { OPPONENT_DIFFICULTY = 1.0; player2.baseSpeed = BASE_SPEED; return; }
    const opponentTeam = leagueTable.find(team => team.name === opponentName);
    OPPONENT_DIFFICULTY = opponentTeam ? opponentTeam.difficulty : 1.0;
    player2.baseSpeed = BASE_SPEED * OPPONENT_DIFFICULTY;
    player2.speed = player2.baseSpeed;
    player2.kickPower = KICK_POWER * (0.8 + (OPPONENT_DIFFICULTY * 0.2));
}

function finishCareerMatch() {
    playSound('whistle');
    const playerTeam = leagueTable.find(t => t.isPlayer);
    const opponentTeam = leagueTable.find(t => t.name === opponentName);
    if (scoreBlue > scoreRed) { playerTeam.points += 3; playerTeam.win++; playerUpgradePoints += 15; } 
    else if (scoreBlue < scoreRed) { opponentTeam.points += 3; opponentTeam.win++; playerUpgradePoints += 2; } 
    else { playerTeam.points++; opponentTeam.points++; playerTeam.draw++; opponentTeam.draw++; playerUpgradePoints += 5; }
    playerTeam.played++; opponentTeam.played++;
    simulateOtherMatches();
    currentMatchDay++;
    if (currentMatchDay <= MAX_MATCH_DAYS) {
        const otherTeams = leagueTable.filter(t => !t.isPlayer);
        opponentName = otherTeams[Math.floor(Math.random() * otherTeams.length)].name;
    }
    gameState = 'finished';
}

function simulateOtherMatches() {
    let otherTeams = leagueTable.filter(t => !t.isPlayer && t.name !== opponentName);
    otherTeams.sort(() => Math.random() - 0.5);
    while (otherTeams.length >= 2) {
        const teamA = otherTeams.pop(); const teamB = otherTeams.pop();
        const goalsA = Math.floor(Math.random()*3); const goalsB = Math.floor(Math.random()*3);
        teamA.played++; teamB.played++;
        if (goalsA > goalsB) { teamA.points += 3; teamA.win++; teamB.loss++; }
        else if (goalsB > goalsA) { teamB.points += 3; teamB.win++; teamA.loss++; }
        else { teamA.points++; teamB.points++; teamA.draw++; teamB.draw++; }
    }
    leagueTable.sort((a, b) => b.points - a.points);
}

function handleNameInput(key) {
    if (key === 'Backspace') { if (currentNameInput.length > 0) currentNameInput = currentNameInput.slice(0, -1); } 
    else if (key === 'Enter') { if (currentNameInput.trim().length > 0) { playerName = currentNameInput.trim(); const pTeam = leagueTable.find(t => t.isPlayer); if (pTeam) pTeam.name = playerName; gameState = 'career_menu'; } } 
    else if (currentNameInput.length < 15 && /^[a-zA-Z0-9 ]$/.test(key)) { currentNameInput += key.toUpperCase(); }
}

function handleMenuInput(menuItems, moveY, isKick) {
    let currentControlDown = (moveY > 0.5) || keys['s'] || keys['ArrowDown'];
    let currentControlUp = (moveY < -0.5) || keys['w'] || keys['ArrowUp'];
    let menuControlTriggered = (currentControlDown || currentControlUp) && !menuControlDownLastFrame;
    menuControlDownLastFrame = currentControlDown || currentControlUp;
    if (menuControlTriggered) {
        playSound('menu');
        let menuIndex = (gameState === 'upgrade_selection') ? selectedUpgradeItem : selectedMenuItem;
        let setMenuIndex = (i) => { if(gameState === 'upgrade_selection') selectedUpgradeItem = i; else selectedMenuItem = i; };
        if (currentControlDown) setMenuIndex((menuIndex + 1) % menuItems.length);
        else if (currentControlUp) setMenuIndex((menuIndex - 1 + menuItems.length) % menuItems.length);
    }
    if (isKick) {
        playSound('menu');
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

function constrainToPitch(p) {
    const TOP_BAR_H = 60 * SCALE;
    const MARGIN = 42 * SCALE; 
    const MIN_X = 50 * SCALE + p.radius * SCALE;
    const MAX_X = WIDTH - 50 * SCALE - p.radius * SCALE;
    const MIN_Y = TOP_BAR_H + 40 * SCALE + p.radius * SCALE; 
    const MAX_Y = HEIGHT - 40 * SCALE - p.radius * SCALE;
    if (p.x < MIN_X) { p.x = MIN_X + 0.1; p.vx = 0; }
    if (p.x > MAX_X) { p.x = MAX_X - 0.1; p.vx = 0; }
    if (p.y < MIN_Y) { p.y = MIN_Y + 0.1; p.vy = 0; }
    if (p.y > MAX_Y) { p.y = MAX_Y - 0.1; p.vy = 0; }
}

function update() {
    frameCounter++; updateGamepad(); updateParticles();
    if (isReplaying) { playReplay(); return; }
    if (gameState === 'name_input') return;

    let moveX1 = 0, moveY1 = 0, isSprint1 = false, isKick1 = false, isSlide1 = false;
    if(keys['w']) moveY1 = -1; if(keys['s']) moveY1 = 1; if(keys['a']) moveX1 = -1; if(keys['d']) moveX1 = 1;
    if (isBotActive) { if(keys['ArrowUp']) moveY1 = -1; if(keys['ArrowDown']) moveY1 = 1; if(keys['ArrowLeft']) moveX1 = -1; if(keys['ArrowRight']) moveX1 = 1; }
    
    isSprint1 = (keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight']);
    
    let kickKey = keys[' '] || keys['x'] || keys['Enter']; let slideKey = keys['Control'] || keys['c'];
    if(gamepads[0]) {
        if(Math.abs(gamepads[0].axes[0]) > 0.1) moveX1 = gamepads[0].axes[0]; if(Math.abs(gamepads[0].axes[1]) > 0.1) moveY1 = gamepads[0].axes[1];
        if(gamepads[0].buttons[0].pressed) kickKey = true; if(gamepads[0].buttons[1].pressed) slideKey = true; if(gamepads[0].buttons[5].pressed) isSprint1 = true;
    }
    isKick1 = kickKey && !lastKick1; lastKick1 = kickKey; isSlide1 = slideKey && !lastSlide1; lastSlide1 = slideKey;
    let isSkip = keys['Enter'] && !skipPressedLastFrame; skipPressedLastFrame = keys['Enter'];

    if (gameState === 'intro') { introTimer--; if (introTimer <= 0 || isSkip) { gameState = 'main_menu'; playSound('menu'); } return; }
    if (gameState === 'main_menu') { handleMenuInput(mainMenuItems, moveY1, isKick1); return; }
    if (gameState === 'career_menu') { handleMenuInput(careerMenuItems, moveY1, isKick1); return; }
    if (gameState === 'upgrade_selection') { handleMenuInput(upgradeMenuItems, moveY1, isKick1); return; }
    if (gameState === 'match_setup') { if(isSkip || isKick1) { scoreBlue=0; scoreRed=0; timeLeftSeconds=MATCH_DURATION_MINUTES*60; gameState='playing'; resetBall(); } return; }
    if (gameState === 'controls') { if(isSkip) gameState = 'main_menu'; return; }
    if (gameState === 'career_table') { if(isSkip) gameState = 'career_menu'; return; }
    if (gameState === 'finished') { if(isSkip || isKick1) { if(currentMode==='career') gameState='career_menu'; else gameState='main_menu'; } return; }

    if (gameState === 'playing' || gameState === 'foul_kick' || gameState === 'penalty') {
        applySprintLogic(player1, isSprint1);
        if(!applySlideLogic(player1, isSlide1, moveX1, moveY1)) { 
            player1.vx = moveX1 * player1.speed * SCALE; player1.vy = moveY1 * player1.speed * SCALE; 
        }
        player1.x += player1.vx; player1.y += player1.vy;
        if(Math.abs(moveX1) > 0 || Math.abs(moveY1) > 0) { player1.moveDirX = moveX1; player1.moveDirY = moveY1; }
        
        // HANGOK RÚGÁSHOZ
        if (isKick1) playSound('kick'); 
        applyKickLogic(player1, isKick1);

        let moveX2 = 0, moveY2 = 0, isSprint2 = false, isKick2 = false, isSlide2 = false;
        if (isBotActive) {
            const bot = getBotMove(); moveX2 = bot.moveX; moveY2 = bot.moveY; isKick2 = bot.isKick; isSlide2 = bot.isSlide; isSprint2 = (bot.moveX !== 0 || bot.moveY !== 0);
            if(!applySlideLogic(player2, isSlide2, moveX2, moveY2)) { player2.vx = moveX2 * player2.speed * SCALE; player2.vy = moveY2 * player2.speed * SCALE; }
            player2.x += player2.vx; player2.y += player2.vy;
            applySprintLogic(player2, isSprint2);
        } else {
            if(keys['ArrowUp']) moveY2 = -1; if(keys['ArrowDown']) moveY2 = 1; if(keys['ArrowLeft']) moveX2 = -1; if(keys['ArrowRight']) moveX2 = 1;
            isSprint2 = keys['ShiftRight']; let kickKey2 = keys['.']; let slideKey2 = keys['-'];
            isKick2 = kickKey2 && !lastKick2; lastKick2 = kickKey2; isSlide2 = slideKey2 && !lastSlide2; lastSlide2 = slideKey2;
            applySprintLogic(player2, isSprint2);
            if(!applySlideLogic(player2, isSlide2, moveX2, moveY2)) { player2.vx = moveX2 * player2.speed * SCALE; player2.vy = moveY2 * player2.speed * SCALE; }
            player2.x += player2.vx; player2.y += player2.vy;
            if(Math.abs(moveX2)>0||Math.abs(moveY2)>0) { player2.moveDirX=moveX2; player2.moveDirY=moveY2; }
            
            if (isKick2) playSound('kick');
            applyKickLogic(player2, isKick2);
        }
        if(isBotActive && isKick2) playSound('kick');
        if(isBotActive) applyKickLogic(player2, isKick2);

        constrainToPitch(player1); constrainToPitch(player2);

        if(gameState === 'playing') {
            players.forEach(checkCollision);
            ball.vx *= ball.friction; ball.vy *= ball.friction; ball.x += ball.vx; ball.y += ball.vy;
            if (Math.abs(ball.vx) > 5 * SCALE || Math.abs(ball.vy) > 5 * SCALE) createParticle(ball.x, ball.y, 'trail', 'rgba(255, 255, 255, 0.4)');
            
            constrainToPitch(player1); constrainToPitch(player2);

            const TOP_BAR_H = 60 * SCALE; 
            const PITCH_CENTER_Y = TOP_BAR_H + (HEIGHT - TOP_BAR_H) / 2;
            const isGoalY = ball.y > PITCH_CENTER_Y - (GOAL_HEIGHT*SCALE)/2 && ball.y < PITCH_CENTER_Y + (GOAL_HEIGHT*SCALE)/2;
            if (isGoalY) { if (ball.x < 50*SCALE) { scoreRed++; triggerGoal(); } else if (ball.x > WIDTH - 50*SCALE) { scoreBlue++; triggerGoal(); } }
            
            // HANGOK FALHOZ
            if (ball.x < 50*SCALE + ball.radius && !isGoalY) { ball.x = 50*SCALE + ball.radius; ball.vx = -ball.vx; playSound('wall'); }
            else if (ball.x > WIDTH - 50*SCALE - ball.radius && !isGoalY) { ball.x = WIDTH - 50*SCALE - ball.radius; ball.vx = -ball.vx; playSound('wall'); }
            
            const BALL_MIN_Y = TOP_BAR_H + 40*SCALE + ball.radius; const BALL_MAX_Y = HEIGHT - 40*SCALE - ball.radius;
            if (ball.y < BALL_MIN_Y) { ball.y = BALL_MIN_Y; ball.vy = -ball.vy; playSound('wall'); }
            if (ball.y > BALL_MAX_Y) { ball.y = BALL_MAX_Y; ball.vy = -ball.vy; playSound('wall'); }
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
    playSound('goal'); // GÓLÖRÖM HANG
    isReplaying = true; replayIndex = 0; gameState = 'replay';
    for(let i=0; i<50; i++) {
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
        createParticle(WIDTH/2, HEIGHT/2 - 200*SCALE, 'confetti', colors[Math.floor(Math.random()*colors.length)]);
    }
}

// --- RAJZOLÁS ---

function drawPitch() {
    const topBar = 60 * SCALE; const fieldHeight = HEIGHT - topBar; 
    const C_GRASS1 = '#2E5E2E'; const C_GRASS2 = '#346934'; const STRIPE_W = WIDTH / 12;
    for (let i = 0; i < 12; i++) { ctx.fillStyle = (i % 2 === 0) ? C_GRASS1 : C_GRASS2; ctx.fillRect(i * STRIPE_W, topBar, STRIPE_W, fieldHeight); }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3*SCALE; ctx.lineJoin = 'round';
    ctx.strokeRect(50*SCALE, topBar + 40*SCALE, WIDTH-100*SCALE, fieldHeight-80*SCALE);
    const midY = topBar + fieldHeight/2;
    ctx.beginPath(); ctx.moveTo(WIDTH/2, topBar + 40*SCALE); ctx.lineTo(WIDTH/2, HEIGHT-40*SCALE); ctx.stroke();
    ctx.beginPath(); ctx.arc(WIDTH/2, midY, CENTER_CIRCLE_RADIUS*SCALE, 0, Math.PI*2); ctx.stroke();
    const boxY = midY - (PENALTY_BOX_HEIGHT*SCALE)/2;
    ctx.strokeRect(50*SCALE, boxY, PENALTY_BOX_WIDTH*SCALE, PENALTY_BOX_HEIGHT*SCALE);
    ctx.strokeRect(WIDTH-50*SCALE-PENALTY_BOX_WIDTH*SCALE, boxY, PENALTY_BOX_WIDTH*SCALE, PENALTY_BOX_HEIGHT*SCALE);
    
    // --- KAPU (HÁLÓS) ---
    drawGoal(0, midY - (GOAL_HEIGHT*SCALE)/2, 50*SCALE, GOAL_HEIGHT*SCALE);
    drawGoal(WIDTH-50*SCALE, midY - (GOAL_HEIGHT*SCALE)/2, 50*SCALE, GOAL_HEIGHT*SCALE);
}

function drawGoal(x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
    for(let i=0; i<=w; i+=8*SCALE) { ctx.beginPath(); ctx.moveTo(x+i, y); ctx.lineTo(x+i, y+h); ctx.stroke(); }
    for(let i=0; i<=h; i+=8*SCALE) { ctx.beginPath(); ctx.moveTo(x, y+i); ctx.lineTo(x+w, y+i); ctx.stroke(); }
    ctx.lineWidth = 4*SCALE; ctx.strokeStyle = 'white'; ctx.strokeRect(x, y, w, h);
}

function drawGameObjects(state, p1, p2, b) {
    drawBall(b);
    drawPlayer(p1, state === 'playing' && p1.team === 'blue');
    drawPlayer(p2, state === 'playing' && !isBotActive && p2.team === 'red');
    if (state === 'playing') { drawStaminaBar(p1); if (!isBotActive) drawStaminaBar(p2); }
}

function drawBall(b) {
    const r = b.radius * SCALE;
    let grad = ctx.createRadialGradient(b.x - r*0.3, b.y - r*0.3, r*0.2, b.x, b.y, r);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#cccccc');
    ctx.fillStyle = grad; 
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; 
    
    ctx.save(); ctx.translate(b.x, b.y); 
    const rot = (b.x + b.y) * 0.1; ctx.rotate(rot);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r*0.5, -r*0.5); ctx.lineTo(0, 0); ctx.lineTo(-r*0.5, -r*0.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(r*0.5, r*0.5); ctx.lineTo(0, 0); ctx.lineTo(-r*0.5, r*0.5); ctx.fill();
    ctx.restore();
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

function drawScoreboard() {
    const topBarHeight = 70 * SCALE; const centerX = WIDTH / 2;
    let gradient = ctx.createLinearGradient(0, 0, 0, topBarHeight);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)'); gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, WIDTH, topBarHeight);
    const boxW = 280 * SCALE; const boxH = 45 * SCALE; const boxY = 15 * SCALE;
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.roundRect(centerX - boxW/2, boxY, boxW, boxH, 10*SCALE); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; 
    ctx.fillStyle = COLORS.accentBlue; ctx.beginPath(); ctx.roundRect(centerX - boxW/2, boxY, 6*SCALE, boxH, [10*SCALE, 0, 0, 10*SCALE]); ctx.fill();
    ctx.fillStyle = COLORS.redCard; ctx.beginPath(); ctx.roundRect(centerX + boxW/2 - 6*SCALE, boxY, 6*SCALE, boxH, [0, 10*SCALE, 10*SCALE, 0]); ctx.fill();
    ctx.font = getFont(22, 'bold'); ctx.fillStyle = 'white';
    ctx.textAlign = 'right'; ctx.fillText(playerName.substring(0, 3).toUpperCase(), centerX - 40 * SCALE, boxY + 32 * SCALE);
    ctx.textAlign = 'left'; const oppName = currentMode === 'career' ? opponentName.substring(0, 3).toUpperCase() : "VEN";
    ctx.fillText(oppName, centerX + 40 * SCALE, boxY + 32 * SCALE);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(centerX - 30*SCALE, boxY, 60*SCALE, boxH);
    ctx.fillStyle = COLORS.neonGreen; ctx.font = getFont(32, 'bold'); ctx.textAlign = 'center'; ctx.fillText(`${scoreBlue} - ${scoreRed}`, centerX, boxY + 34 * SCALE);
    const timeBoxW = 70 * SCALE; const timeBoxH = 25 * SCALE;
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.moveTo(centerX - timeBoxW/2, boxY + boxH); ctx.lineTo(centerX + timeBoxW/2, boxY + boxH); ctx.lineTo(centerX + timeBoxW/2 - 5*SCALE, boxY + boxH + timeBoxH); ctx.lineTo(centerX - timeBoxW/2 + 5*SCALE, boxY + boxH + timeBoxH); ctx.fill();
    const min = Math.floor(timeLeftSeconds / 60); const sec = timeLeftSeconds % 60;
    ctx.fillStyle = 'white'; ctx.font = getFont(16, 'bold'); ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, centerX, boxY + boxH + 18 * SCALE);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.roundRect(WIDTH - 70*SCALE, 20*SCALE, 50*SCALE, 20*SCALE, 4*SCALE); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = getFont(12, 'bold'); ctx.fillText("ÉLŐ", WIDTH - 45*SCALE, 34*SCALE);
    if (Math.floor(Date.now() / 500) % 2 === 0) { ctx.beginPath(); ctx.arc(WIDTH - 63*SCALE, 30*SCALE, 3*SCALE, 0, Math.PI*2); ctx.fill(); }
    ctx.textAlign = 'left'; ctx.font = getFont(18, 'italic bold'); ctx.fillStyle = '#64748b'; ctx.fillText("BNZ", 20*SCALE, 35*SCALE); ctx.fillStyle = 'white'; ctx.fillText("LIGA", 55*SCALE, 35*SCALE);
}

function drawMenuOption(text, index, isSelected, x, startY) {
    const y = startY + index * (80*SCALE);
    if(isSelected) { ctx.fillStyle = COLORS.neonGreen; ctx.fillRect(x - 20*SCALE, y - 40*SCALE, 10*SCALE, 50*SCALE); ctx.font = getFont(50); ctx.fillStyle = 'white'; ctx.fillText(text, x, y); } 
    else { ctx.font = getFont(40); ctx.fillStyle = COLORS.textGray; ctx.fillText(text, x, y); }
}

function drawKey(key, x, y, w = 50, h = 50) {
    const sW = w * SCALE; const sH = h * SCALE; const radius = 8 * SCALE;
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.roundRect(x, y + 5*SCALE, sW, sH, radius); ctx.fill();
    ctx.fillStyle = '#333'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2 * SCALE;
    ctx.beginPath(); ctx.roundRect(x, y, sW, sH, radius); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'white'; ctx.font = getFont(20, 'bold'); ctx.textAlign = 'center'; ctx.fillText(key, x + sW/2, y + sH/2 + 8*SCALE);
}

function drawMainMenu() {
    drawPitch(); ctx.fillStyle = 'rgba(16, 24, 32, 0.9)'; ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.font = getFont(30, 'bold'); ctx.fillStyle = '#AAA'; ctx.textAlign = 'left'; 
    ctx.fillText("BNZ STUDIO PRESENTS", 100*SCALE, 80*SCALE);
    ctx.font = getFont(120, 'italic 900'); ctx.fillStyle = 'white'; ctx.fillText("MINI", 100*SCALE, 180*SCALE);
    ctx.fillStyle = COLORS.neonGreen; ctx.fillText("FOCA", 340*SCALE, 180*SCALE);
    mainMenuItems.forEach((item, i) => drawMenuOption(item.text, i, i===selectedMenuItem, 100*SCALE, 400*SCALE));
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

function drawUpgradeMenu() { drawPitch(); ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.fillRect(0,0,WIDTH,HEIGHT); upgradeMenuItems.forEach((item,i)=>drawMenuOption(item.text + (item.cost?` (${item.cost}p)`:""),i,i===selectedUpgradeItem, 100*SCALE, 200*SCALE)); }

function drawNameInput() { 
    drawPitch(); ctx.fillStyle='rgba(16, 24, 32, 0.95)'; ctx.fillRect(0,0,WIDTH,HEIGHT); ctx.textAlign='center';
    ctx.fillStyle='white'; ctx.font=getFont(50); ctx.fillText("ÚJ KARRIER KEZDÉSE", WIDTH/2, HEIGHT/2 - 100*SCALE);
    ctx.fillStyle='#AAA'; ctx.font=getFont(30); ctx.fillText("ÍRD BE A CSAPATOD NEVÉT:", WIDTH/2, HEIGHT/2 - 40*SCALE);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(WIDTH/2 - 200*SCALE, HEIGHT/2, 400*SCALE, 60*SCALE);
    ctx.strokeStyle = COLORS.neonGreen; ctx.lineWidth = 3; ctx.strokeRect(WIDTH/2 - 200*SCALE, HEIGHT/2, 400*SCALE, 60*SCALE);
    ctx.fillStyle=COLORS.neonGreen; ctx.font=getFont(40); 
    const cursor = (Math.floor(Date.now() / 500) % 2 === 0) ? "|" : "";
    ctx.fillText(currentNameInput + cursor, WIDTH/2, HEIGHT/2 + 45*SCALE); 
    ctx.fillStyle='#AAA'; ctx.font=getFont(20); ctx.fillText("NYOMJ ENTERT A FOLYTATÁSHOZ", WIDTH/2, HEIGHT/2 + 100*SCALE);
}

function drawMatchSetup() {
    drawPitch(); ctx.fillStyle = 'rgba(16, 24, 32, 0.95)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const midY = HEIGHT / 2;
    ctx.textAlign = 'right'; ctx.font = getFont(80, 'bold'); ctx.fillStyle = COLORS.accentBlue; ctx.fillText(playerName, WIDTH/2 - 100*SCALE, midY);
    ctx.textAlign = 'center'; ctx.font = getFont(100, 'italic bold'); ctx.fillStyle = 'white'; ctx.fillText("VS", WIDTH/2, midY + 20*SCALE);
    ctx.textAlign = 'left'; ctx.font = getFont(80, 'bold'); ctx.fillStyle = '#FF4444'; ctx.fillText(currentMode === 'career' ? opponentName : "VENDÉG", WIDTH/2 + 100*SCALE, midY);
    ctx.font = getFont(30); ctx.fillStyle = '#AAA'; ctx.textAlign = 'center'; ctx.fillText("NYOMJ MEG EGY GOMBOT A KEZDÉSHEZ", WIDTH/2, HEIGHT - 100*SCALE);
}

function drawControls() {
    drawPitch(); ctx.fillStyle = 'rgba(16, 24, 32, 0.96)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.neonGreen; ctx.font = getFont(50); ctx.fillText("JÁTÉK ÚTMUTATÓ", WIDTH/2, 70*SCALE);
    const leftColX = WIDTH * 0.25; const rightColX = WIDTH * 0.75; const rowStart = 150 * SCALE;
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.accentBlue; ctx.font = getFont(30); ctx.fillText("JÁTÉKOS 1 (HAZAI)", leftColX, rowStart - 40*SCALE);
    drawKey("W", leftColX - 25*SCALE, rowStart); drawKey("A", leftColX - 80*SCALE, rowStart + 55*SCALE); drawKey("S", leftColX - 25*SCALE, rowStart + 55*SCALE); drawKey("D", leftColX + 30*SCALE, rowStart + 55*SCALE);
    ctx.fillStyle = '#AAA'; ctx.font = getFont(18); ctx.fillText("WASD MOZGÁS", leftColX - 25*SCALE + 25*SCALE, rowStart + 130*SCALE);
    const actY = rowStart + 180 * SCALE; drawKey("SHIFT", leftColX - 120*SCALE, actY, 100); ctx.textAlign='left'; ctx.fillText("SPRINT", leftColX, actY + 30*SCALE);
    drawKey("SPACE", leftColX - 120*SCALE, actY + 70*SCALE, 100); ctx.fillText("RÚGÁS", leftColX, actY + 100*SCALE);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.redCard; ctx.font = getFont(30); ctx.fillText("JÁTÉKOS 2 (VENDÉG)", rightColX, rowStart - 40*SCALE);
    drawKey("▲", rightColX - 25*SCALE, rowStart); drawKey("◄", rightColX - 80*SCALE, rowStart + 55*SCALE); drawKey("▼", rightColX - 25*SCALE, rowStart + 55*SCALE); drawKey("►", rightColX + 30*SCALE, rowStart + 55*SCALE);
    ctx.fillStyle = '#AAA'; ctx.font = getFont(18); ctx.fillText("NYILAK MOZGÁS", rightColX - 25*SCALE + 25*SCALE, rowStart + 130*SCALE);
    ctx.textAlign='left'; drawKey(".", rightColX - 120*SCALE, actY + 70*SCALE, 50); ctx.fillText("RÚGÁS (.)", rightColX - 50*SCALE, actY + 100*SCALE);
    drawKey("-", rightColX - 120*SCALE, actY + 140*SCALE, 50); ctx.fillText("BECSÚSZÁS (-)", rightColX - 50*SCALE, actY + 170*SCALE);
    ctx.textAlign = 'center'; ctx.fillStyle = '#AAA'; ctx.font = getFont(20); ctx.fillText("NYOMJ ENTERT A VISSZALÉPÉSHEZ", WIDTH/2, HEIGHT - 50*SCALE);
}

function drawCareerTable() {
    drawPitch(); ctx.fillStyle = 'rgba(16, 24, 32, 0.98)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.neonGreen; ctx.font = getFont(60); ctx.fillText("BAJNOKSÁG ÁLLÁSA", WIDTH/2, 80*SCALE);
    const startY = 160 * SCALE; const rowHeight = 45 * SCALE; const wHalf = WIDTH/2;
    const pos = { name: -350, p: 50, w: 120, d: 190, l: 260, pts: 350 };
    ctx.fillStyle = COLORS.textGray; ctx.font = getFont(24); ctx.textAlign = 'left'; ctx.fillText("CSAPAT", wHalf + pos.name * SCALE, startY - 20*SCALE);
    ctx.textAlign = 'center'; ctx.fillText("M", wHalf + pos.p * SCALE, startY - 20*SCALE); ctx.fillText("GY", wHalf + pos.w * SCALE, startY - 20*SCALE); ctx.fillText("D", wHalf + pos.d * SCALE, startY - 20*SCALE); ctx.fillText("V", wHalf + pos.l * SCALE, startY - 20*SCALE); ctx.fillText("P", wHalf + pos.pts * SCALE, startY - 20*SCALE);
    leagueTable.forEach((team, index) => {
        const y = startY + index * rowHeight;
        if (team.isPlayer) { ctx.fillStyle = 'rgba(49, 237, 49, 0.15)'; ctx.fillRect(wHalf - 400*SCALE, y - 30*SCALE, 800*SCALE, rowHeight - 5*SCALE); ctx.fillStyle = COLORS.neonGreen; } else { ctx.fillStyle = 'white'; }
        ctx.font = getFont(26, team.isPlayer ? 'bold' : 'normal'); ctx.textAlign = 'left'; ctx.fillText(`${index + 1}. ${team.name}`, wHalf + pos.name * SCALE, y);
        ctx.textAlign = 'center'; ctx.fillText(team.played, wHalf + pos.p * SCALE, y); ctx.fillText(team.win, wHalf + pos.w * SCALE, y); ctx.fillText(team.draw, wHalf + pos.d * SCALE, y); ctx.fillText(team.loss, wHalf + pos.l * SCALE, y);
        ctx.font = getFont(28, 'bold'); ctx.fillText(team.points, wHalf + pos.pts * SCALE, y);
    });
    ctx.fillStyle = '#AAA'; ctx.font = getFont(20); ctx.fillText("NYOMJ ENTERT A VISSZALÉPÉSHEZ", WIDTH/2, HEIGHT - 50*SCALE);
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (gameState === 'intro') { 
        drawPitch(); ctx.fillStyle='rgba(16, 24, 32, 0.95)'; ctx.fillRect(0,0,WIDTH,HEIGHT); ctx.textAlign = 'center'; ctx.font = getFont(150, 'italic 900'); ctx.fillStyle = 'white'; ctx.fillText("MINI", WIDTH/2 - 120*SCALE, HEIGHT/2 - 20*SCALE); ctx.fillStyle = COLORS.neonGreen; ctx.fillText("FOCA", WIDTH/2 + 180*SCALE, HEIGHT/2 - 20*SCALE); ctx.font = getFont(40, 'bold'); ctx.fillStyle = '#AAAAAA'; ctx.fillText("BNZ STUDIO", WIDTH/2, HEIGHT/2 + 50*SCALE); return; 
    }
    if (gameState === 'main_menu') { drawMainMenu(); return; }
    if (gameState === 'career_menu') { drawCareerMenu(); return; } 
    if (gameState === 'upgrade_selection') { drawUpgradeMenu(); return; }
    if (gameState === 'name_input') { drawNameInput(); return; }
    if (gameState === 'match_setup') { drawMatchSetup(); return; }
    if (gameState === 'controls') { drawControls(); return; }
    if (gameState === 'career_table') { drawCareerTable(); return; }
    if (gameState === 'finished') {
        drawPitch(); ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0,0,WIDTH,HEIGHT); ctx.fillStyle = 'white'; ctx.textAlign='center'; ctx.font=getFont(50); ctx.fillText("MECCS VÉGE", WIDTH/2, HEIGHT/2 - 50*SCALE); ctx.font = getFont(90); ctx.fillStyle = (scoreBlue > scoreRed) ? COLORS.neonGreen : COLORS.redCard; ctx.fillText(`${scoreBlue} - ${scoreRed}`, WIDTH/2, HEIGHT/2 + 50*SCALE); ctx.font = getFont(20); ctx.fillStyle = '#AAA'; ctx.fillText("NYOMJ ENTERT", WIDTH/2, HEIGHT/2 + 200*SCALE); return;
    }
    drawPitch(); drawParticles(); drawGameObjects(gameState, player1, player2, ball);
    if (isReplaying) { ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.fillStyle = 'white'; ctx.font = getFont(40); ctx.textAlign = 'right'; ctx.fillText("VISSZAJÁTSZÁS", WIDTH - 50*SCALE, 50*SCALE); }
    if(gameState === 'goal_scored') { ctx.fillStyle = 'rgba(49, 237, 49, 0.8)'; ctx.fillRect(0, HEIGHT/2 - 60*SCALE, WIDTH, 120*SCALE); ctx.fillStyle = 'white'; ctx.font = getFont(100, 'italic 900'); ctx.textAlign = 'center'; ctx.shadowColor='black'; ctx.shadowBlur=20; ctx.fillText("GÓÓÓL!", WIDTH/2, HEIGHT/2 + 35*SCALE); ctx.shadowBlur=0; } 
    drawScoreboard();
}

function gameLoop(timestamp) {
    if (gameState === 'playing' && timeLeftSeconds > 0 && timestamp - lastTime > TIME_INTERVAL) {
        timeLeftSeconds--; lastTime = timestamp;
        if (timeLeftSeconds <= 0) { if (currentMode === 'career') finishCareerMatch(); else gameState = 'finished'; }
    }
    update(); draw(); requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
