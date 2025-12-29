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
