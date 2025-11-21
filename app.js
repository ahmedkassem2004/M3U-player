// -------------------- CONFIG --------------------
const M3U_URL = "https://iptv-org.github.io/iptv/index.m3u";
const COUNTRIES_API = "https://iptv-org.github.io/api/countries.json";

// DOM refs
const body = document.body;
const video = document.getElementById("video");
const listEl = document.getElementById("list");
const countrySelect = document.getElementById("country-select");
const categorySelect = document.getElementById("category-select");
const searchInput = document.getElementById("search");
const clearSearchBtn = document.getElementById("clear-search");
const overlay = document.getElementById("overlay");
const spinner = document.getElementById("spinner");
const toggleBtn = document.getElementById("toggle-list-btn");
const topMenuBtn = document.getElementById("top-menu-btn");
const sidebarCloseBtn = document.getElementById("sidebar-close");
const leftPanel = document.getElementById("left");
const fsBtn = document.getElementById("fsBtn");
const fsMenu = document.getElementById("fsMenu");
const fsList = document.getElementById("fsList");
const fsSearch = document.getElementById("fsSearch");
const optAllCountries = document.getElementById("opt-all-countries");
const optAllCategories = document.getElementById("opt-all-categories");
const favoritesModal = document.getElementById("favoritesModal");
const favoritesListContainer = document.getElementById("favoritesList");
const installModal = document.getElementById("installModal");
const settingsModal = document.getElementById("settingsModal");
const lightModeToggle = document.getElementById("lightModeToggle");
const miniLogo = document.getElementById("mini-logo");
const miniTitle = document.getElementById("mini-title");
const miniMeta = document.getElementById("mini-meta");
const miniFavBtn = document.getElementById("mini-fav-btn");
const miniFsBtn = document.getElementById("mini-fullscreen-btn");
const nowTitleEl = document.getElementById("nowTitle");

// bottom nav
const btnChannels = document.getElementById("btn-channels");
const btnFavs = document.getElementById("btn-favs");
const btnHist = document.getElementById("btn-hist");
const btnSettings = document.getElementById("btn-settings");

// top settings
const btnSettingsTop = document.getElementById("btn-settings-top");

// state
let hls = null;
let allChannels = [];
let channelsDOM = [];
let countriesMap = {};
let favorites = JSON.parse(localStorage.getItem("iptv_favs") || "[]");
let historyList = JSON.parse(localStorage.getItem("iptv_hist") || "[]");
let currentLang = "es";
let hlsRetryCount = 0;
let deferredPrompt;
let installModalShown = localStorage.getItem("pwa_install_shown") === "true";
let currentChannel = null;

// i18n
const translations = {
  es: {
    loading: "Cargando lista...",
    noChannels: "No se encontraron canales.",
    toggleOpen: "☰ Canales",
    toggleClose: "X Cerrar",
    search: "Buscar canal...",
    errorNative: "No se pudo reproducir este canal (nativo).",
    favAdd: "Añadir a Favoritos",
    favRemove: "Quitar de Favoritos",
    errorFatal: "Error fatal: no se pudo cargar el stream.",
    allCountries: "🌐 Todos los Países",
    allCategories: "⭐ Todas las Categorías",
    all: "Todos",
  },
  en: {
    loading: "Loading list...",
    noChannels: "No channels found.",
    toggleOpen: "☰ Channels",
    toggleClose: "X Close",
    search: "Search channel...",
    errorNative: "Could not play this channel (Native).",
    favAdd: "Add to Favorites",
    favRemove: "Remove from Favorites",
    errorFatal: "Fatal Error: Could not load stream.",
    allCountries: "🌐 All Countries",
    allCategories: "⭐ All Categories",
    all: "All",
  },
  pt: {
    loading: "Carregando lista...",
    noChannels: "Nenhum canal encontrado.",
    toggleOpen: "☰ Canais",
    toggleClose: "X Fechar",
    search: "Pesquisar canal...",
    errorNative: "Não foi possível reproduzir este canal (Nativo).",
    favAdd: "Adicionar aos Favoritos",
    favRemove: "Remover dos Favoritos",
    errorFatal: "Erro fatal: Não foi possível carregar o stream.",
    allCountries: "🌐 Todos os Países",
    allCategories: "⭐ Todas as Categorias",
    all: "Todos",
  },
  ar: {
    loading: "جارٍ التحميل...",
    noChannels: "لم يتم العثور على قنوات.",
    toggleOpen: "☰ القنوات",
    toggleClose: "X إغلاق",
    search: "ابحث عن قناة...",
    errorNative: "تعذر تشغيل هذه القناة (أصلي).",
    favAdd: "أضف إلى المفضلة",
    favRemove: "إزالة من المفضلة",
    errorFatal: "خطأ فادح: تعذر تحميل البث.",
    allCountries: "🌐 كل الدول",
    allCategories: "⭐ كل الفئات",
    all: "الكل",
  },
};

