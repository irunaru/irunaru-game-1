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
    scene: { preload, create, update }
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
    // GitHub Pages 경로 호환을 위해 상대 경로 유지
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
    // 플레이어 배치
    player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 60, 'player');
    player.setCollideWorldBounds(true);

    // 적 그룹 및 배치
    aliens = this.physics.add.group();
    const rows = 5;
    const cols = 10;
    const startX = this.scale.width / 2 - (cols - 1) * 30;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const alien = aliens.create(startX + c * 60, 80 + r * 50, 'alien');
            alien.waveOffset = Math.random() * Math.PI * 2;
            alien.diving = false;
        }
    }

    // 총알 그룹 (최대 개수 제한으로 성능 최적화)
    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 15 });
    enemyBulletsIru = this.physics.add.group({ defaultKey: 'bullet_iru', maxSize: 10 });
    enemyBulletsNaru = this.physics.add.group({ defaultKey: 'bullet_naru', maxSize: 10 });

    // 입력 설정
    cursors = this.input.keyboard.createCursorKeys();
    fireButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 충돌 처리 (Collider 대신 Overlap 사용으로 튕김 현상 방지)
    this.physics.add.overlap(bullets, aliens, hitAlien, null, this);
    this.physics.add.overlap(enemyBulletsIru, player, hitPlayer, null, this);
    this.physics.add.overlap(enemyBulletsNaru, player, hitPlayer, null, this);

    // 창 크기 조절 대응
    this.scale.on('resize', (gameSize) => {
        player.y = gameSize.height - 60;
    });
}

/* =====================
   UPDATE
===================== */
function update() {
    // 플레이어 이동 로직
    if (cursors.left.isDown) {
        player.setVelocityX(-400);
    } else if (cursors.right.isDown) {
        player.setVelocityX(400);
    } else {
        player.setVelocityX(0);
    }

    // 발사 로직 (연사 속도 제한)
    if (Phaser.Input.Keyboard.JustDown(fireButton)) {
        fireBullet();
    }

    // 화면 밖으로 나간 오브젝트 정리 (메모리 관리)
    cleanupObjects(bullets, (b) => b.y < 0);
    cleanupObjects(enemyBulletsIru, (b) => b.y > this.scale.height);
    cleanupObjects(enemyBulletsNaru, (b) => b.y > this.scale.height);

    // 적 인공지능 (AI) 로직
    const time = this.time.now * 0.002;
    aliens.children.each(alien => {
        if (!alien.active) return;

        if (!alien.diving) {
            // 기본 패턴: 사인파 이동 및 서서히 하강
            alien.setVelocityX(Math.sin(time + alien.waveOffset) * 120);
            alien.setVelocityY(20);

            // 확률적 발사
            if (Math.random() < 0.002) enemyFire(this, alien);

            // 확률적 다이브 공격
            if (Math.random() < 0.001) {
                alien.diving = true;
                this.physics.moveToObject(alien, player, 350);
            }
        } else {
            // 화면 아래로 완전히 나갔을 때 위에서 다시 등장 (무한 루프)
            if (alien.y > this.scale.height + 50) {
                alien.diving = false;
                alien.y = -50;
                alien.x = Phaser.Math.Between(50, this.scale.width - 50);
            }
        }
    });
}

/* =====================
   FUNCTIONS
===================== */
function fireBullet() {
    const time = player.scene.time.now;
    if (time - lastFired < 200) return;
    lastFired = time;

    const bullet = bullets.get(player.x, player.y - 20);
    if (bullet) {
        bullet.setActive(true).setVisible(true);
        bullet.body.enable = true; // 비활성화되었던 물리 바디 재활성화
        bullet.setVelocityY(-600);
    }
}

function enemyFire(scene, alien) {
    const group = Math.random() < 0.5 ? enemyBulletsIru : enemyBulletsNaru;
    const bullet = group.get(alien.x, alien.y + 20);
    if (bullet) {
        bullet.setActive(true).setVisible(true);
        bullet.body.enable = true;
        scene.physics.moveToObject(bullet, player, 300);
    }
}

function cleanupObjects(group, condition) {
    group.children.each(obj => {
        if (obj.active && condition(obj)) {
            // 메모리에서 제거하지 않고 비활성화하여 재사용(Pooling)
            obj.disableBody(true, true);
        }
    });
}

function hitAlien(bullet, alien) {
    bullet.disableBody(true, true);
    // 적을 완전히 제거 (나중에 점수/폭발 효과 넣기 좋음)
    alien.destroy();
}

function hitPlayer(player, bullet) {
    bullet.disableBody(true, true);
    // 피격 효과: 빨간색으로 깜빡임
    player.setTint(0xff0000);
    player.scene.time.delayedCall(150, () => player.clearTint());
}
