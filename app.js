"use strict";

const categories = [
  ["all", "Всё меню"], ["rolls", "Роллы"], ["sets", "Сеты"], ["pizza", "Пицца"],
  ["burgers", "Бургеры"], ["doners", "Донеры"], ["drinks", "Напитки"]
];

const products = [
  { id: "philadelphia", category: "rolls", name: "Филадельфия", info: "8 шт. · 280 г", price: 790, description: "Лосось, сливочный сыр и хрустящий огурец.", tag: "ХИТ" },
  { id: "canada", category: "rolls", name: "Канада", info: "8 шт. · 275 г", price: 850, description: "Угорь в соусе унаги, огурец, сливочный сыр и кунжут." },
  { id: "tempura", category: "rolls", name: "Креветка темпура", info: "8 шт. · 260 г", price: 690, description: "Хрустящая креветка, сливочный сыр и острый соус.", tag: "ОСТРОЕ" },
  { id: "tokyo", category: "sets", name: "Сет Токио", info: "24 шт. · 815 г", price: 1990, description: "Филадельфия, Канада и Креветка темпура в одном сете.", tag: "НА КОМПАНИЮ" },
  { id: "pepperoni", category: "pizza", name: "Пепперони", info: "30 см · 510 г", price: 790, description: "Пикантная пепперони, моцарелла и томатный соус." },
  { id: "ranch", category: "pizza", name: "Курица и грибы", info: "30 см · 540 г", price: 820, description: "Курица гриль, шампиньоны, моцарелла и сливочный соус." },
  { id: "classic", category: "burgers", name: "Нори Чизбургер", info: "310 г", price: 590, description: "Говядина, чеддер, маринованный огурец и фирменный соус.", tag: "ХИТ" },
  { id: "crispy", category: "burgers", name: "Криспи Чикен", info: "295 г", price: 550, description: "Курица в хрустящей панировке, коул-слоу и огурчики." },
  { id: "beef", category: "doners", name: "Донер с говядиной", info: "380 г", price: 590, description: "Говядина гриль, свежие овощи и чесночный соус в лаваше." },
  { id: "chicken", category: "doners", name: "Донер с курицей", info: "360 г", price: 490, description: "Курица гриль, помидоры, огурцы и йогуртовый соус." },
  { id: "raspberry", category: "drinks", name: "Малина и лайм", info: "450 мл", price: 290, description: "Малиновый лимонад со свежим лаймом и льдом." },
  { id: "passion", category: "drinks", name: "Маракуйя и мята", info: "450 мл", price: 310, description: "Лимонад с пюре маракуйи, лаймом и мятой." }
];

const byId = new Map(products.map(product => [product.id, product]));
const rubles = new Intl.NumberFormat("ru-RU");
const money = amount => `${rubles.format(amount)} ₽`;
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const get = id => document.getElementById(id);
const grid = get("product-grid");
const categoryList = get("categories");
const search = get("search");
const cartDialog = get("cart-dialog");
const productDialog = get("product-dialog");
const cartContent = get("cart-content");
const cartActions = get("cart-actions");
const cartTitle = get("cart-title");
const freeDelivery = 1990;
const storageKey = "nori-street-cart-v1";
let cart = readCart();
let category = "all";
let promotion = false;
let deliveryMethod = "courier";
let checkoutDraft = null;
let useClubPoints = false;
let inFlightCheckout = false;
let toastTimer;

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey)) ?? {};
    return Object.fromEntries(products
      .filter(({ id }) => Number.isInteger(saved[id]) && saved[id] > 0)
      .map(({ id }) => [id, Math.min(99, saved[id])]));
  } catch {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  } catch {
    // The cart still works in memory when storage is unavailable.
  }
}

function totals(method = deliveryMethod, includeClub = false) {
  const items = products.filter(({ id }) => cart[id]);
  const subtotal = items.reduce((sum, item) => sum + cart[item.id] * item.price, 0);
  const count = items.reduce((sum, item) => sum + cart[item.id], 0);
  const discount = promotion ? Math.round(subtotal * 0.1) : 0;
  const shipping = subtotal && subtotal < freeDelivery && method === "courier" ? 249 : 0;
  const foodTotal = subtotal - discount;
  const account = includeClub ? club.current() : null;
  const points = account ? club.amounts(foodTotal, account.balance, useClubPoints) : { available: 0, spent: 0, earned: 0 };
  return { items, subtotal, count, discount, shipping, account, points, foodTotal, total: foodTotal + shipping - points.spent };
}