function tKey(key) {
  return (translations[currentLang] || translations.es)[key] || "";
}

// ------------- LANGUAGE ----------------
function setLanguage(lang) {
  currentLang = lang;
  const t = translations[lang] || translations.es;
  document.getElementById("app-title").innerText =
    lang === "en" ? "Modern IPTV Web Player" : "Reproductor IPTV Web Moderno";
  searchInput.placeholder = t.search;
  toggleBtn.innerText = leftPanel.classList.contains("active")
    ? t.toggleClose
    : t.toggleOpen;
  optAllCountries.textContent = t.allCountries;
  optAllCategories.textContent = t.allCategories;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  // actualizar textos de pills
  document
    .querySelector('.pill-filter[data-filter="all"]')
    .textContent = t.all;
  document
    .querySelector('.pill-filter[data-filter="favs"]')
    .textContent = "★ Favoritos";
  document
    .querySelector('.pill-filter[data-filter="hist"]')
    .textContent = "⟲ Historial";
}

// ------------- THEME ----------------
function toggleLightMode() {
  const isLight = body.classList.toggle("light-mode");
  localStorage.setItem("theme_mode", isLight ? "light" : "dark");
}

function initializeTheme() {
  const savedTheme = localStorage.getItem("theme_mode") || "dark";
  if (savedTheme === "light") {
    body.classList.add("light-mode");
    lightModeToggle.checked = true;
  } else {
    body.classList.remove("light-mode");
    lightModeToggle.checked = false;
  }
  lightModeToggle.addEventListener("change", toggleLightMode);
}

// ------------- FETCH & PARSE ----------------
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Fetch failed: " + url);
  return r.json();
}

function extractAttr(line, key) {
  const re = new RegExp(key + '="([^"]*)"', "i");
  const m = line.match(re);
  return m ? m[1].trim() : "";
}

async function loadList() {
  listEl.innerHTML = `<div style="padding:12px;color:var(--accent)">${tKey(
    "loading"
  )}</div>`;
  try {
    const [m3uText, countriesData] = await Promise.all([
      fetch(M3U_URL).then((r) => r.text()),
      fetchJSON(COUNTRIES_API).catch(() => []),
    ]);

    (countriesData || []).forEach((c) => {
      if (c.code) countriesMap[c.code.toUpperCase()] = c.name;
    });

    const lines = m3uText.split(/\r?\n/);
    allChannels = [];
    const countries = new Set();
    const categories = new Set();

    for (let i = 0; i < lines.length; i++) {
      const L = lines[i].trim();
      if (!L) continue;
      if (L.startsWith("#EXTINF")) {
        const name = L.includes(",") ? L.substring(L.indexOf(",") + 1).trim() : "";
        const logo =
          extractAttr(L, "tvg-logo") || extractAttr(L, "logo") || null;
        const country =
          (
            extractAttr(L, "tvg-country") ||
            extractAttr(L, "country") ||
            ""
          ).toUpperCase() || "OTROS";
        const group = extractAttr(L, "group-title") || "Otros";
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        const url = (lines[j] || "").trim();
        i = j;
        if (name && url) {
          allChannels.push({ name, logo, url, country, group });
          countries.add(country);
          categories.add(group);
        }
      }
    }

    if (allChannels.length === 0) {
      listEl.innerHTML = `<div style="padding:12px;color:#ff6b6b">${tKey(
        "noChannels"
      )}</div>`;
      return;
    }

    // Países
    countrySelect.innerHTML = "";
    countrySelect.appendChild(optAllCountries);
    optAllCountries.textContent = tKey("allCountries");
    Array.from(countries)
      .sort()
      .forEach((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = countriesMap[c] || c;
        countrySelect.appendChild(o);
      });

    // Categorías
    categorySelect.innerHTML = "";
    categorySelect.appendChild(optAllCategories);
    optAllCategories.textContent = tKey("allCategories");
    Array.from(categories)
      .sort()
      .forEach((g) => {
        const o = document.createElement("option");
        o.value = g;
        o.textContent = g;
        categorySelect.appendChild(o);
      });

    renderChannels(allChannels);
    renderFsList(allChannels);
  } catch (err) {
    console.error(err);
    listEl.innerHTML =
      '<div style="padding:12px;color:#ff6b6b">Error cargando lista</div>';
  }
}

