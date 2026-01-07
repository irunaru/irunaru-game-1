// ==========================================
// [PART 1] 게임 시작: 엔진 환경 설정
// ==========================================
const config = {
    type: Phaser.AUTO,           // 브라우저 성능에 따라 WebGL/Canvas 자동 선택
    width: window.innerWidth,    // 화면 너비를 창 크기에 맞춤
    height: window.innerHeight,  // 화면 높이를 창 크기에 맞춤
    backgroundColor: '#000000',  // 우주 배경색 (검정)
    scale: {
        mode: Phaser.Scale.RESIZE,          // 창 크기 조절 시 실시간 대응
        autoCenter: Phaser.Scale.CENTER_BOTH // 화면 중앙 정렬
    },
    physics: {
        default: 'arcade',                  // 물리 엔진: 충돌, 이동 계산 담당
        arcade: { gravity: { y: 0 }, debug: false } // 우주니까 중력은 0
    },
    input: { activePointers: 3, keyboard: true }, // 키보드 및 멀티터치 허용
    scene: { preload, create, update }            // 실행 순서: 로드 -> 생성 -> 반복
};

const game = new Phaser.Game(config); // 설정값으로 게임 실행

// 게임 전반에서 사용할 변수 모음
let player, aliens, bullets, enemyBullets, items, particles;
let cursors, fireButton, starfield;
let score = 0, playerHP = 3, wave = 1, gameOver = false;
let hpText, scoreText, waveText, bulletToggle = false;
let lastFired = 0, nextEnemyFire = 0;

// ==========================================
// [PART 2] 로드: 이미지 자원 불러오기
// ==========================================
function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('alien', 'assets/alien.png');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('heart', 'assets/heart.png');
    this.load.image('bullet_iru', 'assets/bullet_alien_iru.png');
    this.load.image('bullet_naru', 'assets/bullet_alien_naru.png');
    this.load.image('star', 'assets/star.png'); // 배경 별 이미지
}

// ==========================================
// [PART 3] 생성: 오브젝트 배치 및 초기화
// ==========================================
function create() {
    // 1. 입력 감지 설정
    cursors = this.input.keyboard.createCursorKeys();
    fireButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // 2. 드문드문 흐르는 우주 배경 설정
    starfield = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'star');
    starfield.setOrigin(0, 0).setDepth(-1);
    starfield.tileScaleX = 3.0; // 별 밀도를 낮게 (3배 확대)
    starfield.tileScaleY = 3.0;
    starfield.alpha = 0.4;      // 은은한 투명도

    // 3. 플레이어 및 그룹(적, 총알, 아이템) 생성
    player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, 'player');
    player.setCollideWorldBounds(true);

    aliens = this.physics.add.group();
    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
    enemyBullets = this.physics.add.group();
    items = this.physics.add.group();

    // 4. 이펙트(파티클) 및 UI 텍스트 배치
    particles = this.add.particles(0, 0, 'bullet', { speed: 100, scale: {start: 0.5, end: 0}, lifespan: 400, frequency: -1 });
    const style = { fontSize: '22px', fill: '#fff', fontWeight: 'bold' };
    hpText = this.add.text(20, 20, `HP: ❤️ ${playerHP}`, style).setDepth(100);
    scoreText = this.add.text(20, 50, `SCORE: ${score}`, style).setDepth(100);
    waveText = this.add.text(20, 80, `WAVE: ${wave}`, style).setDepth(100);

    // 5. 충돌 규칙 정의 (무엇과 무엇이 부딪히면 어떤 함수를 실행할지)
    this.physics.add.overlap(bullets, aliens, destroyAlien, null, this);
    this.physics.add.overlap(enemyBullets, player, damagePlayer, null, this);
    this.physics.add.overlap(items, player, collectItem, null, this);

    // 6. 적 웨이브 생성 시작
    createWave(this);
}

// ==========================================
// [PART 4] 루프: 매 프레임 실시간 계산 (핵심 로직)
// ==========================================
function update() {
    if (gameOver) return; // 게임 오버 상태면 아래 계산 중단

    starfield.tilePositionY -= 0.8; // 배경 스크롤

    // 플레이어 좌우 이동 (키보드 및 터치)
    let moveSpeed = 450;
    if (cursors.left.isDown || (this.input.activePointer.isDown && this.input.activePointer.x < this.scale.width / 2)) {
        player.setVelocityX(-moveSpeed);
    } else if (cursors.right.isDown || (this.input.activePointer.isDown && this.input.activePointer.x >= this.scale.width / 2)) {
        player.setVelocityX(moveSpeed);
    } else {
        player.setVelocityX(0);
    }

    // 적들의 움직임 및 사격 관리
    aliens.children.each(alien => {
        if (!alien.active) return;
        alien.y += 0.2 + (wave * 0.05); // 서서히 하강
        
        // 무작위 확률로 적이 총알(이루/나루) 발사
        if (this.time.now > nextEnemyFire && Math.random() < 0.01) {
            enemyShoot(this, alien);
            nextEnemyFire = this.time.now + Math.max(1200 - (wave * 50), 600);
        }
        if (alien.y > this.scale.height) endGame(this); // 바닥에 닿으면 종료
    });
}

// ==========================================
// [PART 5] 종료 및 재시작: 게임의 마무리
// ==========================================

// 적 파괴 함수
function destroyAlien(bullet, alien) {
    bullet.disableBody(true, true);
    particles.emitParticleAt(alien.x, alien.y, 10);
    score += 10;
    scoreText.setText(`SCORE: ${score}`);
    if (Math.random() < 0.15) items.create(alien.x, alien.y, 'heart').setVelocityY(200);
    alien.destroy();
    if (aliens.countActive(true) === 0) nextWave(this);
}

// 게임 종료 함수
function endGame(scene) {
    gameOver = true;
    player.setVelocity(0).setTint(0x444444); // 플레이어 정지 및 회색조
    player.body.enable = false;
    scene.add.text(scene.scale.width / 2, scene.scale.height / 2, 
        `GAME OVER\nSCORE: ${score}\n[ 화면 클릭 재시작 ]`, 
        { fontSize: '32px', fill: '#f00', align: 'center', backgroundColor: '#000' }
    ).setOrigin(0.5).setDepth(200);
}

// 게임 재시작 함수 (모든 수치 초기화)
function restartGame(scene) {
    gameOver = false; playerHP = 3; score = 0; wave = 1;
    bullets.clear(true, true); enemyBullets.clear(true, true); aliens.clear(true, true); items.clear(true, true);
    scene.children.list.filter(c => c.depth === 200).forEach(c => c.destroy()); // 안내문 제거
    player.clearTint(); player.body.enable = true;
    hpText.setText(`HP: ❤️ ${playerHP}`); scoreText.setText(`SCORE: ${score}`); waveText.setText(`WAVE: ${wave}`);
    createWave(scene);
}

// (기타 필요 함수들: enemyShoot, fireBullet, damagePlayer, collectItem, createWave, nextWave 등은 기존 로직 유지)
