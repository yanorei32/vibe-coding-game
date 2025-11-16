// ゲームの要素を取得
const gameArea = document.getElementById('gameArea');
const player = document.getElementById('player');
const goal = document.getElementById('goal');
const status = document.getElementById('status');
const resetButton = document.getElementById('resetButton');
const difficultyLevel = document.getElementById('difficultyLevel');
const highScoreElement = document.getElementById('highScore');
const safeZoneElement = document.getElementById('safeZone');

// localStorageのキー
const HIGH_SCORE_KEY = 'vibeCodingGameHighScore';

// ゲームの状態
let gameState = {
    isGameOver: false,
    isCleared: false,
    playerX: 50,
    playerY: 50,
    moveSpeed: 5,
    level: 1, // 難易度レベル
    enemies: [] // 敵の配列（各敵は {element, isMoving, velocityX, velocityY} の形式）
};

// 動く敵の確率（30%の確率で動く敵になる）
const MOVING_ENEMY_PROBABILITY = 0.3;
// 動く敵の速度
const MOVING_ENEMY_SPEED = 2;

// ゲームエリアのサイズ
const GAME_WIDTH = 600;
const GAME_HEIGHT = 400;
const PLAYER_SIZE = 30;
const ENEMY_SIZE = 40;
const GOAL_SIZE = 35;
// スタートとゴールの最小距離（ゲームエリアの対角線の約50%）
const MIN_START_GOAL_DISTANCE = 350;

// 安全地帯のサイズ（スタート地点周辺）
const SAFE_ZONE_WIDTH = 150;
const SAFE_ZONE_HEIGHT = 150;
const SAFE_ZONE_X = 0;
const SAFE_ZONE_Y = 0;

// 安全地帯の矩形を取得
function getSafeZoneRect() {
    return {
        left: SAFE_ZONE_X,
        top: SAFE_ZONE_Y,
        right: SAFE_ZONE_X + SAFE_ZONE_WIDTH,
        bottom: SAFE_ZONE_Y + SAFE_ZONE_HEIGHT
    };
}

// 位置が安全地帯内かどうかをチェック（矩形全体が重なっているか）
function isInSafeZone(x, y, size) {
    const safeZone = getSafeZoneRect();
    // 要素の矩形が安全地帯と重なっているかチェック
    const elementRight = x + size;
    const elementBottom = y + size;
    return x < safeZone.right &&
           elementRight > safeZone.left &&
           y < safeZone.bottom &&
           elementBottom > safeZone.top;
}

// 2点間の距離を計算
function getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// ランダムな位置を生成（他の要素と重ならないようにする）
function getRandomPosition(size, excludeRects = [], minDistanceFrom = null) {
    let x, y;
    let attempts = 0;
    const maxAttempts = 200; // 距離チェックを追加したので試行回数を増やす
    
    // 安全地帯を除外リストに追加
    const safeZoneRect = getSafeZoneRect();
    const allExcludeRects = [safeZoneRect, ...excludeRects];
    
    do {
        // 画面内のランダムな位置を生成（端に少し余白を持たせる）
        const margin = 10;
        x = Math.random() * (GAME_WIDTH - size - margin * 2) + margin;
        y = Math.random() * (GAME_HEIGHT - size - margin * 2) + margin;
        attempts++;
    } while (
        attempts < maxAttempts &&
        (isInSafeZone(x, y, size) || // 安全地帯内でないかチェック
         allExcludeRects.some(rect => {
            // 他の要素と重なっていないかチェック
            return x < rect.right + 20 &&
                   x + size > rect.left - 20 &&
                   y < rect.bottom + 20 &&
                   y + size > rect.top - 20;
        }) ||
         (minDistanceFrom && getDistance(x + size / 2, y + size / 2, minDistanceFrom.x, minDistanceFrom.y) < minDistanceFrom.minDistance))
    );
    
    return { x, y };
}

// 既存の敵をすべて削除
function clearEnemies() {
    gameState.enemies.forEach(enemy => {
        if (enemy.element && enemy.element.parentNode) {
            enemy.element.parentNode.removeChild(enemy.element);
        }
    });
    gameState.enemies = [];
}