// ------------- FAVORITOS ----------------
function toggleFavorite(ch, starEl) {
  const url = ch.url;
  const isFav = favorites.includes(url);
  const t = translations[currentLang];

  let channelElementInMainList = channelsDOM.find(
    (el) => el.dataset.url === url
  );
  if (!starEl && channelElementInMainList) {
    starEl = channelElementInMainList.querySelector(".favorite-toggle");
  }

  if (isFav) {
    favorites = favorites.filter((u) => u !== url);
    if (starEl) {
      starEl.innerHTML = "☆";
      starEl.title = t.favAdd;
    }
  } else {
    favorites.push(url);
    if (starEl) {
      starEl.innerHTML = "★";
      starEl.title = t.favRemove;
    }
  }
  localStorage.setItem("iptv_favs", JSON.stringify(favorites));

  updateMiniFavIcon();

  if (favoritesModal.style.display === "flex") {
    showFavoritesModal();
  }
}

function updateMiniFavIcon() {
  if (!currentChannel) {
    miniFavBtn.textContent = "☆";
    return;
  }
  const isFav = favorites.includes(currentChannel.url);
  miniFavBtn.textContent = isFav ? "★" : "☆";
}

// ------------- RENDER LISTAS ----------------
function createChannelElement(ch) {
  const el = document.createElement("div");
  el.className = "channel";
  el.tabIndex = 0;
  el.dataset.url = ch.url;
  el.dataset.name = ch.name;
  el.dataset.country = ch.country;
  el.dataset.group = ch.group;

  const logo = document.createElement("div");
  logo.className = "channel-logo";
  if (ch.logo) {
    const img = document.createElement("img");
    img.src = ch.logo;
    img.alt = ch.name + " logo";
    img.onerror = () => {
      img.remove();
      logo.textContent = ch.name.slice(0, 2).toUpperCase();
    };
    logo.appendChild(img);
  } else {
    logo.textContent = ch.name.slice(0, 2).toUpperCase();
  }

  const name = document.createElement("div");
  name.className = "channel-name";
  name.textContent = ch.name;

  const t = translations[currentLang];
  const isFav = favorites.includes(ch.url);
  const favBtn = document.createElement("span");
  favBtn.className = "favorite-toggle";
  favBtn.innerHTML = isFav ? "★" : "☆";
  favBtn.title = isFav ? t.favRemove : t.favAdd;
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite(ch, favBtn);
  });

  el.appendChild(logo);
  el.appendChild(name);
  el.appendChild(favBtn);

  el.addEventListener("click", () => playChannel(ch, el));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") playChannel(ch, el);
  });

  return el;
}

function renderChannels(list) {
  listEl.innerHTML = "";
  channelsDOM = [];
  if (!list || list.length === 0) {
    listEl.innerHTML =
      '<div style="padding:12px;color:#ffd166">No hay canales para este filtro.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const ch of list) {
    const el = createChannelElement(ch);
    frag.appendChild(el);
    channelsDOM.push(el);
  }
  listEl.appendChild(frag);
}

function renderFsList(list) {
  fsList.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const ch of list) {
    const el = document.createElement("div");
    el.textContent = ch.name;
    el.onclick = () => {
      playChannel(ch, null);
      fsMenu.style.display = "none";
    };
    frag.appendChild(el);
  }
  fsList.appendChild(frag);
}

// FAVORITOS MODAL
function createModalChannelElement(ch) {
  const el = document.createElement("div");
  el.className = "channel";

  const nameEl = document.createElement("span");
  nameEl.className = "channel-name";
  nameEl.textContent = ch.name;

  const removeBtn = document.createElement("span");
  removeBtn.textContent = "❌";
  removeBtn.style.cursor = "pointer";
  removeBtn.style.marginLeft = "10px";
  removeBtn.title = tKey("favRemove");
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite({ url: ch.url }, el);
    showFavoritesModal();
  });

  el.appendChild(nameEl);
  el.appendChild(removeBtn);

  el.addEventListener("click", () => {
    playChannel(ch, null);
    favoritesModal.style.display = "none";
    favoritesModal.setAttribute("aria-hidden", "true");
    setActiveMenuButton(null);
  });
  return el;
}

