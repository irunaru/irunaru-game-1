// 1. 게임 엔진 설정 (해상도, 물리 엔진, 입력 방식 등)
const config = {
    type: Phaser.AUTO, // 브라우저 환경에 따라 WebGL 또는 Canvas 자동 선택
    width: window.innerWidth, // 화면 너비를 브라우저 창 너비로 설정
    height: window.innerHeight, // 화면 높이를 브라우저 창 높이로 설정
    backgroundColor: '#000000', // 배경색 (검정)
    scale: {
        mode: Phaser.Scale.RESIZE, // 창 크기가 변하면 게임 크기도 재조정
        autoCenter: Phaser.Scale.CENTER_BOTH // 게임 화면을 중앙에 배치
    },
    physics: {
        default: 'arcade', // 아케이드 물리 엔진 사용 (가장 가볍고 빠름)
        arcade: { gravity: { y: 0 }, debug: false } // 중력 0, 디버그 모드 끔
    },
    input: { activePointers: 3, keyboard: true }, // 멀티터치(최대 3개) 및 키보드 사용 허용
    scene: { preload, create, update } // 게임의 3대 단계 연결
};

// 게임 인스턴스 생성
const game = new Phaser.Game(config);

// 2. 전역 변수 선언 (게임 전체에서 공통으로 사용)
let player, aliens, bullets, enemyBullets, items, particles;
let cursors, fireButton, starfield;
let lastFired = 0, nextEnemyFire = 0; 
let score = 0, playerHP = 3, wave = 1, gameOver = false;
let hpText, scoreText, waveText, bulletToggle = false;

// 3. 자원 로드 단계 (이미지 등 외부 파일 불러오기)
function preload() {
    this.load.image('player', 'assets/player.png'); // 플레이어 캐릭터
    this.load.image('alien', 'assets/alien.png'); // 적 캐릭터
    this.load.image('bullet', 'assets/bullet.png'); // 플레이어 총알
    this.load.image('heart', 'assets/heart.png'); // 체력 회복 아이템
    this.load.image('bullet_iru', 'assets/bullet_alien_iru.png'); // 적 총알 (이루)
    this.load.image('bullet_naru', 'assets/bullet_alien_naru.png'); // 적 총알 (나루)
    this.load.image('star', 'assets/star.png'); // 배경 별 이미지
}

// 4. 게임 생성 단계 (오브젝트 배치, 물리 법칙 설정)
function create() {
    // 입력 장치 초기화
    cursors = this.input.keyboard.createCursorKeys(); // 화살표 키
    fireButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE); // 스페이스바
    
    // [배경 설정] 배경 이미지가 없을 경우를 대비한 자동 생성 로직
    if (!this.textures.exists('star')) {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff, 0.5);
        graphics.fillCircle(1, 1, 1);
        graphics.generateTexture('star', 2, 2);
        graphics.destroy();
    }

    // [배경 스크롤 설정]
    starfield = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'star');
    starfield.setOrigin(0, 0).setDepth(-1); // 맨 뒤에 배치
    starfield.tileScaleX = 3.0; // 별 밀도 낮추기 (가로 3배 확대)
    starfield.tileScaleY = 3.0; // 별 밀도 낮추기 (세로 3배 확대)
    starfield.alpha = 0.4; // 배경 투명도

    // [이펙트] 적이 터질 때 나오는 파티클 설정
    particles = this.add.particles(0, 0, 'bullet', {
        speed: { min: -100, max: 100 },
        scale: { start: 0.5, end: 0 },
        lifespan: 400,
        frequency: -1 // 필요할 때만 호출해서 사용
    });

    // [플레이어 생성]
    player = this.physics.add.sprite(this.scale.width / 2, this.scale.height - 80, 'player');
    player.setCollideWorldBounds(true); // 화면 밖으로 못 나가게 설정

    // [그룹 생성] 효율적인 관리를 위해 여러 오브젝트를 그룹으로 묶음
    aliens = this.physics.add.group();
    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 }); // 최대 30발만 존재 가능
    enemyBullets = this.physics.add.group();
    items = this.physics.add.group();

    // 첫 번째 웨이브 적 생성
    createWave(this);

    // [충돌 감지 로직]
    this.physics.add.overlap(bullets, aliens, destroyAlien, null, this); // 총알 <-> 적
    this.physics.add.overlap(enemyBullets, player, damagePlayer, null, this); // 적총알 <-> 플레이어
    this.physics.add.overlap(items, player, collectItem, null, this); // 아이템 <-> 플레이어

    // [UI 설정]
    const style = { fontSize: '22px', fill: '#fff', fontFamily: 'Arial', fontWeight: 'bold' };
    hpText = this.add.text(20, 20, `HP: ❤️ ${playerHP}`, style).setDepth(100);
    scoreText = this.add.text(20, 50, `SCORE: ${score}`, style).setDepth(100);
    waveText = this.add.text(20, 80, `WAVE: ${wave}`, style).setDepth(100);

    // [입력 이벤트] 마우스 클릭 또는 터치 시 발사/재시작
    this.input.on('pointerdown', () => {
        if (gameOver) { restartGame(this); return; }
        window.focus();
        fireBullet(this);
    });

    // 화면 크기가 바뀔 때 대응
    this.scale.on('resize', (gameSize) => {
        if (starfield) starfield.setSize(gameSize.width, gameSize.height);
        if (player && player.active) player.setPosition(gameSize.width / 2, gameSize.height - 80);
    });
}

