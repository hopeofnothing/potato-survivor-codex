const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  level: document.querySelector("#level"),
  time: document.querySelector("#time"),
  kills: document.querySelector("#kills"),
  healthBar: document.querySelector("#healthBar"),
  xpBar: document.querySelector("#xpBar"),
  weaponSlots: document.querySelector("#weaponSlots"),
  accessorySlots: document.querySelector("#accessorySlots"),
  startOverlay: document.querySelector("#startOverlay"),
  levelOverlay: document.querySelector("#levelOverlay"),
  pauseOverlay: document.querySelector("#pauseOverlay"),
  gameOverOverlay: document.querySelector("#gameOverOverlay"),
  choices: document.querySelector("#choices"),
  pauseWeapons: document.querySelector("#pauseWeapons"),
  pauseAccessories: document.querySelector("#pauseAccessories"),
  finalStats: document.querySelector("#finalStats"),
  startButton: document.querySelector("#startButton"),
  restartButton: document.querySelector("#restartButton"),
  backToStartButton: document.querySelector("#backToStartButton"),
  resumeButton: document.querySelector("#resumeButton"),
  pauseButton: document.querySelector("#pauseButton"),
  audioButton: document.querySelector("#audioButton"),
  langButtons: document.querySelectorAll("[data-lang]"),
};

const keys = new Set();
const pointer = { active: false, x: 0, y: 0 };
const world = { width: 1280, height: 720 };
let currentLang = "en";
const audio = {
  ctx: null,
  master: null,
  musicGain: null,
  musicTimer: null,
  musicStep: 0,
  muted: false,
  last: {},
};

const i18n = {
  en: {
    title: "Potato Survivor",
    tagline: "Hold the field, harvest XP, and turn one brave potato into a fully loaded fryer storm.",
    startRun: "Start Run",
    levelUp: "Level Up",
    paused: "Paused",
    resume: "Resume",
    weapons: "Weapons",
    accessories: "Accessories",
    mashed: "Mashed",
    tryAgain: "Try Again",
    backToStart: "Back to Start",
    hudLevel: "Level",
    hudTime: "Time",
    hudKos: "KOs",
    soundOn: "Snd",
    soundOff: "Off",
    soundOnTitle: "Sound on",
    soundOffTitle: "Sound off",
    emptySlot: "Empty slot",
    noItems: "No items equipped.",
    level: "level",
    lv: "Lv",
    newWeapon: "New weapon.",
    newAccessory: "New accessory.",
    levelOne: "Level 1",
    current: "Current",
    next: "Next",
    survived: (level, time, kills) => `Level ${level} potato survived ${time} and cleared ${kills} enemies.`,
  },
  zh: {
    title: "馬鈴薯倖存者",
    tagline: "守住菜園、收集經驗，讓勇敢的馬鈴薯變成全副武裝的炸物風暴。",
    startRun: "開始遊戲",
    levelUp: "升級",
    paused: "暫停",
    resume: "繼續",
    weapons: "武器",
    accessories: "配件",
    mashed: "變薯泥了",
    tryAgain: "再試一次",
    backToStart: "回到開始畫面",
    hudLevel: "等級",
    hudTime: "時間",
    hudKos: "擊倒",
    soundOn: "聲音",
    soundOff: "靜音",
    soundOnTitle: "聲音開啟",
    soundOffTitle: "聲音關閉",
    emptySlot: "空欄位",
    noItems: "尚未裝備物品。",
    level: "等級",
    lv: "Lv",
    newWeapon: "新武器。",
    newAccessory: "新配件。",
    levelOne: "等級 1",
    current: "目前",
    next: "下一級",
    survived: (level, time, kills) => `等級 ${level} 的馬鈴薯存活 ${time}，擊倒 ${kills} 名敵人。`,
  },
};

function tr(key) {
  return i18n[currentLang][key];
}