function renderFavoritesModalList(list) {
  favoritesListContainer.innerHTML = "";
  if (!list || list.length === 0) {
    favoritesListContainer.innerHTML =
      '<div style="padding:10px;color:var(--text-soft);">No tienes canales favoritos guardados.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const ch of list) {
    frag.appendChild(createModalChannelElement(ch));
  }
  favoritesListContainer.appendChild(frag);
}

function showFavoritesModal() {
  setActiveMenuButton("btn-favs");
  const favs = allChannels.filter((c) => favorites.includes(c.url));
  renderFavoritesModalList(favs);
  favoritesModal.style.display = "flex";
  favoritesModal.setAttribute("aria-hidden", "false");
  if (window.innerWidth < 900 && leftPanel.classList.contains("active")) {
    leftPanel.classList.remove("active");
    toggleBtn.textContent = tKey("toggleOpen");
  }
}

// ------------- PLAYBACK ----------------
async function playChannel(ch, el) {
  currentChannel = ch;

  // history
  const idx = historyList.indexOf(ch.url);
  if (idx !== -1) historyList.splice(idx, 1);
  historyList.unshift(ch.url);
  historyList = historyList.slice(0, 50);
  localStorage.setItem("iptv_hist", JSON.stringify(historyList));

  // UI
  channelsDOM.forEach((c) => c.classList.remove("active"));
  if (el) el.classList.add("active");
  if (window.innerWidth < 900) {
    leftPanel.classList.remove("active");
    toggleBtn.innerText = tKey("toggleOpen") || "☰ Canales";
  }
  overlay.textContent = ch.name;
  overlay.style.display = "block";
  overlay.setAttribute("aria-hidden", "false");
  spinner.style.display = "flex";
  spinner.setAttribute("aria-hidden", "false");

  nowTitleEl.textContent = ch.name;
  miniTitle.textContent = ch.name;
  miniMeta.textContent = ch.group || "Canal IPTV";
  miniLogo.innerHTML = "";
  if (ch.logo) {
    const img = document.createElement("img");
    img.src = ch.logo;
    img.onload = () => miniLogo.appendChild(img);
    img.onerror = () => {
      miniLogo.textContent = ch.name.slice(0, 2).toUpperCase();
    };
  } else {
    miniLogo.textContent = ch.name.slice(0, 2).toUpperCase();
  }
  updateMiniFavIcon();

  try {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
  } catch (e) {
    console.warn("Cleanup failed", e);
  }

  const url = ch.url;
  hlsRetryCount = 0;

  function tryNativePlay(src) {
    return new Promise((resolve, reject) => {
      video.src = src;
      const p = video.play();
      if (p && p.then) {
        p.then(resolve).catch(reject);
      } else {
        resolve();
      }
    });
  }

  function hlsOnError(event, data) {
    console.warn("HLS error", data);
    if (data.fatal) {
      if (hlsRetryCount < 2) {
        hlsRetryCount++;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.loadSource(url);
        } else {
          hls.destroy();
          hls = null;
          setTimeout(() => playChannel(ch, el), 1000);
        }
      } else {
        console.error(
          "HLS fatal after retries. Attempting native fallback."
        );
        try {
          if (hls) hls.destroy();
        } catch (e) {}
        hls = null;
        tryNativePlay(url)
          .then(() => {
            spinner.style.display = "none";
            overlay.style.display = "none";
          })
          .catch(() => {
            spinner.style.display = "none";
            alert(tKey("errorFatal"));
            overlay.style.display = "none";
          });
      }
    }
  }

  const u = url.split("?")[0].toLowerCase();
  const isM3U8 = u.includes(".m3u8");
  const isMPD = u.includes(".mpd");
  const isRtsp = u.startsWith("rtsp:");
  const isRtmp = u.startsWith("rtmp:");

  try {
    if (isRtsp || isRtmp || isMPD) {
      spinner.style.display = "none";
      overlay.style.display = "none";
      alert(
        "Este tipo de stream (RTSP/RTMP/DASH) no es reproducible directamente en navegadores."
      );
      return;
    }

    if (isM3U8) {
      if (window.Hls && Hls.isSupported()) {
        hls = new Hls({
          maxBufferLength: 30,
          enableWorker: true,
          manifestLoadingRetryDelay: 1000,
          fragLoadingRetryDelay: 1200,
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          spinner.style.display = "none";
          spinner.setAttribute("aria-hidden", "true");
          overlay.style.display = "none";
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, hlsOnError);
        return;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        tryNativePlay(url)
          .then(() => {
            spinner.style.display = "none";
            overlay.style.display = "none";
          })
          .catch(() => {
            spinner.style.display = "none";
            overlay.style.display = "none";
            alert(tKey("errorNative"));
          });
        return;
      }
    }

    // otros formatos
    await tryNativePlay(url);
    spinner.style.display = "none";
    overlay.style.display = "none";
  } catch (err) {
    console.error("Playback error:", err);
    spinner.style.display = "none";
    overlay.style.display = "none";
    alert(
      "No se pudo reproducir este canal (posible CORS/Formato/Seguridad)."
    );
  }
}

