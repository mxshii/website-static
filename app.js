/* ═══════════════════════════════════════════════════════
   STATIC — app.js
   - Loads products from expense-system /api/stock/public
   - Cart + product modal
   - Customer accounts (register / login)
   - Checkout: details → payment → review → done
   - Orders POST to /api/orders/storefront (no credentials)
   ═══════════════════════════════════════════════════════ */

const EXPENSE_API = "https://expense-sys-ten.vercel.app";
const VODAFONE_CASH_NUMBER = "01005792211";

// ── STATE ─────────────────────────────────────────────
let PRODUCTS = [];           // loaded from stock API
let cart = [];
let currentProduct = null;
let customerData = {};
let currentPaymentMethod = null; // "vodafone" | "card"
let currentUser = null;      // logged-in customer

// ── INIT ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  createToastContainer();
  initNavbar();
  initMobileMenu();
  loadCurrentUser();
  loadProducts();            // fetch from expense-system
  updateCartUI();
  initProductModal();
  initCartDrawer();
  initCheckout();
  initAccountModal();
});

// ══════════════════════════════════════════════════════
// NAVBAR
// ══════════════════════════════════════════════════════
function initNavbar() {
  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 40);
  });
}

function initMobileMenu() {
  const btn = document.getElementById("mobile-menu-btn");
  const menu = document.getElementById("mobile-menu");
  if (!btn || !menu) return;
  btn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });
  menu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => menu.classList.remove("open"));
  });
}