// 敵を生成
function createEnemy(excludeRects) {
    const enemyElement = document.createElement('div');
    
    // 確率的に動く敵かどうかを決定（30%の確率）
    const isMoving = Math.random() < MOVING_ENEMY_PROBABILITY;
    
    if (isMoving) {
        enemyElement.className = 'enemy enemy-moving';
    } else {
        enemyElement.className = 'enemy';
    }
    
    // 敵の位置をランダムに生成
    const enemyPos = getRandomPosition(ENEMY_SIZE, excludeRects);
    enemyElement.style.left = enemyPos.x + 'px';
    enemyElement.style.top = enemyPos.y + 'px';
    
    gameArea.appendChild(enemyElement);
    
    // 動く敵の場合はランダムな方向の速度を設定
    let velocityX = 0;
    let velocityY = 0;
    if (isMoving) {
        // ランダムな方向（-1から1の範囲）に速度を設定
        const angle = Math.random() * Math.PI * 2;
        velocityX = Math.cos(angle) * MOVING_ENEMY_SPEED;
        velocityY = Math.sin(angle) * MOVING_ENEMY_SPEED;
    }
    
    const enemyData = {
        element: enemyElement,
        isMoving: isMoving,
        velocityX: velocityX,
        velocityY: velocityY,
        rect: {
            left: enemyPos.x,
            top: enemyPos.y,
            right: enemyPos.x + ENEMY_SIZE,
            bottom: enemyPos.y + ENEMY_SIZE
        }
    };
    
    gameState.enemies.push(enemyData);
    
    return enemyData;
}

// 安全地帯の表示を更新
function updateSafeZoneDisplay() {
    safeZoneElement.style.left = SAFE_ZONE_X + 'px';
    safeZoneElement.style.top = SAFE_ZONE_Y + 'px';
    safeZoneElement.style.width = SAFE_ZONE_WIDTH + 'px';
    safeZoneElement.style.height = SAFE_ZONE_HEIGHT + 'px';
}

// 初期位置の設定
function initGame(resetLevel = false) {
    // レベルをリセットする場合は1に戻す
    if (resetLevel) {
        gameState.level = 1;
    }
    
    // 既存の敵を削除
    clearEnemies();
    
    // 安全地帯の表示を更新
    updateSafeZoneDisplay();
    
    // プレイヤーの初期位置（左上付近、安全地帯内）
    gameState.playerX = 50;
    gameState.playerY = 50;
    updatePlayerPosition();
    
    // プレイヤーの位置を除外リストに追加
    const playerRect = {
        left: gameState.playerX,
        top: gameState.playerY,
        right: gameState.playerX + PLAYER_SIZE,
        bottom: gameState.playerY + PLAYER_SIZE
    };
    
    // 難易度に応じた敵の数を計算（レベル1=1個、レベル2=2個、レベル3=3個...）
    const enemyCount = gameState.level;
    const excludeRects = [playerRect];
    
    // 敵を生成
    for (let i = 0; i < enemyCount; i++) {
        const enemyData = createEnemy(excludeRects);
        excludeRects.push(enemyData.rect);
    }
    
    // ゴールの位置をランダムに生成（プレイヤーと敵と重ならず、スタートから一定距離以上離れている）
    const startCenterX = gameState.playerX + PLAYER_SIZE / 2;
    const startCenterY = gameState.playerY + PLAYER_SIZE / 2;
    const goalPos = getRandomPosition(GOAL_SIZE, excludeRects, {
        x: startCenterX,
        y: startCenterY,
        minDistance: MIN_START_GOAL_DISTANCE
    });
    goal.style.left = goalPos.x + 'px';
    goal.style.top = goalPos.y + 'px';
    
    // 難易度表示を更新
    difficultyLevel.textContent = gameState.level;
    
    // ゲーム状態のリセット
    gameState.isGameOver = false;
    gameState.isCleared = false;
    status.textContent = `レベル ${gameState.level} - 矢印キーで移動してください`;
    status.className = 'status';
}

// プレイヤーの位置を更新
function updatePlayerPosition() {
    // 画面外に出ないように制限
    gameState.playerX = Math.max(0, Math.min(GAME_WIDTH - PLAYER_SIZE, gameState.playerX));
    gameState.playerY = Math.max(0, Math.min(GAME_HEIGHT - PLAYER_SIZE, gameState.playerY));
    
    player.style.left = gameState.playerX + 'px';
    player.style.top = gameState.playerY + 'px';
}

// 衝突判定（矩形同士の当たり判定）
function checkCollision(rect1, rect2) {
    return rect1.left < rect2.right &&
           rect1.right > rect2.left &&
           rect1.top < rect2.bottom &&
           rect1.bottom > rect2.top;
}