function ensureAudio() {
  if (audio.ctx) {
    if (audio.ctx.state === "suspended") audio.ctx.resume();
    return true;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;

  audio.ctx = new AudioContext();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = audio.muted ? 0 : 0.28;
  audio.master.connect(audio.ctx.destination);

  audio.musicGain = audio.ctx.createGain();
  audio.musicGain.gain.value = 0.16;
  audio.musicGain.connect(audio.master);
  return true;
}

function setMuted(muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.setTargetAtTime(muted ? 0 : 0.28, audio.ctx.currentTime, 0.02);
  updateAudioButton();
}

function updateAudioButton() {
  ui.audioButton.textContent = audio.muted ? tr("soundOff") : tr("soundOn");
  ui.audioButton.title = audio.muted ? tr("soundOffTitle") : tr("soundOnTitle");
  ui.audioButton.setAttribute("aria-label", ui.audioButton.title);
}

function tone(freq, duration, type = "square", volume = 0.18, destination = audio.master, when = 0) {
  if (!ensureAudio() || audio.muted) return;
  const start = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function noise(duration, volume = 0.14, filterFreq = 900) {
  if (!ensureAudio() || audio.muted) return;
  const length = Math.floor(audio.ctx.sampleRate * duration);
  const buffer = audio.ctx.createBuffer(1, length, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;

  const source = audio.ctx.createBufferSource();
  const filter = audio.ctx.createBiquadFilter();
  const gain = audio.ctx.createGain();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  gain.gain.setValueAtTime(volume, audio.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  source.start();
}

function throttledSound(name, ms, play) {
  const now = performance.now();
  if ((audio.last[name] || 0) + ms > now) return;
  audio.last[name] = now;
  play();
}

function playSound(name) {
  if (name === "fries") return throttledSound("fries", 70, () => tone(620, 0.055, "square", 0.08));
  if (name === "ketchup") return throttledSound("ketchup", 120, () => tone(190, 0.12, "sawtooth", 0.09));
  if (name === "mash") return throttledSound("mash", 160, () => noise(0.11, 0.11, 420));
  if (name === "tots") return throttledSound("tots", 120, () => {
    tone(440, 0.045, "square", 0.06);
    tone(560, 0.045, "square", 0.06, audio.master, 0.035);
  });
  if (name === "chip") return throttledSound("chip", 130, () => tone(760, 0.09, "sawtooth", 0.075));
  if (name === "hit") return throttledSound("hit", 55, () => noise(0.04, 0.07, 1300));
  if (name === "hurt") return throttledSound("hurt", 240, () => {
    tone(180, 0.16, "sawtooth", 0.14);
    noise(0.08, 0.1, 260);
  });
  if (name === "xp") return throttledSound("xp", 35, () => tone(880, 0.045, "triangle", 0.07));
  if (name === "heal") return throttledSound("heal", 120, () => {
    tone(620, 0.08, "triangle", 0.08);
    tone(930, 0.12, "triangle", 0.08, audio.master, 0.08);
  });
  if (name === "level") return throttledSound("level", 400, () => {
    tone(523, 0.09, "triangle", 0.1);
    tone(659, 0.09, "triangle", 0.1, audio.master, 0.09);
    tone(784, 0.14, "triangle", 0.1, audio.master, 0.18);
  });
  if (name === "select") return tone(520, 0.07, "square", 0.07);
  if (name === "pause") return tone(300, 0.07, "triangle", 0.08);
  if (name === "gameover") return throttledSound("gameover", 500, () => {
    tone(260, 0.14, "sawtooth", 0.1);
    tone(190, 0.22, "sawtooth", 0.1, audio.master, 0.14);
  });
}

function startMusic() {
  if (!ensureAudio() || audio.musicTimer) return;
  const notes = [196, 247, 294, 247, 330, 294, 247, 220, 196, 247, 294, 370, 330, 294, 247, 220];
  audio.musicTimer = setInterval(() => {
    if (state.mode !== "playing" || audio.muted) return;
    const note = notes[audio.musicStep % notes.length];
    tone(note, 0.11, "triangle", 0.055, audio.musicGain);
    if (audio.musicStep % 4 === 0) tone(note / 2, 0.16, "square", 0.035, audio.musicGain);
    audio.musicStep += 1;
  }, 230);
}

function stopMusic() {
  if (!audio.musicTimer) return;
  clearInterval(audio.musicTimer);
  audio.musicTimer = null;
  audio.musicStep = 0;
}

const weaponCatalog = {
  fries: {
    id: "fries",
    name: "French Fries",
    zhName: "薯條",
    icon: "F",
    type: "weapon",
    description: "Throws crispy fries at the nearest enemy.",
    zhDescription: "朝最近的敵人投擲酥脆薯條。",
    maxLevel: 8,
  },
  ketchup: {
    id: "ketchup",
    name: "Ketchup Burst",
    zhName: "番茄醬爆裂",
    icon: "K",
    type: "weapon",
    description: "Splats sticky sauce puddles that slow and damage enemies.",
    zhDescription: "濺出黏稠醬池，使敵人緩速並受到傷害。",
    maxLevel: 8,
  },
  mash: {
    id: "mash",
    name: "Mash Mine",
    zhName: "薯泥地雷",
    icon: "M",
    type: "weapon",
    description: "Drops hot mash behind you that bursts after a delay.",
    zhDescription: "留下熱薯泥，短暫延遲後爆開。",
    maxLevel: 8,
  },
  peeler: {
    id: "peeler",
    name: "Peeler Orbit",
    zhName: "削皮刀環繞",
    icon: "P",
    type: "weapon",
    description: "A spinning peeler circles the potato and shreds enemies.",
    zhDescription: "旋轉削皮刀環繞馬鈴薯並切碎敵人。",
    maxLevel: 8,
  },
  tots: {
    id: "tots",
    name: "Tater Tots",
    zhName: "薯球散射",
    icon: "T",
    type: "weapon",
    description: "Sprays short-range tots in all directions.",
    zhDescription: "向四面八方噴射短距離薯球。",
    maxLevel: 8,
  },
  chip: {
    id: "chip",
    name: "Potato Chip Saw",
    zhName: "洋芋片鋸刃",
    icon: "C",
    type: "weapon",
    description: "Fires wide chip blades that slice across the field.",
    zhDescription: "發射寬大的洋芋片刀刃，切穿戰場。",
    maxLevel: 8,
  },
};

const accessoryCatalog = {
  salt: {
    id: "salt",
    name: "Sea Salt",
    zhName: "海鹽",
    icon: "S",
    type: "accessory",
    description: "Adds weapon damage.",
    zhDescription: "增加武器傷害。",
    maxLevel: 5,
  },
  butter: {
    id: "butter",
    name: "Butter Jacket",
    zhName: "奶油外套",
    icon: "B",
    type: "accessory",
    description: "Raises max health and heals a little.",
    zhDescription: "提高最大生命，並恢復少量生命。",
    maxLevel: 5,
  },
  starch: {
    id: "starch",
    name: "Starch Boots",
    zhName: "澱粉靴",
    icon: ">",
    type: "accessory",
    description: "Moves faster through the chaos.",
    zhDescription: "在混亂中移動得更快。",
    maxLevel: 5,
  },
  magnet: {
    id: "magnet",
    name: "Gravy Magnet",
    zhName: "肉汁磁鐵",
    icon: "G",
    type: "accessory",
    description: "Pulls XP from farther away.",
    zhDescription: "從更遠距離吸取經驗。",
    maxLevel: 5,
  },
  timer: {
    id: "timer",
    name: "Oven Timer",
    zhName: "烤箱計時器",
    icon: "O",
    type: "accessory",
    description: "Weapons fire more often.",
    zhDescription: "讓武器更頻繁攻擊。",
    maxLevel: 5,
  },
  basket: {
    id: "basket",
    name: "Fryer Basket",
    zhName: "油炸籃",
    icon: "+",
    type: "accessory",
    description: "Adds one extra projectile or orbiting blade per level.",
    zhDescription: "每級增加一個投射物或環繞刀刃。",
    maxLevel: 5,
  },
};

let state;
let lastTime = 0;
let levelChoices = [];

function freshState() {
  return {
    mode: "title",
    elapsed: 0,
    kills: 0,
    spawnTimer: 0,
    enemyBudgetTimer: 0,
    shake: 0,
    player: {
      x: world.width / 2,
      y: world.height / 2,
      radius: 20,
      hp: 100,
      maxHp: 100,
      speed: 245,
      level: 1,
      xp: 0,
      xpToNext: 10,
      iFrames: 0,
    },
    weapons: [{ id: "fries", level: 1, cooldown: 0 }],
    accessories: [],
    enemies: [],
    projectiles: [],
    gems: [],
    hearts: [],
    effects: [],
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  world.width = rect.width;
  world.height = rect.height;
}

function startRun() {
  ensureAudio();
  startMusic();
  state = freshState();
  ui.startOverlay.classList.remove("active");
  ui.gameOverOverlay.classList.remove("active");
  ui.levelOverlay.classList.remove("active");
  ui.pauseOverlay.classList.remove("active");
  ui.pauseButton.textContent = "Esc";
  state.mode = "playing";
  updateLoadout();
}

function showStartScreen() {
  stopMusic();
  state = freshState();
  ui.gameOverOverlay.classList.remove("active");
  ui.levelOverlay.classList.remove("active");
  ui.pauseOverlay.classList.remove("active");
  ui.startOverlay.classList.add("active");
  ui.pauseButton.textContent = "Esc";
  updateLoadout();
  updateHud();
}

function applyTranslations() {
  document.documentElement.lang = currentLang === "zh" ? "zh-Hant" : "en";
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = tr(element.dataset.i18n);
  }
  for (const button of ui.langButtons) {
    button.classList.toggle("active", button.dataset.lang === currentLang);
  }
  updateAudioButton();
  updateLoadout();
  updateHud();
  if (state?.mode === "paused") updatePauseDetails();
  if (state?.mode === "levelup") renderLevelChoices();
  if (state?.mode === "gameover") updateFinalStats();
}

function setLanguage(lang) {
  currentLang = lang;
  applyTranslations();
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function itemName(item) {
  return currentLang === "zh" ? item.zhName : item.name;
}

function itemDescription(item) {
  return currentLang === "zh" ? item.zhDescription : item.description;
}

function weaponStats(id, level, effective = false) {
  const basket = effective ? projectileBonus() : 0;
  const damage = effective ? damageMultiplier() : 1;
  const cooldown = effective ? cooldownMultiplier() : 1;

  if (id === "fries") {
    const stats =
      currentLang === "zh"
        ? [
            `每輪 ${1 + Math.floor((level - 1) / 2) + basket} 根薯條`,
            `每根 ${Math.round((11 + level * 4) * damage)} 傷害`,
            `${Math.max(0.18, (0.78 - level * 0.035) * cooldown).toFixed(2)} 秒冷卻`,
            `${Math.floor(level / 4)} 穿透`,
          ]
        : [
            `${1 + Math.floor((level - 1) / 2) + basket} fries per volley`,
            `${Math.round((11 + level * 4) * damage)} damage each`,
            `${Math.max(0.18, (0.78 - level * 0.035) * cooldown).toFixed(2)}s cooldown`,
            `${Math.floor(level / 4)} pierce`,
          ];
    if (level >= 8) stats.push(currentLang === "zh" ? "進化：同時向後方發射同等齊射" : "evolution: fires a matching rear volley");
    return stats;
  }

  if (id === "ketchup") {
    const stats =
      currentLang === "zh"
        ? [
            `${1 + Math.floor(level / 3) + basket} 顆醬汁彈`,
            `${46 + level * 5}px 醬池半徑`,
            `每秒 ${Math.round((8 + level * 3) * damage)} 傷害`,
            `${formatPercent(Math.min(0.62, 0.28 + level * 0.035))} 緩速`,
          ]
        : [
            `${1 + Math.floor(level / 3) + basket} sauce blobs`,
            `${46 + level * 5}px puddle radius`,
            `${Math.round((8 + level * 3) * damage)} damage/sec`,
            `${formatPercent(Math.min(0.62, 0.28 + level * 0.035))} slow`,
          ];
    if (level >= 8) stats.push(currentLang === "zh" ? "進化：每次濺射會產生衛星醬池" : "evolution: each splat creates satellite puddles");
    return stats;
  }

  if (id === "mash") {
    const stats =
      currentLang === "zh"
        ? [
            `${Math.round((24 + level * 7) * damage)} 爆炸傷害`,
            `${Math.max(0.8, (2.9 - level * 0.1) * cooldown).toFixed(2)} 秒冷卻`,
            "延遲範圍爆炸",
          ]
        : [
            `${Math.round((24 + level * 7) * damage)} blast damage`,
            `${Math.max(0.8, (2.9 - level * 0.1) * cooldown).toFixed(2)}s cooldown`,
            "Delayed area explosion",
          ];
    if (level >= 8) stats.push(currentLang === "zh" ? "進化：以三角形放置 3 顆地雷" : "evolution: drops a triangle of mines");
    return stats;
  }

  if (id === "peeler") {
    const stats =
      currentLang === "zh"
        ? [
            `${1 + Math.floor(level / 3) + basket} 片環繞刀刃`,
            `${72 + level * 5}px 環繞半徑`,
            `${Math.round((18 + level * 5) * damage)} 接觸傷害`,
          ]
        : [
            `${1 + Math.floor(level / 3) + basket} orbiting blades`,
            `${72 + level * 5}px orbit radius`,
            `${Math.round((18 + level * 5) * damage)} contact damage`,
          ];
    if (level >= 8) stats.push(currentLang === "zh" ? "進化：增加第二圈反向旋轉刀刃" : "evolution: adds a second counter-rotating orbit");
    return stats;
  }

  if (id === "tots") {
    const stats =
      currentLang === "zh"
        ? [
            `每次爆發 ${6 + Math.floor(level / 2) + basket} 顆薯球`,
            `每顆 ${Math.round((8 + level * 3) * damage)} 傷害`,
            `${Math.max(0.7, (2.4 - level * 0.08) * cooldown).toFixed(2)} 秒冷卻`,
            "向所有方向發射",
          ]
        : [
            `${6 + Math.floor(level / 2) + basket} tots per burst`,
            `${Math.round((8 + level * 3) * damage)} damage each`,
            `${Math.max(0.7, (2.4 - level * 0.08) * cooldown).toFixed(2)}s cooldown`,
            "Fires in every direction",
          ];
    if (level >= 8) stats.push(currentLang === "zh" ? "進化：額外發射第二圈內側爆發" : "evolution: fires a second inner burst");
    return stats;
  }

  if (id === "chip") {
    const stats =
      currentLang === "zh"
        ? [
            `${1 + Math.floor(level / 4) + basket} 片洋芋片刀刃`,
            `每片 ${Math.round((18 + level * 6) * damage)} 傷害`,
            `${4 + Math.floor(level / 2)} 穿透`,
            `${Math.max(0.55, (2.55 - level * 0.1) * cooldown).toFixed(2)} 秒冷卻`,
          ]
        : [
            `${1 + Math.floor(level / 4) + basket} chip blades`,
            `${Math.round((18 + level * 6) * damage)} damage each`,
            `${4 + Math.floor(level / 2)} pierce`,
            `${Math.max(0.55, (2.55 - level * 0.1) * cooldown).toFixed(2)}s cooldown`,
          ];
    if (level >= 8) stats.push(currentLang === "zh" ? "進化：洋芋片刀刃可反彈一次" : "evolution: chip blades ricochet once");
    return stats;
  }

  return [];
}

function accessoryStats(id, level) {
  if (currentLang === "zh") {
    if (id === "salt") return [`+${formatPercent(level * 0.16)} 武器傷害`];
    if (id === "butter") return [`+${level * 14} 最大生命`, "升級時恢復 28 生命"];
    if (id === "starch") return [`+${level * 22} 移動速度`];
    if (id === "magnet") return [`${78 + level * 38}px 經驗吸取半徑`];
    if (id === "timer") return [`${formatPercent(level * 0.08)} 更快武器冷卻`];
    if (id === "basket") return [`支援武器 +${level} 個投射物或環繞刀刃`];
  }
  if (id === "salt") return [`+${formatPercent(level * 0.16)} weapon damage`];
  if (id === "butter") return [`+${level * 14} max health`, "Heals 28 when upgraded"];
  if (id === "starch") return [`+${level * 22} movement speed`];
  if (id === "magnet") return [`${78 + level * 38}px XP pickup radius`];
  if (id === "timer") return [`${formatPercent(level * 0.08)} faster weapon cooldowns`];
  if (id === "basket") return [`+${level} projectile or orbiting blade on supported weapons`];
  return [];
}

function describeItem(type, id, level, effective = false) {
  const stats = type === "weapon" ? weaponStats(id, level, effective) : accessoryStats(id, level);
  return stats.join(". ");
}

function describeUpgrade(type, id, fromLevel, toLevel) {
  const before = describeItem(type, id, fromLevel);
  const after = describeItem(type, id, toLevel);
  return `${tr("current")}: ${before}. ${tr("next")}: ${after}.`;
}

function getItem(collection, id) {
  return collection.find((item) => item.id === id);
}

function accessoryLevel(id) {
  return getItem(state.accessories, id)?.level || 0;
}

function weaponLevel(id) {
  return getItem(state.weapons, id)?.level || 0;
}

function damageMultiplier() {
  return 1 + accessoryLevel("salt") * 0.16;
}

function cooldownMultiplier() {
  return Math.max(0.48, 1 - accessoryLevel("timer") * 0.08);
}

function projectileBonus() {
  return accessoryLevel("basket");
}

function magnetRadius() {
  return 78 + accessoryLevel("magnet") * 38;
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const margin = 45;
  let x;
  let y;

  if (side === 0) {
    x = Math.random() * world.width;
    y = -margin;
  } else if (side === 1) {
    x = world.width + margin;
    y = Math.random() * world.height;
  } else if (side === 2) {
    x = Math.random() * world.width;
    y = world.height + margin;
  } else {
    x = -margin;
    y = Math.random() * world.height;
  }

  const minutes = state.elapsed / 60;
  const roll = Math.random();
  const type = roll < Math.min(0.18 + minutes * 0.025, 0.38) ? "sprout" : roll > 0.92 ? "spudling" : "bug";
  const base = {
    bug: { hp: 13, speed: 78, damage: 10, radius: 15, xp: 2, color: "#6a3830" },
    sprout: { hp: 28, speed: 54, damage: 16, radius: 19, xp: 4, color: "#395f2f" },
    spudling: { hp: 70, speed: 38, damage: 22, radius: 26, xp: 8, color: "#7f4f2b" },
  }[type];

  state.enemies.push({
    ...base,
    type,
    x,
    y,
    hp: base.hp * (1 + minutes * 0.55),
    maxHp: base.hp * (1 + minutes * 0.55),
    knock: 0,
  });
}

function nearestEnemy() {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      best = enemy;
      bestDist = dist;
    }
  }
  return best;
}

function fireProjectile(config) {
  state.projectiles.push({
    ...config,
    x: config.x,
    y: config.y,
    vx: config.vx,
    vy: config.vy,
    radius: config.radius,
    damage: config.damage * damageMultiplier(),
    life: config.life,
    maxLife: config.life,
    pierce: config.pierce || 0,
    color: config.color,
    kind: config.kind,
    hit: new Set(),
  });
}

function aimAt(enemy, speed, spread = 0) {
  const baseAngle = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x) + spread;
  return {
    vx: Math.cos(baseAngle) * speed,
    vy: Math.sin(baseAngle) * speed,
  };
}

function useWeapon(weapon, dt) {
  weapon.cooldown -= dt;
  if (weapon.cooldown > 0) return;

  const level = weapon.level;
  const bonus = projectileBonus();
  const player = state.player;
  const target = nearestEnemy();

  if (weapon.id === "fries" && target) {
    playSound("fries");
    const count = 1 + Math.floor((level - 1) / 2) + bonus;
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * 0.16;
      const aim = aimAt(target, 520, spread);
      fireProjectile({
        x: player.x,
        y: player.y,
        vx: aim.vx,
        vy: aim.vy,
        radius: 7,
        damage: 11 + level * 4,
        life: 1.25,
        pierce: Math.floor(level / 4),
        color: "#ffd45d",
        kind: "fries",
      });
      if (level >= 8) {
        fireProjectile({
          x: player.x,
          y: player.y,
          vx: -aim.vx,
          vy: -aim.vy,
          radius: 7,
          damage: 11 + level * 4,
          life: 1.25,
          pierce: Math.floor(level / 4),
          color: "#ffd45d",
          kind: "fries",
        });
      }
    }
    weapon.cooldown = Math.max(0.18, (0.78 - level * 0.035) * cooldownMultiplier());
  }

  if (weapon.id === "ketchup" && target) {
    playSound("ketchup");
    const count = 1 + Math.floor(level / 3) + bonus;
    for (let i = 0; i < count; i += 1) {
      const aim = aimAt(target, 300, (i - (count - 1) / 2) * 0.24);
      fireProjectile({
        x: player.x,
        y: player.y,
        vx: aim.vx,
        vy: aim.vy,
        radius: 12,
        damage: 0,
        life: 0.55 + level * 0.03,
        pierce: -1,
        color: "#de4f2f",
        kind: "ketchup",
        splatRadius: 46 + level * 5,
        puddleDamage: 8 + level * 3,
        slow: Math.min(0.62, 0.28 + level * 0.035),
        puddleLife: 2.8 + level * 0.25,
        evolved: level >= 8,
      });
    }
    weapon.cooldown = Math.max(0.72, (2.25 - level * 0.08) * cooldownMultiplier());
  }

  if (weapon.id === "mash") {
    playSound("mash");
    const mineCount = level >= 8 ? 3 : 1;
    for (let i = 0; i < mineCount; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / mineCount + state.elapsed;
      const spread = mineCount === 1 ? 0 : 42;
      state.effects.push({
        kind: "mine",
        x: player.x + Math.cos(angle) * spread,
        y: player.y + Math.sin(angle) * spread,
        radius: 18,
        timer: 0.75,
        life: 2.2,
        damage: (24 + level * 7) * damageMultiplier(),
        color: "#f2e3a4",
        hit: new Set(),
      });
    }
    weapon.cooldown = Math.max(0.8, (2.9 - level * 0.1) * cooldownMultiplier());
  }

  if (weapon.id === "peeler") {
    weapon.cooldown = 0.1;
  }

  if (weapon.id === "tots") {
    playSound("tots");
    const count = 6 + Math.floor(level / 2) + bonus;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + state.elapsed * 0.6;
      fireProjectile({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * 280,
        vy: Math.sin(angle) * 280,
        radius: 6,
        damage: 8 + level * 3,
        life: 0.9,
        pierce: 0,
        color: "#c88b49",
        kind: "tot",
      });
      if (level >= 8) {
        const innerAngle = angle + Math.PI / count;
        fireProjectile({
          x: player.x,
          y: player.y,
          vx: Math.cos(innerAngle) * 190,
          vy: Math.sin(innerAngle) * 190,
          radius: 8,
          damage: 8 + level * 3,
          life: 1.05,
          pierce: 0,
          color: "#ffd45d",
          kind: "tot",
        });
      }
    }
    weapon.cooldown = Math.max(0.7, (2.4 - level * 0.08) * cooldownMultiplier());
  }

  if (weapon.id === "chip" && target) {
    playSound("chip");
    const count = 1 + Math.floor(level / 4) + bonus;
    for (let i = 0; i < count; i += 1) {
      const aim = aimAt(target, 440, (i - (count - 1) / 2) * 0.24);
      fireProjectile({
        x: player.x,
        y: player.y,
        vx: aim.vx,
        vy: aim.vy,
        radius: 16,
        damage: 18 + level * 6,
        life: 1.35,
        pierce: 4 + Math.floor(level / 2),
        color: "#f7e891",
        kind: "chip",
        bounces: level >= 8 ? 1 : 0,
      });
    }
    weapon.cooldown = Math.max(0.55, (2.55 - level * 0.1) * cooldownMultiplier());
  }
}

