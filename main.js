const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#050505',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    input: { activePointers: 3 },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let player, aliens, bullets, enemyBullets, items, particles;
let lastFired = 0, score = 0, playerHP = 3, wave = 1, combo = 0;
let hpText, scoreText, waveText, comboText, gameOver = false;

function preload() {
    // 기존 이미지 로드
    this.load.image('player', 'assets/player.png');
    this.load.image('alien', 'assets/alien.png');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('bullet_iru', 'assets/bullet_alien_iru.png');
    this.load.image('bullet_naru', 'assets/bullet_alien_naru.png');
    // 아이템 이미지 (없을 경우를 대비해 흰색 사각형으로 대체 가능)
    this.load.image('heart', 'assets/heart.png'); 
}

function create() {
    // 1. 파티클(폭발) 매니저 설정
    particles = this.add.particles(0, 0, 'bullet', {
        speed: { min: -100, max: 100 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.5, end: 0 },
        blendMode: 'ADD',
        active: false
    });

    // 2. 그룹 초기화
    player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, 'player');
    player.setCollideWorldBounds(true);

    aliens = this.physics.add.group();
    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
    enemyBullets = this.physics.add.group();
    items = this.physics.add.group();

    createWave(this);

    // 3. 입력 감지 (Safari 최적화)
    this.input.on('pointerdown', (pointer) => {
        if (gameOver) { restartGame(this); return; }
        fireBullet(this);
    });

    // 4. 충돌 판정
    this.physics.add.overlap(bullets, aliens, destroyAlien, null, this);
    this.physics.add.overlap(enemyBullets, player, damagePlayer, null, this);
    this.physics.add.overlap(items, player, collectItem, null, this);
    this.physics.add.overlap(aliens, player, damagePlayer, null, this);

    // 5. UI 설정
    const style = { fontSize: '22px', fill: '#fff', fontFamily: 'Arial Black' };
    hpText = this.add.text(20, 20, `HP: ❤️ ${playerHP}`, style);
    scoreText = this.add.text(20, 50, `SCORE: ${score}`, style);
    waveText = this.add.text(this.scale.width - 20, 20, `WAVE: ${wave}`, style).setOrigin(1, 0);
    comboText = this.add.text(this.scale.width / 2, 100, '', { fontSize: '40px', fill: '#ff0', fontFamily: 'Arial Black' }).setOrigin(0.5).setAlpha(0);
}

function update() {
    if (gameOver) return;

    // 조작 로직
    const pointer = this.input.activePointer;
    if (pointer.isDown) {
        if (pointer.x < this.scale.width / 2) player.setVelocityX(-450);
        else player.setVelocityX(450);
    } else {
        player.setVelocityX(0);
    }

    // 적 행동 (웨이브 이동 + 사격)
    aliens.children.each(alien => {
        if (!alien.active) return;
        alien.y += 0.5 + (wave * 0.1); // 서서히 내려옴
        if (Math.random() < 0.005 + (wave * 0.001)) enemyShoot(this, alien);
        if (alien.y > this.scale.height) endGame(this); // 바닥에 닿으면 게임오버
    });

    // 화면 밖 오브젝트 정리
    bullets.children.each(b => { if (b.y < 0) b.disableBody(true, true); });
}

function fireBullet(scene) {
    if (scene.time.now - lastFired < 200) return;
    lastFired = scene.time.now;

    const b = bullets.get(player.x, player.y - 40);
    if (b) {
        b.setActive(true).setVisible(true).body.enable = true;
        b.setVelocityY(-800);
    }
}

function destroyAlien(bullet, alien) {
    bullet.disableBody(true, true);
    
    // 폭발 효과
    particles.emitParticleAt(alien.x, alien.y, 10);
    this.cameras.main.shake(100, 0.01); // 화면 흔들림

    // 점수 및 콤보
    combo++;
    score += 10 * combo;
    scoreText.setText(`SCORE: ${score}`);
    showComboEffect(this);

    // 아이템 드랍 (10% 확률)
    if (Math.random() < 0.1) {
        const item = items.create(alien.x, alien.y, 'heart');
        item.setVelocityY(200);
    }

    alien.destroy();
    if (aliens.countActive() === 0) nextWave(this);
}

function damagePlayer(player, attacker) {
    attacker.destroy ? attacker.destroy() : attacker.disableBody(true, true);
    
    playerHP--;
    combo = 0; // 피격 시 콤보 초기화
    hpText.setText(`HP: ❤️ ${playerHP}`);
    this.cameras.main.flash(200, 255, 0, 0); // 빨간색 번쩍임

    if (playerHP <= 0) endGame(this);
}

function collectItem(player, item) {
    item.destroy();
    playerHP = Math.min(playerHP + 1, 5); // 최대 HP 5
    hpText.setText(`HP: ❤️ ${playerHP}`);
}

function showComboEffect(scene) {
    if (combo < 2) return;
    comboText.setText(`${combo} COMBO!`).setAlpha(1);
    scene.tweens.add({
        targets: comboText,
        alpha: 0,
        y: 80,
        duration: 800,
        onComplete: () => { comboText.setY(100); }
    });
}

function createWave(scene) {
    const cols = Math.floor(scene.scale.width / 80);
    const rows = Math.min(2 + wave, 5);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = 60 + (c * 70);
            const y = 80 + (r * 60);
            const alien = aliens.create(x, y, 'alien');
            alien.setOrigin(0.5);
        }
    }
}

function nextWave(scene) {
    wave++;
    waveText.setText(`WAVE: ${wave}`);
    scene.time.delayedCall(1000, () => createWave(scene));
}

function enemyShoot(scene, alien) {
    const b = enemyBullets.create(alien.x, alien.y, 'bullet_iru');
    if (b) {
        b.setVelocityY(300 + (wave * 20));
        b.setTint(0xffaa00);
    }
}

function endGame(scene) {
    gameOver = true;
    scene.physics.pause();
    player.setTint(0xff0000);
    const centerX = scene.scale.width / 2;
    const centerY = scene.scale.height / 2;
    gameOverText = scene.add.text(centerX, centerY, 'GAME OVER\n터치하여 재시작', { fontSize: '40px', fill: '#f00', align: 'center' }).setOrigin(0.5);
}

function restartGame(scene) {
    location.reload(); // 가장 깔끔한 상태 초기화 방식
}