// ══════════════════════════════════════════════════════
// CUSTOMER AUTH
// ══════════════════════════════════════════════════════
function loadCurrentUser() {
  try {
    const saved = localStorage.getItem("static_customer");
    if (saved) {
      const parsed = JSON.parse(saved);
      currentUser = parsed;
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
    `Delete your account (${currentUser.email})?\n\nThis cannot be undone. Your order history will be lost.`
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
  if (!btn || !label) return;
  if (currentUser) {
    label.textContent = currentUser.name.split(" ")[0];
    btn.title = "My account";
  } else {
    label.textContent = "sign in";
    btn.title = "Sign in or create account";
  }
}

function initAccountModal() {
  const btn = document.getElementById("account-btn");
  const modal = document.getElementById("account-modal");
  const closeBtn = document.getElementById("account-modal-close");
  if (!btn || !modal) return;

  btn.addEventListener("click", () => {
    if (currentUser) {
      openMyAccount();
    } else {
      openAccountModal("login");
    }
  });
  closeBtn.addEventListener("click", closeAccountModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeAccountModal(); });

  document.getElementById("switch-to-register").addEventListener("click", () => openAccountModal("register"));
  document.getElementById("switch-to-login").addEventListener("click", () => openAccountModal("login"));
  document.getElementById("account-logout-btn").addEventListener("click", () => { logoutUser(); closeAccountModal(); });
  document.getElementById("account-delete-btn").addEventListener("click", deleteMyAccount);

  document.getElementById("register-form").addEventListener("submit", handleRegister);
  document.getElementById("login-form").addEventListener("submit", handleLogin);
}

function openAccountModal(tab = "login") {
  const modal = document.getElementById("account-modal");
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  showAccountTab(tab);
}

function closeAccountModal() {
  document.getElementById("account-modal").classList.remove("open");
  document.body.style.overflow = "";
}

function openMyAccount() {
  const modal = document.getElementById("account-modal");
  showAccountTab("profile");
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  // Populate profile
  document.getElementById("profile-name").textContent = currentUser.name;
  document.getElementById("profile-email").textContent = currentUser.email;
  // Load orders
  loadMyOrders();
}

function showAccountTab(tab) {
  ["login-pane", "register-pane", "profile-pane"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  const pane = document.getElementById(tab + "-pane");
  if (pane) pane.classList.remove("hidden");
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById("register-submit");
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const phone = document.getElementById("reg-phone").value.trim();
  const errEl = document.getElementById("register-error");
  errEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "creating account...";
  try {
    const res = await fetch(`${EXPENSE_API}/api/customers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }
    saveCurrentUser(data.customer, data.token);
    closeAccountModal();
    showToast(`Welcome, ${data.customer.name.split(" ")[0]}! ✦`);
  } catch (_) {
    errEl.textContent = "Something went wrong. Try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "create account";
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("login-submit");
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "signing in...";
  try {
    const res = await fetch(`${EXPENSE_API}/api/customers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }
    saveCurrentUser(data.customer, data.token);
    closeAccountModal();
    showToast(`Welcome back, ${data.customer.name.split(" ")[0]}! ✦`);
  } catch (_) {
    errEl.textContent = "Something went wrong. Try again.";
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
    if (!orders.length) {
      container.innerHTML = "<p style='color:var(--coffee-400);font-size:.85rem'>No orders yet. Go shop!</p>";
      return;
    }
    container.innerHTML = orders.map(o => `
      <div class="profile-order-card">
        <div class="profile-order-head">
          <span class="profile-order-id">#${o.id}</span>
          <span class="profile-order-status ${o.paymentStatus}">${o.paymentStatus}</span>
        </div>
        <div class="profile-order-items">${(o.items || []).map(i => `${i.itemName} ×${i.quantity}`).join(", ")}</div>
        <div class="profile-order-date">${new Date(o.createdAt).toLocaleDateString("en-GB")}</div>
      </div>
    `).join("");
  } catch (_) {
    container.innerHTML = "<p style='color:var(--coffee-400);font-size:.85rem'>Could not load orders.</p>";
  }
}

// ══════════════════════════════════════════════════════
// LOAD PRODUCTS FROM EXPENSE SYSTEM STOCK
// ══════════════════════════════════════════════════════
async function loadProducts() {
  const grid = document.getElementById("products-grid");
  grid.innerHTML = `
    <div class="products-loading">
      <div class="loading-spinner"></div>
      <p>Loading products...</p>
    </div>`;

  try {
    const res = await fetch(`${EXPENSE_API}/api/stock/public`);
    const stock = await res.json();

    if (!stock.length) {
      grid.innerHTML = `<div class="products-empty"><p>Products coming soon — check back shortly!</p></div>`;
      return;
    }

    // Map stock items to product objects
    PRODUCTS = stock.map(item => ({
      id: item.id,
      name: item.itemName,
      sku: item.sku || "",
      desc: `${item.itemName} — a hand-illustrated sticker pack from STATIC. Waterproof vinyl, die-cut, shipped from Cairo.`,
      price: item.price || 0,
      qty: item.quantity,
      img: getProductImage(item.itemName, item.sku),
      badge: item.quantity > 0 && item.quantity <= 5 ? "low stock" : item.quantity === 0 ? "sold out" : null,
      outOfStock: item.quantity === 0,
    }));

    renderProducts();
  } catch (err) {
    console.error("Failed to load stock:", err);
    // Fallback to placeholder products
    PRODUCTS = getFallbackProducts();
    renderProducts();
  }
}

function getProductImage(name, sku) {
  const n = (name + " " + (sku || "")).toLowerCase();
  if (n.includes("cat") || n.includes("feline")) return "images/sticker-cats.jpg";
  if (n.includes("celestial") || n.includes("botanical") || n.includes("moon") || n.includes("star")) return "images/sticker-celestial.jpg";
  if (n.includes("food") || n.includes("ramen") || n.includes("boba") || n.includes("foodi")) return "images/sticker-food.jpg";
  return "images/sticker-cozy.jpg"; // default
}

function getFallbackProducts() {
  return [
    { id: "cozy", name: "Kawaii Cozy Pack", sku: "STK-COZY", desc: "18 cozy stickers: cats, coffees, moons, daisies.", price: 0, qty: 99, img: "images/sticker-cozy.jpg", badge: null, outOfStock: false },
    { id: "cats", name: "Cat Emotions Pack", sku: "STK-CATS", desc: "6 die-cut cat stickers in different moods.", price: 0, qty: 99, img: "images/sticker-cats.jpg", badge: "new", outOfStock: false },
    { id: "celes", name: "Celestial & Botanical", sku: "STK-CELES", desc: "Suns, moons, mushrooms and cosmic sparkles.", price: 0, qty: 99, img: "images/sticker-celestial.jpg", badge: null, outOfStock: false },
    { id: "food", name: "Foodie Friends Pack", sku: "STK-FOOD", desc: "Ramen, boba, croissants, ice cream and more.", price: 0, qty: 99, img: "images/sticker-food.jpg", badge: null, outOfStock: false },
  ];
}

// ══════════════════════════════════════════════════════
// RENDER PRODUCTS
// ══════════════════════════════════════════════════════
function renderProducts() {
  const grid = document.getElementById("products-grid");
  grid.innerHTML = "";
  PRODUCTS.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card" + (p.outOfStock ? " sold-out" : "");
    card.setAttribute("data-id", p.id);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `View ${p.name}`);
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${p.img}" alt="${p.name}" loading="lazy" />
        ${p.badge ? `<span class="card-badge ${p.badge === "sold out" ? "badge-sold" : ""}">${p.badge}</span>` : ""}
        <div class="card-explore"><span>explore</span></div>
      </div>
      <div class="card-body">
        <div class="card-name">${p.name}</div>
        <div class="card-pieces">${p.qty > 0 ? `${p.qty} in stock` : "out of stock"}</div>
        <div class="card-bottom">
          <span class="card-price">${p.price > 0 ? p.price + " EGP" : "Price TBD"}</span>
          <button class="card-add-btn ${p.outOfStock ? "disabled" : ""}" aria-label="Quick add ${p.name}" data-id="${p.id}" ${p.outOfStock ? "disabled" : ""}>
            <i data-lucide="plus" style="width:16px;height:16px"></i>
          </button>
        </div>
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-add-btn")) {
        e.stopPropagation();
        if (!p.outOfStock) quickAddToCart(p.id);
        return;
      }
      openProductModal(p.id);
    });
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openProductModal(p.id); });
    grid.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