function updatePlayer(dt) {
  const player = state.player;
  let xMove = 0;
  let yMove = 0;

  if (keys.has("ArrowLeft") || keys.has("KeyA")) xMove -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) xMove += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) yMove -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) yMove += 1;

  if (pointer.active) {
    const dx = pointer.x - player.x;
    const dy = pointer.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 12) {
      xMove += dx / dist;
      yMove += dy / dist;
    }
  }

  const length = Math.hypot(xMove, yMove) || 1;
  const speed = player.speed + accessoryLevel("starch") * 22;
  player.x += (xMove / length) * speed * dt;
  player.y += (yMove / length) * speed * dt;
  player.x = Math.max(player.radius, Math.min(world.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(world.height - player.radius, player.y));
  player.iFrames = Math.max(0, player.iFrames - dt);
}

function updateEnemies(dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const slow = strongestSlowAt(enemy.x, enemy.y);
    const speed = enemy.speed * (1 + state.elapsed / 420) * (1 - slow);
    enemy.x += (dx / dist) * speed * dt;
    enemy.y += (dy / dist) * speed * dt;

    if (dist < enemy.radius + player.radius && player.iFrames <= 0) {
      player.hp -= enemy.damage;
      player.iFrames = 0.55;
      state.shake = 0.16;
      playSound("hurt");
      if (player.hp <= 0) endRun();
    }
  }
}

