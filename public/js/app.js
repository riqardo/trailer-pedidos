import {
  ApiError,
  api,
  clearToken,
  getToken,
  setToken,
} from "./api.js";

/* =========================================================
   Utilidades
   ========================================================= */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

const LOCATION_LABELS = { mesa: "Mesa", placa: "Placa", balcao: "Balcão" };
const LOCATION_ICONS = { mesa: "table", placa: "tag", balcao: "user" };
const PAYMENTS = {
  dinheiro: { label: "Dinheiro", icon: "cash" },
  pix: { label: "Pix", icon: "pix" },
  cartao: { label: "Cartão", icon: "card" },
};

const state = {
  user: null,
  products: [],
  orders: [],
  filter: "open",
  search: "",
  view: "orders",
  menuCategory: "all",
  menuSearch: "",
  activeOrder: null,
  editor: createBlankEditor(),
  finalize: { order: null, method: "dinheiro", saving: false },
};

let confirmResolver = null;

function createBlankEditor() {
  return {
    order: null,
    cart: [],
    locationType: "mesa",
    productCategory: "all",
    productSearch: "",
    saving: false,
    dirty: false,
  };
}

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function icon(name, className = "") {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function money(value) {
  return brl.format(Number(value) || 0);
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function formatCardTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  return isSameDay(date, now)
    ? timeFormatter.format(date)
    : shortDateFormatter.format(date);
}

function formatWhen(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isSameDay(date, new Date())) {
    return `Hoje às ${timeFormatter.format(date)}`;
  }
  return `${shortDateFormatter.format(date)} às ${timeFormatter.format(date)}`;
}

function locationText(location) {
  if (!location) return "";
  if (location.type === "balcao") return "Balcão";
  return `${LOCATION_LABELS[location.type]} ${location.label}`;
}

function initials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function statusPill(status) {
  return status === "finalized"
    ? '<span class="status-pill finalized">Finalizado</span>'
    : '<span class="status-pill open">Em aberto</span>';
}

function itemSummary(order) {
  if (!order.items.length) return "Sem itens na comanda";
  const shown = order.items
    .slice(0, 2)
    .map((item) => `${item.quantity}× ${item.name}`)
    .join(" · ");
  const remaining = order.items.length - 2;
  return remaining > 0 ? `${shown} · +${remaining}` : shown;
}

function toCartItem(item) {
  const product = state.products.find((entry) => entry.id === item.productId);
  return {
    productId: item.productId,
    name: item.name,
    unitPrice: Number(item.unitPrice),
    quantity: item.quantity,
    category: item.category,
    icon: product?.icon ?? (item.category === "bebida" ? "🥤" : "🌭"),
    available: product?.available ?? true,
  };
}

function sumCents(value) {
  return Math.round((Number(value) || 0) * 100);
}

/* =========================================================
   Toasts e confirmação
   ========================================================= */

function toast(message, type = "success") {
  const container = $("#toast-container");
  const element = document.createElement("div");
  element.className = `toast ${type}`;

  const iconName = type === "error" ? "close" : type === "info" ? "info" : "check";
  element.innerHTML = `<span class="toast-icon">${icon(iconName)}</span><p>${esc(message)}</p>`;
  container.append(element);

  window.setTimeout(() => {
    element.classList.add("leaving");
    window.setTimeout(() => element.remove(), 220);
  }, 4200);
}

function confirmAction({
  title,
  message,
  confirmLabel = "Confirmar",
  tone = "primary",
}) {
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;

  const okButton = $("#confirm-ok");
  okButton.textContent = confirmLabel;
  okButton.className = `btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`;

  showModal("confirm-modal");

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function resolveConfirm(value) {
  if (!confirmResolver) return;
  const resolve = confirmResolver;
  confirmResolver = null;
  hideModal("confirm-modal");
  resolve(value);
}

/* =========================================================
   Modais
   ========================================================= */

function showModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = false;
  syncBodyLock();
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  syncBodyLock();
}

function isModalOpen(id) {
  const modal = document.getElementById(id);
  return modal ? !modal.hidden : false;
}

function syncBodyLock() {
  const anyOpen = $$(".modal").some((modal) => !modal.hidden);
  document.body.style.overflow = anyOpen ? "hidden" : "";
}

function closeAllModals() {
  if (confirmResolver) {
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(false);
  }
  $$(".modal").forEach((modal) => {
    modal.hidden = true;
  });
  syncBodyLock();
}

function setBusy(button, busy, label) {
  if (!button) return;

  if (busy) {
    if (!button.dataset.originalHtml) {
      button.dataset.originalHtml = button.innerHTML;
    }
    button.disabled = true;
    button.textContent = label;
  } else {
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
    button.disabled = false;
  }
}

/* =========================================================
   Autenticação e sessão
   ========================================================= */

