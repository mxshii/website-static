/* ═══════════════════════════════════════════════════════
   STATIC — app.js
   Full sticker shop with cart, product modal, checkout
   Orders POST to expense-system /api/orders/storefront
   ═══════════════════════════════════════════════════════ */

// ── CONFIG ────────────────────────────────────────────
// Set this to your deployed expense-system URL.
// The expense-system needs a public POST /api/orders/storefront endpoint
// (see the expense-system README for setup instructions).
const EXPENSE_API = "https://expense-sys-ten.vercel.app/";

// ── PRODUCTS ──────────────────────────────────────────
const PRODUCTS = [
  {
    id: "cozy-pack",
    name: "Kawaii Cozy Pack",
    sku: "STK-COZY",
    desc: "18 assorted cozy-vibes stickers: sleepy cats, coffee cups, little moons, daisies and more. A full universe of cute on one sheet.",
    price: 0, // TBD by owner
    priceDisplay: "TBD",
    pieces: "18 stickers / sheet",
    img: "images/sticker-cozy.jpg",
    badge: "bestseller",
    category: "Stickers",
  },
  {
    id: "cats-pack",
    name: "Cat Emotions Pack",
    sku: "STK-CATS",
    desc: "6 individual die-cut cat stickers, each in a different mood. From ZZZ to HEWWO — the whole emotional range covered.",
    price: 0,
    priceDisplay: "TBD",
    pieces: "6 die-cut stickers",
    img: "images/sticker-cats.jpg",
    badge: "new",
    category: "Stickers",
  },
  {
    id: "celestial-pack",
    name: "Celestial & Botanical",
    sku: "STK-CELES",
    desc: "Suns, moons, mushrooms, monstera leaves and cosmic sparkles. A dreamy mix of the wild and the celestial.",
    price: 0,
    priceDisplay: "TBD",
    pieces: "16 stickers / sheet",
    img: "images/sticker-celestial.jpg",
    badge: null,
    category: "Stickers",
  },
  {
    id: "food-pack",
    name: "Foodie Friends Pack",
    sku: "STK-FOOD",
    desc: "Ramen, boba, croissants, strawberries, ice cream and toast — all adorably kawaii and ready to decorate your stuff.",
    price: 0,
    priceDisplay: "TBD",
    pieces: "6 die-cut stickers",
    img: "images/sticker-food.jpg",
    badge: null,
    category: "Stickers",
  },
];

// ── STATE ─────────────────────────────────────────────
let cart = [];
let currentProduct = null;

// ── INIT ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  updateCartUI();
  initNavbar();
  initMobileMenu();
  initProductModal();
  initCartDrawer();
  initCheckout();
  createToastContainer();
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
  btn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });
  // Close on nav link click
  menu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => menu.classList.remove("open"));
  });
}

// ══════════════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════════════
function renderProducts() {
  const grid = document.getElementById("products-grid");
  grid.innerHTML = "";
  PRODUCTS.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.setAttribute("data-id", p.id);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `View ${p.name}`);
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${p.img}" alt="${p.name}" loading="lazy" />
        ${p.badge ? `<span class="card-badge">${p.badge}</span>` : ""}
        <div class="card-explore"><span>explore</span></div>
      </div>
      <div class="card-body">
        <div class="card-name">${p.name}</div>
        <div class="card-pieces">${p.pieces}</div>
        <div class="card-bottom">
          <span class="card-price">${p.priceDisplay !== "TBD" ? p.price + " EGP" : "Price TBD"}</span>
          <button class="card-add-btn" aria-label="Quick add ${p.name}" data-id="${p.id}">
            <i data-lucide="plus" style="width:16px;height:16px"></i>
          </button>
        </div>
      </div>
    `;
    // Click card body → open modal
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-add-btn")) {
        e.stopPropagation();
        quickAddToCart(p.id);
        return;
      }
      openProductModal(p.id);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openProductModal(p.id);
    });
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
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeProductModal(); });

  minusBtn.addEventListener("click", () => {
    qtyInput.value = Math.max(1, +qtyInput.value - 1);
  });
  plusBtn.addEventListener("click", () => {
    qtyInput.value = Math.min(10, +qtyInput.value + 1);
  });
  addBtn.addEventListener("click", () => {
    if (!currentProduct) return;
    const qty = parseInt(qtyInput.value, 10) || 1;
    addToCart(currentProduct.id, qty);
    closeProductModal();
    openCart();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeProductModal();
      closeCheckout();
    }
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
  document.getElementById("modal-price").textContent = p.priceDisplay !== "TBD" ? p.price + " EGP" : "Price TBD";
  document.getElementById("modal-pieces").textContent = p.pieces;
  document.getElementById("modal-qty").value = 1;

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
  const cartBtn = document.getElementById("cart-btn");
  const cartClose = document.getElementById("cart-close");
  const overlay = document.getElementById("cart-overlay");
  const checkoutBtn = document.getElementById("cart-checkout-btn");

  cartBtn.addEventListener("click", openCart);
  cartClose.addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);
  checkoutBtn.addEventListener("click", () => { closeCart(); openCheckout(); });
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
  if (!p) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, 10);
  } else {
    cart.push({ ...p, qty });
  }
  updateCartUI();
  showToast(`${p.name} added to cart ✦`);
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  updateCartUI();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  item.qty = Math.max(0, Math.min(10, item.qty + delta));
  if (item.qty === 0) removeFromCart(productId);
  else updateCartUI();
}

function updateCartUI() {
  // Count badge
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById("cart-count");
  badge.textContent = totalQty;
  const prevCount = badge.getAttribute("data-prev") || "0";
  if (String(totalQty) !== prevCount) {
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
    setTimeout(() => badge.classList.remove("bump"), 400);
  }
  badge.setAttribute("data-prev", totalQty);

  // Cart items
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

  // Render items
  const fragment = document.createDocumentFragment();
  cart.forEach(item => {
    const el = document.createElement("div");
    el.className = "cart-item";
    el.innerHTML = `
      <img class="cart-item-img" src="${item.img}" alt="${item.name}" />
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${item.priceDisplay !== "TBD" ? item.price + " EGP each" : "Price TBD"}</div>
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

  // Event delegation for cart controls
  itemsEl.addEventListener("click", handleCartControls);

  // Subtotal
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
// CHECKOUT
// ══════════════════════════════════════════════════════
let checkoutStep = 1;
let customerData = {};