// ------------- FILTERING ----------------
function filterChannels() {
  const country = countrySelect.value;
  const group = categorySelect.value;
  const q = (searchInput.value || "").toLowerCase();

  const filtered = allChannels.filter((ch) => {
    const matchCountry = !country || ch.country === country;
    const matchGroup = !group || ch.group === group;
    const matchQuery = !q || ch.name.toLowerCase().includes(q);
    return matchCountry && matchGroup && matchQuery;
  });

  renderChannels(filtered);
  renderFsList(filtered);
}

function showAllChannels() {
  countrySelect.value = "";
  categorySelect.value = "";
  searchInput.value = "";
  filterChannels();
}

function showHistory() {
  const hist = historyList
    .map((u) => allChannels.find((c) => c.url === u))
    .filter(Boolean);
  renderChannels(hist);
  renderFsList(hist);
}

function showFavoritesInList() {
  const favs = allChannels.filter((c) => favorites.includes(c.url));
  renderChannels(favs);
  renderFsList(favs);
}

// ------------- NAV & UI ----------------
function setActiveMenuButton(id) {
  document
    .querySelectorAll("#bottomMenu .menu-btn")
    .forEach((btn) => btn.classList.remove("active"));
  if (id) document.getElementById(id).classList.add("active");
}

// mobile sidebar toggle
function toggleSidebar() {
  const isActive = leftPanel.classList.toggle("active");
  toggleBtn.textContent = isActive ? tKey("toggleClose") : tKey("toggleOpen");
  if (!isActive) setActiveMenuButton(null);
}

// bottom buttons
btnChannels.addEventListener("click", () => {
  if (window.innerWidth < 900 && !leftPanel.classList.contains("active")) {
    leftPanel.classList.add("active");
    toggleBtn.textContent = tKey("toggleClose");
  }
  showAllChannels();
  setActiveMenuButton("btn-channels");
});

btnFavs.addEventListener("click", showFavoritesModal);

btnHist.addEventListener("click", () => {
  showHistory();
  setActiveMenuButton("btn-hist");
  if (window.innerWidth < 900 && !leftPanel.classList.contains("active")) {
    leftPanel.classList.add("active");
    toggleBtn.textContent = tKey("toggleClose");
  }
});

btnSettings.addEventListener("click", () => {
  settingsModal.style.display = "flex";
  settingsModal.setAttribute("aria-hidden", "false");
  setActiveMenuButton("btn-settings");
});

btnSettingsTop.addEventListener("click", () => {
  settingsModal.style.display = "flex";
  settingsModal.setAttribute("aria-hidden", "false");
});

// sidebar toggle buttons
toggleBtn.addEventListener("click", toggleSidebar);
topMenuBtn.addEventListener("click", toggleSidebar);
sidebarCloseBtn.addEventListener("click", toggleSidebar);

// search
searchInput.addEventListener("input", filterChannels);
clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  filterChannels();
});

// selects
countrySelect.addEventListener("change", filterChannels);
categorySelect.addEventListener("change", filterChannels);

// pills
document.querySelectorAll(".pill-filter").forEach((pill) => {
  pill.addEventListener("click", () => {
    document
      .querySelectorAll(".pill-filter")
      .forEach((p) => p.classList.remove("pill-active"));
    pill.classList.add("pill-active");
    const filter = pill.dataset.filter;
    if (filter === "all") {
      showAllChannels();
      setActiveMenuButton(null);
    } else if (filter === "favs") {
      showFavoritesInList();
      setActiveMenuButton("btn-favs");
    } else if (filter === "hist") {
      showHistory();
      setActiveMenuButton("btn-hist");
    }
  });
});