function quantity(product) {
  const count = cart[product.id] ?? 0;
  if (!count) {
    return `<button type="button" class="add" data-change="1" data-id="${product.id}" aria-label="Добавить: ${product.name}">${icon("plus")}</button>`;
  }
  return `<div class="qty"><button type="button" data-change="-1" data-id="${product.id}" aria-label="Убрать одну порцию: ${product.name}">${icon("minus")}</button><output aria-label="Количество порций">${count}</output><button type="button" data-change="1" data-id="${product.id}" aria-label="Добавить порцию: ${product.name}">${icon("plus")}</button></div>`;
}

function renderCategories() {
  categoryList.innerHTML = categories.map(([id, label]) =>
    `<button type="button" class="category" data-category="${id}" aria-pressed="${id === category}">${label}</button>`
  ).join("");
}

function renderProducts() {
  const normalize = value => value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  const query = normalize(search.value);
  const matches = products.filter(product => {
    const categoryName = categories.find(([id]) => id === product.category)[1];
    return (category === "all" || product.category === category) &&
      normalize(`${product.name} ${product.description} ${categoryName}`).includes(query);
  });
  grid.innerHTML = matches.map(product => `<article class="product">
    <button type="button" class="product-photo" data-product="${product.id}" aria-label="Подробнее: ${product.name}">
      <img src="assets/${product.id}.webp" alt="" width="356" height="356" loading="lazy" decoding="async">
      ${product.tag ? `<span class="tag ${product.tag === "ОСТРОЕ" ? "hot" : ""}">${product.tag}</span>` : ""}
    </button>
    <div class="product-main">
      <span class="product-meta">${product.info}</span>
      <h3 class="product-title"><button type="button" data-product="${product.id}">${product.name}</button></h3>
      <p class="product-description">${product.description}</p>
      <div class="product-bottom"><strong class="price">${money(product.price)}</strong><span data-quantity="${product.id}">${quantity(product)}</span></div>
    </div>
  </article>`).join("");
  get("empty-search").hidden = matches.length > 0;
}

function updateCartBadge() {
  const { count, subtotal, discount } = totals();
  document.querySelectorAll("[data-cart-count]").forEach(node => { node.textContent = count; });
  document.querySelectorAll("[data-cart-total]").forEach(node => { node.textContent = money(subtotal - discount); });
  document.querySelector(".mobile-cart").hidden = count === 0;
}

function summary({ subtotal, discount, shipping, total, points }, showDelivery = true) {
  return `<div class="summary"><div><span>Блюда</span><span>${money(subtotal)}</span></div>
    ${discount ? `<div><span>Промокод NORI10</span><span>−${money(discount)}</span></div>` : ""}
    ${showDelivery && points.spent ? `<div><span>Бонусы NORI Club</span><span>−${money(points.spent)}</span></div>` : ""}
    ${showDelivery ? `<div><span>Доставка</span><span>${shipping ? money(shipping) : "Бесплатно"}</span></div>` : ""}
    <div><span>Итого</span><span>${money(showDelivery ? total : subtotal - discount)}</span></div></div>`;
}

function renderCart() {
  cartTitle.textContent = "Корзина";
  const amounts = totals();
  if (!amounts.count) {
    cartContent.innerHTML = `<div class="cart-empty">${icon("bag")}<h3>Корзина пока пуста</h3><p>Добавьте в неё то, что хочется сегодня.</p><button class="button" type="button" data-menu>К меню</button></div>`;
    cartActions.replaceChildren();
    return;
  }
  cartContent.innerHTML = amounts.items.map(product => `<div class="cart-line">
    <img src="assets/${product.id}.webp" alt="" width="65" height="65">
    <div><strong>${product.name}</strong><small>${money(product.price * cart[product.id])}</small></div>
    ${quantity(product)}</div>`).join("") +
    `<form id="promo-form" class="promotion-entry"><input name="code" aria-label="Промокод" placeholder="Промокод" maxlength="20" value="${promotion ? "NORI10" : ""}" required><button class="button subtle" type="submit">Применить</button></form>
    <p class="small-note" id="promo-status" role="status">${promotion ? "Скидка 10% применена." : "Попробуйте NORI10 на первый заказ."}</p>
    ${summary(amounts, false)}
    <p class="small-note">Стоимость доставки зависит от способа получения.</p>`;
  cartActions.innerHTML = `<button type="button" class="button" data-checkout>Оформить заказ <strong>${money(amounts.subtotal - amounts.discount)}</strong></button>`;
}

