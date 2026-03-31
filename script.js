const counterEl = document.getElementById("counter");
const clickButtonEl = document.getElementById("clickButton");
const rateTextEl = document.getElementById("rateText");
const statusEl = document.getElementById("status");
const SAVE_COOKIE_NAME = "derekcoin_save";
const SAVE_INTERVAL_MS = 10000;

let clicks = 0;
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
    cost: 100,
    passivePerSecond: 20,
    owned: 0,
    ownedEl: document.getElementById("cryptoFarmsOwned"),
    buyButtonEl: document.getElementById("buyCryptoFarmButton"),
  },
  {
    id: "gpuSupplier",
    name: "GPU Suppliers",
    cost: 1000,
    passivePerSecond: 80,
    owned: 0,
    ownedEl: document.getElementById("gpuSuppliersOwned"),
    buyButtonEl: document.getElementById("buyGpuSupplierButton"),
  },
  {
    id: "ramBrand",
    name: "Consumer RAM Brands",
    cost: 10000,
    passivePerSecond: 400,
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
    clicks,
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
      clicks = Math.max(0, Math.floor(parsedSave.clicks));
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
  counterEl.textContent = `Clicks: ${clicks}`;
  rateTextEl.textContent = `Passive income: ${getTotalPassivePerSecond()} clicks/sec`;

  for (const asset of assets) {
    asset.ownedEl.textContent = `Owned: ${asset.owned}`;
    asset.buyButtonEl.disabled = clicks < asset.cost;
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function buyAsset(asset) {
  if (clicks < asset.cost) {
    setStatus(`Not enough clicks to buy ${asset.name}.`, true);
    return;
  }

  clicks -= asset.cost;
  asset.owned += 1;
  setStatus(`Purchased ${asset.name}. Passive farming increased.`);
  updateUI();
}

clickButtonEl.addEventListener("click", () => {
  clicks += 1;
  updateUI();
});

for (const asset of assets) {
  asset.buyButtonEl.addEventListener("click", () => buyAsset(asset));
}

setInterval(() => {
  const passiveGain = getTotalPassivePerSecond();
  if (passiveGain > 0) {
    clicks += passiveGain;
    updateUI();
  }
}, 1000);

setInterval(() => {
  saveGame();
}, SAVE_INTERVAL_MS);

window.addEventListener("beforeunload", () => {
  saveGame();
});

loadGame();
updateUI();
