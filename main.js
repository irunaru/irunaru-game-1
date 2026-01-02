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
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload,
        create,
        update
    }
};

new Phaser.Game(config);

let player;
let aliens;
let bullets;
let enemyBulletsIru;
let enemyBulletsNaru;
let cursors;
let fireButton;
let lastFired = 0;

/* =====================
   PRELOAD
===================== */
function preload() {
    // 경로 앞에 / 를 붙이지 마세요! (GitHub Pages 호환성)
    this.load.image('player', 'assets/player.png');
    this.load.image('alien', 'assets/alien.png');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('bullet_iru', 'assets/bullet_alien_iru.png');
    this.load.image('bullet_naru', 'assets/bullet_alien_naru.png');
}

/* =====================
   CREATE
===================== */
function create() {
    // 플레이어
    player = this.physics.add.sprite(
        this.scale.width / 2,
        this.scale.height - 60,
        'player'
    );
    player.setCollideWorldBounds(true);

    // 적 그룹
    aliens = this.physics.add.group();

    const rows = 5;
    const cols = 10;
    const startX = this.scale.width / 2 - (cols - 1) * 30;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const alien = aliens.create(
                startX + c * 60,
                80 + r * 50,
                'alien'
            );

            alien.waveOffset = Math.random() * Math.PI * 2;
            alien.diving = false;

            // 물리 부드럽게
            alien.setDamping(true);
            alien.setDrag(0.9);
        }
    }

    // 플레이어 총알
    bullets = this.physics.add.group({
        defaultKey: 'bullet',
        maxSize: 12,
        allowGravity: false
    });

    // 적 총알 2종
    enemyBulletsIru = this.physics.add.group({
        defaultKey: 'bullet_iru',
        maxSize: 15,
        allowGravity: false
    });

    enemyBulletsNaru = this.physics.add.group({
        defaultKey: 'bullet_naru',
        maxSize: 15,
        allowGravity: false
    });

    // 입력
    cursors = this.input.keyboard.createCursorKeys();
    fireButton = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    // 충돌
    this.physics.add.collider(bullets, aliens, hitAlien, null, this);
    this.physics.add.collider(enemyBulletsIru, player, hitPlayer, null, this);
    this.physics.add.collider(enemyBulletsNaru, player, hitPlayer, null, this);

    // 리사이즈
    this.scale.on('resize', size => {
        player.setPosition(size.width / 2, size.height - 60);
    });
}

/* =====================
   UPDATE
===================== */
function update() {
    // 플레이어 이동
    if (cursors.left.isDown) {
        player.setVelocityX(-360);
    } else if (cursors.right.isDown) {
        player.setVelocityX(360);
    } else {
        player.setVelocityX(0);
    }

    // 플레이어 발사
    if (Phaser.Input.Keyboard.JustDown(fireButton)) {
        fireBullet();
    }

    // 총알 정리
    cleanupBullets(bullets, y => y < 0);
    cleanupBullets(enemyBulletsIru, y => y > this.scale.height);
    cleanupBullets(enemyBulletsNaru, y => y > this.scale.height);

    // 적 이동 (⭐ 핵심 개선)
    const time = this.time.now * 0.002;

    aliens.children.each(alien => {
        if (!alien.active) return;

        if (!alien.diving) {
            // 웨이브 이동 (속도 기반)
            alien.setVelocityX(
                Math.sin(time + alien.waveOffset) * 120
            );

            // 지속 하강
            alien.setVelocityY(25);

            // 적 총알
            if (Math.random() < 0.002) {
                enemyFire(this, alien);
            }

            // 다이브 공격
            if (Math.random() < 0.001) {
                alien.diving = true;
                this.physics.moveToObject(alien, player, 320);
            }
        }
        // 다이브 후 자연 복귀
        else if (alien.y > this.scale.height + 40) {
            alien.diving = false;
            alien.setVelocity(
                Phaser.Math.Between(-120, 120),
                Phaser.Math.Between(-180, -120)
            );
        }
    });
}

/* =====================
   FUNCTIONS
===================== */
function fireBullet() {
    const time = player.scene.time.now;
    if (time - lastFired < 250) return;
    lastFired = time;

    const bullet = bullets.get(player.x, player.y - 20);
    if (bullet) {
        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.setVelocityY(-550);
    }
}

// 적 총알 랜덤 선택 (iru / naru)
function enemyFire(scene, alien) {
    const group =
        Math.random() < 0.5 ? enemyBulletsIru : enemyBulletsNaru;

    const bullet = group.get(alien.x, alien.y + 20);
    if (!bullet) return;

    bullet.setActive(true);
    bullet.setVisible(true);

    scene.physics.moveToObject(bullet, player, 320);
}

function cleanupBullets(group, outCheck) {
    group.children.each(bullet => {
        if (bullet.active && outCheck(bullet.y)) {
            bullet.setActive(false);
            bullet.setVisible(false);
            bullet.body.stop();
        }
    });
}

function hitAlien(bullet, alien) {
    bullet.setActive(false);
    bullet.setVisible(false);
    bullet.body.stop();
    alien.destroy();
}

function hitPlayer(player, bullet) {
    bullet.setActive(false);
    bullet.setVisible(false);
    bullet.body.stop();

    player.setTintFill(0xff0000);

    player.scene.time.delayedCall(100, () => {
        player.clearTint();
    });
}