// ══════════════════════════════════════════════════════
// PRODUCT MODAL
// ══════════════════════════════════════════════════════
function initProductModal() {
  const overlay = document.getElementById("product-modal");
  const closeBtn = document.getElementById("modal-close");
  const minusBtn = document.getElementById("modal-qty-minus");
  const plusBtn = document.getElementById("modal-qty-plus");
  const qtyInput = document.getElementById("modal-qty");
  const addBtn = document.getElementById("modal-add-btn");

  closeBtn.addEventListener("click", closeProductModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeProductModal(); });

  minusBtn.addEventListener("click", () => { qtyInput.value = Math.max(1, +qtyInput.value - 1); });
  plusBtn.addEventListener("click", () => { qtyInput.value = Math.min(10, +qtyInput.value + 1); });
  addBtn.addEventListener("click", () => {
    if (!currentProduct || currentProduct.outOfStock) return;
    const qty = parseInt(qtyInput.value, 10) || 1;
    addToCart(currentProduct.id, qty);
    closeProductModal();
    openCart();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeProductModal(); closeCheckout(); closeAccountModal(); }
  });
}

function openProductModal(productId) {
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p) return;
  currentProduct = p;

  document.getElementById("modal-main-img").src = p.img;
  document.getElementById("modal-main-img").alt = p.name;
  document.getElementById("modal-product-name").textContent = p.name;
  document.getElementById("modal-desc").textContent = p.desc;
  document.getElementById("modal-price").textContent = p.price > 0 ? p.price + " EGP" : "Price TBD";
  document.getElementById("modal-pieces").textContent = p.qty > 0 ? `${p.qty} in stock` : "Out of stock";
  document.getElementById("modal-qty").value = 1;

  const addBtn = document.getElementById("modal-add-btn");
  addBtn.disabled = p.outOfStock;
  addBtn.textContent = p.outOfStock ? "sold out" : "add to cart";

  document.getElementById("product-modal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeProductModal() {
  document.getElementById("product-modal").classList.remove("open");
  document.body.style.overflow = "";
  currentProduct = null;
}

// ══════════════════════════════════════════════════════
// CART
// ══════════════════════════════════════════════════════
function initCartDrawer() {
  document.getElementById("cart-btn").addEventListener("click", openCart);
  document.getElementById("cart-close").addEventListener("click", closeCart);
  document.getElementById("cart-overlay").addEventListener("click", closeCart);
  document.getElementById("cart-checkout-btn").addEventListener("click", () => { closeCart(); openCheckout(); });
  // Single delegated listener for all cart item controls — set up once, never re-bound
  document.getElementById("cart-items").addEventListener("click", handleCartControls);
}

function openCart() {
  document.getElementById("cart-drawer").classList.add("open");
  document.getElementById("cart-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

window.closeCart = function () {
  document.getElementById("cart-drawer").classList.remove("open");
  document.getElementById("cart-overlay").classList.remove("open");
  document.body.style.overflow = "";
};

function quickAddToCart(productId) {
  addToCart(productId, 1);
  openCart();
}

function addToCart(productId, qty = 1) {
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p || p.outOfStock) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, p.qty, 10);
  } else {
    cart.push({ ...p, qty });
  }
  updateCartUI();
  showToast(`${p.name} added ✦`);
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  updateCartUI();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  const maxQty = PRODUCTS.find(p => p.id === productId)?.qty || 10;
  item.qty = Math.max(0, Math.min(maxQty, item.qty + delta));
  if (item.qty === 0) removeFromCart(productId);
  else updateCartUI();
}

