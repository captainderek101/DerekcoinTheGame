const counterEl = document.getElementById("counter");
const clickButtonEl = document.getElementById("clickButton");
const rateTextEl = document.getElementById("rateText");
const statusEl = document.getElementById("status");
const fxLayerEl = document.getElementById("fxLayer");
const assetsScrollEl = document.getElementById("assetsScroll");
const achievementToastEl = document.getElementById("achievementToast");
const achievementsRowEl = document.getElementById("achievementsRow");
const SAVE_COOKIE_NAME = "derekcoin_save";
const SAVE_INTERVAL_MS = 10000;
const PASSIVE_TICKS_PER_SECOND = 30;
const PLUS_ONE_LIFETIME_MS = 1000;
const PLUS_ONE_FADE_DELAY_MS = 200;
const PLUS_ONE_GRAVITY = 2200;
const PLUS_ONE_MIN_UPWARD_VELOCITY = -760;
const PLUS_ONE_MAX_UPWARD_VELOCITY = -620;
const PLUS_ONE_MAX_HORIZONTAL_VELOCITY = 260;
const BULK_BUY_COUNT = 10;

const MARKET_VALUE_ACHIEVEMENT_CENTS = 6_800_000;
const USED_LAPTOPS_ACHIEVEMENT_COUNT = 100;

let market_value_cents = 0;
let passiveFractionBuffer = 0;
let activePlusOnes = [];
let lastPlusOneFrameTime = performance.now();
let assets = [];

let achievementsUnlocked = {
  betterThanBitcoin: false,
  usedPartsStore: false,
};

const achievementBoxById = new Map();
let achievementToastQueue = [];
let achievementToastRunning = false;

function getAssetOwnedById(id) {
  const asset = assets.find((a) => a.id === id);
  return asset ? asset.owned : 0;
}

const ACHIEVEMENT_DEFS = [
  {
    id: "betterThanBitcoin",
    title: "Better Than Bitcoin",
    description: "Reach $68,000 Market Value.",
    image: "images/trend-up-arrow.svg",
    check: () => market_value_cents >= MARKET_VALUE_ACHIEVEMENT_CENTS,
  },
  {
    id: "usedPartsStore",
    title: "Used Parts Store",
    description: "Own 100 Used Laptops.",
    image: "images/three-dollars.svg",
    check: () => getAssetOwnedById("usedLaptop") >= USED_LAPTOPS_ACHIEVEMENT_COUNT,
  },
];

const upgrades = [
  {
    id: "usedLaptop",
    name: "Used Laptop",
    description: "Salvaged from a post-rugpull startup. Each laptop auto-farms $0.01 market value of coins per second.",
    cost: 10,
    income: 1,
    image: "images/laptop.svg",
  },
  {
    id: "cryptoFarm",
    name: "Crypto Farm",
    description: "Containerized miner farm that prints hype at industrial scale.",
    cost: 200,
    income: 40,
    image: "images/rake.svg",
  },
  {
    id: "gpuSupplier",
    name: "GPU Supplier",
    description: "Backroom deal pipeline for graphics cards that fuel your shitcoin empire.",
    cost: 6000,
    income: 800,
    image: "images/factory.svg",
  },
  {
    id: "ramBrand",
    name: "Consumer RAM Brand",
    description: "Memory product empire with big margins and even bigger shitcoin hyping capacity.",
    cost: 240000,
    income: 16000,
    image: "images/tech-logo.svg",
  },
];

