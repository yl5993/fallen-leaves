// ===== 可调整参数 =====
const SETTINGS = {
  canvasSize: 500,

  gridColumns: 5,
  gridRows: 5,
  treeDensity:3,             // 1 = 5×5 棵；调大增加树数

  treeSize: 0.5,              // 整体树木大小
  treeSizeVariation: 0.3,     // 每棵树的尺寸差异

  mouseInfluenceRadius: 120,  // 鼠标影响叶子的范围
  leafFallSpeed: 2,         // 落叶速度
  leafWind: 0.3,              // 落叶横向飘散程度
  leafSize: 8,                 // 基础叶片大小
  leafSizeVariation: 0.4,     // 叶片大小随机变化

  growthSpeedMin: 0.002,
  growthSpeedMax: 0.004
};

let trees = [];
let fallenLeaves = [];

function setup() {
  const host = document.getElementById("forest-canvas");
  const side = min(900, host.clientWidth);
  const canvas = createCanvas(side, side);
  canvas.parent(host);
  frameRate(30);
  createForest();
}

function windowResized() {
  const host = document.getElementById("forest-canvas");
  const side = min(900, host.clientWidth);
  resizeCanvas(side, side);
  createForest();
}

function createForest() {
  trees = [];
  fallenLeaves = [];

  let densityScale = sqrt(SETTINGS.treeDensity);
  let columns = max(1, round(SETTINGS.gridColumns * densityScale));
  let rows = max(1, round(SETTINGS.gridRows * densityScale));

  let cellWidth = width / columns;
  let cellHeight = height * 0.78 / rows;
  let topMargin = height * 0.18;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let x = (column + 0.5) * cellWidth +
        random(-cellWidth * 0.3, cellWidth * 0.3);

      let y = topMargin + (row + 0.5) * cellHeight +
        random(-cellHeight * 0.3, cellHeight * 0.3);

      let sizeVariation = random(
        1 - SETTINGS.treeSizeVariation,
        1 + SETTINGS.treeSizeVariation
      );

      trees.push({
        x: constrain(x, 5, width - 5),
        y: constrain(y, height * 0.2, height - 5),
        scale: SETTINGS.treeSize * sizeVariation,
        seed: floor(random(100000)),

        // 每棵树独有的形态参数
        trunkLength: random(70, 110),
        trunkThickness: random(7, 11),
        branchAngle: random(0.32, 0.72),
        branchRatio: random(0.58, 0.79),
        maxBranchDepth: random(3.5, 5.0),
        bendAmount: random(2, 9),
        lean: random(-0.16, 0.16),
        pruneChance: random(0.03, 0.22),

        growth: 0,
        growthSpeed: random(
          SETTINGS.growthSpeedMin,
          SETTINGS.growthSpeedMax
        ),

        health: 1,
        previousDropProgress: 0,
        dropAccumulator: 0,
        lastAnchors: []
      });
    }
  }

  // 后排树先画，前排树后画
  trees.sort((a, b) => a.y - b.y);
}