function updateCartUI() {
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById("cart-count");
  badge.textContent = totalQty;
  badge.classList.remove("bump");
  void badge.offsetWidth;
  if (totalQty > 0) badge.classList.add("bump");
  setTimeout(() => badge.classList.remove("bump"), 400);

  const itemsEl = document.getElementById("cart-items");
  const emptyEl = document.getElementById("cart-empty");
  const footerEl = document.getElementById("cart-footer");

  if (cart.length === 0) {
    emptyEl.style.display = "flex";
    footerEl.style.display = "none";
    itemsEl.innerHTML = "";
    itemsEl.appendChild(emptyEl);
    return;
  }
  emptyEl.style.display = "none";
  footerEl.style.display = "block";

  const fragment = document.createDocumentFragment();
  cart.forEach(item => {
    const el = document.createElement("div");
    el.className = "cart-item";
    el.innerHTML = `
      <img class="cart-item-img" src="${item.img}" alt="${item.name}" />
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${item.price > 0 ? item.price + " EGP each" : "Price TBD"}</div>
      </div>
      <div class="cart-item-controls">
        <button class="ci-qty-btn" aria-label="Decrease" data-id="${item.id}" data-action="minus">
          <i data-lucide="minus" style="width:12px;height:12px"></i>
        </button>
        <span class="ci-qty">${item.qty}</span>
        <button class="ci-qty-btn" aria-label="Increase" data-id="${item.id}" data-action="plus">
          <i data-lucide="plus" style="width:12px;height:12px"></i>
        </button>
        <button class="ci-remove" aria-label="Remove" data-id="${item.id}" data-action="remove">
          <i data-lucide="x" style="width:14px;height:14px"></i>
        </button>
      </div>
    `;
    fragment.appendChild(el);
  });
  itemsEl.innerHTML = "";
  itemsEl.appendChild(fragment);
  if (window.lucide) lucide.createIcons();

  const subtotal = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  document.getElementById("cart-subtotal").textContent = subtotal > 0 ? subtotal + " EGP" : "TBD";
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

// ══════════════════════════════════════════════════════
// CHECKOUT — 4 steps: details → payment → review → done
// ══════════════════════════════════════════════════════
let checkoutStep = 1;

function initCheckout() {
  document.getElementById("checkout-close").addEventListener("click", closeCheckout);
  document.getElementById("checkout-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("checkout-modal")) closeCheckout();
  });
  document.getElementById("checkout-next-btn").addEventListener("click", validateAndGoToPayment);
  document.getElementById("payment-back-btn").addEventListener("click", () => setCheckoutStep(1));
  document.getElementById("payment-next-btn").addEventListener("click", goToReview);
  document.getElementById("checkout-back-btn").addEventListener("click", () => setCheckoutStep(2));
  document.getElementById("checkout-place-btn").addEventListener("click", placeOrder);
  document.getElementById("confirm-done-btn").addEventListener("click", () => {
    closeCheckout();
    cart = [];
    updateCartUI();
  });

  // Payment method toggles
  document.querySelectorAll(".payment-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".payment-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      currentPaymentMethod = opt.getAttribute("data-method");
      // Show/hide relevant panels
      document.getElementById("vodafone-panel").classList.toggle("hidden", currentPaymentMethod !== "vodafone");
      document.getElementById("card-panel").classList.toggle("hidden", currentPaymentMethod !== "card");
    });
  });
}

