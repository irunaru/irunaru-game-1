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
        activePointers: 3,
        keyboard: true 
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let player, aliens, bullets, enemyBullets, items, particles;
let cursors, fireButton;
let lastFired = 0, score = 0, playerHP = 3, wave = 1;
let hpText, scoreText, waveText, gameOver = false;

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('alien', 'assets/alien.png');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('bullet_iru', 'assets/bullet_alien_iru.png');
}

function create() {
    // 1. 키보드 입력 활성화
    cursors = this.input.keyboard.createCursorKeys();
    fireButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard.enabled = true;

    // 2. 아이템 이미지 생성
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(10, 10, 10); 
    graphics.generateTexture('heart', 20, 20);
    graphics.destroy();

    // 3. 파티클 설정
    particles = this.add.particles(0, 0, 'bullet', {
        speed: { min: -100, max: 100 },
        scale: { start: 0.5, end: 0 },
        lifespan: 500,
        frequency: -1
    });

    // 4. 오브젝트 생성
    player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, 'player');
    player.setCollideWorldBounds(true);

    aliens = this.physics.add.group();
    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
    enemyBullets = this.physics.add.group({ defaultKey: 'bullet_iru', maxSize: 50 });
    items = this.physics.add.group();

    createWave(this);

    // 5. 터치/클릭 입력
    this.input.on('pointerdown', (pointer) => {
        if (gameOver) { 
            restartGame(this);
            return; 
        }
        if (window.focus) window.focus();
        fireBullet(this);
    });

    // 6. 충돌 판정
    this.physics.add.overlap(bullets, aliens, destroyAlien, null, this);
    this.physics.add.overlap(enemyBullets, player, damagePlayer, null, this);
    this.physics.add.overlap(items, player, collectItem, null, this);

    // 7. UI 설정
    const style = { fontSize: '22px', fill: '#fff', fontFamily: 'Arial', fontWeight: 'bold' };
    hpText = this.add.text(20, 20, `HP: ❤️ ${playerHP}`, style).setDepth(100);
    scoreText = this.add.text(20, 50, `SCORE: ${score}`, style).setDepth(100);
    waveText = this.add.text(20, 80, `WAVE: ${wave}`, style).setDepth(100);

    // 8. 화면 크기 변경 대응
    this.scale.on('resize', (gameSize) => {
        if (player && player.active) {
            player.setPosition(gameSize.width / 2, gameSize.height - 80);
        }
    });
}

function update() {
    if (gameOver) return;

    let isMoving = false;
    const moveSpeed = 450;

    // PC 조작 - 방향키
    if (cursors && (cursors.left.isDown || cursors.right.isDown)) {
        if (cursors.left.isDown) {
            player.setVelocityX(-moveSpeed);
        } else if (cursors.right.isDown) {
            player.setVelocityX(moveSpeed);
        }
        isMoving = true;
    } 
    // 모바일/마우스 조작 - 터치
    else if (this.input.activePointer.isDown) {
        if (this.input.activePointer.x < this.scale.width / 2) {
            player.setVelocityX(-moveSpeed);
        } else {
            player.setVelocityX(moveSpeed);
        }
        isMoving = true;
    }

    if (!isMoving) {
        player.setVelocityX(0);
    }

    // PC 조작 - 스페이스바
    if (fireButton && Phaser.Input.Keyboard.JustDown(fireButton)) {
        fireBullet(this);
    }

    // 총알 정리
    bullets.children.each(b => {
        if (b.active && b.y < -50) b.disableBody(true, true);
    });
    enemyBullets.children.each(b => {
        if (b.active && b.y > this.scale.height + 50) b.disableBody(true, true);
    });

    // 적 행동
    aliens.children.each(alien => {
        if (!alien.active) return;
        alien.y += 0.3 + (wave * 0.1); 
        if (Math.random() < 0.003 + (wave * 0.001)) {
            enemyShoot(this, alien);
        }
        if (alien.y > this.scale.height) {
            endGame(this);
        }
    });
}