function formatIntegerWithCommas(integerDigits) {
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatCentsToDollars(cents) {
  const padded = String(cents).padStart(3, "0");
  const dollarsPart = padded.slice(0, -2);
  const centsPart = padded.slice(-2);
  return `${formatIntegerWithCommas(dollarsPart)}.${centsPart}`;
}

function costDisplayLine(costCents) {
  return `Cost: $${formatCentsToDollars(costCents)} market value`;
}

function incomeDisplayLine(incomeCents) {
  return `Income: +$${formatCentsToDollars(incomeCents)}/sec`;
}

function buildAchievementBoxes() {
  achievementBoxById.clear();
  achievementsRowEl.textContent = "";

  for (const def of ACHIEVEMENT_DEFS) {
    const box = document.createElement("div");
    box.className = "achievement-box achievement-box--locked";
    box.dataset.achievementId = def.id;
    box.setAttribute("tabindex", "0");
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", `${def.title}. ${def.description}`);

    const tooltip = document.createElement("div");
    tooltip.className = "achievement-tooltip";
    const titleEl = document.createElement("div");
    titleEl.className = "achievement-tooltip-title";
    titleEl.textContent = def.title;
    const descEl = document.createElement("p");
    descEl.className = "achievement-tooltip-desc";
    descEl.textContent = def.description;
    tooltip.append(titleEl, descEl);

    const icon = document.createElement("img");
    icon.className = "achievement-icon";
    icon.src = def.image;
    icon.alt = "";

    box.append(tooltip, icon);
    achievementsRowEl.appendChild(box);
    achievementBoxById.set(def.id, box);
  }
}

function applyAchievementVisualState() {
  for (const def of ACHIEVEMENT_DEFS) {
    const box = achievementBoxById.get(def.id);
    if (!box) {
      continue;
    }
    const unlocked = achievementsUnlocked[def.id];
    box.classList.toggle("achievement-box--locked", !unlocked);
    box.classList.toggle("achievement-box--unlocked", unlocked);
  }
}

function showAchievementToastOnce(title, onComplete) {
  const TOAST_VISIBLE_MS = 3000;
  const FADE_MS = 550;

  achievementToastEl.textContent = `Achievement unlocked: ${title}`;
  achievementToastEl.classList.remove("achievement-toast--hiding");
  achievementToastEl.classList.add("achievement-toast--visible");

  window.setTimeout(() => {
    achievementToastEl.classList.remove("achievement-toast--visible");
    achievementToastEl.classList.add("achievement-toast--hiding");
  }, TOAST_VISIBLE_MS);

  window.setTimeout(() => {
    achievementToastEl.textContent = "";
    achievementToastEl.classList.remove("achievement-toast--hiding");
    onComplete();
  }, TOAST_VISIBLE_MS + FADE_MS);
}

function runAchievementToastQueue() {
  if (achievementToastQueue.length === 0) {
    achievementToastRunning = false;
    return;
  }

  achievementToastRunning = true;
  const title = achievementToastQueue.shift();
  showAchievementToastOnce(title, runAchievementToastQueue);
}

function enqueueAchievementToast(title) {
  achievementToastQueue.push(title);
  if (!achievementToastRunning) {
    runAchievementToastQueue();
  }
}

function checkAchievements() {
  let newlyUnlocked = false;

  for (const def of ACHIEVEMENT_DEFS) {
    if (achievementsUnlocked[def.id]) {
      continue;
    }
    if (!def.check()) {
      continue;
    }

    achievementsUnlocked[def.id] = true;
    newlyUnlocked = true;

    const box = achievementBoxById.get(def.id);
    if (box) {
      box.classList.remove("achievement-box--locked");
      box.classList.add("achievement-box--unlocked");
    }

    enqueueAchievementToast(def.title);
  }

  if (newlyUnlocked) {
    saveGame();
  }
}

function buildAssetCards(upgrades) {
  for (const u of upgrades) {
    const section = document.createElement("section");
    section.className = "asset-card";
    section.dataset.assetId = u.id;

    const row1 = document.createElement("div");
    row1.className = "asset-row";
    const titleGroup = document.createElement("div");
    titleGroup.className = "asset-title-group";
    const iconEl = document.createElement("img");
    iconEl.className = "asset-icon";
    iconEl.src = u.image;
    iconEl.alt = "";
    iconEl.draggable = false;
    const nameEl = document.createElement("div");
    nameEl.className = "asset-name";
    nameEl.textContent = u.name;
    titleGroup.append(iconEl, nameEl);
    const costEl = document.createElement("div");
    costEl.className = "asset-cost";
    costEl.textContent = costDisplayLine(u.cost);
    row1.append(titleGroup, costEl);

    const descEl = document.createElement("p");
    descEl.className = "asset-desc";
    descEl.textContent = u.description;

    const incomeEl = document.createElement("div");
    incomeEl.className = "asset-income";
    incomeEl.textContent = incomeDisplayLine(u.income);

    const row2 = document.createElement("div");
    row2.className = "asset-row";
    const ownedEl = document.createElement("div");
    ownedEl.className = "asset-owned";
    ownedEl.id = `${u.id}-owned`;
    ownedEl.textContent = "Owned: 0";
    const actionsEl = document.createElement("div");
    actionsEl.className = "asset-actions";
    const buyBtn = document.createElement("button");
    buyBtn.className = "buy-btn";
    buyBtn.id = `${u.id}-buy`;
    buyBtn.textContent = "Buy";
    const buyBulkBtn = document.createElement("button");
    buyBulkBtn.className = "buy-btn buy-btn--bulk";
    buyBulkBtn.id = `${u.id}-buyBulk`;
    buyBulkBtn.textContent = "Buy 10";
    buyBulkBtn.type = "button";
    actionsEl.append(buyBtn, buyBulkBtn);
    row2.append(ownedEl, actionsEl);

    section.append(row1, descEl, incomeEl, row2);
    assetsScrollEl.appendChild(section);

    assets.push({
      id: u.id,
      name: u.name,
      cost: u.cost,
      passivePerSecond: u.income,
      owned: 0,
      ownedEl,
      buyButtonEl: buyBtn,
      buyBulkButtonEl: buyBulkBtn,
    });
  }
}

function setCookie(name, value, maxAgeSeconds) {
  document.cookie = `${name}=${value}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const cookiePrefix = `${name}=`;
  const cookieParts = document.cookie.split("; ");

  for (const cookiePart of cookieParts) {
    if (cookiePart.startsWith(cookiePrefix)) {
      return cookiePart.slice(cookiePrefix.length);
    }
  }

  return null;
}

function saveGame() {
  const saveData = {
    clicks: market_value_cents,
    assets: {},
    achievements: { ...achievementsUnlocked },
  };

  for (const asset of assets) {
    saveData.assets[asset.id] = asset.owned;
  }

  const serialized = encodeURIComponent(JSON.stringify(saveData));
  setCookie(SAVE_COOKIE_NAME, serialized, 60 * 60 * 24 * 365);
}

function loadGame() {
  const rawSave = getCookie(SAVE_COOKIE_NAME);
  if (!rawSave) {
    return;
  }

  try {
    const parsedSave = JSON.parse(decodeURIComponent(rawSave));

    if (typeof parsedSave.clicks === "number" && Number.isFinite(parsedSave.clicks)) {
      market_value_cents = Math.max(0, Math.floor(parsedSave.clicks));
    }

    if (parsedSave.assets && typeof parsedSave.assets === "object") {
      for (const asset of assets) {
        const ownedValue = parsedSave.assets[asset.id];
        if (typeof ownedValue === "number" && Number.isFinite(ownedValue)) {
          asset.owned = Math.max(0, Math.floor(ownedValue));
        }
      }
    }

    if (parsedSave.achievements && typeof parsedSave.achievements === "object") {
      for (const key of Object.keys(achievementsUnlocked)) {
        if (typeof parsedSave.achievements[key] === "boolean") {
          achievementsUnlocked[key] = parsedSave.achievements[key];
        }
      }
    }
  } catch (error) {
    setStatus("Save data was invalid and could not be loaded.", true);
  }
}

function getTotalPassivePerSecond() {
  return assets.reduce((total, asset) => total + asset.owned * asset.passivePerSecond, 0);
}

function updateUI() {
  counterEl.textContent = `Market value: $${formatCentsToDollars(market_value_cents)}`;
  rateTextEl.textContent = `Growth rate: $${formatCentsToDollars(getTotalPassivePerSecond())}/sec`;

  for (const asset of assets) {
    asset.ownedEl.textContent = `Owned: ${asset.owned}`;
    asset.buyButtonEl.disabled = market_value_cents < asset.cost;
    const bulkCost = asset.cost * BULK_BUY_COUNT;
    asset.buyBulkButtonEl.disabled = market_value_cents < bulkCost;
  }

  checkAchievements();
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function buyAsset(asset) {
  if (market_value_cents < asset.cost) {
    setStatus(`Not enough clicks to buy ${asset.name}.`, true);
    return;
  }

  market_value_cents -= asset.cost;
  asset.owned += 1;
  setStatus(`Purchased ${asset.name}. Passive farming increased.`);
  updateUI();
}

function buyAssetInBulk(asset) {
  const bulkCost = asset.cost * BULK_BUY_COUNT;
  if (market_value_cents < bulkCost) {
    setStatus(`Not enough market value to buy ${BULK_BUY_COUNT} × ${asset.name}.`, true);
    return;
  }

  market_value_cents -= bulkCost;
  asset.owned += BULK_BUY_COUNT;
  setStatus(`Purchased ${BULK_BUY_COUNT} × ${asset.name}. Passive farming increased.`);
  updateUI();
}

function spawnPlusOneSprite(mouseX, mouseY) {
  const buttonRect = clickButtonEl.getBoundingClientRect();
  const startX = typeof mouseX === "number" ? mouseX : buttonRect.left + (buttonRect.width / 2);
  const startY = typeof mouseY === "number" ? mouseY : buttonRect.top + (buttonRect.height / 2);
  const randomHorizontalVelocity = (Math.random() * 2 - 1) * PLUS_ONE_MAX_HORIZONTAL_VELOCITY;
  const randomUpwardVelocity =
    PLUS_ONE_MIN_UPWARD_VELOCITY +
    Math.random() * (PLUS_ONE_MAX_UPWARD_VELOCITY - PLUS_ONE_MIN_UPWARD_VELOCITY);

  const spriteEl = document.createElement("img");
  spriteEl.src = "images/plus-one.svg";
  spriteEl.alt = "+1";
  spriteEl.className = "plus-one-sprite";
  spriteEl.style.left = `${startX}px`;
  spriteEl.style.top = `${startY}px`;
  fxLayerEl.appendChild(spriteEl);

  activePlusOnes.push({
    el: spriteEl,
    x: startX,
    y: startY,
    vx: randomHorizontalVelocity,
    vy: randomUpwardVelocity,
    ageMs: 0,
  });
}

function animatePlusOneSprites(frameTime) {
  const deltaSeconds = Math.min((frameTime - lastPlusOneFrameTime) / 1000, 0.05);
  lastPlusOneFrameTime = frameTime;

  for (let i = activePlusOnes.length - 1; i >= 0; i -= 1) {
    const sprite = activePlusOnes[i];
    sprite.ageMs += deltaSeconds * 1000;
    sprite.vy += PLUS_ONE_GRAVITY * deltaSeconds;
    sprite.x += sprite.vx * deltaSeconds;
    sprite.y += sprite.vy * deltaSeconds;

    sprite.el.style.left = `${sprite.x}px`;
    sprite.el.style.top = `${sprite.y}px`;

    if (sprite.ageMs > PLUS_ONE_FADE_DELAY_MS) {
      const fadeProgress = (sprite.ageMs - PLUS_ONE_FADE_DELAY_MS) / (PLUS_ONE_LIFETIME_MS - PLUS_ONE_FADE_DELAY_MS);
      sprite.el.style.opacity = `${Math.max(0, 1 - fadeProgress)}`;
    }

    if (sprite.ageMs >= PLUS_ONE_LIFETIME_MS || sprite.y > window.innerHeight + 40) {
      sprite.el.remove();
      activePlusOnes.splice(i, 1);
    }
  }

  window.requestAnimationFrame(animatePlusOneSprites);
}

clickButtonEl.addEventListener("click", (event) => {
  market_value_cents += 1;
  spawnPlusOneSprite(event.clientX, event.clientY);
  updateUI();
});

setInterval(() => {
  const passivePerSecond = getTotalPassivePerSecond();
  if (passivePerSecond <= 0) {
    return;
  }

  passiveFractionBuffer += passivePerSecond / PASSIVE_TICKS_PER_SECOND;
  const wholeClicksToAdd = Math.floor(passiveFractionBuffer);

  if (wholeClicksToAdd > 0) {
    market_value_cents += wholeClicksToAdd;
    passiveFractionBuffer -= wholeClicksToAdd;
    updateUI();
  }
}, 1000 / PASSIVE_TICKS_PER_SECOND);

setInterval(() => {
  saveGame();
}, SAVE_INTERVAL_MS);

window.addEventListener("beforeunload", () => {
  saveGame();
});

window.requestAnimationFrame(animatePlusOneSprites);

async function init() {
  buildAssetCards(upgrades);
  buildAchievementBoxes();

  for (const asset of assets) {
    asset.buyButtonEl.addEventListener("click", () => buyAsset(asset));
    asset.buyBulkButtonEl.addEventListener("click", () => buyAssetInBulk(asset));
  }

  loadGame();
  applyAchievementVisualState();
  updateUI();
}

init().catch((error) => {
  setStatus("Could not start the game. Try reloading the page.", true);
  console.error(error);
});
