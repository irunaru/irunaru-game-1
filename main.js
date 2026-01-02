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

const game = new Phaser.Game(config);

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
    // 1. 플레이어 생성
    player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, 'player');
    player.setCollideWorldBounds(true);

    // 2. 적 그룹 생성
    aliens = this.physics.add.group();
    const rows = 5;
    const cols = Math.floor(this.scale.width / 70); 
    const startX = this.scale.width / 2 - (cols - 1) * 30;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const alien = aliens.create(startX + c * 60, 100 + r * 50, 'alien');
            alien.waveOffset = Math.random() * Math.PI * 2;
            alien.diving = false;
        }
    }

    // 3. 총알 그룹 (Object Pooling)
    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 20 });
    enemyBulletsIru = this.physics.add.group({ defaultKey: 'bullet_iru', maxSize: 15 });
    enemyBulletsNaru = this.physics.add.group({ defaultKey: 'bullet_naru', maxSize: 15 });

    // 4. 입력 설정 (키보드)
    cursors = this.input.keyboard.createCursorKeys();
    fireButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 5. 모바일/마우스 클릭 발사 이벤트 (중요!)
    // update 루프 밖에서 처리해야 터치 입력을 놓치지 않습니다.
    this.input.on('pointerdown', () => {
        fireBullet();
    });

    // 6. 충돌 처리
    this.physics.add.overlap(bullets, aliens, hitAlien, null, this);
    this.physics.add.overlap(enemyBulletsIru, player, hitPlayer, null, this);
    this.physics.add.overlap(enemyBulletsNaru, player, hitPlayer, null, this);

    // 리사이즈 대응
    this.scale.on('resize', (gameSize) => {
        player.y = gameSize.height - 80;
    });
}

/* =====================
   UPDATE
===================== */
function update() {
    const pointer = this.input.activePointer;
    const width = this.scale.width;

    // --- 이동: 키보드 또는 화면 좌우 터치 ---
    if (cursors.left.isDown || (pointer.isDown && pointer.x < width / 2)) {
        player.setVelocityX(-400);
    } else if (cursors.right.isDown || (pointer.isDown && pointer.x >= width / 2)) {
        player.setVelocityX(400);
    } else {
        player.setVelocityX(0);
    }

    // --- 발사: 키보드 전용 (터치는 create의 이벤트 리스너가 담당) ---
    if (Phaser.Input.Keyboard.JustDown(fireButton)) {
        fireBullet();
    }

    // 오브젝트 정리
    cleanupObjects(bullets, (obj) => obj.y < 0);
    cleanupObjects(enemyBulletsIru, (obj) => obj.y > this.scale.height);
    cleanupObjects(enemyBulletsNaru, (obj) => obj.y > this.scale.height);

    // 적 AI 로직
    const time = this.time.now * 0.002;
    aliens.children.each(alien => {
        if (!alien || !alien.active) return;

        if (!alien.diving) {
            alien.setVelocityX(Math.sin(time + alien.waveOffset) * 120);
            alien.setVelocityY(20);
            if (Math.random() < 0.003) enemyFire(this, alien);
            if (Math.random() < 0.001) {
                alien.diving = true;
                this.physics.moveToObject(alien, player, 350);
            }
        } else if (alien.y > this.scale.height + 50) {
            alien.diving = false;
            alien.y = -50;
            alien.x = Phaser.Math.Between(50, width - 50);
        }
    });
}

/* =====================
   FUNCTIONS
===================== */
function fireBullet() {
    // 씬 상태 확인
    const scene = player.scene;
    const time = scene.time.now;
    
    if (time - lastFired < 200) return;
    lastFired = time;

    const bullet = bullets.get(player.x, player.y - 30);
    if (bullet) {
        bullet.setActive(true).setVisible(true);
        bullet.body.enable = true;
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
            obj.disableBody(true, true);
        }
    });
}

function hitAlien(bullet, alien) {
    bullet.disableBody(true, true);
    alien.destroy();
}

function hitPlayer(player, bullet) {
    bullet.disableBody(true, true);
    player.setTint(0xff0000);
    player.scene.time.delayedCall(150, () => player.clearTint());
}
