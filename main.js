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
    input: { activePointers: 3, keyboard: true },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let player, aliens, bullets, enemyBullets, items, particles;
let cursors, fireButton, starfield;
let lastFired = 0, nextEnemyFire = 0; 
let score = 0, playerHP = 3, wave = 1, gameOver = false;
let hpText, scoreText, waveText, bulletToggle = false;

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('alien', 'assets/alien.png');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('heart', 'assets/heart.png');
    this.load.image('bullet_iru', 'assets/bullet_alien_iru.png');
    this.load.image('bullet_naru', 'assets/bullet_alien_naru.png');
    this.load.image('star', 'assets/star.png');
}

function create() {
    cursors = this.input.keyboard.createCursorKeys();
    fireButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // 배경 설정 (별 밀도 및 투명도 조절)
    starfield = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'star');
    starfield.setOrigin(0, 0).setDepth(-1);
    starfield.tileScaleX = 1.5; // 숫자를 키울수록 별이 더 띄엄띄엄 보입니다.
    starfield.tileScaleY = 1.5;
    starfield.alpha = 0.6;      // 숫자를 낮출수록(0.1~1.0) 별이 흐려집니다.

    particles = this.add.particles(0, 0, 'bullet', {
        speed: { min: -100, max: 100 },
        scale: { start: 0.5, end: 0 },
        lifespan: 400,
        frequency: -1
    });

    player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, 'player');
    player.setCollideWorldBounds(true);

    aliens = this.physics.add.group();
    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
    enemyBullets = this.physics.add.group();
    items = this.physics.add.group();

    createWave(this);

    this.physics.add.overlap(bullets, aliens, destroyAlien, null, this);
    this.physics.add.overlap(enemyBullets, player, damagePlayer, null, this);
    this.physics.add.overlap(items, player, collectItem, null, this);

    const style = { fontSize: '22px', fill: '#fff', fontFamily: 'Arial', fontWeight: 'bold' };
    hpText = this.add.text(20, 20, `HP: ❤️ ${playerHP}`, style).setDepth(100);
    scoreText = this.add.text(20, 50, `SCORE: ${score}`, style).setDepth(100);
    waveText = this.add.text(20, 80, `WAVE: ${wave}`, style).setDepth(100);

    this.input.on('pointerdown', () => {
        if (gameOver) { restartGame(this); return; }
        window.focus();
        fireBullet(this);
    });

    this.scale.on('resize', (gameSize) => {
        if (starfield) {
            starfield.setSize(gameSize.width, gameSize.height);
        }
        if (player && player.active) player.setPosition(gameSize.width / 2, gameSize.height - 80);
    });
}

function update() {
    if (gameOver) return;
    if (starfield) starfield.tilePositionY -= 1.0; // 배경 속도도 조금 늦췄습니다.

    let isMoving = false;
    const moveSpeed = 450;
    const currentTime = this.time.now;

    if (cursors.left.isDown || (this.input.activePointer.isDown && this.input.activePointer.x < this.scale.width / 2)) {
        player.setVelocityX(-moveSpeed);
        isMoving = true;
    } else if (cursors.right.isDown || (this.input.activePointer.isDown && this.input.activePointer.x >= this.scale.width / 2)) {
        player.setVelocityX(moveSpeed);
        isMoving = true;
    }
    if (!isMoving) player.setVelocityX(0);
    if (Phaser.Input.Keyboard.JustDown(fireButton)) fireBullet(this);

    aliens.children.each(alien => {
        if (!alien.active) return;
        alien.y += 0.2 + (wave * 0.05);
        if (currentTime > nextEnemyFire && Math.random() < 0.01) {
            enemyShoot(this, alien);
            nextEnemyFire = currentTime + Math.max(1200 - (wave * 50), 600);
        }
        if (alien.y > this.scale.height) endGame(this);
    });

    bullets.children.each(b => { if (b.active && b.y < -50) b.disableBody(true, true); });
    enemyBullets.children.each(b => { if (b.active && b.y > this.scale.height + 50) b.disableBody(true, true); });
}

