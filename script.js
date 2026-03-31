const counterEl = document.getElementById("counter");
const clickButtonEl = document.getElementById("clickButton");
const rateTextEl = document.getElementById("rateText");
const statusEl = document.getElementById("status");
const fxLayerEl = document.getElementById("fxLayer");
const SAVE_COOKIE_NAME = "derekcoin_save";
const SAVE_INTERVAL_MS = 10000;
const PASSIVE_TICKS_PER_SECOND = 30;
const PLUS_ONE_LIFETIME_MS = 1000;
const PLUS_ONE_FADE_DELAY_MS = 200;
const PLUS_ONE_GRAVITY = 2200;
const PLUS_ONE_MIN_UPWARD_VELOCITY = -760;
const PLUS_ONE_MAX_UPWARD_VELOCITY = -620;
const PLUS_ONE_MAX_HORIZONTAL_VELOCITY = 260;

let market_value_cents = 0;
let passiveFractionBuffer = 0;
let activePlusOnes = [];
let lastPlusOneFrameTime = performance.now();
const assets = [
  {
    id: "usedLaptop",
    name: "Used Laptop",
    cost: 10,
    passivePerSecond: 1,
    owned: 0,
    ownedEl: document.getElementById("laptopsOwned"),
    buyButtonEl: document.getElementById("buyLaptopButton"),
  },
  {
    id: "cryptoFarm",
    name: "Crypto Farms",
    cost: 200,
    passivePerSecond: 40,
    owned: 0,
    ownedEl: document.getElementById("cryptoFarmsOwned"),
    buyButtonEl: document.getElementById("buyCryptoFarmButton"),
  },
  {
    id: "gpuSupplier",
    name: "GPU Suppliers",
    cost: 6000,
    passivePerSecond: 800,
    owned: 0,
    ownedEl: document.getElementById("gpuSuppliersOwned"),
    buyButtonEl: document.getElementById("buyGpuSupplierButton"),
  },
  {
    id: "ramBrand",
    name: "Consumer RAM Brands",
    cost: 240000,
    passivePerSecond: 16000,
    owned: 0,
    ownedEl: document.getElementById("ramBrandsOwned"),
    buyButtonEl: document.getElementById("buyRamBrandButton"),
  },
];

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
  } catch (error) {
    setStatus("Save data was invalid and could not be loaded.", true);
  }
}

function getTotalPassivePerSecond() {
  return assets.reduce((total, asset) => total + asset.owned * asset.passivePerSecond, 0);
}

function updateUI() {
  const padded_mkv = String(market_value_cents).padStart(3, '0');
  const mkv_to_display = padded_mkv.slice(0, -2) + '.' + padded_mkv.slice(-2);
  counterEl.textContent = `Market value: $${mkv_to_display}`;
  const padded_growth = String(getTotalPassivePerSecond()).padStart(3, '0');
  const grown_to_display = padded_growth.slice(0, -2) + '.' + padded_growth.slice(-2);
  rateTextEl.textContent = `Growth rate: $${grown_to_display}/sec`;

  for (const asset of assets) {
    asset.ownedEl.textContent = `Owned: ${asset.owned}`;
    asset.buyButtonEl.disabled = market_value_cents < asset.cost;
  }
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

function spawnPlusOneSprite(mouseX, mouseY) {
  const buttonRect = clickButtonEl.getBoundingClientRect();
  const startX = typeof mouseX === "number" ? mouseX : buttonRect.left + (buttonRect.width / 2);
  const startY = typeof mouseY === "number" ? mouseY : buttonRect.top + (buttonRect.height / 2);
  const randomHorizontalVelocity = (Math.random() * 2 - 1) * PLUS_ONE_MAX_HORIZONTAL_VELOCITY;
  const randomUpwardVelocity =
    PLUS_ONE_MIN_UPWARD_VELOCITY +
    Math.random() * (PLUS_ONE_MAX_UPWARD_VELOCITY - PLUS_ONE_MIN_UPWARD_VELOCITY);

  const spriteEl = document.createElement("img");
  spriteEl.src = "plus-one.svg";
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

for (const asset of assets) {
  asset.buyButtonEl.addEventListener("click", () => buyAsset(asset));
}

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
loadGame();
updateUI();
