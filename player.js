function Player(xRatio, yRatio, color, team) {
    this.xRatio = xRatio; this.yRatio = yRatio; 
    this.x = WIDTH * xRatio; this.y = HEIGHT * yRatio;
    this.radius = 18; this.color = color; this.team = team;
    this.baseSpeed = BASE_SPEED; this.speed = BASE_SPEED;
    this.maxSprintTime = MAX_SPRINT_TIME; this.kickPower = KICK_POWER;
    this.sprintTime = this.maxSprintTime;
    this.vx = 0; this.vy = 0;
    this.moveDirX = 0; this.moveDirY = 0;
    this.slideTimer = 0; 
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
}

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

function applySlideLogic(player, isSlideAttempt, moveX, moveY) {
    if (player.slideTimer > 0) {
        player.slideTimer--;
        if (player.slideTimer > SLIDE_RECOVERY && frameCounter % 3 === 0 && typeof createParticle !== 'undefined') {
            createParticle(player.x, player.y + 15*SCALE, 'grass', '#2E8B57');
        }
        if (player.slideTimer > SLIDE_RECOVERY) { player.vx *= SLIDE_FRICTION; player.vy *= SLIDE_FRICTION; }
        else { player.vx = 0; player.vy = 0; player.speed = player.baseSpeed; }
        return true;
    }
    if (isSlideAttempt && (Math.abs(moveX) > 0 || Math.abs(moveY) > 0)) {
        player.slideTimer = SLIDE_TIME + SLIDE_RECOVERY;
        player.moveDirX = moveX; player.moveDirY = moveY;
        const d = Math.sqrt(moveX**2 + moveY**2);
        if(d > 0) { player.vx = (moveX/d) * player.baseSpeed * SLIDE_BOOST * SCALE; player.vy = (moveY/d) * player.baseSpeed * SLIDE_BOOST * SCALE; }
        player.sprintTime = Math.max(0, player.sprintTime - player.maxSprintTime / 4);
        if (typeof createParticle !== 'undefined') {
            for(let i=0; i<5; i++) createParticle(player.x, player.y + 15*SCALE, 'grass', '#32CD32');
        }
        return true;
    }
    return false;
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
        const mag = Math.sqrt(kx*kx + ky*ky); if(mag > 0) { kx/=mag; ky/=mag; }
        ball.vx = kx * player.kickPower * SCALE; ball.vy = ky * player.kickPower * SCALE; 
        if (isFreeKickState) { gameState = 'playing'; kickerPlayer = null; players.forEach(checkCollision); }
    }
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
