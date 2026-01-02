const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    input: {
        activePointers: 3 
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let player, aliens, bullets, enemyBulletsIru, enemyBulletsNaru;
let cursors, fireButton;
let lastFired = 0;
let playerHP = 3, score = 0, wave = 1, gameOver = false;
let hpText, scoreText, waveText, gameOverText;
let enemyFireTimer = 0;

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('alien', 'assets/alien.png');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('bullet_iru', 'assets/bullet_alien_iru.png');
    this.load.image('bullet_naru', 'assets/bullet_alien_naru.png');
}

function create() {
    // 1. 플레이어 생성
    player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, 'player');
    player.setCollideWorldBounds(true);

    // 2. 그룹 설정
    aliens = this.physics.add.group();
    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
    enemyBulletsIru = this.physics.add.group({ defaultKey: 'bullet_iru', maxSize: 20 });
    enemyBulletsNaru = this.physics.add.group({ defaultKey: 'bullet_naru', maxSize: 20 });

    createWave(this);

    // 3. 입력 설정
    cursors = this.input.keyboard.createCursorKeys();
    fireButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 4. Safari 대응 터치 이벤트
    this.input.on('pointerdown', (pointer) => {
        if (gameOver) { 
            restartGame(this); 
            return; 
        }
        fireBullet(this);
    });

    // 5. 충돌 설정
    this.physics.add.overlap(bullets, aliens, hitAlien, null, this);
    this.physics.add.overlap(enemyBulletsIru, player, hitPlayer, null, this);
    this.physics.add.overlap(enemyBulletsNaru, player, hitPlayer, null, this);

    // 6. UI 생성
    const textStyle = { fontSize: '24px', fill: '#fff', fontFamily: 'Arial', fontWeight: 'bold' };
    hpText = this.add.text(20, 20, `HP: ${playerHP}`, textStyle).setDepth(100);
    scoreText = this.add.text(20, 55, `Score: ${score}`, textStyle).setDepth(100);
    waveText = this.add.text(20, 90, `Wave: ${wave}`, textStyle).setDepth(100);

    this.scale.on('resize', (gameSize) => {
        player.setPosition(gameSize.width / 2, gameSize.height - 80);
        if (gameOverText) gameOverText.setPosition(gameSize.width / 2, gameSize.height / 2);
    });
}

function update() {
    if (gameOver) return;

    const pointer = this.input.activePointer;
    const width = this.scale.width;

    // 이동 로직
    if (cursors.left.isDown || (pointer.isDown && pointer.x < width / 2)) {
        player.setVelocityX(-450);
    } else if (cursors.right.isDown || (pointer.isDown && pointer.x >= width / 2)) {
        player.setVelocityX(450);
    } else {
        player.setVelocityX(0);
    }

    // PC 발사
    if (Phaser.Input.Keyboard.JustDown(fireButton)) { 
        fireBullet(this); 
    }

    // 오브젝트 정리
    cleanupObjects(bullets, (obj) => obj.y < -50);
    cleanupObjects(enemyBulletsIru, (obj) => obj.y > this.scale.height + 50);
    cleanupObjects(enemyBulletsNaru, (obj) => obj.y > this.scale.height + 50);

    // 적 행동 로직
    const time = this.time.now * 0.002;
    enemyFireTimer += this.game.loop.delta;

    aliens.children.each(alien => {
        if (!alien || !alien.active) return;
        if (!alien.diving) {
            alien.setVelocityX(Math.sin(time + alien.waveOffset) * 120);
            alien.setVelocityY(25);
            if (Math.random() < 0.001 + (wave * 0.0002)) {
                alien.diving = true;
                this.physics.moveToObject(alien, player, 350 + (wave * 10));
            }
        } else if (alien.y > this.scale.height + 50) {
            alien.destroy();
        }
    });

    // 적 공격 시스템
    if (enemyFireTimer > 800) {
        enemyFireTimer = 0;
        const activeAliens = aliens.getChildren().filter(a => a.active);
        if (activeAliens.length > 0) {
            const randomAlien = Phaser.Utils.Array.GetRandom(activeAliens);
            if (Math.random() < 0.4) enemyFire(this, randomAlien);
        }
    }

    if (aliens.countActive(true) === 0) { 
        nextWave(this); 
    }
}

