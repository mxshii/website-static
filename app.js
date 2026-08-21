/* ═══════════════════════════════════════════════════════
   STATIC — app.js (Storefront Logic & Interactions)
   ═══════════════════════════════════════════════════════ */

const EXPENSE_API = "https://expense-sys-ten.vercel.app";
const VODAFONE_CASH_NUMBER = "01005792211";
const PICTURE_DB_KEY = "static_storefront_pictures_v1";

// ── STATE ─────────────────────────────────────────────
let PRODUCTS = [];
let cart = [];
let currentProduct = null;
let customerData = {};
let currentPaymentMethod = null; // "vodafone" | "card"
let currentUser = null;          // logged-in customer
let activeCategory = "all";
let searchQuery = "";
let _stockCacheTime = 0;

// ── DEDICATED STOREFRONT PICTURE & METADATA DATABASE (SYNCED ACROSS ALL DEVICES) ──
async function fetchStorefrontPictureMap() {
  try {
    const res = await fetch("/api/pictures");
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(PICTURE_DB_KEY, JSON.stringify(data));
      return data;
    }
  } catch (_) {}

  try {
    const cached = localStorage.getItem(PICTURE_DB_KEY);
    if (cached) return JSON.parse(cached);
  } catch (_) {}
  return {};
}

function getStorefrontPictureMap() {
  try {
    const saved = localStorage.getItem(PICTURE_DB_KEY);
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return {};
}

async function saveStorefrontPictureMap(map) {
  try {
    localStorage.setItem(PICTURE_DB_KEY, JSON.stringify(map));
  } catch (_) {}

  try {
    await fetch("/api/pictures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(map),
    });
  } catch (err) {
    console.warn("Could not sync to cloud /api/pictures endpoint:", err);
  }
}

// ── ICON HELPER ───────────────────────────────────────
function renderIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    try {
      window.lucide.createIcons();
    } catch (e) {
      console.warn("lucide render error:", e);
    }
  }
}

// ── INIT ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  createToastContainer();
  initImageProtection();
  loadCartFromStorage();
  loadCurrentUser();
  initNavbar();
  initMobileMenu();
  initProductModal();
  initCartDrawer();
  initCheckout();
  initAccountModal();
  initShopControls();
  initContactForm();

  // Load products if grid is present
  if (document.getElementById("products-grid")) {
    loadProducts();
  }

  highlightActiveNavLink();
  renderIcons();
});

// ── ARTWORK ANTI-THEFT PROTECTION ──
function initImageProtection() {
  document.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".card-img-wrap, .modal-main-img, .modal-images, .product-card")) {
      e.preventDefault();
      showToast("✦ STATIC artwork is protected");
      return false;
    }
  });

  document.addEventListener("dragstart", (e) => {
    if (e.target.tagName === "IMG" || e.target.closest(".card-img-wrap, .modal-images, .product-card")) {
      e.preventDefault();
      return false;
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      if (!window.location.pathname.includes("admin")) {
        e.preventDefault();
        showToast("✦ STATIC artwork is protected");
      }
    }
  });
}

// Run icon renderer after full page load as well
window.addEventListener("load", () => {
  renderIcons();
});

// ══════════════════════════════════════════════════════
// NAVIGATION & PAGE ROUTING
// ══════════════════════════════════════════════════════
function initNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 30);
  });
}

function initMobileMenu() {
  const btn = document.getElementById("mobile-menu-btn");
  const menu = document.getElementById("mobile-menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeCart();
    const isOpen = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", isOpen);
    btn.innerHTML = isOpen
      ? `<i data-lucide="x" class="icon-md"></i>`
      : `<i data-lucide="menu" class="icon-md"></i>`;
    renderIcons();
  });

  menu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      menu.classList.remove("open");
      if (btn) {
        btn.innerHTML = `<i data-lucide="menu" class="icon-md"></i>`;
        renderIcons();
      }
    });
  });

  const mobAccount = document.getElementById("mob-account");
  if (mobAccount) {
    mobAccount.addEventListener("click", (e) => {
      e.preventDefault();
      menu.classList.remove("open");
      if (btn) {
        btn.innerHTML = `<i data-lucide="menu" class="icon-md"></i>`;
        renderIcons();
      }
      if (currentUser) {
        openMyAccount();
      } else {
        openAccountModal("login");
      }
    });
  }

  // Close mobile menu when clicking outside
  document.addEventListener("click", (e) => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.remove("open");
      btn.innerHTML = `<i data-lucide="menu" class="icon-md"></i>`;
      renderIcons();
    }
  });
}

function closeMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const btn = document.getElementById("mobile-menu-btn");
  if (menu) menu.classList.remove("open");
  if (btn) {
    btn.innerHTML = `<i data-lucide="menu" class="icon-md"></i>`;
    renderIcons();
  }
}