function enemyShoot(scene, alien) {
    if (enemyBullets.countActive(true) >= 6) return; 
    const bulletKey = bulletToggle ? 'bullet_iru' : 'bullet_naru';
    bulletToggle = !bulletToggle;
    
    const b = enemyBullets.create(alien.x, alien.y + 40, bulletKey);
    if (b) {
        b.setVelocityY(200 + (wave * 15));
        b.setScale(0.5); 
        b.body.setSize(30, 30); 
    }
}

function fireBullet(scene) {
    if (!player || !player.active || scene.time.now - lastFired < 200) return;
    lastFired = scene.time.now;
    const b = bullets.get(player.x, player.y - 40);
    if (b) {
        b.setActive(true).setVisible(true).body.enable = true;
        b.setVelocityY(-800);
    }
}

function destroyAlien(bullet, alien) {
    bullet.disableBody(true, true);
    particles.emitParticleAt(alien.x, alien.y, 10);
    score += 10;
    scoreText.setText(`SCORE: ${score}`);
    if (Math.random() < 0.15) {
        const h = items.create(alien.x, alien.y, 'heart');
        h.setVelocityY(200);
        h.setScale(0.8);
    }
    alien.destroy();
    if (aliens.countActive(true) === 0) nextWave(this);
}

function damagePlayer(p, b) {
    b.destroy();
    playerHP--;
    hpText.setText(`HP: ❤️ ${playerHP}`);
    p.setTint(0xff0000);
    p.scene.time.delayedCall(150, () => { if (p.active) p.clearTint(); });
    if (playerHP <= 0) endGame(p.scene);
}

function collectItem(p, i) {
    i.destroy();
    playerHP = Math.min(playerHP + 1, 5);
    hpText.setText(`HP: ❤️ ${playerHP}`);
}

function createWave(scene) {
    const rows = Math.min(3 + Math.floor(wave / 3), 5);
    const cols = Math.floor(scene.scale.width / 85);
    const startX = (scene.scale.width - (cols - 1) * 70) / 2;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            aliens.create(startX + (c * 70), 80 + (r * 60), 'alien');
        }
    }
}

function nextWave(scene) {
    wave++;
    waveText.setText(`WAVE: ${wave}`);
    const msg = scene.add.text(scene.scale.width / 2, scene.scale.height / 2, `WAVE ${wave - 1} CLEAR!`, 
        { fontSize: '40px', fill: '#ffff00', fontWeight: 'bold' }).setOrigin(0.5).setDepth(200);
    scene.time.delayedCall(1500, () => { msg.destroy(); createWave(scene); });
}

function endGame(scene) {
    gameOver = true;
    player.setVelocity(0).setTint(0x444444);
    player.body.enable = false;
    scene.add.text(scene.scale.width / 2, scene.scale.height / 2, 
        `GAME OVER\n\nSCORE: ${score}\n[ 클릭하여 재시작 ]`, 
        { fontSize: '32px', fill: '#f00', align: 'center', backgroundColor: '#000000cc', padding: 20 }
    ).setOrigin(0.5).setDepth(200);
}

function restartGame(scene) {
    gameOver = false; playerHP = 3; score = 0; wave = 1; lastFired = 0; nextEnemyFire = 0;
    bullets.clear(true, true); enemyBullets.clear(true, true); aliens.clear(true, true); items.clear(true, true);
    scene.children.list.filter(c => c.depth === 200).forEach(c => c.destroy());
    player.clearTint(); player.body.enable = true;
    player.setPosition(scene.scale.width / 2, scene.scale.height - 80);
    hpText.setText(`HP: ❤️ ${playerHP}`); scoreText.setText(`SCORE: ${score}`); waveText.setText(`WAVE: ${wave}`);
    createWave(scene);
}