function fireBullet(scene) {
    if (!player || !player.active || gameOver) return;
    const time = game.loop.time;
    if (time - lastFired < 200) return;
    lastFired = time;

    const bullet = bullets.get(player.x, player.y - 30);
    if (bullet) {
        bullet.setActive(true).setVisible(true);
        bullet.body.enable = true;
        bullet.setVelocityY(-700);
    }
}

function enemyFire(scene, alien) {
    const group = Math.random() < 0.5 ? enemyBulletsIru : enemyBulletsNaru;
    const bullet = group.get(alien.x, alien.y + 20);
    if (bullet) {
        bullet.setActive(true).setVisible(true);
        bullet.body.enable = true;
        scene.physics.moveToObject(bullet, player, 300 + (wave * 5));
    }
}

function cleanupObjects(group, condition) {
    group.children.each(obj => {
        if (obj.active && condition(obj)) obj.disableBody(true, true);
    });
}

function hitAlien(bullet, alien) {
    bullet.disableBody(true, true);
    alien.destroy();
    score += 10;
    scoreText.setText(`Score: ${score}`);
}

function hitPlayer(p, bullet) {
    bullet.disableBody(true, true);
    playerHP--;
    hpText.setText(`HP: ${playerHP}`);
    p.setTint(0xff0000);
    p.scene.time.delayedCall(150, () => { 
        if (p.active) p.clearTint(); 
    });
    if (playerHP <= 0) { 
        endGame(p.scene); 
    }
}

function createWave(scene) {
    const rows = Math.min(2 + wave, 6);
    const cols = Math.floor(scene.scale.width / 80);
    const startX = scene.scale.width / 2 - (cols - 1) * 30;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const alien = aliens.create(startX + c * 60, 100 + r * 50, 'alien');
            alien.waveOffset = Math.random() * Math.PI * 2;
            alien.diving = false;
        }
    }
}

function nextWave(scene) {
    aliens.clear(true, true);
    wave++;
    waveText.setText(`Wave: ${wave}`);
    const msg = scene.add.text(
        scene.scale.width / 2, 
        scene.scale.height / 2, 
        `WAVE ${wave - 1} CLEAR!`, 
        { fontSize: '40px', fill: '#ffff00' }
    ).setOrigin(0.5);
    scene.time.delayedCall(1500, () => { 
        msg.destroy(); 
        createWave(scene); 
    });
}

function endGame(scene) {
    gameOver = true;
    player.setTint(0x444444);
    player.setVelocity(0);
    player.body.enable = false;
    gameOverText = scene.add.text(
        scene.scale.width / 2, 
        scene.scale.height / 2, 
        `GAME OVER\n\nScore: ${score}\nWave: ${wave}\n\n[ 터치하여 재시작 ]`, 
        { 
            fontSize: '32px', 
            fill: '#ff0000', 
            align: 'center', 
            backgroundColor: '#000000cc', 
            padding: 20 
        }
    ).setOrigin(0.5).setDepth(200);
}

function restartGame(scene) {
    gameOver = false; 
    playerHP = 3; 
    score = 0; 
    wave = 1; 
    lastFired = 0; 
    enemyFireTimer = 0;
    
    bullets.clear(true, true); 
    enemyBulletsIru.clear(true, true); 
    enemyBulletsNaru.clear(true, true); 
    aliens.clear(true, true);
    
    if (gameOverText) gameOverText.destroy();
    
    player.clearTint(); 
    player.body.enable = true;
    player.setPosition(scene.scale.width / 2, scene.scale.height - 80);
    
    hpText.setText(`HP: ${playerHP}`); 
    scoreText.setText(`Score: ${score}`); 
    waveText.setText(`Wave: ${wave}`);
    
    createWave(scene);
}