function setQuantity(id, delta, source) {
  const product = byId.get(id);
  if (!product) return;
  const focusedControl = source && document.activeElement === source;
  const count = Math.max(0, Math.min(99, (cart[id] ?? 0) + delta));
  if (count) cart[id] = count;
  else delete cart[id];
  if (!totals().count) promotion = false;
  saveCart();
  updateCartBadge();
  const control = grid.querySelector(`[data-quantity="${id}"]`);
  if (control) control.innerHTML = quantity(product);
  if (cartDialog.open) renderCart();
  const focusRoot = cartDialog.open ? cartContent : control;
  if (focusRoot && focusedControl) {
    const nextFocus = focusRoot.querySelector(`[data-id="${id}"][data-change="${delta}"]`) ??
      focusRoot.querySelector(`[data-id="${id}"]`) ?? focusRoot.querySelector("button");
    nextFocus?.focus({ preventScroll: true });
  }
  if (delta > 0 && !cartDialog.open && !productDialog.open) showToast(`${product.name} · в корзине`);
}

function showToast(message) {
  const toast = get("toast");
  toast.textContent = message;
  toast.classList.add("active");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("active"), 2200);
}

function openProduct(id) {
  const product = byId.get(id);
  if (!product) return;
  get("detail-content").innerHTML = `<img class="detail-photo" src="assets/${id}.webp" alt="">
    <div class="detail-main"><span class="product-meta">${product.info}</span><h2 id="detail-title">${product.name}</h2>
    <p>${product.description}</p><button type="button" class="button" data-detail-add="${id}">Добавить в корзину <strong>${money(product.price)}</strong></button></div>`;
  productDialog.showModal();
}

function checkout() {
  if (!totals().count) return;
  cartTitle.textContent = "Оформление";
  cartContent.innerHTML = `<form id="checkout-form" class="checkout-form">
    <button type="button" class="back-button" data-back>Вернуться в корзину</button>
    <p class="demo-note">Пробный заказ. Используйте вымышленные контактные данные.</p>
    <fieldset class="method"><legend>Как получите заказ</legend>
      <label><input name="method" type="radio" value="courier" checked> Доставка</label>
      <label><input name="method" type="radio" value="pickup"> Самовывоз</label>
    </fieldset>
    <div class="form-row"><label class="field">Имя<input name="name" placeholder="Алекс" required maxlength="70" pattern=".*\\S.*"></label>
    <label class="field">Телефон<input name="phone" type="tel" placeholder="+7 900 000-00-00" required maxlength="25"></label></div>
    <label class="field" id="address-field">Адрес доставки<input name="address" placeholder="Улица, дом, квартира" required maxlength="200" pattern=".*\\S.*"></label>
    <label class="field">Время<select name="time"><option>Как можно скорее</option><option>Через 1 час</option><option>Через 2 часа</option></select></label>
    <label class="field">Оплата<select name="payment"><option>Картой при получении</option><option>Наличными при получении</option></select></label>
    <label class="field">Комментарий<textarea name="comment" placeholder="Домофон, этаж или пожелания к заказу" maxlength="300"></textarea></label>
    <div class="loyalty-box" id="checkout-loyalty"></div>
    <p class="small-note form-status" id="checkout-status" role="status" hidden></p>
    <div id="checkout-summary"></div>
  </form>`;
  cartActions.innerHTML = `<button class="button" type="submit" form="checkout-form">Подтвердить демозаказ <strong id="checkout-total"></strong></button>`;
  const form = get("checkout-form");
  if (checkoutDraft) {
    for (const [name, value] of checkoutDraft) {
      if (name !== "usePoints") form.elements[name].value = value;
    }
  }
  updateCheckout(true);
  cartContent.scrollTop = 0;
  cartContent.querySelector("[data-back]").focus();
}