function draw() {
  background(235, 240, 230);

  // 先更新落叶，再把已经落地的叶片画在树后面
  updateFallenLeaves();
  drawFallenLeaves(true);

  for (let tree of trees) {
    let distanceToMouse = dist(mouseX, mouseY, tree.x, tree.y);

    // 树枝只在开场自动生长
    tree.growth = min(tree.growth + tree.growthSpeed, 1);

    // 鼠标只影响叶片状态
    let nearDistance = SETTINGS.mouseInfluenceRadius * 0.15;
    let targetHealth = map(
      distanceToMouse,
      nearDistance,
      SETTINGS.mouseInfluenceRadius,
      0,
      1
    );

    targetHealth = constrain(targetHealth, 0, 1);
    tree.health = lerp(tree.health, targetHealth, 0.03);

    // 先变黄，之后才开始掉落
    let yellowing = constrain(
      map(tree.health, 0.55, 0.95, 1, 0),
      0,
      1
    );

    let dropProgress = constrain(
      map(tree.health, 0.55, 0.15, 0, 1),
      0,
      1
    );

    let maxDepth = map(
      tree.growth,
      0,
      1,
      0.2,
      tree.maxBranchDepth
    );

    let anchors = [];

    push();
    translate(tree.x, tree.y);
    scale(tree.scale);
    rotate(tree.lean);

    drawBranch(
      tree.trunkLength,
      tree.trunkThickness,
      0,
      maxDepth,
      yellowing,
      dropProgress,
      tree,
      1,
      anchors
    );

    pop();

    // 仅在落叶阶段生成落叶粒子
    let dropDelta = max(
      0,
      dropProgress - tree.previousDropProgress
    );

    tree.dropAccumulator += dropDelta * 55;

    let sources = anchors.length > 0 ? anchors : tree.lastAnchors;

    while (tree.dropAccumulator >= 1 && sources.length > 0) {
      let source = random(sources);
      spawnFallenLeaf(source.x, source.y, source.scale);
      tree.dropAccumulator -= 1;
    }

    if (anchors.length > 0) {
      tree.lastAnchors = anchors;
    }

    tree.previousDropProgress = dropProgress;
  }

  // 空中飘落的叶片画在树前面
  drawFallenLeaves(false);
}

function drawBranch(
  length,
  thickness,
  depth,
  maxDepth,
  yellowing,
  dropProgress,
  tree,
  path,
  anchors
) {
  // 固定删枝结果，让不同树保持不同形态
  if (
    depth > 0 &&
    hash01(tree.seed, depth, path) < tree.pruneChance
  ) {
    return;
  }

  let layerGrowth = constrain(maxDepth - depth, 0, 1);
  if (layerGrowth <= 0) return;

  let endPoint = drawHandDrawnBranch(
    length * layerGrowth,
    thickness,
    tree,
    path
  );

  translate(endPoint.x, endPoint.y);

  if (maxDepth - depth <= 1) {
    drawLeaves(
      layerGrowth,
      yellowing,
      dropProgress,
      tree,
      path,
      anchors
    );
    return;
  }

  // 给左右分枝不同的角度和长度变化
  let jitterLeft = map(
    hash01(tree.seed + 11, depth, path),
    0,
    1,
    -0.14,
    0.14
  );

  let jitterRight = map(
    hash01(tree.seed + 23, depth, path),
    0,
    1,
    -0.14,
    0.14
  );

  let leftLength = length * tree.branchRatio * map(
    hash01(tree.seed + 31, depth, path),
    0,
    1,
    0.85,
    1.12
  );

  let rightLength = length * tree.branchRatio * map(
    hash01(tree.seed + 47, depth, path),
    0,
    1,
    0.85,
    1.12
  );

  push();
  rotate(-tree.branchAngle + jitterLeft);
  drawBranch(
    leftLength,
    thickness * 0.7,
    depth + 1,
    maxDepth,
    yellowing,
    dropProgress,
    tree,
    path * 2,
    anchors
  );
  pop();

  push();
  rotate(tree.branchAngle + jitterRight);
  drawBranch(
    rightLength,
    thickness * 0.7,
    depth + 1,
    maxDepth,
    yellowing,
    dropProgress,
    tree,
    path * 2 + 1,
    anchors
  );
  pop();
}

function drawHandDrawnBranch(length, thickness, tree, path) {
  let segments = 10;
  let points = [];

  let noiseOffset = tree.seed * 0.001 + path * 0.17;
  let widthOffset = tree.seed * 0.002 + path * 0.31;
  let startNoise = noise(noiseOffset);

  for (let i = 0; i <= segments; i++) {
    let progress = i / segments;
    let bendNoise = noise(noiseOffset + progress * 1.5);

    let x = (bendNoise - startNoise) * tree.bendAmount;
    let y = -length * progress;

    points.push({ x, y, progress });
  }

  stroke(0);
  noFill();

  for (let i = 0; i < segments; i++) {
    let middleProgress =
      (points[i].progress + points[i + 1].progress) / 2;

    let widthNoise = noise(widthOffset + middleProgress * 2);
    let widthVariation = map(widthNoise, 0, 1, -0.08, 0.08);

    let currentThickness =
      thickness *
      (1 - middleProgress * 0.35) *
      (1 + widthVariation);

    strokeWeight(currentThickness);
    line(
      points[i].x,
      points[i].y,
      points[i + 1].x,
      points[i + 1].y
    );
  }

  return points[segments];
}