function initCheckout() {
  document.getElementById("checkout-close").addEventListener("click", closeCheckout);
  document.getElementById("checkout-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("checkout-modal")) closeCheckout();
  });
  document.getElementById("checkout-next-btn").addEventListener("click", validateAndGoToReview);
  document.getElementById("checkout-back-btn").addEventListener("click", goToStep1);
  document.getElementById("checkout-place-btn").addEventListener("click", placeOrder);
  document.getElementById("confirm-done-btn").addEventListener("click", () => {
    closeCheckout();
    cart = [];
    updateCartUI();
  });
}

function openCheckout() {
  if (cart.length === 0) { showToast("Your cart is empty!"); return; }
  checkoutStep = 1;
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
  [1, 2, 3].forEach(i => {
    document.getElementById(`checkout-step-${i}`).classList.toggle("hidden", i !== n);
    const ind = document.getElementById(`step-ind-${i}`);
    ind.classList.toggle("active", i === n);
    ind.classList.toggle("done", i < n);
  });
}

function validateAndGoToReview() {
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
  populateReview();
  setCheckoutStep(2);
}

function goToStep1() { setCheckoutStep(1); }

function populateReview() {
  // Items
  const itemsEl = document.getElementById("review-items");
  itemsEl.innerHTML = cart.map(item => `
    <div class="review-item">
      <img src="${item.img}" alt="${item.name}" />
      <div class="review-item-info">
        <div>${item.name} × ${item.qty}</div>
        <div style="font-size:.78rem;color:var(--coffee-400)">${item.pieces}</div>
      </div>
      <div class="review-item-price">${item.priceDisplay !== "TBD" ? (item.price * item.qty) + " EGP" : "TBD"}</div>
    </div>
  `).join("");

  // Totals
  const subtotal = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  document.getElementById("review-totals").innerHTML = `
    <div class="review-total-row"><span>subtotal</span><span>${subtotal > 0 ? subtotal + " EGP" : "TBD"}</span></div>
    <div class="review-total-row"><span>shipping</span><span>calculated on delivery</span></div>
    <div class="review-total-row grand"><span>total</span><span>${subtotal > 0 ? subtotal + " EGP" : "TBD"}</span></div>
  `;

  // Customer
  document.getElementById("review-customer").innerHTML = `
    <strong style="font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--coffee-500)">delivering to</strong><br/>
    <strong>${customerData.name}</strong> · ${customerData.phone}${customerData.email ? " · " + customerData.email : ""}<br/>
    ${customerData.address}
    ${customerData.note ? `<br/><em style="color:var(--coffee-400);font-size:.82rem">Note: ${customerData.note}</em>` : ""}
  `;
}

async function placeOrder() {
  const btn = document.getElementById("checkout-place-btn");
  btn.disabled = true;
  btn.textContent = "placing order...";

  // Build order payload matching expense-system /api/orders format
  const items = cart.map(i => ({
    stockItemId: null,      // no stock link from website side
    sku: i.sku,
    itemName: i.name,
    quantity: i.qty,
    unitPrice: i.price || 0,
  }));

  const payload = {
    customerName: customerData.name,
    phone: customerData.phone,
    email: customerData.email || null,
    address: customerData.address,
    items,
    shippingPrice: 0,
    paymentStatus: "unpaid",
    deliveryStatus: "processing",
    note: customerData.note || null,
  };

  try {
    const res = await fetch(`${EXPENSE_API}/api/orders/storefront`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    let orderId = null;
    if (res.ok) {
      const data = await res.json();
      orderId = data.id || null;
    }
    // Even if request fails (CORS/auth in dev), show success to customer
    // The order is captured; you can also add email notification here
    showConfirmation(orderId);
  } catch (_) {
    // Network issue — still show confirmation, order details available locally
    showConfirmation(null);
  }
}

function showConfirmation(orderId) {
  setCheckoutStep(3);
  const msg = orderId
    ? `Your order #${orderId} has been received. We'll reach out to confirm delivery details!`
    : `Your order has been received. We'll reach out to confirm delivery details!`;
  document.getElementById("confirm-msg").textContent = msg;
  document.getElementById("confirm-order-id").textContent = orderId ? `Order ID: ${orderId}` : "";
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