function updateProjectiles(dt) {
  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    if (projectile.kind === "chip" && projectile.bounces > 0) {
      const hitSide = projectile.x < projectile.radius || projectile.x > world.width - projectile.radius;
      const hitTop = projectile.y < projectile.radius || projectile.y > world.height - projectile.radius;
      if (hitSide || hitTop) {
        if (hitSide) projectile.vx *= -1;
        if (hitTop) projectile.vy *= -1;
        projectile.x = Math.max(projectile.radius, Math.min(world.width - projectile.radius, projectile.x));
        projectile.y = Math.max(projectile.radius, Math.min(world.height - projectile.radius, projectile.y));
        projectile.bounces -= 1;
        projectile.hit.clear();
      }
    }
    if (projectile.kind === "ketchup" && projectile.life <= 0 && !projectile.splatted) {
      projectile.splatted = true;
      createKetchupPuddle(projectile);
    }
  }

  state.projectiles = state.projectiles.filter((projectile) => {
    return (
      projectile.life > 0 &&
      projectile.x > -80 &&
      projectile.x < world.width + 80 &&
      projectile.y > -80 &&
      projectile.y < world.height + 80
    );
  });
}

function updateEffects(dt) {
  for (const effect of state.effects) {
    effect.timer -= dt;
    effect.life -= dt;
    if (effect.kind === "mine" && effect.timer <= 0) {
      effect.radius = Math.min(90, effect.radius + 260 * dt);
    }
    if (effect.kind === "ketchupPuddle") {
      for (const enemy of state.enemies) {
        if (Math.hypot(effect.x - enemy.x, effect.y - enemy.y) < effect.radius + enemy.radius) {
          enemy.hp -= effect.damage * dt;
        }
      }
    }
  }
  state.effects = state.effects.filter((effect) => effect.life > 0);
}