// mini bar buttons
miniFavBtn.addEventListener("click", () => {
  if (currentChannel) toggleFavorite(currentChannel, null);
});
miniFsBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

// favorites modal close
document
  .getElementById("closeFavModal")
  .addEventListener("click", () => {
    favoritesModal.style.display = "none";
    favoritesModal.setAttribute("aria-hidden", "true");
    setActiveMenuButton(null);
  });

// settings modal close
document
  .getElementById("closeSettingsModal")
  .addEventListener("click", () => {
    settingsModal.style.display = "none";
    settingsModal.setAttribute("aria-hidden", "true");
    setActiveMenuButton(null);
  });

// ESC handlers
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (favoritesModal.style.display === "flex") {
      favoritesModal.style.display = "none";
      favoritesModal.setAttribute("aria-hidden", "true");
      setActiveMenuButton(null);
    } else if (settingsModal.style.display === "flex") {
      settingsModal.style.display = "none";
      settingsModal.setAttribute("aria-hidden", "true");
      setActiveMenuButton(null);
    } else if (leftPanel.classList.contains("active")) {
      toggleSidebar();
    } else if (installModal.style.display === "flex") {
      hideInstallModal();
    }
  }
});

// fullscreen side-menu
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    fsBtn.style.display = "flex";
  } else {
    fsBtn.style.display = "none";
    fsMenu.style.display = "none";
  }
});
fsBtn.addEventListener("click", () => {
  fsMenu.style.display = fsMenu.style.display === "block" ? "none" : "block";
});
fsSearch.addEventListener("input", () => {
  const q = fsSearch.value.toLowerCase();
  [...fsList.children].forEach((c) => {
    c.style.display = c.textContent.toLowerCase().includes(q)
      ? "block"
      : "none";
  });
});

// ------------- PWA INSTALL ----------------
function hideInstallModal() {
  installModal.style.display = "none";
  installModal.setAttribute("aria-hidden", "true");
  localStorage.setItem("pwa_install_shown", "true");
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!installModalShown) {
    installModal.style.display = "flex";
    installModal.setAttribute("aria-hidden", "false");
  }
});
document
  .getElementById("btn-install-yes")
  .addEventListener("click", () => {
    hideInstallModal();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
      });
    }
  });
document
  .getElementById("btn-install-no")
  .addEventListener("click", hideInstallModal);

// ------------- INIT ----------------
document
  .getElementById("language-select")
  .addEventListener("change", (e) => setLanguage(e.target.value));

setLanguage("es");
initializeTheme();
loadList();

// SERVICE WORKER inline
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swScript = `
      const CACHE_NAME = 'iptv-player-cache-v5';
      const urlsToCache = ['./','https://cdn.jsdelivr.net/npm/hls.js@latest'];
      self.addEventListener('install',event=>{
        event.waitUntil(
          caches.open(CACHE_NAME).then(cache=>{
            return cache.addAll(urlsToCache).catch(()=>{})
          })
        );
        self.skipWaiting();
      });
      self.addEventListener('activate',event=>{
        event.waitUntil(
          caches.keys().then(names=>Promise.all(
            names.filter(n=>n!==CACHE_NAME).map(n=>caches.delete(n))
          ))
        );
        self.clients.claim();
      });
      self.addEventListener('fetch',event=>{
        if(event.request.mode==='navigate' || event.request.destination==='script' || event.request.destination==='style'){
          event.respondWith(
            caches.match(event.request).then(resp=>{
              return resp || fetch(event.request).catch(()=>{
                if(event.request.mode==='navigate'){
                  return new Response('<h1>Sin conexión</h1><p>Se requiere Internet para cargar los canales.</p>',{headers:{'Content-Type':'text/html'}});
                }
              });
            })
          );
        }
      });
    `;
    try {
      const swBlob = new Blob([swScript], {
        type: "application/javascript",
      });
      const swUrl = URL.createObjectURL(swBlob);
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) =>
          console.log("Service Worker registrado:", reg.scope)
        )
        .catch((err) =>
          console.error("Fallo registro Service Worker:", err)
        );
    } catch (e) {
      console.warn("SW inline error:", e);
    }
  });
}