// 動く敵を更新（移動と画面端での跳ね返り、安全地帯の侵入防止）
function updateMovingEnemies() {
    const safeZone = getSafeZoneRect();
    
    for (const enemy of gameState.enemies) {
        if (!enemy.isMoving) continue; // 動かない敵はスキップ
        
        // 敵の現在位置を取得
        let x = parseFloat(enemy.element.style.left);
        let y = parseFloat(enemy.element.style.top);
        
        // 速度に応じて位置を更新
        let newX = x + enemy.velocityX;
        let newY = y + enemy.velocityY;
        
        // 安全地帯に入ろうとしているかチェック
        if (isInSafeZone(newX, newY, ENEMY_SIZE)) {
            // 安全地帯の境界で跳ね返す
            // X方向の侵入を防ぐ
            if (newX + ENEMY_SIZE > safeZone.left && x + ENEMY_SIZE <= safeZone.left) {
                // 左から侵入しようとしている
                enemy.velocityX *= -1;
                newX = safeZone.left - ENEMY_SIZE;
            } else if (newX < safeZone.right && x >= safeZone.right) {
                // 右から侵入しようとしている
                enemy.velocityX *= -1;
                newX = safeZone.right;
            }
            
            // Y方向の侵入を防ぐ
            if (newY + ENEMY_SIZE > safeZone.top && y + ENEMY_SIZE <= safeZone.top) {
                // 上から侵入しようとしている
                enemy.velocityY *= -1;
                newY = safeZone.top - ENEMY_SIZE;
            } else if (newY < safeZone.bottom && y >= safeZone.bottom) {
                // 下から侵入しようとしている
                enemy.velocityY *= -1;
                newY = safeZone.bottom;
            }
            
            // それでも安全地帯内にある場合は、安全地帯の外に押し出す
            if (isInSafeZone(newX, newY, ENEMY_SIZE)) {
                // 最も近い安全地帯の外に移動
                const distToLeft = Math.abs(newX - (safeZone.left - ENEMY_SIZE));
                const distToRight = Math.abs(newX - safeZone.right);
                const distToTop = Math.abs(newY - (safeZone.top - ENEMY_SIZE));
                const distToBottom = Math.abs(newY - safeZone.bottom);
                
                const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
                
                if (minDist === distToLeft) {
                    newX = safeZone.left - ENEMY_SIZE;
                    enemy.velocityX = -Math.abs(enemy.velocityX);
                } else if (minDist === distToRight) {
                    newX = safeZone.right;
                    enemy.velocityX = Math.abs(enemy.velocityX);
                } else if (minDist === distToTop) {
                    newY = safeZone.top - ENEMY_SIZE;
                    enemy.velocityY = -Math.abs(enemy.velocityY);
                } else {
                    newY = safeZone.bottom;
                    enemy.velocityY = Math.abs(enemy.velocityY);
                }
            }
        }
        
        // 画面端に当たったら跳ね返る
        if (newX <= 0 || newX >= GAME_WIDTH - ENEMY_SIZE) {
            enemy.velocityX *= -1;
            newX = Math.max(0, Math.min(GAME_WIDTH - ENEMY_SIZE, newX));
        }
        if (newY <= 0 || newY >= GAME_HEIGHT - ENEMY_SIZE) {
            enemy.velocityY *= -1;
            newY = Math.max(0, Math.min(GAME_HEIGHT - ENEMY_SIZE, newY));
        }
        
        // 位置を更新
        x = newX;
        y = newY;
        enemy.element.style.left = x + 'px';
        enemy.element.style.top = y + 'px';
        
        // 矩形情報も更新
        enemy.rect.left = x;
        enemy.rect.top = y;
        enemy.rect.right = x + ENEMY_SIZE;
        enemy.rect.bottom = y + ENEMY_SIZE;
    }
}

// プレイヤーと敵の衝突判定
function checkEnemyCollision() {
    const playerRect = {
        left: gameState.playerX,
        top: gameState.playerY,
        right: gameState.playerX + PLAYER_SIZE,
        bottom: gameState.playerY + PLAYER_SIZE
    };
    
    // すべての敵との衝突をチェック
    for (const enemy of gameState.enemies) {
        if (checkCollision(playerRect, enemy.rect)) {
            gameOver();
            return; // 衝突したら処理を終了
        }
    }
}