function fireBullet(scene) {
    if (!scene || !scene.time || !player || !player.active) return;
    if (scene.time.now - lastFired < 200) return;
    lastFired = scene.time.now;
    
    const b = bullets.get(player.x, player.y - 40);
    if (b) {
        b.setActive(true).setVisible(true);
        b.body.enable = true;
        b.setVelocityY(-800);
    }
}

function destroyAlien(bullet, alien) {
    bullet.disableBody(true, true);
    particles.emitParticleAt(alien.x, alien.y, 10);
    
    score += 10;
    scoreText.setText(`SCORE: ${score}`);
    
    if (Math.random() < 0.15) {
        const heart = items.create(alien.x, alien.y, 'heart');
        heart.setVelocityY(200);
    }
    
    alien.destroy();
    
    if (aliens.countActive(true) === 0) {
        nextWave(this.scene);
    }
}

function damagePlayer(p, b) {
    b.destroy();
    playerHP--;
    hpText.setText(`HP: ❤️ ${playerHP}`);
    
    p.setTint(0xff0000);
    p.scene.time.delayedCall(150, () => { 
        if (p.active) p.clearTint(); 
    });
    
    if (playerHP <= 0) {
        endGame(p.scene);
    }
}

function collectItem(p, i) {
    i.destroy();
    playerHP = Math.min(playerHP + 1, 5);
    hpText.setText(`HP: ❤️ ${playerHP}`);
}

function createWave(scene) {
    const rows = Math.min(3 + Math.floor(wave / 3), 6);
    const cols = Math.floor(scene.scale.width / 80);
    const startX = scene.scale.width / 2 - (cols * 35);
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            aliens.create(startX + (c * 70), 80 + (r * 60), 'alien');
        }
    }
}

function nextWave(scene) {
    wave++;
    waveText.setText(`WAVE: ${wave}`);
    
    const msg = scene.add.text(
        scene.scale.width / 2, 
        scene.scale.height / 2, 
        `WAVE ${wave - 1} CLEAR!`, 
        { fontSize: '40px', fill: '#ffff00', fontFamily: 'Arial', fontWeight: 'bold' }
    ).setOrigin(0.5).setDepth(200);
    
    scene.time.delayedCall(1500, () => { 
        msg.destroy(); 
        createWave(scene); 
    });
}

function enemyShoot(scene, alien) {
    const b = enemyBullets.get(alien.x, alien.y + 20);
    if (b) {
        b.setActive(true).setVisible(true);
        b.body.enable = true;
        b.setVelocityY(300 + (wave * 20));
        b.setTint(0xffff00);
    }
}

function endGame(scene) {
    gameOver = true;
    player.setVelocity(0);
    player.setTint(0x444444);
    player.body.enable = false;
    
    const gameOverText = scene.add.text(
        scene.scale.width / 2, 
        scene.scale.height / 2, 
        `GAME OVER\n\nSCORE: ${score}\nWAVE: ${wave}\n\n[ 터치하여 재시작 ]`, 
        { 
            fontSize: '32px', 
            fill: '#ff0000', 
            align: 'center',
            fontFamily: 'Arial',
            fontWeight: 'bold',
            backgroundColor: '#000000cc',
            padding: { x: 20, y: 20 }
        }
    ).setOrigin(0.5).setDepth(200);
}

function restartGame(scene) {
    gameOver = false;
    playerHP = 3;
    score = 0;
    wave = 1;
    lastFired = 0;
    
    bullets.clear(true, true);
    enemyBullets.clear(true, true);
    aliens.clear(true, true);
    items.clear(true, true);
    
    scene.children.list.forEach(child => {
        if (child.type === 'Text' && child.depth === 200) {
            child.destroy();
        }
    });
    
    if (player) {
        player.clearTint();
        player.body.enable = true;
        player.setPosition(scene.scale.width / 2, scene.scale.height - 80);
        player.setVelocity(0);
    }
    
    hpText.setText(`HP: ❤️ ${playerHP}`);
    scoreText.setText(`SCORE: ${score}`);
    waveText.setText(`WAVE: ${wave}`);
    
    createWave(scene);
}