function updateCheckout(refreshClub = false) {
  const form = get("checkout-form");
  if (!form) return;
  deliveryMethod = form.elements.method.value;
  const pickup = deliveryMethod === "pickup";
  get("address-field").hidden = pickup;
  form.elements.address.disabled = pickup;
  form.elements.address.required = !pickup;
  const amounts = totals(deliveryMethod, true);
  if (refreshClub) {
    const box = get("checkout-loyalty");
    if (amounts.account) {
      if (!form.elements.name.value.trim()) form.elements.name.value = amounts.account.name;
      box.innerHTML = `<p><strong>NORI Club</strong> · На счёте ${rubles.format(amounts.account.balance)} бонусов</p>
        ${amounts.points.available ? `<label><input type="checkbox" name="usePoints" ${useClubPoints ? "checked" : ""}> Списать ${rubles.format(amounts.points.available)} бонусов</label>` : "<p class='small-note'>Бонусы можно списать, когда они появятся на счёте.</p>"}
        <p class="small-note" id="points-earned"></p>`;
    } else {
      box.innerHTML = `<p><strong>NORI Club</strong> · 5% бонусами за заказ</p><p class="small-note"><button type="button" data-open-account>Войти в кабинет</button> или зайти в демопрофиль, чтобы применить бонусы.</p>`;
    }
  }
  const earned = get("points-earned");
  if (earned) earned.textContent = `Начислим за заказ: +${rubles.format(amounts.points.earned)}`;
  get("checkout-summary").innerHTML = summary(amounts);
  get("checkout-total").textContent = money(amounts.total);
}

async function confirmOrder(form) {
  if (inFlightCheckout) return;
  const formData = new FormData(form);
  const phone = String(formData.get("phone")).trim();
  if (!/^\+?[\d\s()-]+$/.test(phone) || !/^(?:7|8)?\d{10}$/.test(phone.replace(/\D/g, ""))) {
    form.elements.phone.setCustomValidity("Введите 10 цифр номера или номер с кодом +7.");
    form.elements.phone.reportValidity();
    return;
  }
  const amounts = totals(deliveryMethod, true);
  if (!amounts.count) return;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  let result;
  if (amounts.account) {
    const order = {
      code, date: new Date().toISOString(), method: deliveryMethod, total: amounts.total,
      items: amounts.items.map(item => ({ name: item.name, quantity: cart[item.id] }))
    };
    const submit = cartActions.querySelector("button");
    inFlightCheckout = true;
    form.inert = true;
    submit.disabled = true;
    try {
      result = await club.recordOrder(amounts.account.id, order, amounts.foodTotal, useClubPoints, amounts.points.spent);
    } catch {
      const status = get("checkout-status");
      status.textContent = "Не удалось сохранить заказ в кабинете. Попробуйте ещё раз.";
      status.hidden = false;
      return;
    } finally {
      inFlightCheckout = false;
      form.inert = false;
      submit.disabled = false;
    }
    if (!result) {
      updateCheckout(true);
      const status = get("checkout-status");
      status.textContent = "Бонусный баланс изменился. Проверьте итог и подтвердите заказ ещё раз.";
      status.hidden = false;
      return;
    }
  }
  cartTitle.textContent = "Заказ оформлен";
  cartContent.innerHTML = `<div class="success">
    <div class="success-mark">${icon("check")}</div><h3>Демозаказ №${code} готов</h3>
    <p>Так клиент увидит подтверждение. Данные пробного заказа доступны на этом экране.</p>
    <div class="receipt" id="receipt"><strong>Состав заказа</strong><ul>${amounts.items.map(item => `<li>${item.name} × ${cart[item.id]}</li>`).join("")}</ul></div>
    </div>`;
  const details = [
    ["Имя", formData.get("name")], ["Телефон", phone],
    ["Получение", deliveryMethod === "pickup" ? "Самовывоз" : "Курьером"],
    ["Адрес", formData.get("address")], ["Время", formData.get("time")],
    ["Оплата", formData.get("payment")], ["Комментарий", formData.get("comment")],
    ["Списано бонусов", result?.spent ? String(result.spent) : ""],
    ["Начислено бонусов", result ? String(result.earned) : ""],
    ["Баланс NORI Club", result ? String(result.balance) : ""],
    ["Итого", money(amounts.total)]
  ];
  const receipt = get("receipt");
  for (const [label, value] of details) {
    if (!value?.trim()) continue;
    const row = document.createElement("p");
    row.textContent = `${label} · ${value.trim()}`;
    receipt.append(row);
  }
  cartActions.innerHTML = `<button type="button" class="button" data-menu>Вернуться к меню</button>`;
  cart = {};
  promotion = false;
  deliveryMethod = "courier";
  useClubPoints = false;
  checkoutDraft = null;
  saveCart();
  updateCartBadge();
  renderProducts();
  cartContent.scrollTop = 0;
  cartActions.querySelector("button").focus();
}