function createKetchupPuddle(projectile) {
  const puddles = [{ x: projectile.x, y: projectile.y, radius: projectile.splatRadius }];
  if (projectile.evolved) {
    for (let i = 0; i < 4; i += 1) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      puddles.push({
        x: projectile.x + Math.cos(angle) * projectile.splatRadius * 0.85,
        y: projectile.y + Math.sin(angle) * projectile.splatRadius * 0.85,
        radius: projectile.splatRadius * 0.55,
      });
    }
  }

  for (const puddle of puddles) {
    state.effects.push({
      kind: "ketchupPuddle",
      x: puddle.x,
      y: puddle.y,
      radius: puddle.radius,
      timer: 0,
      life: projectile.puddleLife,
      maxLife: projectile.puddleLife,
      damage: projectile.puddleDamage * damageMultiplier(),
      slow: projectile.slow,
      color: "#de4f2f",
    });
  }
}

function strongestSlowAt(x, y) {
  let slow = 0;
  for (const effect of state.effects) {
    if (effect.kind !== "ketchupPuddle") continue;
    if (Math.hypot(effect.x - x, effect.y - y) < effect.radius) {
      slow = Math.max(slow, effect.slow);
    }
  }
  return slow;
}

function applyOrbitDamage(dt) {
  const weapon = getItem(state.weapons, "peeler");
  if (!weapon) return;

  const count = 1 + Math.floor(weapon.level / 3) + projectileBonus();
  const orbitRadius = 72 + weapon.level * 5;
  const bladeRadius = 16;
  const rings = weapon.level >= 8 ? 2 : 1;
  for (let ring = 0; ring < rings; ring += 1) {
    const direction = ring === 0 ? 1 : -1;
    const radius = orbitRadius + ring * 28;
    for (let i = 0; i < count; i += 1) {
      const angle = state.elapsed * (2.8 + weapon.level * 0.08) * direction + (Math.PI * 2 * i) / count;
      const x = state.player.x + Math.cos(angle) * radius;
      const y = state.player.y + Math.sin(angle) * radius;
      for (const enemy of state.enemies) {
        if (Math.hypot(enemy.x - x, enemy.y - y) < enemy.radius + bladeRadius) {
          enemy.hp -= (18 + weapon.level * 5) * damageMultiplier() * dt * 4.5;
        }
      }
    }
  }
}