// 5. 게임 실시간 업데이트 단계 (초당 60회 실행)
function update() {
    if (gameOver) return; // 게임 오버 시 멈춤

    // 배경 스크롤 효과
    if (starfield) starfield.tilePositionY -= 0.8;

    let isMoving = false;
    const moveSpeed = 450; // 이동 속도
    const currentTime = this.time.now;

    // 조작 로직 (좌우 이동)
    if (cursors.left.isDown || (this.input.activePointer.isDown && this.input.activePointer.x < this.scale.width / 2)) {
        player.setVelocityX(-moveSpeed);
        isMoving = true;
    } else if (cursors.right.isDown || (this.input.activePointer.isDown && this.input.activePointer.x >= this.scale.width / 2)) {
        player.setVelocityX(moveSpeed);
        isMoving = true;
    }
    if (!isMoving) player.setVelocityX(0); // 아무것도 안 누르면 멈춤
    if (Phaser.Input.Keyboard.JustDown(fireButton)) fireBullet(this); // 스페이스바 발사

    // 외계인(적) 행동 관리
    aliens.children.each(alien => {
        if (!alien.active) return;
        alien.y += 0.2 + (wave * 0.05); // 웨이브가 높아질수록 조금씩 빨리 내려옴
        
        // 적 발사 확률 로직
        if (currentTime > nextEnemyFire && Math.random() < 0.01) {
            enemyShoot(this, alien);
            // 다음 발사 시간 조절 (웨이브가 높을수록 자주 쏨)
            nextEnemyFire = currentTime + Math.max(1200 - (wave * 50), 600);
        }
        
        // 외계인이 바닥에 닿으면 게임 오버
        if (alien.y > this.scale.height) endGame(this);
    });

    // 화면 밖으로 나간 총알들 제거 (메모리 절약)
    bullets.children.each(b => { if (b.active && b.y < -50) b.disableBody(true, true); });
    enemyBullets.children.each(b => { if (b.active && b.y > this.scale.height + 50) b.disableBody(true, true); });
}

// [함수] 적의 사격 (이루/나루 번갈아 가며)
function enemyShoot(scene, alien) {
    if (enemyBullets.countActive(true) >= 6) return; // 동시에 너무 많은 총알 방지
    
    const bulletKey = bulletToggle ? 'bullet_iru' : 'bullet_naru';
    bulletToggle = !bulletToggle; // 발사할 때마다 캐릭터 변경
    
    const b = enemyBullets.create(alien.x, alien.y + 40, bulletKey);
    if (b) {
        b.setVelocityY(200 + (wave * 15)); // 웨이브 비례 속도 증가
        b.setScale(0.5); // 크기 50%
        b.body.setSize(30, 30); // 히트박스(충돌 영역) 최적화
    }
}