function openCheckout() {
  if (cart.length === 0) { showToast("Your cart is empty!"); return; }
  checkoutStep = 1;
  currentPaymentMethod = null;
  // Pre-fill from logged-in customer
  if (currentUser) {
    const nameEl = document.getElementById("co-name");
    const emailEl = document.getElementById("co-email");
    const phoneEl = document.getElementById("co-phone");
    if (nameEl && !nameEl.value) nameEl.value = currentUser.name || "";
    if (emailEl && !emailEl.value) emailEl.value = currentUser.email || "";
    if (phoneEl && !phoneEl.value) phoneEl.value = currentUser.phone || "";
  }
  setCheckoutStep(1);
  document.getElementById("checkout-modal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCheckout() {
  document.getElementById("checkout-modal").classList.remove("open");
  document.body.style.overflow = "";
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
  // Re-init lucide icons in dynamic steps
  if (window.lucide) lucide.createIcons();
}

function validateAndGoToPayment() {
  const name = document.getElementById("co-name").value.trim();
  const phone = document.getElementById("co-phone").value.trim();
  const email = document.getElementById("co-email").value.trim();
  const address = document.getElementById("co-address").value.trim();
  const note = document.getElementById("co-note").value.trim();

  let valid = true;
  [["co-name", name], ["co-phone", phone], ["co-address", address]].forEach(([id, val]) => {
    const el = document.getElementById(id);
    el.classList.toggle("error", !val);
    if (!val) valid = false;
  });
  if (!valid) { showToast("Please fill in all required fields"); return; }

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
  document.getElementById("review-items").innerHTML = cart.map(item => `
    <div class="review-item">
      <img src="${item.img}" alt="${item.name}" />
      <div class="review-item-info">
        <div>${item.name} &times; ${item.qty}</div>
      </div>
      <div class="review-item-price">${item.price > 0 ? (item.price * item.qty) + " EGP" : "TBD"}</div>
    </div>
  `).join("");

  const subtotal = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const methodLabel = currentPaymentMethod === "vodafone" ? "Vodafone Cash" : "Card Payment";

  document.getElementById("review-totals").innerHTML = `
    <div class="review-total-row"><span>subtotal</span><span>${subtotal > 0 ? subtotal + " EGP" : "TBD"}</span></div>
    <div class="review-total-row"><span>shipping</span><span>calculated on delivery</span></div>
    <div class="review-total-row"><span>payment via</span><span>${methodLabel}</span></div>
    <div class="review-total-row grand"><span>total</span><span>${subtotal > 0 ? subtotal + " EGP" : "TBD"}</span></div>
  `;

  document.getElementById("review-customer").innerHTML = `
    <strong style="font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--coffee-500)">delivering to</strong><br/>
    <strong>${customerData.name}</strong> &middot; ${customerData.phone}${customerData.email ? " &middot; " + customerData.email : ""}<br/>
    ${customerData.address}
    ${customerData.note ? `<br/><em style="color:var(--coffee-400);font-size:.82rem">Note: ${customerData.note}</em>` : ""}
  `;
}

async function placeOrder() {
  const btn = document.getElementById("checkout-place-btn");
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" style="width:16px;height:16px;animation:spin 1s linear infinite"></i> placing order...`;
  if (window.lucide) lucide.createIcons();

  // Map to the field names the expense-system frontend expects: name, qty, price
  const items = cart.map(i => ({
    name: i.name,
    qty: i.qty,
    price: i.price || 0,
    sku: i.sku || "",
  }));

  const payload = {
    customerName: customerData.name,
    phone: customerData.phone,
    email: customerData.email || null,
    address: customerData.address,
    items,
    shippingPrice: 0,
    paymentMethod: currentPaymentMethod === "vodafone" ? "Vodafone Cash" : "Card",
    note: customerData.note || null,
  };

  let orderId = null;
  try {
    const res = await fetch(`${EXPENSE_API}/api/orders/storefront`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // NO credentials: "include" — cross-origin, no cookies needed
    });
    if (res.ok) {
      const data = await res.json();
      orderId = data.id || null;
    }
  } catch (err) {
    console.error("Order placement error:", err);
  }

  showConfirmation(orderId);
  btn.disabled = false;
}

function showConfirmation(orderId) {
  setCheckoutStep(4);
  const msg = orderId
    ? `Your order #${orderId} has been received! We'll reach out to confirm delivery.`
    : `Your order has been received! We'll reach out to confirm delivery details.`;
  document.getElementById("confirm-msg").textContent = msg;
  document.getElementById("confirm-order-id").textContent = orderId ? `Order ID: #${orderId}` : "";

  // Show payment instructions in confirmation
  if (currentPaymentMethod === "vodafone") {
    document.getElementById("confirm-payment-note").innerHTML = `
      <div class="confirm-payment-box vodafone-box">
        <strong>Send payment via Vodafone Cash</strong>
        <div class="vcash-number">${VODAFONE_CASH_NUMBER}</div>
        <p>Send the total amount to the number above and we'll confirm your order once received.</p>
      </div>
    `;
  } else {
    document.getElementById("confirm-payment-note").innerHTML = `
      <div class="confirm-payment-box card-box">
        <strong>Card payment</strong>
        <p>Our team will contact you with card payment details to complete your order.</p>
      </div>
    `;
  }
}

// ══════════════════════════════════════════════════════
// NEWSLETTER
// ══════════════════════════════════════════════════════
window.handleNewsletter = function (e) {
  e.preventDefault();
  const email = document.getElementById("newsletter-email").value.trim();
  if (!email) return;
  showToast("You're on the list! ✦");
  document.getElementById("newsletter-email").value = "";
};

// ══════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════
function createToastContainer() {
  const c = document.createElement("div");
  c.className = "toast-container";
  c.id = "toast-container";
  document.body.appendChild(c);
}

function showToast(msg, duration = 2800) {
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