// プレイヤーとゴールの衝突判定
function checkGoalCollision() {
    const playerRect = {
        left: gameState.playerX,
        top: gameState.playerY,
        right: gameState.playerX + PLAYER_SIZE,
        bottom: gameState.playerY + PLAYER_SIZE
    };
    
    const goalRect = {
        left: parseInt(goal.style.left),
        top: parseInt(goal.style.top),
        right: parseInt(goal.style.left) + GOAL_SIZE,
        bottom: parseInt(goal.style.top) + GOAL_SIZE
    };
    
    if (checkCollision(playerRect, goalRect)) {
        clearGame();
    }
}

// ゲームオーバー処理
function gameOver() {
    if (gameState.isCleared) return; // 既にクリアしていたら何もしない
    
    gameState.isGameOver = true;
    
    // 到達したレベル（現在のレベル - 1）をハイスコアとして記録
    const reachedLevel = gameState.level - 1;
    const isNewRecord = updateHighScore(gameState.level);
    
    let gameOverMessage = 'ゲームオーバー';
    if (isNewRecord && reachedLevel > 0) {
        gameOverMessage += ` 🎉 ハイスコア更新！レベル ${reachedLevel} 到達`;
    }
    
    status.textContent = gameOverMessage;
    status.className = 'status game-over';
}

// ハイスコアをlocalStorageから読み込む
function loadHighScore() {
    const savedScore = localStorage.getItem(HIGH_SCORE_KEY);
    if (savedScore !== null) {
        return parseInt(savedScore, 10);
    }
    return 0;
}

// ハイスコアをlocalStorageに保存
function saveHighScore(score) {
    localStorage.setItem(HIGH_SCORE_KEY, score.toString());
}

// ハイスコアを更新（必要に応じて）
function updateHighScore(level) {
    const currentHighScore = loadHighScore();
    // クリアしたレベル（level - 1）がハイスコアより高い場合に更新
    const clearedLevel = level - 1;
    if (clearedLevel > currentHighScore) {
        saveHighScore(clearedLevel);
        highScoreElement.textContent = clearedLevel;
        return true; // 新しいハイスコアを記録した
    }
    return false; // ハイスコアを更新しなかった
}

// ハイスコア表示を更新
function updateHighScoreDisplay() {
    const highScore = loadHighScore();
    highScoreElement.textContent = highScore;
}

// ゲームクリア処理
function clearGame() {
    if (gameState.isGameOver) return; // 既にゲームオーバーだったら何もしない
    
    gameState.isCleared = true;
    
    // ハイスコアを更新
    const isNewRecord = updateHighScore(gameState.level);
    
    // 少し待ってから次のレベルに進む
    setTimeout(() => {
        gameState.level++;
        let clearMessage = `レベル ${gameState.level - 1} クリア！`;
        if (isNewRecord) {
            clearMessage += ' 🎉 ハイスコア更新！';
        }
        clearMessage += ' 次のレベルへ...';
        status.textContent = clearMessage;
        status.className = 'status clear';
        
        // 1秒後に次のレベルを開始
        setTimeout(() => {
            initGame(false); // レベルはリセットしない
        }, 1500);
    }, 500);
}

// キーボード入力の処理
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// キーが押されたときの処理
document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
        e.preventDefault(); // ページのスクロールを防ぐ
    }
});

// キーが離されたときの処理
document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// ゲームループ（毎フレーム実行される処理）
function gameLoop() {
    // ゲームオーバーまたはクリア状態でない場合のみ移動可能
    if (!gameState.isGameOver && !gameState.isCleared) {
        // 矢印キーの入力に応じてプレイヤーを移動
        if (keys.ArrowUp) {
            gameState.playerY -= gameState.moveSpeed;
        }
        if (keys.ArrowDown) {
            gameState.playerY += gameState.moveSpeed;
        }
        if (keys.ArrowLeft) {
            gameState.playerX -= gameState.moveSpeed;
        }
        if (keys.ArrowRight) {
            gameState.playerX += gameState.moveSpeed;
        }
        
        // プレイヤーの位置を更新
        updatePlayerPosition();
        
        // 動く敵を更新
        updateMovingEnemies();
        
        // 衝突判定
        checkEnemyCollision();
        checkGoalCollision();
    }
    
    // 次のフレームで再度実行
    requestAnimationFrame(gameLoop);
}

// リセットボタンのクリックイベント
resetButton.addEventListener('click', () => {
    // ゲームをリセット（レベルも1に戻す）
    initGame(true);
});

// ハイスコアを読み込んで表示
updateHighScoreDisplay();

// ゲームの初期化（レベル1から開始）
initGame(true);

// ゲームループを開始
gameLoop();