async function handleLogin(event) {
  event.preventDefault();

  const username = $("#login-username").value.trim();
  const password = $("#login-password").value;
  const errorBox = $("#login-error");
  const submit = $("#login-submit");

  errorBox.hidden = true;

  if (!username || !password) {
    errorBox.textContent = "Informe usuário e senha para entrar.";
    errorBox.hidden = false;
    return;
  }

  setBusy(submit, true, "Entrando...");

  try {
    const auth = await api.login({ username, password });
    setToken(auth.token);
    state.user = auth.user;

    $("#login-screen").hidden = true;
    $("#app-shell").hidden = false;
    $("#login-password").value = "";
    hideBootScreen();

    window.scrollTo(0, 0);
    updateUserChrome();
    setView("orders");
    renderAll();

    try {
      const [productsData, ordersData] = await Promise.all([
        api.products(),
        api.orders({ limit: 200 }),
      ]);
      state.products = productsData.products;
      state.orders = ordersData.orders;
      renderAll();
    } catch (error) {
      handleRequestError(error);
    }
  } catch (error) {
    errorBox.textContent =
      error?.status === 401
        ? "Usuário ou senha inválidos. Confira e tente novamente."
        : error?.message ?? "Não foi possível entrar. Tente novamente.";
    errorBox.hidden = false;
    $("#login-password").select();
  } finally {
    setBusy(submit, false);
  }
}

async function restoreSession() {
  if (!getToken()) {
    hideBootScreen();
    $("#login-screen").hidden = false;
    window.setTimeout(() => $("#login-username").focus(), 60);
    return;
  }

  try {
    const { user } = await api.me();
    state.user = user;
    $("#login-screen").hidden = true;
    $("#app-shell").hidden = false;
    hideBootScreen();
    updateUserChrome();
    renderAll();

    window.scrollTo(0, 0);

    try {
      const [productsData, ordersData] = await Promise.all([
        api.products(),
        api.orders({ limit: 200 }),
      ]);
      state.products = productsData.products;
      state.orders = ordersData.orders;
      renderAll();
    } catch (error) {
      handleRequestError(error);
    }
  } catch {
    clearToken();
    forceLoginScreen();
  }
}

function hideBootScreen() {
  const boot = $("#boot-screen");
  if (boot) boot.hidden = true;
}

function forceLoginScreen(message = "") {
  clearToken();
  closeAllModals();

  state.user = null;
  state.products = [];
  state.orders = [];
  state.activeOrder = null;
  state.editor = createBlankEditor();
  state.finalize = { order: null, method: "dinheiro", saving: false };
  state.search = "";
  state.filter = "open";

  $("#app-shell").hidden = true;
  $("#login-screen").hidden = false;
  $("#login-password").value = "";
  hideBootScreen();
  window.scrollTo(0, 0);

  const errorBox = $("#login-error");
  if (message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  } else {
    errorBox.hidden = true;
  }

  window.setTimeout(() => $("#login-username").focus(), 60);
}

function handleLogout() {
  clearToken();
  forceLoginScreen();
  toast("Você saiu do caixa.", "info");
}

function handleRequestError(error, { silent = false } = {}) {
  if (error?.status === 401) {
    forceLoginScreen("Sua sessão expirou. Entre novamente para continuar.");
    return;
  }

  if (!silent) {
    toast(error?.message ?? "Não foi possível concluir a operação.", "error");
  }
}

/* =========================================================
   Carregamento e navegação
   ========================================================= */

function updateUserChrome() {
  if (!state.user) return;

  $("#user-name").textContent = state.user.name;
  $("#user-role").textContent =
    state.user.role === "gerente" ? "Gerente" : "Atendente";
  $("#user-avatar").textContent = initials(state.user.name);
}

async function loadData() {
  const [productsData, ordersData] = await Promise.all([
    api.products(),
    api.orders({ limit: 200 }),
  ]);

  state.products = productsData.products;
  state.orders = ordersData.orders;
  renderAll();
}

async function refreshOrders() {
  const data = await api.orders({ limit: 200 });
  state.orders = data.orders;
  renderAll();
}