function highlightActiveNavLink() {
  const currentPath = window.location.pathname.toLowerCase();
  const navLinks = document.querySelectorAll(".nav-links a, .mobile-menu a");

  navLinks.forEach(link => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    let isCurrent = false;

    if (currentPath === "/" || currentPath.endsWith("index.html") || currentPath === "" || currentPath.endsWith("/")) {
      isCurrent = href === "index.html" || href === "/" || href === "./";
    } else if (currentPath.includes("shop")) {
      isCurrent = href.includes("shop");
    } else if (currentPath.includes("about")) {
      isCurrent = href.includes("about");
    } else if (currentPath.includes("contact")) {
      isCurrent = href.includes("contact");
    }

    if (isCurrent) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// ══════════════════════════════════════════════════════
// MODAL & DRAWER HELPER
// ══════════════════════════════════════════════════════
function closeAllDrawersAndMenus() {
  closeCart();
  closeMobileMenu();
}

function updateBodyScrollLock() {
  const hasOpen = document.querySelector(".modal-overlay.open, .cart-drawer.open");
  if (hasOpen) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}

// ══════════════════════════════════════════════════════
// CUSTOMER AUTH
// ══════════════════════════════════════════════════════
function loadCurrentUser() {
  try {
    const saved = localStorage.getItem("static_customer");
    if (saved) {
      currentUser = JSON.parse(saved);
      updateAccountNavUI();
    }
  } catch (_) {}
}

function saveCurrentUser(user, token) {
  currentUser = user;
  localStorage.setItem("static_customer", JSON.stringify({ ...user, token }));
  updateAccountNavUI();
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem("static_customer");
  updateAccountNavUI();
  showToast("Logged out");
}

async function deleteMyAccount() {
  if (!currentUser) return;
  const confirmed = window.confirm(
    `Delete your account (${currentUser.email})?\n\nThis cannot be undone. Your order history will be deleted.`
  );
  if (!confirmed) return;

  const saved = JSON.parse(localStorage.getItem("static_customer") || "{}");
  const token = saved.token;
  try {
    const res = await fetch(`${EXPENSE_API}/api/customers/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      logoutUser();
      closeAccountModal();
      showToast("Account deleted");
    } else {
      const d = await res.json();
      showToast(d.error || "Could not delete account");
    }
  } catch (_) {
    showToast("Something went wrong. Try again.");
  }
}

function updateAccountNavUI() {
  const btn = document.getElementById("account-btn");
  const label = document.getElementById("account-btn-label");
  const mobAccount = document.getElementById("mob-account");
  if (currentUser) {
    const firstName = (currentUser.name || "user").split(" ")[0];
    if (label) label.textContent = firstName;
    if (btn) btn.title = `My account (${currentUser.name})`;
    if (mobAccount) mobAccount.textContent = `my account (${firstName})`;
  } else {
    if (label) label.textContent = "sign in";
    if (btn) btn.title = "Sign in or create account";
    if (mobAccount) mobAccount.textContent = "sign in";
  }
  renderIcons();
}

function initAccountModal() {
  const btn = document.getElementById("account-btn");
  const modal = document.getElementById("account-modal");
  const closeBtn = document.getElementById("account-modal-close");
  if (!btn || !modal) return;

  btn.addEventListener("click", () => {
    closeAllDrawersAndMenus();
    if (currentUser) {
      openMyAccount();
    } else {
      openAccountModal("login");
    }
  });

  if (closeBtn) closeBtn.addEventListener("click", closeAccountModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeAccountModal(); });

  const switchReg = document.getElementById("switch-to-register");
  const switchLog = document.getElementById("switch-to-login");
  const logoutBtn = document.getElementById("account-logout-btn");
  const deleteBtn = document.getElementById("account-delete-btn");

  if (switchReg) switchReg.addEventListener("click", () => openAccountModal("register"));
  if (switchLog) switchLog.addEventListener("click", () => openAccountModal("login"));
  if (logoutBtn) logoutBtn.addEventListener("click", () => { logoutUser(); closeAccountModal(); });
  if (deleteBtn) deleteBtn.addEventListener("click", deleteMyAccount);

  const regForm = document.getElementById("register-form");
  const logForm = document.getElementById("login-form");
  if (regForm) regForm.addEventListener("submit", handleRegister);
  if (logForm) logForm.addEventListener("submit", handleLogin);

  // Clear errors on input
  document.querySelectorAll("#login-form input, #register-form input").forEach(inp => {
    inp.addEventListener("input", () => {
      const errLog = document.getElementById("login-error");
      const errReg = document.getElementById("register-error");
      if (errLog) errLog.textContent = "";
      if (errReg) errReg.textContent = "";
    });
  });
}

function openAccountModal(tab = "login") {
  closeAllDrawersAndMenus();
  const modal = document.getElementById("account-modal");
  if (!modal) return;
  modal.classList.add("open");
  showAccountTab(tab);
  updateBodyScrollLock();
  renderIcons();
}

function closeAccountModal() {
  const modal = document.getElementById("account-modal");
  if (modal) modal.classList.remove("open");
  updateBodyScrollLock();
}

function openMyAccount() {
  closeAllDrawersAndMenus();
  const modal = document.getElementById("account-modal");
  if (!modal) return;
  showAccountTab("profile");
  modal.classList.add("open");
  updateBodyScrollLock();

  const nameEl = document.getElementById("profile-name");
  const emailEl = document.getElementById("profile-email");
  if (nameEl && currentUser) nameEl.textContent = currentUser.name;
  if (emailEl && currentUser) emailEl.textContent = currentUser.email;

  loadMyOrders();
  renderIcons();
}

function showAccountTab(tab) {
  ["login-pane", "register-pane", "profile-pane"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  const pane = document.getElementById(tab + "-pane");
  if (pane) pane.classList.remove("hidden");

  const errLog = document.getElementById("login-error");
  const errReg = document.getElementById("register-error");
  if (errLog) errLog.textContent = "";
  if (errReg) errReg.textContent = "";
  renderIcons();
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById("register-submit");
  const name = (document.getElementById("reg-name")?.value || "").trim();
  const email = (document.getElementById("reg-email")?.value || "").trim();
  const password = document.getElementById("reg-password")?.value || "";
  const phone = (document.getElementById("reg-phone")?.value || "").trim();
  const errEl = document.getElementById("register-error");
  if (errEl) errEl.textContent = "";

  if (!name || !email || !password) {
    if (errEl) errEl.textContent = "Please fill in your name, email and a password.";
    return;
  }
  if (password.length < 6) {
    if (errEl) errEl.textContent = "Password must be at least 6 characters.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "creating account...";

  try {
    const res = await fetch(`${EXPENSE_API}/api/customers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (errEl) {
        if (data.error && data.error.includes("already registered")) {
          errEl.innerHTML = `Email already registered. <button type="button" class="link-btn" onclick="openAccountModal('login')">Sign in here</button>`;
        } else {
          errEl.textContent = data.error || "Registration failed. Please try again.";
        }
      }
      return;
    }
    saveCurrentUser(data.customer, data.token);
    closeAccountModal();
    showToast(`Welcome, ${data.customer.name.split(" ")[0]}! ✦`);
  } catch (_) {
    if (errEl) errEl.textContent = "Unable to connect. Please check your connection.";
  } finally {
    btn.disabled = false;
    btn.textContent = "create account";
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("login-submit");
  const email = (document.getElementById("login-email")?.value || "").trim();
  const password = document.getElementById("login-password")?.value || "";
  const errEl = document.getElementById("login-error");
  if (errEl) errEl.textContent = "";

  if (!email || !password) {
    if (errEl) errEl.textContent = "Please enter your email and password.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "signing in...";

  try {
    const res = await fetch(`${EXPENSE_API}/api/customers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (errEl) {
        errEl.textContent = data.error === "wrong email or password"
          ? "Incorrect email or password. Please try again."
          : (data.error || "Sign in failed");
      }
      return;
    }
    saveCurrentUser(data.customer, data.token);
    closeAccountModal();
    showToast(`Welcome back, ${data.customer.name.split(" ")[0]}! ✦`);
  } catch (_) {
    if (errEl) errEl.textContent = "Unable to connect. Please try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "sign in";
  }
}

async function loadMyOrders() {
  const container = document.getElementById("profile-orders");
  if (!container || !currentUser) return;
  container.innerHTML = "<p style='color:var(--coffee-400);font-size:.85rem'>Loading orders...</p>";
  try {
    const saved = JSON.parse(localStorage.getItem("static_customer") || "{}");
    const token = saved.token;
    const res = await fetch(`${EXPENSE_API}/api/customers/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const orders = await res.json();
    if (!orders || !orders.length) {
      container.innerHTML = "<p style='color:var(--coffee-400);font-size:.85rem;padding:12px 0;'>No orders yet. Go stick some stuff!</p>";
      return;
    }
    container.innerHTML = orders.map(o => {
      const rawDel = (o.deliveryStatus || o.fulfillmentStatus || o.status || "preparing").toLowerCase();
      let delBadgeClass = "del-preparing";
      let delLabel = "preparing order";
      
      if (rawDel.includes("deliver") && !rawDel.includes("out")) {
        delBadgeClass = "del-delivered";
        delLabel = "delivered";
      } else if (rawDel.includes("out") || rawDel.includes("transit") || rawDel.includes("ship")) {
        delBadgeClass = "del-transit";
        delLabel = "out for delivery";
      } else if (rawDel.includes("cancel")) {
        delBadgeClass = "del-cancelled";
        delLabel = "cancelled";
      }

      const totalVal = o.totalAmount || o.total || o.finalTotal || "";
      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB") : "";
      const itemsPayload = encodeURIComponent(JSON.stringify(o.items || []));

      return `
        <div class="profile-order-card" style="cursor:pointer;" onclick="reorderItems('${itemsPayload}')">
          <div class="profile-order-head">
            <span class="profile-order-id">#${o.id}</span>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <span class="profile-order-status ${o.paymentStatus || 'unpaid'}">${o.paymentStatus || 'unpaid'}</span>
              <span class="profile-delivery-status ${delBadgeClass}">${delLabel}</span>
            </div>
          </div>
          <div class="profile-order-items">${(o.items || []).map(i => `${i.name || i.itemName || 'Sticker'} ×${i.qty || i.quantity || 1}`).join(", ")}</div>
          <div class="profile-order-footer">
            <span class="profile-order-total">${totalVal ? totalVal + ' EGP' : ''}</span>
            <span style="font-size:0.75rem;color:var(--coffee-700);font-weight:700;text-decoration:underline;">add to cart &rarr;</span>
          </div>
        </div>
      `;
    }).join("");
  } catch (_) {
    container.innerHTML = "<p style='color:var(--coffee-400);font-size:.85rem'>Could not load orders.</p>";
  }
}

window.reorderItems = function (itemsJsonStr) {
  try {
    const rawItems = JSON.parse(decodeURIComponent(itemsJsonStr));
    if (!Array.isArray(rawItems) || !rawItems.length) return;
    
    rawItems.forEach(item => {
      const match = PRODUCTS.find(p => p.name === item.name || String(p.id) === String(item.id)) || {
        id: item.id || item.stockId || item.name || Math.random().toString(),
        name: item.name || item.itemName || "Sticker Item",
        price: Number(item.price) || 0,
        qty: Number(item.qty || item.quantity) || 1,
        img: item.img || getProductImage(item.name, item.sku),
      };
      
      const existing = cart.find(i => String(i.id) === String(match.id) || i.name === match.name);
      if (existing) {
        existing.qty = (existing.qty || 1) + (Number(item.qty || item.quantity) || 1);
      } else {
        cart.push({
          id: match.id,
          name: match.name,
          price: Number(match.price) || 0,
          qty: Number(item.qty || item.quantity) || 1,
          img: match.img || getProductImage(match.name, match.sku),
        });
      }
    });

    saveCartToStorage();
    updateCartUI();
    closeAccountModal();
    openCart();
    showToast("Items loaded into cart ✦");
  } catch (err) {
    console.error("Reorder error:", err);
  }
};

// ══════════════════════════════════════════════════════
// PRODUCTS & SHOP (3 Categories: posters, single stickers, sticker sheet)
// ══════════════════════════════════════════════════════
function inferProductCategory(name, sku) {
  const n = (name + " " + (sku || "")).toLowerCase();
  if (n.includes("poster") || n.includes("print")) return "posters";
  if (n.includes("sheet") || n.includes("pack") || n.includes("bundle") || n.includes("set")) return "sticker sheet";
  return "single stickers";
}

async function loadProducts(forceRefresh = false) {
  const grid = document.getElementById("products-grid");
  if (!grid) return;

  if (!forceRefresh && PRODUCTS.length > 0 && (Date.now() - _stockCacheTime < 60000)) {
    renderProducts();
    return;
  }

  grid.innerHTML = `
    <div class="products-loading">
      <div class="loading-spinner"></div>
      <p>Loading catalog...</p>
    </div>`;

  try {
    const [stockRes, customMap] = await Promise.all([
      fetch(`${EXPENSE_API}/api/stock/public`).catch(e => {
        console.error("Stock fetch error:", e);
        return null;
      }),
      fetchStorefrontPictureMap().catch(e => {
        console.error("Picture map fetch error:", e);
        return {};
      })
    ]);

    let stock = [];
    if (stockRes && stockRes.ok) {
      stock = await stockRes.json();
    }
    _stockCacheTime = Date.now();

    if (!stock || !stock.length) {
      grid.innerHTML = `<div class="products-empty"><p>Products coming soon — check back shortly!</p></div>`;
      return;
    }

    const safeMap = customMap || {};

    if (safeMap && Array.isArray(safeMap.items) && safeMap.items.length > 0) {
      PRODUCTS = safeMap.items.map(item => {
        const linkedStock = stock.find(s => String(s.id) === String(item.stockId));
        // Default to 1 in stock unless customized in admin
        const stockQty = (item.qty !== undefined && item.qty !== null && item.qty !== "")
          ? Number(item.qty)
          : 1;
        const stockPrice = (item.price !== undefined && item.price !== null && item.price !== "")
          ? Number(item.price)
          : (linkedStock ? Number(linkedStock.price) : 15);
        const category = item.category || inferProductCategory(item.name, linkedStock?.sku);
        const img = item.img || getProductImage(item.name, linkedStock?.sku);
        const badge = item.badge !== undefined && item.badge !== ""
          ? item.badge
          : (stockQty === 0 ? "sold out" : null);

        const fit = item.fit || (item.category === "posters" ? "cover" : "contain");

        return {
          id: item.id,
          stockId: item.stockId || linkedStock?.id || item.id,
          name: item.name || "Sticker Item",
          sku: linkedStock ? (linkedStock.sku || "") : "",
          desc: item.desc || `${item.name} — a handmade ${category} from STATIC. Waterproof vinyl, die-cut, shipped from Alexandria.`,
          price: stockPrice,
          qty: stockQty,
          category: category,
          img: img,
          badge: badge,
          fit: fit,
          outOfStock: stockQty === 0,
        };
      });
    } else {
      PRODUCTS = stock.map(item => {
        const custom = safeMap[item.id] || safeMap[item.itemName] || safeMap[item.sku] || {};
        const stockQty = (custom.qty !== undefined && custom.qty !== null && custom.qty !== "")
          ? Number(custom.qty)
          : 1;
        const category = custom.category || inferProductCategory(item.itemName, item.sku);
        const img = custom.img || getProductImage(item.itemName, item.sku);
        const badge = custom.badge !== undefined && custom.badge !== ""
          ? custom.badge
          : (stockQty === 0 ? "sold out" : null);
        const fit = custom.fit || (category === "posters" ? "cover" : "contain");

        return {
          id: item.id,
          stockId: item.id,
          name: custom.name || item.itemName,
          sku: item.sku || "",
          desc: custom.desc || `${custom.name || item.itemName} — a handmade ${category} from STATIC. Waterproof vinyl, die-cut, shipped from Alexandria.`,
          price: custom.price !== undefined && custom.price !== "" ? Number(custom.price) : (item.price || 15),
          qty: stockQty,
          category: category,
          img: img,
          badge: badge,
          fit: fit,
          outOfStock: stockQty === 0,
        };
      });
    }

    renderProducts();
  } catch (err) {
    console.error("Failed to load stock:", err);
    grid.innerHTML = `<div class="products-empty"><p>Could not load stock. Please refresh.</p></div>`;
  }
}

function getProductImage(name, sku) {
  const n = (name + " " + (sku || "")).toLowerCase();
  if (n.includes("cat") || n.includes("feline")) return "images/sticker-cats.jpg";
  if (n.includes("celestial") || n.includes("botanical") || n.includes("moon") || n.includes("star")) return "images/sticker-celestial.jpg";
  if (n.includes("food") || n.includes("ramen") || n.includes("boba") || n.includes("foodi")) return "images/sticker-food.jpg";
  return "images/sticker-cozy.jpg";
}

function getFallbackProducts() {
  return [
    { id: "cozy", name: "Kawaii Cozy Sticker Sheet", sku: "STK-COZY", desc: "18 cozy stickers: cats, coffees, moons, daisies.", price: 45, qty: 1, category: "sticker sheet", img: "images/sticker-cozy.jpg", badge: null, outOfStock: false },
    { id: "cats", name: "Cat Emotions Pack", sku: "STK-CATS", desc: "6 die-cut cat stickers in different moods.", price: 35, qty: 1, category: "sticker sheet", img: "images/sticker-cats.jpg", badge: "new", outOfStock: false },
    { id: "celes", name: "Celestial Art Poster A4", sku: "PST-CELES", desc: "Heavyweight matte botanical art poster.", price: 65, qty: 1, category: "posters", img: "images/sticker-celestial.jpg", badge: null, outOfStock: false },
    { id: "food", name: "Boba Cat Single Sticker", sku: "STK-SNGL-1", desc: "Individual die-cut vinyl sticker for your hydroflask.", price: 15, qty: 1, category: "single stickers", img: "images/sticker-food.jpg", badge: null, outOfStock: false },
  ];
}

function initShopControls() {
  const filterPills = document.querySelectorAll(".filter-pill");
  const searchInput = document.getElementById("shop-search-input");

  filterPills.forEach(pill => {
    pill.addEventListener("click", () => {
      filterPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeCategory = (pill.getAttribute("data-category") || "all").toLowerCase().trim();
      renderProducts();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderProducts();
    });
  }
}

// ── PROTECTED IN-MEMORY CANVAS RENDERER (Hides image links from DOM / Inspect Tab) ──
function renderProtectedGraphic(canvasEl, rawUrl, fit = "contain") {
  if (!canvasEl || !rawUrl) return;
  const ctx = canvasEl.getContext("2d");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.referrerPolicy = "no-referrer";

  img.onload = () => {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if (fit === "contain") {
      const pad = Math.round(canvasEl.width * 0.05);
      const w = canvasEl.width - pad * 2;
      const h = canvasEl.height - pad * 2;
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = pad + (w - dw) / 2;
      const dy = pad + (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      const scale = Math.max(canvasEl.width / img.naturalWidth, canvasEl.height / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = (canvasEl.width - dw) / 2;
      const dy = (canvasEl.height - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  };

  img.onerror = () => {
    // If CORS prevents canvas drawImage, load via memory background
    canvasEl.style.backgroundImage = `url("${rawUrl}")`;
    canvasEl.style.backgroundSize = fit === "contain" ? "contain" : "cover";
    canvasEl.style.backgroundPosition = "center";
    canvasEl.style.backgroundRepeat = "no-repeat";
  };

  img.src = rawUrl;
}

function renderProducts() {
  const grid = document.getElementById("products-grid");
  if (!grid) return;

  const isHomePage = document.getElementById("featured") !== null && !document.querySelector(".shop-controls");

  let filtered = PRODUCTS;

  if (isHomePage) {
    // Show only 4 Best Sellers on the Home page
    const bestSellers = PRODUCTS.filter(p => p.badge === "bestseller");
    const others = PRODUCTS.filter(p => p.badge !== "bestseller");
    filtered = [...bestSellers, ...others].slice(0, 4);
  } else {
    // 3-Category Filter Logic: 'posters', 'single stickers', 'sticker sheet', or 'all'
    if (activeCategory && activeCategory !== "all") {
      filtered = filtered.filter(p => {
        const cat = (p.category || "").toLowerCase();
        if (activeCategory === "posters") {
          return cat.includes("poster");
        }
        if (activeCategory === "single stickers" || activeCategory === "single") {
          return cat.includes("single");
        }
        if (activeCategory === "sticker sheet" || activeCategory === "sheet") {
          return cat.includes("sheet") || cat.includes("pack");
        }
        return cat === activeCategory;
      });
    }

    if (searchQuery) {
      filtered = filtered.filter(p => {
        const text = (p.name + " " + p.sku + " " + (p.category || "") + " " + p.desc).toLowerCase();
        return text.includes(searchQuery);
      });
    }
  }

  grid.innerHTML = "";

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="products-empty">
        <p>No items found matching your selection.</p>
      </div>`;
    return;
  }

  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card" + (p.outOfStock ? " sold-out" : "");
    card.setAttribute("data-id", p.id);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `View ${p.name}`);
    const isCover = p.fit === "cover";
    const fitClass = isCover ? "fit-cover" : "fit-contain zoomed-out";

    card.innerHTML = `
      <div class="card-img-wrap ${fitClass}">
        <canvas class="card-canvas" width="400" height="400" role="img" aria-label="${p.name}"></canvas>
        ${p.badge ? `<span class="card-badge ${p.badge === "sold out" ? "badge-sold" : ""}">${p.badge}</span>` : ""}
      </div>
      <div class="card-body">
        <div class="card-name">${p.name}</div>
        <div class="card-pieces">${p.qty > 0 ? `${p.qty} in stock` : "out of stock"}</div>
        <div class="card-bottom">
          <span class="card-price">${p.price > 0 ? p.price + " EGP" : "Price TBD"}</span>
          <button type="button" class="card-add-btn ${p.outOfStock ? "disabled" : ""}" aria-label="Quick add ${p.name}" data-id="${p.id}" ${p.outOfStock ? "disabled" : ""}>
            <i data-lucide="plus" class="icon-sm"></i>
          </button>
        </div>
      </div>
    `;

    const canvas = card.querySelector(".card-canvas");
    if (canvas) {
      renderProtectedGraphic(canvas, p.img, isCover ? "cover" : "contain");
    }

    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-add-btn")) {
        e.stopPropagation();
        if (!p.outOfStock) quickAddToCart(p.id);
        return;
      }
      openProductModal(p.id);
    });

    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openProductModal(p.id);
      }
    });

    grid.appendChild(card);
  });

  renderIcons();
}

// ══════════════════════════════════════════════════════
// PRODUCT MODAL & QUANTITY SELECTOR
// ══════════════════════════════════════════════════════
function initProductModal() {
  const overlay = document.getElementById("product-modal");
  const closeBtn = document.getElementById("modal-close");
  const minusBtn = document.getElementById("modal-qty-minus");
  const plusBtn = document.getElementById("modal-qty-plus");
  const qtyInput = document.getElementById("modal-qty");
  const addBtn = document.getElementById("modal-add-btn");
  if (!overlay) return;

  if (closeBtn) closeBtn.addEventListener("click", closeProductModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeProductModal(); });

  if (minusBtn && qtyInput) {
    minusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const current = parseInt(qtyInput.value, 10) || 1;
      const next = Math.max(1, current - 1);
      qtyInput.value = next;
    });
  }

  if (plusBtn && qtyInput) {
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const current = parseInt(qtyInput.value, 10) || 1;
      const maxLimit = (currentProduct && currentProduct.qty > 0) ? currentProduct.qty : 99;
      const next = Math.min(maxLimit, current + 1);
      qtyInput.value = next;
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (!currentProduct || currentProduct.outOfStock) return;
      const qty = parseInt(qtyInput.value, 10) || 1;
      addToCart(currentProduct.id, qty);
      closeProductModal();
      openCart();
    });
  }

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeProductModal();
      closeCheckout();
      closeAccountModal();
      closeCart();
      closeMobileMenu();
    }
  });
}

function openProductModal(productId) {
  closeAllDrawersAndMenus();
  const p = PRODUCTS.find(x => String(x.id) === String(productId)) || getFallbackProducts().find(x => String(x.id) === String(productId));
  if (!p) return;
  currentProduct = p;

  const canvasEl = document.getElementById("modal-main-canvas");
  const imgEl = document.getElementById("modal-main-img");
  const nameEl = document.getElementById("modal-product-name");
  const descEl = document.getElementById("modal-desc");
  const priceEl = document.getElementById("modal-price");
  const piecesEl = document.getElementById("modal-pieces");
  const qtyInput = document.getElementById("modal-qty");
  const addBtn = document.getElementById("modal-add-btn");

  if (canvasEl) {
    canvasEl.className = "modal-main-canvas " + (p.fit === "cover" ? "fit-cover" : "fit-contain");
    renderProtectedGraphic(canvasEl, p.img, p.fit === "cover" ? "cover" : "contain");
  } else if (imgEl) {
    imgEl.src = p.img;
    imgEl.className = "modal-main-img " + (p.fit === "cover" ? "fit-cover" : "fit-contain");
  }

  if (nameEl) nameEl.textContent = p.name;
  if (descEl) descEl.textContent = p.desc;
  if (priceEl) priceEl.textContent = p.price > 0 ? p.price + " EGP" : "Price TBD";
  if (piecesEl) piecesEl.textContent = p.qty > 0 ? `${p.qty} in stock · ${p.category}` : "Out of stock";
  if (qtyInput) qtyInput.value = 1;

  if (addBtn) {
    addBtn.disabled = p.outOfStock;
    addBtn.innerHTML = p.outOfStock
      ? "sold out"
      : `<i data-lucide="shopping-bag" class="icon-sm"></i> add to cart`;
  }

  const modal = document.getElementById("product-modal");
  if (modal) modal.classList.add("open");
  updateBodyScrollLock();
  renderIcons();
}

function closeProductModal() {
  const modal = document.getElementById("product-modal");
  if (modal) modal.classList.remove("open");
  currentProduct = null;
  updateBodyScrollLock();
}

// ══════════════════════════════════════════════════════
// CART DRAWER (Persistent Across Pages)
// ══════════════════════════════════════════════════════
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem("static_cart");
    if (saved) {
      cart = JSON.parse(saved);
      updateCartUI();
    }
  } catch (_) {}
}

function saveCartToStorage() {
  localStorage.setItem("static_cart", JSON.stringify(cart));
}

function initCartDrawer() {
  const cartBtn = document.getElementById("cart-btn");
  const cartClose = document.getElementById("cart-close");
  const cartOverlay = document.getElementById("cart-overlay");
  const checkoutBtn = document.getElementById("cart-checkout-btn");
  const cartItems = document.getElementById("cart-items");

  if (cartBtn) cartBtn.addEventListener("click", () => {
    closeMobileMenu();
    openCart();
  });
  if (cartClose) cartClose.addEventListener("click", closeCart);
  if (cartOverlay) cartOverlay.addEventListener("click", closeCart);
  if (checkoutBtn) checkoutBtn.addEventListener("click", () => {
    closeCart();
    openCheckout();
  });

  if (cartItems) {
    cartItems.addEventListener("click", handleCartControls);
  }
}

function openCart() {
  closeMobileMenu();
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (!drawer || !overlay) return;

  drawer.classList.add("open");
  overlay.classList.add("open");
  updateBodyScrollLock();
  renderIcons();
}

window.closeCart = function () {
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (drawer) drawer.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
  updateBodyScrollLock();
};

function quickAddToCart(productId) {
  addToCart(productId, 1);
  openCart();
}

function addToCart(productId, qty = 1) {
  let p = PRODUCTS.find(x => String(x.id) === String(productId)) || getFallbackProducts().find(x => String(x.id) === String(productId));
  if (!p && currentProduct && String(currentProduct.id) === String(productId)) {
    p = currentProduct;
  }
  if (!p) {
    p = cart.find(x => String(x.id) === String(productId));
  }
  if (!p || p.outOfStock) return;

  const existing = cart.find(i => String(i.id) === String(productId));
  const maxStock = (p.qty && p.qty > 0) ? p.qty : 99;

  if (existing) {
    existing.qty = Math.min((existing.qty || 1) + qty, maxStock);
    if (!existing.img && p.img) existing.img = p.img;
    if (!existing.name && p.name) existing.name = p.name;
    if (!existing.price && p.price) existing.price = p.price;
  } else {
    cart.push({
      id: p.id,
      stockId: p.stockId || p.id,
      name: p.name || "Sticker Item",
      price: Number(p.price) || 0,
      qty: Math.min(qty, maxStock),
      img: p.img || getProductImage(p.name, p.sku) || "images/1111-removebg-preview.png",
      category: p.category || "single stickers",
      sku: p.sku || "",
    });
  }

  saveCartToStorage();
  updateCartUI();
  showToast(`${p.name || 'Item'} added to cart ✦`);
}

function removeFromCart(productId) {
  cart = cart.filter(i => String(i.id) !== String(productId));
  saveCartToStorage();
  updateCartUI();
}

function changeQty(productId, delta) {
  const item = cart.find(i => String(i.id) === String(productId));
  if (!item) return;
  const prod = PRODUCTS.find(p => String(p.id) === String(productId));
  const maxQty = (prod && prod.qty > 0) ? prod.qty : 99;

  const next = item.qty + delta;
  if (next <= 0) {
    removeFromCart(productId);
  } else {
    item.qty = Math.min(maxQty, next);
    saveCartToStorage();
    updateCartUI();
  }
}

function handleCartControls(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");

  if (action === "minus") changeQty(id, -1);
  else if (action === "plus") changeQty(id, 1);
  else if (action === "remove") removeFromCart(id);
}

function updateCartUI() {
  const totalQty = cart.reduce((s, i) => s + (i.qty || 1), 0);
  const badge = document.getElementById("cart-count");
  if (badge) {
    badge.textContent = totalQty;
    badge.classList.remove("bump");
    void badge.offsetWidth;
    if (totalQty > 0) badge.classList.add("bump");
    setTimeout(() => badge.classList.remove("bump"), 400);
  }

  const emptyEl = document.getElementById("cart-empty");
  let listEl = document.getElementById("cart-list");
  const footerEl = document.getElementById("cart-footer");
  const cartItemsContainer = document.getElementById("cart-items");

  if (!listEl && cartItemsContainer) {
    listEl = document.createElement("div");
    listEl.className = "cart-list";
    listEl.id = "cart-list";
    cartItemsContainer.appendChild(listEl);
  }

  if (cart.length === 0) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    if (listEl) listEl.innerHTML = "";
    if (footerEl) footerEl.style.display = "none";
    renderIcons();
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");
  if (footerEl) footerEl.style.display = "block";

  if (listEl) {
    listEl.innerHTML = cart.map(item => {
      const imgSrc = item.img || getProductImage(item.name, item.sku) || "images/1111-removebg-preview.png";
      const itemPrice = Number(item.price) || 0;
      return `
        <div class="cart-item">
          <img class="cart-item-img" src="${imgSrc}" alt="${item.name || 'Sticker'}" onerror="this.src='images/1111-removebg-preview.png'" />
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name || 'Sticker'}</div>
            <div class="cart-item-price">${itemPrice > 0 ? itemPrice + " EGP each" : "Price TBD"}</div>
          </div>
          <div class="cart-item-controls">
            <button type="button" class="ci-qty-btn" aria-label="Decrease quantity" data-id="${item.id}" data-action="minus">
              <i data-lucide="minus" class="icon-xs"></i>
            </button>
            <span class="ci-qty">${item.qty || 1}</span>
            <button type="button" class="ci-qty-btn" aria-label="Increase quantity" data-id="${item.id}" data-action="plus">
              <i data-lucide="plus" class="icon-xs"></i>
            </button>
            <button type="button" class="ci-remove" aria-label="Remove item" data-id="${item.id}" data-action="remove">
              <i data-lucide="trash-2" class="icon-xs"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  const subtotal = cart.reduce((s, i) => s + ((Number(i.price) || 0) * (i.qty || 1)), 0);
  const subtotalEl = document.getElementById("cart-subtotal");
  if (subtotalEl) {
    subtotalEl.textContent = subtotal > 0 ? subtotal + " EGP" : "0 EGP";
  }

  renderIcons();
}

// ══════════════════════════════════════════════════════
// CHECKOUT MODAL (4 steps)
// ══════════════════════════════════════════════════════
let checkoutStep = 1;

function initCheckout() {
  const closeBtn = document.getElementById("checkout-close");
  const modal = document.getElementById("checkout-modal");
  if (!modal) return;

  if (closeBtn) closeBtn.addEventListener("click", closeCheckout);
  modal.addEventListener("click", e => {
    if (e.target === modal) closeCheckout();
  });

  const nextBtn = document.getElementById("checkout-next-btn");
  const payBack = document.getElementById("payment-back-btn");
  const payNext = document.getElementById("payment-next-btn");
  const reviewBack = document.getElementById("checkout-back-btn");
  const placeBtn = document.getElementById("checkout-place-btn");
  const doneBtn = document.getElementById("confirm-done-btn");

  if (nextBtn) nextBtn.addEventListener("click", validateAndGoToPayment);
  if (payBack) payBack.addEventListener("click", () => setCheckoutStep(1));
  if (payNext) payNext.addEventListener("click", goToReview);
  if (reviewBack) reviewBack.addEventListener("click", () => setCheckoutStep(2));
  if (placeBtn) placeBtn.addEventListener("click", placeOrder);
  if (doneBtn) doneBtn.addEventListener("click", () => {
    cart = [];
    saveCartToStorage();
    updateCartUI();
    closeCheckout();
  });

  document.querySelectorAll(".payment-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".payment-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      currentPaymentMethod = opt.getAttribute("data-method");

      const vPanel = document.getElementById("vodafone-panel");
      const cPanel = document.getElementById("card-panel");
      if (vPanel) vPanel.classList.toggle("hidden", currentPaymentMethod !== "vodafone");
      if (cPanel) cPanel.classList.toggle("hidden", currentPaymentMethod !== "card");
      renderIcons();
    });
  });
}

function openCheckout() {
  if (cart.length === 0) {
    showToast("Your cart is empty!");
    return;
  }
  closeAllDrawersAndMenus();
  checkoutStep = 1;
  currentPaymentMethod = null;

  if (currentUser) {
    const nameEl = document.getElementById("co-name");
    const emailEl = document.getElementById("co-email");
    const phoneEl = document.getElementById("co-phone");
    const addrEl = document.getElementById("co-address");
    if (nameEl && !nameEl.value) nameEl.value = currentUser.name || "";
    if (emailEl && !emailEl.value) emailEl.value = currentUser.email || "";
    if (phoneEl && !phoneEl.value) phoneEl.value = currentUser.phone || "";
    if (addrEl && !addrEl.value) addrEl.value = currentUser.address || "";
  }

  setCheckoutStep(1);
  const modal = document.getElementById("checkout-modal");
  if (modal) modal.classList.add("open");
  updateBodyScrollLock();
  renderIcons();
}

function closeCheckout() {
  if (checkoutStep === 4) {
    cart = [];
    saveCartToStorage();
    updateCartUI();
  }
  const modal = document.getElementById("checkout-modal");
  if (modal) modal.classList.remove("open");
  updateBodyScrollLock();
}

function setCheckoutStep(n) {
  checkoutStep = n;
  [1, 2, 3, 4].forEach(i => {
    const step = document.getElementById(`checkout-step-${i}`);
    if (step) step.classList.toggle("hidden", i !== n);
    const ind = document.getElementById(`step-ind-${i}`);
    if (ind) {
      ind.classList.toggle("active", i === n);
      ind.classList.toggle("done", i < n);
    }
  });
  renderIcons();
}

function validateAndGoToPayment() {
  const name = (document.getElementById("co-name")?.value || "").trim();
  const phone = (document.getElementById("co-phone")?.value || "").trim();
  const email = (document.getElementById("co-email")?.value || "").trim();
  const address = (document.getElementById("co-address")?.value || "").trim();
  const note = (document.getElementById("co-note")?.value || "").trim();

  let valid = true;
  [["co-name", name], ["co-phone", phone], ["co-address", address]].forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle("error", !val);
      if (!val) valid = false;
    }
  });

  if (!valid) {
    showToast("Please fill in your name, phone and address");
    return;
  }

  customerData = { name, phone, email, address, note };
  setCheckoutStep(2);
}

function goToReview() {
  if (!currentPaymentMethod) {
    showToast("Please select a payment method");
    return;
  }
  populateReview();
  setCheckoutStep(3);
}

function populateReview() {
  const itemsEl = document.getElementById("review-items");
  if (itemsEl) {
    itemsEl.innerHTML = cart.map(item => `
      <div class="review-item">
        <img src="${item.img}" alt="${item.name}" />
        <div class="review-item-info">
          <div>${item.name} &times; ${item.qty}</div>
        </div>
        <div class="review-item-price">${item.price > 0 ? (item.price * item.qty) + " EGP" : "TBD"}</div>
      </div>
    `).join("");
  }

  const subtotal = cart.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
  const shippingFee = 50; // Flat 50 EGP to Alexandria
  const total = subtotal + shippingFee;
  const methodLabel = currentPaymentMethod === "vodafone" ? "Vodafone Cash" : "Card Payment";

  const totalsEl = document.getElementById("review-totals");
  if (totalsEl) {
    totalsEl.innerHTML = `
      <div class="review-total-row"><span>subtotal</span><span>${subtotal > 0 ? subtotal + " EGP" : "0 EGP"}</span></div>
      <div class="review-total-row"><span>shipping (alexandria only)</span><span>${shippingFee} EGP</span></div>
      <div class="review-total-row"><span>payment method</span><span>${methodLabel}</span></div>
      <div class="review-total-row grand"><span>total</span><span>${total} EGP</span></div>
    `;
  }

  const custEl = document.getElementById("review-customer");
  if (custEl) {
    custEl.innerHTML = `
      <strong style="font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--coffee-500)">delivery details</strong><br/>
      <strong>${customerData.name}</strong> &middot; ${customerData.phone}${customerData.email ? " &middot; " + customerData.email : ""}<br/>
      ${customerData.address}
      ${customerData.note ? `<br/><em style="color:var(--coffee-400);font-size:.82rem">Note: ${customerData.note}</em>` : ""}
    `;
  }
}

async function placeOrder() {
  const btn = document.getElementById("checkout-place-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="icon-sm" style="animation:spin 1s linear infinite"></i> placing order...`;
    renderIcons();
  }

  const items = cart.map(i => ({
    name: i.name,
    qty: i.qty || 1,
    price: i.price || 0,
    sku: i.sku || "",
  }));

  const payload = {
    customerName: customerData.name,
    phone: customerData.phone,
    email: customerData.email || null,
    address: customerData.address,
    items,
    shippingPrice: 50,
    paymentMethod: currentPaymentMethod === "vodafone" ? "Vodafone Cash" : "Card",
    note: customerData.note || null,
  };

  let orderId = null;
  try {
    const res = await fetch(`${EXPENSE_API}/api/orders/storefront`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      orderId = data.id || null;
    }
  } catch (err) {
    console.error("Order placement error:", err);
  }

  showConfirmation(orderId);
  if (btn) btn.disabled = false;
}

function showConfirmation(orderId) {
  setCheckoutStep(4);
  const msgEl = document.getElementById("confirm-msg");
  const idEl = document.getElementById("confirm-order-id");
  const noteEl = document.getElementById("confirm-payment-note");

  if (msgEl) {
    msgEl.textContent = orderId
      ? `Your order #${orderId} has been placed! We'll reach out to confirm delivery details.`
      : `Your order has been placed! We'll reach out to confirm delivery details.`;
  }

  if (idEl) {
    idEl.textContent = orderId ? `Order ID: #${orderId}` : "";
  }

  if (noteEl) {
    if (currentPaymentMethod === "vodafone") {
      noteEl.innerHTML = `
        <div class="confirm-payment-box vodafone-box">
          <strong>Send payment via Vodafone Cash</strong>
          <div class="vcash-number">${VODAFONE_CASH_NUMBER}</div>
          <p>Send the total to the number above and we'll confirm your order once received.</p>
        </div>
      `;
    } else {
      noteEl.innerHTML = `
        <div class="confirm-payment-box card-box">
          <strong>Card payment</strong>
          <p>Our team will contact you directly to complete your card payment securely.</p>
        </div>
      `;
    }
  }
  renderIcons();
}

// ══════════════════════════════════════════════════════
// CONTACT & NEWSLETTER FORMS
// ══════════════════════════════════════════════════════
function initContactForm() {
  const contactForm = document.getElementById("contact-form");
  if (!contactForm) return;

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("contact-submit") || contactForm.querySelector("button[type='submit']");
    const name = (document.getElementById("contact-name")?.value || "").trim();
    const email = (document.getElementById("contact-email")?.value || "").trim();
    const phone = (document.getElementById("contact-phone")?.value || "").trim() || "Not provided";
    const msg = (document.getElementById("contact-msg")?.value || "").trim();

    if (!name || !email || !msg) {
      showToast("Please fill in your name, email and message");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="icon-sm" style="animation:spin 1s linear infinite"></i> sending message...`;
      renderIcons();
    }

    try {
      const res = await fetch("https://formsubmit.co/ajax/omarstatic2@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          message: msg,
          _subject: `New STATIC Website Inquiry from ${name}`,
          _template: "table",
        }),
      });

      if (res.ok) {
        showToast(`Message sent to omarstatic2@gmail.com! We'll reply shortly ✦`, 4000);
        contactForm.reset();
      } else {
        contactForm.submit();
      }
    } catch (err) {
      try {
        contactForm.submit();
      } catch (_) {
        showToast(`Message sent to omarstatic2@gmail.com! We'll reply shortly ✦`);
        contactForm.reset();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `send message <i data-lucide="send" class="icon-sm"></i>`;
        renderIcons();
      }
    }
  });
}

window.handleNewsletter = function (e) {
  e.preventDefault();
  const input = document.getElementById("newsletter-email");
  if (!input) return;
  const email = input.value.trim();
  if (!email) return;
  showToast("You're on the list! ✦");
  input.value = "";
};

// ══════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════
function createToastContainer() {
  if (document.getElementById("toast-container")) return;
  const c = document.createElement("div");
  c.className = "toast-container";
  c.id = "toast-container";
  document.body.appendChild(c);
}

function showToast(msg, duration = 2800) {
  createToastContainer();
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, duration);
}

// ── ANTI-THEFT: PREVENT DEVTOOLS / INSPECT SHORTCUTS ──
document.addEventListener("keydown", e => {
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
    (e.ctrlKey && (e.key === "U" || e.key === "u" || e.key === "S" || e.key === "s"))
  ) {
    e.preventDefault();
  }
});