function handleCollisions() {
  for (const projectile of state.projectiles) {
    for (const enemy of state.enemies) {
      if (projectile.hit.has(enemy)) continue;
      if (Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) < projectile.radius + enemy.radius) {
        if (projectile.kind === "ketchup") {
          projectile.life = 0;
          if (!projectile.splatted) {
            projectile.splatted = true;
            createKetchupPuddle(projectile);
          }
          continue;
        }
        enemy.hp -= projectile.damage;
        playSound("hit");
        projectile.hit.add(enemy);
        projectile.pierce -= 1;
        if (projectile.pierce < 0) projectile.life = 0;
      }
    }
  }

  for (const effect of state.effects) {
    if (effect.kind !== "mine" || effect.timer > 0) continue;
    for (const enemy of state.enemies) {
      if (effect.hit.has(enemy)) continue;
      if (Math.hypot(effect.x - enemy.x, effect.y - enemy.y) < effect.radius + enemy.radius) {
        enemy.hp -= effect.damage;
        playSound("hit");
        effect.hit.add(enemy);
      }
    }
  }

  const dead = state.enemies.filter((enemy) => enemy.hp <= 0);
  if (dead.length) {
    for (const enemy of dead) {
      state.kills += 1;
      state.gems.push({ x: enemy.x, y: enemy.y, radius: 6, value: enemy.xp });
      if (rollHealthDrop()) {
        state.hearts.push({ x: enemy.x, y: enemy.y, radius: 11, heal: 24 });
      }
      state.effects.push({ kind: "pop", x: enemy.x, y: enemy.y, radius: 4, life: 0.22, color: "#ffd45d" });
    }
    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  }
}

function rollHealthDrop() {
  const healthPercent = state.player.hp / state.player.maxHp;
  const chance = healthPercent < 0.35 ? 0.09 : 0.05;
  return Math.random() < chance;
}

function collectGems(dt) {
  const player = state.player;
  for (const gem of state.gems) {
    const dx = player.x - gem.x;
    const dy = player.y - gem.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < magnetRadius()) {
      gem.x += (dx / dist) * 440 * dt;
      gem.y += (dy / dist) * 440 * dt;
    }
    if (dist < player.radius + gem.radius) {
      player.xp += gem.value;
      gem.collected = true;
      playSound("xp");
    }
  }
  state.gems = state.gems.filter((gem) => !gem.collected);

  for (const heart of state.hearts) {
    const dx = player.x - heart.x;
    const dy = player.y - heart.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < Math.max(70, magnetRadius() * 0.75)) {
      heart.x += (dx / dist) * 340 * dt;
      heart.y += (dy / dist) * 340 * dt;
    }
    if (dist < player.radius + heart.radius && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + heart.heal);
      heart.collected = true;
      state.effects.push({ kind: "heal", x: player.x, y: player.y, radius: 8, life: 0.28, color: "#ff7a7a" });
      playSound("heal");
    }
  }
  state.hearts = state.hearts.filter((heart) => !heart.collected);

  while (player.xp >= player.xpToNext && state.mode === "playing") {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = Math.floor(player.xpToNext * 1.22 + 6);
    playSound("level");
    openLevelUp();
  }
}

function openLevelUp() {
  state.mode = "levelup";
  levelChoices = buildChoices();
  renderLevelChoices();
  ui.levelOverlay.classList.add("active");
}

function renderLevelChoices() {
  ui.choices.innerHTML = "";
  for (const choice of levelChoices) {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.innerHTML = `
      <span class="choice-icon">${choice.icon}</span>
      <strong class="choice-name">${choiceTitle(choice)}</strong>
      <span class="choice-desc">${choiceDescription(choice)}</span>
    `;
    button.addEventListener("click", () => applyChoice(choice));
    ui.choices.append(button);
  }
}

function choiceTitle(choice) {
  const catalog = choice.type === "weapon" ? weaponCatalog[choice.id] : accessoryCatalog[choice.id];
  if (choice.kind === "upgrade") {
    const list = choice.type === "weapon" ? state.weapons : state.accessories;
    const current = getItem(list, choice.id);
    return `${itemName(catalog)} ${tr("lv")} ${current.level + 1}`;
  }
  return itemName(catalog);
}

function choiceDescription(choice) {
  const catalog = choice.type === "weapon" ? weaponCatalog[choice.id] : accessoryCatalog[choice.id];
  if (choice.kind === "upgrade") {
    const list = choice.type === "weapon" ? state.weapons : state.accessories;
    const current = getItem(list, choice.id);
    return describeUpgrade(choice.type, choice.id, current.level, current.level + 1);
  }
  if (choice.type === "weapon") {
    return `${tr("newWeapon")} ${itemDescription(catalog)} ${tr("levelOne")}: ${describeItem("weapon", choice.id, 1)}.`;
  }
  return `${tr("newAccessory")} ${describeItem("accessory", choice.id, 1)}.`;
}

