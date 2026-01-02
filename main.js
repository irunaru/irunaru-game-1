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

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('alien', 'assets/alien.png');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('bullet_iru', 'assets/bullet_alien_iru.png');
    this.load.image('bullet_naru', 'assets/bullet_alien_naru.png');
}

function create() {
    // 1. 플레이어 설정
    player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, 'player');
    player.setCollideWorldBounds(true);

    // 2. 적 그룹 설정
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

    // 3. 총알 그룹 설정
    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 20 });
    enemyBulletsIru = this.physics.add.group({ defaultKey: 'bullet_iru', maxSize: 15 });
    enemyBulletsNaru = this.physics.add.group({ defaultKey: 'bullet_naru', maxSize: 15 });

    // 4. 키보드 입력
    cursors = this.input.keyboard.createCursorKeys();
    fireButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 5. [핵심 수정] 모바일 터치 발사 이벤트 등록
    // 화면 어디를 터치하든 fireBullet 함수가 실행됩니다.
    this.input.on('pointerdown', function (pointer) {
        fireBullet();
    }, this);

    // 6. 충돌 판정
    this.physics.add.overlap(bullets, aliens, hitAlien, null, this);
    this.physics.add.overlap(enemyBulletsIru, player, hitPlayer, null, this);
    this.physics.add.overlap(enemyBulletsNaru, player, hitPlayer, null, this);

    this.scale.on('resize', (gameSize) => {
        player.y = gameSize.height - 80;
    });
}

function update() {
    const pointer = this.input.activePointer;
    const width = this.scale.width;

    // 모바일 이동: 화면 좌우 터치 유지
    if (cursors.left.isDown || (pointer.isDown && pointer.x < width / 2)) {
        player.setVelocityX(-400);
    } else if (cursors.right.isDown || (pointer.isDown && pointer.x >= width / 2)) {
        player.setVelocityX(400);
    } else {
        player.setVelocityX(0);
    }

    // PC 발사: 스페이스바 전용
    if (Phaser.Input.Keyboard.JustDown(fireButton)) {
        fireBullet();
    }

    cleanupObjects(bullets, (obj) => obj.y < 0);
    cleanupObjects(enemyBulletsIru, (obj) => obj.y > this.scale.height);
    cleanupObjects(enemyBulletsNaru, (obj) => obj.y > this.scale.height);

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

function fireBullet() {
    // 플레이어가 존재하고 활성화된 상태인지 확인
    if (!player || !player.active) return;

    const time = game.loop.time;
    if (time - lastFired < 250) return; // 연사 속도 (0.25초)
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

function hitPlayer(p, bullet) {
    bullet.disableBody(true, true);
    p.setTint(0xff0000);
    p.scene.time.delayedCall(150, () => p.clearTint());
}