function drawLeaves(
  amount,
  yellowing,
  dropProgress,
  tree,
  path,
  anchors
) {
  let leafColor = lerpColor(
    color(40, 150, 70),
    color(225, 175, 45),
    yellowing
  );

  // 黄色阶段保持叶片数量；之后才逐步减少
  let baseCount = floor(map(amount, 0, 1, 1, 6));
  let leafCount = floor(baseCount * (1 - dropProgress));

  stroke(leafColor);
  strokeWeight(2);

  for (let i = 0; i < leafCount; i++) {
    let size = SETTINGS.leafSize;

    let x = map(hash01(tree.seed, path, i), 0, 1, -size, size);
    let y = map(hash01(tree.seed + 3, path, i), 0, 1, -size, size * 0.5);
    let leafX = map(hash01(tree.seed + 5, path, i), 0, 1, -size * 0.5, size * 0.5);
    let leafY = map(hash01(tree.seed + 7, path, i), 0, 1, size * 0.5, size * 1.2);

    line(x, y, x + leafX, y - leafY);

    let point = toCanvasPoint(x, y);
    anchors.push({
      x: point.x,
      y: point.y,
      scale: tree.scale
    });
  }
}

function toCanvasPoint(x, y) {
  let matrix = drawingContext.getTransform();
  let density = pixelDensity();

  return {
    x: (matrix.a * x + matrix.c * y + matrix.e) / density,
    y: (matrix.b * x + matrix.d * y + matrix.f) / density
  };
}

function spawnFallenLeaf(x, y, treeScale) {
  let sizeVariation = random(
    1 - SETTINGS.leafSizeVariation,
    1 + SETTINGS.leafSizeVariation
  );

  fallenLeaves.push({
    x: x,
    y: y,
    targetX: random(width),
    targetY: random(height),
    vx: random(-0.5, 0.5),
    vy: random(0.3, 1.2),
    size: SETTINGS.leafSize * treeScale * sizeVariation,
    angle: random(TWO_PI),
    spin: random(-0.04, 0.04),
    color: color(
      random(190, 235),
      random(115, 185),
      random(35, 75)
    ),
    landed: false
  });

  if (fallenLeaves.length > 3000) {
    fallenLeaves.splice(0, fallenLeaves.length - 3000);
  }
}

function updateFallenLeaves() {
  for (let leaf of fallenLeaves) {
    if (leaf.landed) continue;

    leaf.x += (leaf.targetX - leaf.x) * 0.015;
    leaf.y += (leaf.targetY - leaf.y) * 0.015;
    leaf.y += leaf.vy * SETTINGS.leafFallSpeed;
    leaf.x += leaf.vx * SETTINGS.leafWind;
    leaf.angle += leaf.spin;

    if (dist(leaf.x, leaf.y, leaf.targetX, leaf.targetY) < 3) {
      leaf.x = leaf.targetX;
      leaf.y = leaf.targetY;
      leaf.landed = true;
    }
  }
}

function drawFallenLeaves(landedState) {
  for (let leaf of fallenLeaves) {
    if (leaf.landed !== landedState) continue;

    push();
    translate(leaf.x, leaf.y);
    rotate(leaf.angle);
    stroke(leaf.color);
    strokeWeight(max(1, leaf.size * 0.22));
    line(-leaf.size / 2, 0, leaf.size / 2, 0);
    pop();
  }
}

function hash01(a, b, c) {
  let value = sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return value - floor(value);
}
// Le bouton « Nouvelle forêt » appelle cette fonction depuis la page.
function regenerateForest() {
  createForest();
}