// [함수] 플레이어 총알 발사
function fireBullet(scene) {
    if (!player || !player.active || scene.time.now - lastFired < 200) return; // 연사 속도 제한
    lastFired = scene.time.now;
    const b = bullets.get(player.x, player.y - 40);
    if (b) {
        b.setActive(true).setVisible(true).body.enable = true;
        b.setVelocityY(-800); // 플레이어 총알은 위로 빠르게 발사
    }
}

// [함수] 적 처치 시 실행
function destroyAlien(bullet, alien) {
    bullet.disableBody(true, true); // 맞은 총알 제거
    particles.emitParticleAt(alien.x, alien.y, 10); // 펑! 파티클 생성
    score += 10;
    scoreText.setText(`SCORE: ${score}`);
    
    // 15% 확률로 하트 아이템 생성
    if (Math.random() < 0.15) {
        const h = items.create(alien.x, alien.y, 'heart');
        h.setVelocityY(200);
        h.setScale(0.8);
    }
    
    alien.destroy();
    if (aliens.countActive(true) === 0) nextWave(this); // 적이 다 죽으면 다음 웨이브
}

// [함수] 플레이어 데미지 처리
function damagePlayer(p, b) {
    b.destroy(); // 적 총알 제거
    playerHP--;
    hpText.setText(`HP: ❤️ ${playerHP}`);
    p.setTint(0xff0000); // 캐릭터를 빨간색으로 깜빡이게 함
    p.scene.time.delayedCall(150, () => { if (p.active) p.clearTint(); });
    
    if (playerHP <= 0) endGame(p.scene); // 체력 0이면 게임 종료
}

// [함수] 아이템 획득
function collectItem(p, i) {
    i.destroy();
    playerHP = Math.min(playerHP + 1, 5); // 체력 최대 5까지만 회복
    hpText.setText(`HP: ❤️ ${playerHP}`);
}

// [함수] 적 웨이브 생성 (행/열 계산)
function createWave(scene) {
    const rows = Math.min(3 + Math.floor(wave / 3), 5); // 웨이브가 지날수록 행 추가
    const cols = Math.floor(scene.scale.width / 85); // 화면 너비에 맞춰 열 계산
    const startX = (scene.scale.width - (cols - 1) * 70) / 2; // 중앙 정렬 위치 계산
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            aliens.create(startX + (c * 70), 80 + (r * 60), 'alien');
        }
    }
}

// [함수] 다음 웨이브 준비
function nextWave(scene) {
    wave++;
    waveText.setText(`WAVE: ${wave}`);
    const msg = scene.add.text(scene.scale.width / 2, scene.scale.height / 2, `WAVE ${wave - 1} CLEAR!`, 
        { fontSize: '40px', fill: '#ffff00', fontWeight: 'bold' }).setOrigin(0.5).setDepth(200);
    scene.time.delayedCall(1500, () => { msg.destroy(); createWave(scene); });
}

// [함수] 게임 오버 처리
function endGame(scene) {
    gameOver = true;
    player.setVelocity(0).setTint(0x444444); // 플레이어 캐릭터 회색조 변경
    player.body.enable = false;
    scene.add.text(scene.scale.width / 2, scene.scale.height / 2, 
        `GAME OVER\n\nSCORE: ${score}\n[ 클릭하여 재시작 ]`, 
        { fontSize: '32px', fill: '#f00', align: 'center', backgroundColor: '#000000cc', padding: 20 }
    ).setOrigin(0.5).setDepth(200);
}

// [함수] 게임 재시작 (상태 초기화)
function restartGame(scene) {
    gameOver = false; playerHP = 3; score = 0; wave = 1; lastFired = 0; nextEnemyFire = 0;
    bullets.clear(true, true); enemyBullets.clear(true, true); aliens.clear(true, true); items.clear(true, true);
    scene.children.list.filter(c => c.depth === 200).forEach(c => c.destroy()); // 안내 텍스트 삭제
    player.clearTint(); player.body.enable = true;
    player.setPosition(scene.scale.width / 2, scene.scale.height - 80);
    hpText.setText(`HP: ❤️ ${playerHP}`); scoreText.setText(`SCORE: ${score}`); waveText.setText(`WAVE: ${wave}`);
    createWave(scene);
}