categoryList.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  category = button.dataset.category;
  for (const tab of categoryList.children) tab.setAttribute("aria-pressed", tab === button);
  renderProducts();
});

search.addEventListener("input", renderProducts);

document.addEventListener("click", async event => {
  const button = event.target.closest("button");
  if (!button || inFlightCheckout && cartDialog.contains(button)) return;
  if (button.hasAttribute("data-open-cart")) {
    renderCart();
    cartDialog.showModal();
  } else if (button.hasAttribute("data-close")) {
    button.closest("dialog").close();
  } else if (button.hasAttribute("data-menu")) {
    cartDialog.close();
    get("menu").scrollIntoView();
  } else if (button.hasAttribute("data-checkout")) {
    checkout();
  } else if (button.hasAttribute("data-back")) {
    const form = get("checkout-form");
    checkoutDraft = new FormData(form);
    checkoutDraft.set("address", form.elements.address.value);
    renderCart();
    cartActions.querySelector("button")?.focus();
  } else if (button.dataset.change) {
    setQuantity(button.dataset.id, Number(button.dataset.change), button);
  } else if (button.dataset.product) {
    openProduct(button.dataset.product);
  } else if (button.dataset.detailAdd) {
    const { detailAdd } = button.dataset;
    setQuantity(detailAdd, 1);
    productDialog.close();
    showToast(`${byId.get(detailAdd).name} · в корзине`);
  } else if (button.id === "copy-promo") {
    try {
      await navigator.clipboard.writeText("NORI10");
      showToast("Промокод NORI10 скопирован");
    } catch {
      showToast("Ваш промокод · NORI10");
    }
  }
});

cartDialog.addEventListener("submit", event => {
  event.preventDefault();
  if (event.target.id === "checkout-form") {
    confirmOrder(event.target);
    return;
  }
  const valid = event.target.elements.code.value.trim().toUpperCase() === "NORI10";
  if (valid) {
    promotion = true;
    renderCart();
    cartContent.querySelector("[name=code]").focus();
  } else {
    get("promo-status").textContent = "Промокод не найден. Проверьте написание.";
  }
});

cartDialog.addEventListener("change", event => {
  if (event.target.name === "method") updateCheckout();
  if (event.target.name === "usePoints") {
    useClubPoints = event.target.checked;
    updateCheckout();
  }
});

cartDialog.addEventListener("input", event => {
  if (event.target.name === "phone") event.target.setCustomValidity("");
});

cartDialog.addEventListener("close", () => {
  checkoutDraft = null;
  deliveryMethod = "courier";
  useClubPoints = false;
  cartContent.replaceChildren();
  cartActions.replaceChildren();
});
cartDialog.addEventListener("cancel", event => {
  if (inFlightCheckout) event.preventDefault();
});
document.addEventListener("nori:account", () => {
  if (!club.current()) useClubPoints = false;
  updateCheckout(true);
});

for (const dialog of [cartDialog, productDialog]) {
  dialog.addEventListener("click", event => {
    if (event.target !== dialog || inFlightCheckout) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}

const header = get("site-header");
function updateHeader() {
  header.classList.toggle("is-scrolled", window.scrollY > 40);
}
window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();
renderCategories();
renderProducts();
updateCartBadge();