function setView(view) {
  state.view = view;

  window.scrollTo(0, 0);

  $$(".nav-item[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  $("#orders-view").hidden = view !== "orders";
  $("#menu-view").hidden = view !== "menu";

  if (view === "menu") {
    $("#page-eyebrow").textContent = "CARDÁPIO";
    $("#page-title").textContent = "Cardápio";
    renderMenu();
  } else {
    $("#page-eyebrow").textContent = "PAINEL DE PEDIDOS";
    $("#page-title").textContent = "Pedidos";
  }
}

function tickClock() {
  const now = new Date();
  $("#clock-time").textContent = timeFormatter.format(now);
  $("#clock-date").textContent = longDateFormatter.format(now);

  const shiftDate = $("#shift-date");
  if (shiftDate) {
    const text = longDateFormatter.format(now);
    shiftDate.textContent = text.charAt(0).toUpperCase() + text.slice(1);
  }
}

/* =========================================================
   Dashboard de pedidos
   ========================================================= */

function renderAll() {
  renderStats();
  renderOrders();
  renderMenu();
  updateUserChrome();
}

function renderStats() {
  const openOrders = state.orders.filter((order) => order.status === "open");
  const finalizedOrders = state.orders.filter(
    (order) => order.status === "finalized",
  );
  const today = new Date();
  const revenueToday = finalizedOrders
    .filter((order) => order.payment?.paidAt)
    .filter((order) => isSameDay(new Date(order.payment.paidAt), today))
    .reduce((sum, order) => sum + Number(order.payment.total || 0), 0);

  $("#stat-open").textContent = openOrders.length;
  $("#stat-finalized").textContent = finalizedOrders.length;
  $("#stat-revenue").textContent = money(revenueToday);
  $("#nav-open-count").textContent = openOrders.length;

  $("#count-open").textContent = openOrders.length;
  $("#count-finalized").textContent = finalizedOrders.length;
  $("#count-all").textContent = state.orders.length;
}

function filterOrders() {
  const search = normalize(state.search);

  return state.orders
    .filter((order) =>
      state.filter === "all" ? true : order.status === state.filter,
    )
    .filter((order) => {
      if (!search) return true;
      const haystack = normalize(
        [
          order.customerName,
          locationText(order.location),
          order.code,
          String(order.number),
          ...order.items.map((item) => item.name),
        ].join(" "),
      );
      return haystack.includes(search);
    })
    .sort((first, second) => {
      const firstDate =
        first.status === "finalized"
          ? first.payment?.paidAt ?? first.updatedAt
          : first.updatedAt;
      const secondDate =
        second.status === "finalized"
          ? second.payment?.paidAt ?? second.updatedAt
          : second.updatedAt;
      return new Date(secondDate) - new Date(firstDate);
    });
}

function renderOrders() {
  $$("#order-filters .segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });

  const orders = filterOrders();
  const list = $("#orders-list");
  const empty = $("#orders-empty");

  list.innerHTML = orders.map(orderCardHtml).join("");
  empty.hidden = orders.length > 0;

  const emptyTitle = $("#orders-empty h3");
  const emptyText = $("#orders-empty-text");
  const emptyButton = $("#orders-empty .btn");

  if (orders.length === 0) {
    if (state.search) {
      emptyTitle.textContent = "Nenhum pedido encontrado";
      emptyText.textContent = `Não encontramos pedidos para “${state.search}”. Tente outro nome, local ou número.`;
      emptyButton.hidden = true;
    } else if (state.filter === "finalized") {
      emptyTitle.textContent = "Nenhum pedido finalizado";
      emptyText.textContent =
        "Assim que um pedido for pago, ele aparecerá aqui para consulta.";
      emptyButton.hidden = true;
    } else if (state.filter === "all") {
      emptyTitle.textContent = "Nenhum pedido registrado";
      emptyText.textContent =
        "Comece o turno registrando o primeiro pedido na chapa.";
      emptyButton.hidden = false;
    } else {
      emptyTitle.textContent = "Nenhum pedido em aberto";
      emptyText.textContent =
        "Tudo em dia por aqui. Quando alguém chegar, registre um novo pedido.";
      emptyButton.hidden = false;
    }
  }
}

function orderCardHtml(order) {
  const finalized = order.status === "finalized";
  const payment = order.payment ? PAYMENTS[order.payment.method] : null;
  const time = finalized
    ? order.payment?.paidAt ?? order.updatedAt
    : order.updatedAt;

  return `
    <article
      class="order-card ${finalized ? "finalized" : "open"}"
      data-order-id="${esc(order.id)}"
      role="button"
      tabindex="0"
    >
      <div class="order-card-top">
        <div class="order-number">
          <strong>${esc(order.code)}</strong>
          <span class="order-time">${esc(formatCardTime(time))}</span>
        </div>
        ${statusPill(order.status)}
      </div>

      <h2 class="order-customer">${esc(order.customerName)}</h2>
      <span class="order-location">
        ${icon(LOCATION_ICONS[order.location.type] ?? "pin")}
        ${esc(locationText(order.location))}
      </span>

      <p class="order-items">${esc(itemSummary(order))}</p>

      <div class="order-footer">
        <div class="order-total">
          <span>Total</span>
          <strong>${money(order.total)}</strong>
        </div>
        <div class="order-side">
          ${
            payment
              ? `<span class="payment-tag">${icon(payment.icon)}${esc(payment.label)}</span>`
              : ""
          }
          <span class="order-arrow">${icon("chevron")}</span>
        </div>
      </div>
    </article>
  `;
}

/* =========================================================
   Cardápio
   ========================================================= */

function menuProducts() {
  const search = normalize(state.menuSearch);

  return state.products
    .filter(
      (product) =>
        state.menuCategory === "all" ||
        product.category === state.menuCategory,
    )
    .filter((product) => {
      if (!search) return true;
      return normalize(`${product.name} ${product.description}`).includes(search);
    });
}

function renderMenu() {
  $$("#menu-filters .segment").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.category === state.menuCategory,
    );
  });

  const products = menuProducts();
  const available = state.products.filter((product) => product.available).length;
  $("#menu-available-count").textContent = available;

  const grid = $("#products-grid");

  if (!products.length) {
    grid.innerHTML = `<div class="catalog-empty">Nenhum produto encontrado no cardápio.</div>`;
    return;
  }

  grid.innerHTML = products
    .map((product) => {
      const isAvailable = product.available;

      return `
        <article class="product-card ${esc(product.category)} ${isAvailable ? "" : "unavailable"}">
          <div class="product-top">
            <div class="product-icon">${esc(product.icon)}</div>
            <div class="product-info">
              <h3>${esc(product.name)}</h3>
              <span class="product-category">${product.category === "bebida" ? "Bebida" : "Lanche"}</span>
            </div>
            <span class="badge ${isAvailable ? "available" : "unavailable"}">
              ${isAvailable ? "Disponível" : "Indisponível"}
            </span>
          </div>

          <p class="product-description">${esc(product.description)}</p>

          <div class="product-footer">
            <div class="product-price">
              ${money(product.price)}
              <small>preço</small>
            </div>
            <button
              class="btn btn-small ${isAvailable ? "btn-outline" : "btn-ghost"}"
              type="button"
              data-menu-add="${esc(product.id)}"
              ${isAvailable ? "" : "disabled"}
            >
              ${isAvailable ? `${icon("plus")} Adicionar` : "Indisponível"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

/* =========================================================
   Editor de pedido
   ========================================================= */

function openOrderEditor(order = null, { initialProductId = null } = {}) {
  state.editor = createBlankEditor();
  state.editor.order = order;

  if (order) {
    state.editor.cart = order.items.map(toCartItem);
    $("#customer-name").value = order.customerName;
    setLocation(
      order.location.type,
      order.location.type === "balcao" ? "" : order.location.label,
    );
  } else {
    $("#customer-name").value = "";
    setLocation("mesa", "");
  }

  if (initialProductId) {
    addProductToCart(initialProductId, { silent: true });
  }

  $("#order-modal-title").textContent = order
    ? `Editar pedido ${order.code}`
    : "Novo pedido";
  $("#order-modal-subtitle").textContent = order
    ? "Pedido em aberto — as alterações ficam registradas no histórico."
    : "Monte a comanda e identifique o cliente.";

  $("#order-error").hidden = true;
  $("#customer-name").classList.remove("invalid");
  $("#location-value").classList.remove("invalid");

  $$("#editor-categories .segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === "all");
  });
  $("#editor-product-search").value = "";

  renderEditor();
  showModal("order-modal");

  $("#order-form").scrollTop = 0;

  if (initialProductId) {
    toast("Item adicionado à nova comanda.", "info");
  }

  window.setTimeout(() => {
    $("#customer-name").focus();
  }, 80);
}

function setLocation(type, value) {
  state.editor.locationType = type;

  $$("#location-toggle .location-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.location === type);
  });

  const wrap = $("#location-value-wrap");
  const input = $("#location-value");
  const label = $("#location-value-label");
  const hint = $("#location-balcao-hint");

  if (type === "balcao") {
    wrap.hidden = true;
    hint.hidden = false;
    input.value = "";
  } else {
    wrap.hidden = false;
    hint.hidden = true;
    input.value = value ?? "";
    label.textContent =
      type === "mesa" ? "Número da mesa" : "Identificação da placa";
    input.placeholder = type === "mesa" ? "ex.: 4" : "ex.: ABC-1D23";
  }
}

function renderEditor() {
  renderEditorCatalog();
  renderCart();

  const saveButton = $("#save-order-btn");
  saveButton.innerHTML = `${icon("check")} ${
    state.editor.order ? "Salvar alterações" : "Registrar pedido"
  }`;
  saveButton.disabled = state.editor.cart.length === 0;
}

function renderEditorCatalog() {
  const search = normalize(state.editor.productSearch);
  const products = state.products
    .filter(
      (product) =>
        state.editor.productCategory === "all" ||
        product.category === state.editor.productCategory,
    )
    .filter((product) => {
      if (!search) return true;
      return normalize(`${product.name} ${product.description}`).includes(search);
    });

  const container = $("#editor-products");

  if (!products.length) {
    container.innerHTML = `<div class="catalog-empty">Nenhum produto encontrado.</div>`;
    return;
  }

  container.innerHTML = products
    .map((product) => {
      const isAvailable = product.available;
      return `
        <button
          class="catalog-item ${esc(product.category)} ${isAvailable ? "" : "disabled"}"
          type="button"
          data-add-editor-product="${esc(product.id)}"
          ${isAvailable ? "" : "disabled"}
        >
          <span class="catalog-icon">${esc(product.icon)}</span>
          <span class="catalog-text">
            <strong>${esc(product.name)}</strong>
            <small>${money(product.price)}</small>
          </span>
          ${
            isAvailable
              ? `<span class="catalog-add">${icon("plus")}</span>`
              : '<span class="catalog-unavailable">Indisponível</span>'
          }
        </button>
      `;
    })
    .join("");
}

function renderCart() {
  const cart = state.editor.cart;
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalCents = cart.reduce(
    (sum, item) => sum + sumCents(item.unitPrice) * item.quantity,
    0,
  );
  const subtotal = subtotalCents / 100;

  $("#cart-badge").textContent = count;
  $("#cart-count").textContent =
    count === 0
      ? "Nenhum item"
      : `${count} ${count === 1 ? "item" : "itens"}`;
  $("#cart-subtotal").textContent = money(subtotal);
  $("#cart-total").textContent = money(subtotal);
  $("#cart-empty").hidden = cart.length > 0;

  const container = $("#cart-items");
  container.hidden = cart.length === 0;

  container.innerHTML = cart
    .map(
      (item) => `
        <div class="cart-item" data-cart-product="${esc(item.productId)}">
          <span class="cart-item-icon">${esc(item.icon)}</span>
          <span class="cart-item-info">
            <strong>${esc(item.name)}</strong>
            <small>${money(item.unitPrice)} cada${
              item.available ? "" : " · indisponível"
            }</small>
          </span>
          <span class="cart-item-actions">
            <span class="stepper">
              <button type="button" data-cart-minus aria-label="Diminuir ${esc(item.name)}">
                ${icon("minus")}
              </button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-plus aria-label="Aumentar ${esc(item.name)}">
                ${icon("plus")}
              </button>
            </span>
            <button
              class="cart-remove"
              type="button"
              data-cart-remove
              aria-label="Remover ${esc(item.name)}"
            >
              ${icon("trash")}
            </button>
          </span>
        </div>
      `,
    )
    .join("");

  $("#save-order-btn").disabled = cart.length === 0 || state.editor.saving;
}

function addProductToCart(productId, { silent = false } = {}) {
  const product = state.products.find((entry) => entry.id === productId);

  if (!product) {
    toast("Produto não encontrado no cardápio.", "error");
    return;
  }

  if (!product.available) {
    toast(
      `“${product.name}” está indisponível e não pode ser adicionado.`,
      "error",
    );
    return;
  }

  const existing = state.editor.cart.find(
    (item) => item.productId === productId,
  );

  if (existing) {
    if (existing.quantity >= 99) {
      toast("A quantidade máxima por produto é 99.", "info");
      return;
    }
    existing.quantity += 1;
  } else {
    state.editor.cart.push({
      productId: product.id,
      name: product.name,
      unitPrice: Number(product.price),
      quantity: 1,
      category: product.category,
      icon: product.icon,
      available: product.available,
    });
  }

  state.editor.dirty = true;
  renderCart();

  if (!silent) {
    $("#order-error").hidden = true;
  }
}

function handleCartClick(event) {
  const row = event.target.closest("[data-cart-product]");
  if (!row) return;

  const productId = row.dataset.cartProduct;
  const item = state.editor.cart.find((entry) => entry.productId === productId);
  if (!item) return;

  if (event.target.closest("[data-cart-plus]")) {
    if (item.quantity >= 99) {
      toast("A quantidade máxima por produto é 99.", "info");
      return;
    }
    item.quantity += 1;
  } else if (event.target.closest("[data-cart-minus]")) {
    if (item.quantity <= 1) {
      state.editor = { ...state.editor, cart: state.editor.cart.filter((entry) => entry !== item) };
    } else {
      item.quantity -= 1;
    }
  } else if (event.target.closest("[data-cart-remove]")) {
    state.editor = {
      ...state.editor,
      cart: state.editor.cart.filter((entry) => entry !== item),
    };
  } else {
    return;
  }

  state.editor.dirty = true;
  renderCart();
}

function showOrderError(message) {
  const box = $("#order-error");
  box.textContent = message;
  box.hidden = false;
}

function clearOrderError() {
  const box = $("#order-error");
  box.textContent = "";
  box.hidden = true;
}

async function handleSaveOrder(event) {
  event.preventDefault();

  if (state.editor.saving) return;

  const name = $("#customer-name").value.trim();
  const locationType = state.editor.locationType;
  const locationValue = $("#location-value").value.trim();
  const cart = state.editor.cart;

  clearOrderError();
  $("#customer-name").classList.remove("invalid");
  $("#location-value").classList.remove("invalid");

  if (name.length < 2) {
    $("#customer-name").classList.add("invalid");
    $("#customer-name").focus();
    showOrderError("Informe o nome do cliente (mínimo de 2 caracteres).");
    return;
  }

  if (locationType !== "balcao" && !locationValue) {
    $("#location-value").classList.add("invalid");
    $("#location-value").focus();
    showOrderError(
      locationType === "mesa"
        ? "Informe o número da mesa."
        : "Informe a identificação da placa.",
    );
    return;
  }

  if (cart.length === 0) {
    showOrderError("Adicione pelo menos um item à comanda.");
    return;
  }

  const payload = {
    customerName: name,
    location: {
      type: locationType,
      label: locationType === "balcao" ? "Balcão" : locationValue,
    },
    items: cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  };

  state.editor.saving = true;
  const saveButton = $("#save-order-btn");
  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";

  try {
    const data = state.editor.order
      ? await api.updateOrder(state.editor.order.id, payload)
      : await api.createOrder(payload);

    const savedOrder = data.order;
    const editing = Boolean(state.editor.order);

    state.editor.dirty = false;
    hideModal("order-modal");

    toast(
      editing
        ? `Pedido ${savedOrder.code} atualizado com sucesso.`
        : `Pedido ${savedOrder.code} registrado com sucesso.`,
      "success",
    );

    await refreshOrders();
    await openOrderDrawer(savedOrder.id);
  } catch (error) {
    if (error?.status === 401) {
      forceLoginScreen("Sua sessão expirou. Entre novamente para continuar.");
      return;
    }
    showOrderError(error?.message ?? "Não foi possível salvar o pedido.");
  } finally {
    state.editor.saving = false;
    saveButton.disabled =
      state.editor.cart.length === 0 ||
      (isModalOpen("order-modal") && state.editor.saving);
    saveButton.innerHTML = `${icon("check")} ${
      state.editor.order ? "Salvar alterações" : "Registrar pedido"
    }`;
  }
}

async function requestCloseOrderEditor() {
  if (state.editor.saving) return;

  if (state.editor.dirty) {
    const discard = await confirmAction({
      title: "Descartar este pedido?",
      message:
        "As informações preenchidas na comanda serão perdidas. Deseja realmente fechar?",
      confirmLabel: "Descartar",
      tone: "danger",
    });

    if (!discard) return;
  }

  hideModal("order-modal");
  state.editor = createBlankEditor();
}

/* =========================================================
   Detalhe do pedido
   ========================================================= */

async function openOrderDrawer(orderId) {
  try {
    const { order } = await api.order(orderId);
    state.activeOrder = order;
    renderDrawer(order);
    showModal("order-drawer");
  } catch (error) {
    handleRequestError(error);
  }
}

function closeDrawer() {
  hideModal("order-drawer");
  state.activeOrder = null;
}

function renderDrawer(order) {
  const finalized = order.status === "finalized";
  const location = order.location;
  const payment = order.payment;
  const paymentInfo = payment ? PAYMENTS[payment.method] : null;

  const itemsHtml = order.items
    .map(
      (item) => `
        <div class="detail-item">
          <span class="detail-qty">${item.quantity}×</span>
          <div class="detail-item-info">
            <strong>${esc(item.name)}</strong>
            <small>${money(item.unitPrice)} cada</small>
          </div>
          <span class="detail-item-price">${money(item.lineTotal)}</span>
        </div>
      `,
    )
    .join("");

  const paymentHtml =
    finalized && payment
      ? `
        <section class="drawer-section">
          <div class="receipt-card">
            <div class="receipt-head">
              <span class="receipt-check">${icon("check")}</span>
              <div>
                <strong>Pagamento confirmado</strong>
                <span>${esc(paymentInfo?.label ?? payment.method)} · ${esc(formatWhen(payment.paidAt))}</span>
              </div>
            </div>
            <div class="receipt-rows">
              <div class="receipt-row">
                <span>Recebido por</span>
                <strong>${esc(payment.processedBy?.name ?? "Atendente")}</strong>
              </div>
              <div class="receipt-row">
                <span>Valor pago</span>
                <strong>${money(payment.total)}</strong>
              </div>
              <div class="receipt-row">
                <span>Forma de pagamento</span>
                <strong>${esc(paymentInfo?.label ?? payment.method)}</strong>
              </div>
            </div>
            <div class="receipt-note">
              ${icon("info")} Pagamento simulado — sem integração financeira real.
            </div>
          </div>
        </section>
      `
      : "";

  const history = order.history ?? [];
  const historyHtml = history.length
    ? history.map(historyItemHtml).join("")
    : '<p class="field-hint">Nenhum registro no histórico deste pedido.</p>';

  const actionHtml = finalized
    ? `<div class="readonly-note">${icon("lock")} Pedido finalizado — disponível apenas para consulta</div>`
    : `
      <button class="btn btn-primary" type="button" data-drawer-finalize ${order.items.length ? "" : "disabled"}>
        ${icon("check")} Finalizar e receber
      </button>
      <button class="btn btn-ghost" type="button" data-drawer-edit>
        ${icon("edit")} Editar
      </button>
    `;

  $("#drawer-content").innerHTML = `
    <div class="drawer-head">
      <div class="drawer-head-top">
        <div class="drawer-code">
          <strong>${esc(order.code)}</strong>
          ${statusPill(order.status)}
        </div>
        <button class="icon-btn" type="button" data-drawer-close aria-label="Fechar">
          ${icon("close")}
        </button>
      </div>

      <h2 class="drawer-customer">${esc(order.customerName)}</h2>
      <span class="drawer-location">
        ${icon(LOCATION_ICONS[location.type] ?? "pin")}
        ${esc(locationText(location))}
      </span>

      <div class="drawer-meta">
        <span>${icon("clock")} ${esc(formatWhen(order.createdAt))}</span>
        <span>${icon("user")} ${esc(order.createdBy?.name ?? "Atendente")}</span>
      </div>
    </div>

    <section class="drawer-section">
      <div class="drawer-section-title">
        <h3>Itens da comanda</h3>
        <span>${order.itemCount} ${order.itemCount === 1 ? "item" : "itens"}</span>
      </div>
      ${itemsHtml || '<p class="field-hint">Este pedido ainda não possui itens.</p>'}
      <div class="detail-totals">
        <div class="detail-total-row">
          <span>Subtotal</span>
          <strong>${money(order.subtotal)}</strong>
        </div>
        ${
          order.discount > 0
            ? `<div class="detail-total-row discount">
                <span>Desconto em dinheiro (10%)</span>
                <strong>− ${money(order.discount)}</strong>
              </div>`
            : ""
        }
        <div class="detail-total-row grand">
          <span>Total</span>
          <strong>${money(order.total)}</strong>
        </div>
      </div>
    </section>

    ${paymentHtml}

    <section class="drawer-section">
      <div class="drawer-section-title">
        <h3>Histórico de atendimento</h3>
        <span>${history.length} ${history.length === 1 ? "registro" : "registros"}</span>
      </div>
      <div class="timeline">${historyHtml}</div>
    </section>

    <div class="drawer-actions">${actionHtml}</div>
  `;

  $("#drawer-content").scrollTop = 0;
}

function historyItemHtml(entry) {
  const meta = historyMeta(entry);
  return `
    <div class="timeline-item ${esc(entry.action)}">
      <span class="timeline-dot"></span>
      <div class="timeline-body">
        <strong>${esc(meta.title)}</strong>
        <span>${esc(entry.attendant?.name ?? "Atendente")} · ${esc(formatWhen(entry.at))}</span>
        ${meta.detail ? `<small>${esc(meta.detail)}</small>` : ""}
      </div>
    </div>
  `;
}

function historyMeta(entry) {
  const details = entry.details ?? {};

  switch (entry.action) {
    case "created":
      return {
        title: "Pedido registrado",
        detail: details.itemCount ? `${details.itemCount} itens na comanda` : null,
      };
    case "updated":
      return { title: "Pedido alterado", detail: null };
    case "viewed":
      return { title: "Consulta ao pedido", detail: null };
    case "item_added":
      return {
        title: "Item adicionado",
        detail: `${details.quantityAdded ?? 1}× ${details.productName ?? "Produto"}`,
      };
    case "item_updated":
      return {
        title: "Quantidade alterada",
        detail: `${details.productName ?? "Produto"}: ${details.quantityBefore} → ${details.quantityAfter}`,
      };
    case "item_removed":
      return {
        title: "Item removido",
        detail: `${details.quantity ?? 1}× ${details.productName ?? "Produto"}`,
      };
    case "finalized":
      return {
        title: "Pagamento confirmado",
        detail: `${PAYMENTS[details.paymentMethod]?.label ?? details.paymentMethod} · ${money(details.total)}`,
      };
    default:
      return { title: entry.action, detail: null };
  }
}

/* =========================================================
   Finalização
   ========================================================= */

function openFinalizeModal(order) {
  if (!order) return;

  if (!order.items.length) {
    toast("Adicione pelo menos um produto antes de finalizar.", "error");
    return;
  }

  state.finalize = { order, method: "dinheiro", saving: false };

  $("#finalize-subtitle").textContent = `Pedido ${order.code} · confira o valor e escolha a forma de pagamento.`;
  $("#finalize-avatar").textContent = initials(order.customerName);
  $("#finalize-customer").textContent = order.customerName;
  $("#finalize-location").textContent = locationText(order.location);
  $("#finalize-code").textContent = order.code;
  $("#finalize-error").hidden = true;

  $$("#payment-options input").forEach((radio) => {
    radio.checked = radio.value === "dinheiro";
  });

  syncPaymentSelection();
  updateFinalizeSummary();
  $("#finalize-modal .modal-body").scrollTop = 0;
  showModal("finalize-modal");
}

function syncPaymentSelection() {
  $$("#payment-options .payment-option").forEach((option) => {
    const radio = $("input", option);
    option.classList.toggle("selected", radio.value === state.finalize.method);
  });
}

function updateFinalizeSummary() {
  const order = state.finalize.order;
  if (!order) return;

  const subtotalCents = sumCents(order.subtotal);
  const discountCents =
    state.finalize.method === "dinheiro"
      ? Math.round(subtotalCents * 0.1)
      : 0;
  const totalCents = subtotalCents - discountCents;

  $("#finalize-subtotal").textContent = money(subtotalCents / 100);
  $("#finalize-total").textContent = money(totalCents / 100);
  $("#finalize-footer-total").textContent = money(totalCents / 100);

  const discountRow = $("#finalize-discount-row");
  discountRow.hidden = discountCents === 0;
  $("#finalize-discount").textContent = `− ${money(discountCents / 100)}`;
}

async function confirmFinalization() {
  if (!state.finalize.order || state.finalize.saving) return;

  const button = $("#confirm-finalize-btn");
  const errorBox = $("#finalize-error");
  errorBox.hidden = true;

  state.finalize.saving = true;
  setBusy(button, true, "Processando pagamento...");

  try {
    const { order } = await api.finalizeOrder(
      state.finalize.order.id,
      state.finalize.method,
    );

    hideModal("finalize-modal");
    closeDrawer();

    toast(
      `Pagamento em ${PAYMENTS[order.payment.method].label.toLowerCase()} confirmado. Pedido ${order.code} finalizado!`,
      "success",
    );

    await refreshOrders();
    await openOrderDrawer(order.id);
  } catch (error) {
    if (error?.status === 401) {
      forceLoginScreen("Sua sessão expirou. Entre novamente para continuar.");
      return;
    }
    errorBox.textContent =
      error?.message ?? "Não foi possível finalizar o pedido.";
    errorBox.hidden = false;
    toast(errorBox.textContent, "error");
  } finally {
    state.finalize.saving = false;
    setBusy(button, false);
  }
}

/* =========================================================
   Eventos
   ========================================================= */

function bindEvents() {
  $("#login-form").addEventListener("submit", handleLogin);

  $$(".demo-chip").forEach((button) => {
    button.addEventListener("click", () => {
      $("#login-username").value = button.dataset.demoUser;
      $("#login-password").value = button.dataset.demoPassword;
      $("#login-form").requestSubmit();
    });
  });

  $("#logout-btn").addEventListener("click", handleLogout);

  $$(".nav-item[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $("#new-order-btn").addEventListener("click", () => openOrderEditor());

  $("#order-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    renderOrders();
  });

  $("#orders-search").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderOrders();
  });

  $("#orders-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-order-id]");
    if (card) openOrderDrawer(card.dataset.orderId);
  });

  $("#orders-list").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-order-id]");
    if (!card) return;
    event.preventDefault();
    openOrderDrawer(card.dataset.orderId);
  });

  $("#menu-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.menuCategory = button.dataset.category;
    renderMenu();
  });

  $("#menu-search").addEventListener("input", (event) => {
    state.menuSearch = event.target.value;
    renderMenu();
  });

  $("#products-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-menu-add]");
    if (!button || button.disabled) return;
    openOrderEditor(null, { initialProductId: button.dataset.menuAdd });
  });

  $$("[data-close-order]").forEach((element) => {
    element.addEventListener("click", () => requestCloseOrderEditor());
  });

  $("#order-form").addEventListener("submit", handleSaveOrder);

  $("#customer-name").addEventListener("input", (event) => {
    state.editor.dirty = true;
    event.target.classList.remove("invalid");
  });

  $("#location-value").addEventListener("input", (event) => {
    state.editor.dirty = true;
    event.target.classList.remove("invalid");
  });

  $("#location-toggle").addEventListener("click", (event) => {
    const button = event.target.closest("[data-location]");
    if (!button) return;
    const type = button.dataset.location;
    if (type === state.editor.locationType) return;
    setLocation(type, "");
    state.editor.dirty = true;
  });

  $("#editor-categories").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.editor.productCategory = button.dataset.category;
    $$("#editor-categories .segment").forEach((segment) => {
      segment.classList.toggle(
        "active",
        segment.dataset.category === state.editor.productCategory,
      );
    });
    renderEditorCatalog();
  });

  $("#editor-product-search").addEventListener("input", (event) => {
    state.editor.productSearch = event.target.value;
    renderEditorCatalog();
  });

  $("#editor-products").addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-editor-product]");
    if (!button || button.disabled) return;
    addProductToCart(button.dataset.addEditorProduct);
  });

  $("#cart-items").addEventListener("click", handleCartClick);

  $("#order-drawer").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-drawer]")) closeDrawer();
  });

  $("#drawer-content").addEventListener("click", (event) => {
    if (event.target.closest("[data-drawer-close]")) {
      closeDrawer();
      return;
    }

    if (event.target.closest("[data-drawer-edit]")) {
      const order = state.activeOrder;
      if (!order) return;
      closeDrawer();
      openOrderEditor(order);
      return;
    }

    if (event.target.closest("[data-drawer-finalize]")) {
      const button = event.target.closest("[data-drawer-finalize]");
      if (button.disabled) return;
      openFinalizeModal(state.activeOrder);
    }
  });

  $$("[data-close-finalize]").forEach((element) => {
    element.addEventListener("click", () => hideModal("finalize-modal"));
  });

  $("#payment-options").addEventListener("change", (event) => {
    const radio = event.target.closest("input[name='paymentMethod']");
    if (!radio) return;
    state.finalize.method = radio.value;
    syncPaymentSelection();
    updateFinalizeSummary();
  });

  $("#confirm-finalize-btn").addEventListener("click", confirmFinalization);

  $$("#confirm-modal [data-confirm]").forEach((element) => {
    element.addEventListener("click", () => {
      resolveConfirm(element.dataset.confirm === "true");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (isModalOpen("confirm-modal")) {
      resolveConfirm(false);
      return;
    }
    if (isModalOpen("finalize-modal")) {
      hideModal("finalize-modal");
      return;
    }
    if (isModalOpen("order-drawer")) {
      closeDrawer();
      return;
    }
    if (isModalOpen("order-modal")) {
      requestCloseOrderEditor();
    }
  });
}

/* =========================================================
   Inicialização
   ========================================================= */

bindEvents();
tickClock();
window.setInterval(tickClock, 15000);
restoreSession();