function buildChoices() {
  const options = [];
  for (const weapon of state.weapons) {
    const catalog = weaponCatalog[weapon.id];
    if (weapon.level < catalog.maxLevel) {
      options.push({
        kind: "upgrade",
        type: "weapon",
        id: weapon.id,
        icon: catalog.icon,
        title: `${itemName(catalog)} ${tr("lv")} ${weapon.level + 1}`,
        description: describeUpgrade("weapon", weapon.id, weapon.level, weapon.level + 1),
      });
    }
  }

  if (state.weapons.length < 6) {
    for (const item of Object.values(weaponCatalog)) {
      if (!weaponLevel(item.id)) {
        options.push({
          kind: "new",
          type: "weapon",
          id: item.id,
          icon: item.icon,
          title: itemName(item),
          description: `${tr("newWeapon")} ${itemDescription(item)} ${tr("levelOne")}: ${describeItem("weapon", item.id, 1)}.`,
        });
      }
    }
  }

  for (const accessory of state.accessories) {
    const catalog = accessoryCatalog[accessory.id];
    if (accessory.level < catalog.maxLevel) {
      options.push({
        kind: "upgrade",
        type: "accessory",
        id: accessory.id,
        icon: catalog.icon,
        title: `${itemName(catalog)} ${tr("lv")} ${accessory.level + 1}`,
        description: describeUpgrade("accessory", accessory.id, accessory.level, accessory.level + 1),
      });
    }
  }

  if (state.accessories.length < 6) {
    for (const item of Object.values(accessoryCatalog)) {
      if (!accessoryLevel(item.id)) {
        options.push({
          kind: "new",
          type: "accessory",
          id: item.id,
          icon: item.icon,
          title: itemName(item),
          description: `${tr("newAccessory")} ${describeItem("accessory", item.id, 1)}.`,
        });
      }
    }
  }

  return shuffle(options).slice(0, 3);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function applyChoice(choice) {
  playSound("select");
  const list = choice.type === "weapon" ? state.weapons : state.accessories;
  const existing = getItem(list, choice.id);
  if (existing) {
    existing.level += 1;
  } else {
    list.push({ id: choice.id, level: 1, cooldown: 0 });
  }

  if (choice.id === "butter") {
    const player = state.player;
    player.maxHp += 14;
    player.hp = Math.min(player.maxHp, player.hp + 28);
  }

  updateLoadout();
  ui.levelOverlay.classList.remove("active");
  state.mode = "playing";
}

function updateLoadout() {
  renderSlots(ui.weaponSlots, state.weapons, weaponCatalog);
  renderSlots(ui.accessorySlots, state.accessories, accessoryCatalog);
}

function renderSlots(container, items, catalog) {
  container.innerHTML = "";
  for (let i = 0; i < 6; i += 1) {
    const item = items[i];
    const slot = document.createElement("div");
    slot.className = `slot${item ? "" : " empty"}`;
    slot.textContent = item ? `${catalog[item.id].icon}${item.level}` : "";
    slot.title = item ? `${itemName(catalog[item.id])} ${tr("level")} ${item.level}` : tr("emptySlot");
    container.append(slot);
  }
}

function updatePauseDetails() {
  renderDetails(ui.pauseWeapons, state.weapons, weaponCatalog, "weapon");
  renderDetails(ui.pauseAccessories, state.accessories, accessoryCatalog, "accessory");
}

function renderDetails(container, items, catalog, type) {
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-detail";
    empty.textContent = tr("noItems");
    container.append(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "detail-card";
    card.innerHTML = `
      <div class="detail-title">
        <strong>${catalog[item.id].icon} ${itemName(catalog[item.id])}</strong>
        <span>${tr("lv")} ${item.level}</span>
      </div>
      <p>${itemDescription(catalog[item.id])}</p>
      <p>${describeItem(type, item.id, item.level, true)}.</p>
    `;
    container.append(card);
  }
}

function updateHud() {
  const player = state.player;
  ui.level.textContent = player.level;
  ui.time.textContent = formatTime(state.elapsed);
  ui.kills.textContent = state.kills;
  ui.healthBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  ui.xpBar.style.width = `${Math.min(100, (player.xp / player.xpToNext) * 100)}%`;
}

function endRun() {
  state.mode = "gameover";
  stopMusic();
  playSound("gameover");
  ui.pauseOverlay.classList.remove("active");
  updateFinalStats();
  ui.gameOverOverlay.classList.add("active");
}

function updateFinalStats() {
  ui.finalStats.textContent = tr("survived")(state.player.level, formatTime(state.elapsed), state.kills);
}

function update(dt) {
  if (state.mode !== "playing") return;

  state.elapsed += dt;
  state.shake = Math.max(0, state.shake - dt);
  state.spawnTimer -= dt;
  const spawnDelay = Math.max(0.16, 0.85 - state.elapsed / 260);
  if (state.spawnTimer <= 0) {
    const amount = 1 + Math.floor(state.elapsed / 70);
    for (let i = 0; i < amount; i += 1) spawnEnemy();
    state.spawnTimer = spawnDelay;
  }

  updatePlayer(dt);
  for (const weapon of state.weapons) useWeapon(weapon, dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateEffects(dt);
  applyOrbitDamage(dt);
  handleCollisions();
  collectGems(dt);
}

function drawPixelPotato(x, y, size, blink = false) {
  const s = size / 8;
  ctx.fillStyle = "#8a552d";
  rect(x - 3 * s, y - 2 * s, 6 * s, 5 * s);
  ctx.fillStyle = "#c88b49";
  rect(x - 2 * s, y - 3 * s, 4 * s, s);
  rect(x - 4 * s, y - s, s, 3 * s);
  rect(x + 3 * s, y - s, s, 3 * s);
  ctx.fillStyle = "#e0a05a";
  rect(x - 2 * s, y - 2 * s, 4 * s, 4 * s);
  ctx.fillStyle = "#172414";
  rect(x - 1.6 * s, y - 0.7 * s, s, blink ? 0.35 * s : s);
  rect(x + 0.8 * s, y - 0.7 * s, s, blink ? 0.35 * s : s);
  ctx.fillStyle = "#6f3f24";
  rect(x - 0.5 * s, y + 1.2 * s, s, 0.6 * s);
  drawAccessoryLayers(x, y, s);
}

function hasAccessory(id) {
  return accessoryLevel(id) > 0;
}

function drawAccessoryLayers(x, y, s) {
  if (hasAccessory("butter")) {
    ctx.fillStyle = "#ffd45d";
    rect(x - 2.6 * s, y - 1.7 * s, 5.2 * s, 0.55 * s);
    rect(x - 2.2 * s, y + 0.3 * s, 4.4 * s, 0.55 * s);
    ctx.fillStyle = "#fff0a8";
    rect(x - 1.3 * s, y - 2.15 * s, 2.6 * s, 0.5 * s);
  }

  if (hasAccessory("salt")) {
    ctx.fillStyle = "#f8f3db";
    rect(x - 2.8 * s, y - 2.6 * s, 0.5 * s, 0.5 * s);
    rect(x + 2.4 * s, y - 1.8 * s, 0.5 * s, 0.5 * s);
    rect(x - 3.2 * s, y + 0.8 * s, 0.5 * s, 0.5 * s);
    ctx.fillStyle = "#9ee7f0";
    rect(x + 2.8 * s, y + 0.7 * s, 0.45 * s, 0.45 * s);
  }

  if (hasAccessory("starch")) {
    ctx.fillStyle = "#172414";
    rect(x - 2.6 * s, y + 2.6 * s, 1.9 * s, 0.75 * s);
    rect(x + 0.7 * s, y + 2.6 * s, 1.9 * s, 0.75 * s);
    ctx.fillStyle = "#58c2cf";
    rect(x - 2.2 * s, y + 2.1 * s, 1.1 * s, 0.55 * s);
    rect(x + 1.1 * s, y + 2.1 * s, 1.1 * s, 0.55 * s);
  }

  if (hasAccessory("magnet")) {
    ctx.fillStyle = "#de4f2f";
    rect(x - 4.4 * s, y - 1.2 * s, 0.75 * s, 2.4 * s);
    rect(x + 3.65 * s, y - 1.2 * s, 0.75 * s, 2.4 * s);
    ctx.fillStyle = "#d7d3c6";
    rect(x - 4.4 * s, y - 1.2 * s, 1.8 * s, 0.65 * s);
    rect(x + 2.6 * s, y - 1.2 * s, 1.8 * s, 0.65 * s);
  }

  if (hasAccessory("timer")) {
    ctx.fillStyle = "#172414";
    rect(x - 1.4 * s, y - 4.4 * s, 2.8 * s, 1.6 * s);
    ctx.fillStyle = "#f8f3db";
    rect(x - 1.0 * s, y - 4.0 * s, 2.0 * s, 0.9 * s);
    ctx.fillStyle = "#de4f2f";
    rect(x - 0.1 * s, y - 3.95 * s, 0.25 * s, 0.65 * s);
    rect(x - 0.1 * s, y - 3.95 * s, 0.7 * s, 0.25 * s);
  }

  if (hasAccessory("basket")) {
    ctx.fillStyle = "#6f3f24";
    rect(x + 3.2 * s, y + 0.6 * s, 1.4 * s, 2.4 * s);
    ctx.fillStyle = "#c88b49";
    rect(x + 3.45 * s, y + 0.9 * s, 0.25 * s, 1.8 * s);
    rect(x + 4.05 * s, y + 0.9 * s, 0.25 * s, 1.8 * s);
    rect(x + 3.25 * s, y + 1.45 * s, 1.35 * s, 0.25 * s);
    rect(x + 3.25 * s, y + 2.15 * s, 1.35 * s, 0.25 * s);
  }
}

function rect(x, y, w, h) {
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawEnemy(enemy) {
  ctx.fillStyle = "#172414";
  rect(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
  ctx.fillStyle = enemy.color;
  rect(enemy.x - enemy.radius + 4, enemy.y - enemy.radius + 4, enemy.radius * 2 - 8, enemy.radius * 2 - 8);
  ctx.fillStyle = "#f8f3db";
  rect(enemy.x - 5, enemy.y - 4, 4, 4);
  rect(enemy.x + 4, enemy.y - 4, 4, 4);
  ctx.fillStyle = "#172414";
  const hpWidth = (enemy.hp / enemy.maxHp) * enemy.radius * 2;
  rect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2, 4);
  ctx.fillStyle = "#de4f2f";
  rect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, hpWidth, 4);
}

function drawBackground() {
  ctx.fillStyle = "#6fac4a";
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.fillStyle = "rgba(25, 32, 22, 0.08)";
  const grid = 48;
  const offset = (state.elapsed * 18) % grid;
  for (let x = -grid; x < world.width + grid; x += grid) {
    rect(x + offset, 0, 3, world.height);
  }
  for (let y = -grid; y < world.height + grid; y += grid) {
    rect(0, y + offset, world.width, 3);
  }
  ctx.fillStyle = "rgba(248, 243, 219, 0.12)";
  for (let i = 0; i < 26; i += 1) {
    const x = (i * 137 + state.elapsed * 9) % (world.width + 80) - 40;
    const y = (i * 71 + state.elapsed * 5) % (world.height + 80) - 40;
    rect(x, y, 18, 6);
  }
}

function drawOrbit() {
  const weapon = getItem(state.weapons, "peeler");
  if (!weapon) return;
  const count = 1 + Math.floor(weapon.level / 3) + projectileBonus();
  const orbitRadius = 72 + weapon.level * 5;
  const rings = weapon.level >= 8 ? 2 : 1;
  for (let ring = 0; ring < rings; ring += 1) {
    const direction = ring === 0 ? 1 : -1;
    const radius = orbitRadius + ring * 28;
    for (let i = 0; i < count; i += 1) {
      const angle = state.elapsed * (2.8 + weapon.level * 0.08) * direction + (Math.PI * 2 * i) / count;
      const x = state.player.x + Math.cos(angle) * radius;
      const y = state.player.y + Math.sin(angle) * radius;
      ctx.fillStyle = ring === 0 ? "#d7d3c6" : "#9ee7f0";
      rect(x - 16, y - 5, 32, 10);
      ctx.fillStyle = "#172414";
      rect(x - 18, y - 7, 36, 4);
    }
  }
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
  }

  drawBackground();

  for (const gem of state.gems) {
    ctx.fillStyle = "#58c2cf";
    rect(gem.x - gem.radius, gem.y - gem.radius, gem.radius * 2, gem.radius * 2);
    ctx.fillStyle = "#d7f7fb";
    rect(gem.x - 2, gem.y - 2, 4, 4);
  }

  for (const heart of state.hearts) {
    ctx.fillStyle = "#172414";
    rect(heart.x - 12, heart.y - 12, 24, 24);
    ctx.fillStyle = "#f8f3db";
    rect(heart.x - 9, heart.y - 9, 18, 18);
    ctx.fillStyle = "#de4f2f";
    rect(heart.x - 3, heart.y - 8, 6, 16);
    rect(heart.x - 8, heart.y - 3, 16, 6);
  }

  for (const effect of state.effects) {
    if (effect.kind === "mine") {
      ctx.fillStyle = effect.timer > 0 ? "#f2e3a4" : "rgba(242, 227, 164, 0.55)";
      rect(effect.x - effect.radius, effect.y - effect.radius, effect.radius * 2, effect.radius * 2);
    } else if (effect.kind === "ketchupPuddle") {
      const alpha = Math.max(0.18, effect.life / effect.maxLife);
      ctx.fillStyle = `rgba(222, 79, 47, ${0.22 + alpha * 0.28})`;
      rect(effect.x - effect.radius, effect.y - effect.radius * 0.62, effect.radius * 2, effect.radius * 1.24);
      ctx.fillStyle = `rgba(118, 24, 22, ${0.18 + alpha * 0.2})`;
      rect(effect.x - effect.radius * 0.45, effect.y - effect.radius * 0.22, effect.radius * 0.9, effect.radius * 0.44);
    } else {
      ctx.fillStyle = effect.color;
      rect(effect.x - effect.radius, effect.y - effect.radius, effect.radius * 2, effect.radius * 2);
    }
  }

  for (const projectile of state.projectiles) {
    ctx.fillStyle = projectile.color;
    if (projectile.kind === "fries") {
      rect(projectile.x - 12, projectile.y - 4, 24, 8);
    } else if (projectile.kind === "chip") {
      rect(projectile.x - 16, projectile.y - 16, 32, 32);
      ctx.fillStyle = "#b28a35";
      rect(projectile.x - 6, projectile.y - 6, 12, 12);
    } else {
      rect(projectile.x - projectile.radius, projectile.y - projectile.radius, projectile.radius * 2, projectile.radius * 2);
    }
  }

  drawOrbit();
  for (const enemy of state.enemies) drawEnemy(enemy);
  drawPixelPotato(state.player.x, state.player.y, 58, state.player.iFrames > 0 && Math.floor(state.elapsed * 20) % 2 === 0);
  ctx.restore();
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  updateHud();
  requestAnimationFrame(loop);
}

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Escape" && !event.repeat) {
    event.preventDefault();
    togglePause();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  setPointer(event);
});

canvas.addEventListener("pointermove", setPointer);
canvas.addEventListener("pointerup", () => {
  pointer.active = false;
});
canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

function togglePause() {
  if (state.mode === "playing") {
    state.mode = "paused";
    pointer.active = false;
    updatePauseDetails();
    ui.pauseOverlay.classList.add("active");
    ui.pauseButton.textContent = ">";
    playSound("pause");
  } else if (state.mode === "paused") {
    state.mode = "playing";
    ui.pauseOverlay.classList.remove("active");
    ui.pauseButton.textContent = "Esc";
    playSound("select");
  }
}

ui.startButton.addEventListener("click", startRun);
ui.restartButton.addEventListener("click", startRun);
ui.backToStartButton.addEventListener("click", showStartScreen);
ui.resumeButton.addEventListener("click", togglePause);
ui.pauseButton.addEventListener("click", togglePause);
ui.audioButton.addEventListener("click", () => {
  ensureAudio();
  setMuted(!audio.muted);
  playSound("select");
});
for (const button of ui.langButtons) {
  button.addEventListener("click", () => setLanguage(button.dataset.lang));
}
window.addEventListener("resize", resizeCanvas);

state = freshState();
resizeCanvas();
updateLoadout();
applyTranslations();
requestAnimationFrame(loop);
