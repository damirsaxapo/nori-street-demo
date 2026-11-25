"use strict";

const club = (() => {
  const accountKey = "nori-street-club-v1";
  const sessionKey = "nori-street-member-v1";
  const dialog = document.getElementById("account-dialog");
  const content = document.getElementById("account-content");
  const label = document.getElementById("account-header-label");
  const callToAction = document.getElementById("club-cta");
  const currency = new Intl.NumberFormat("ru-RU");
  const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  let session = readSession();
  let mode = "login";
  let returnToOrder = false;
  let busy = false;

  function readSession() {
    try {
      return sessionStorage.getItem(sessionKey);
    } catch {
      return null;
    }
  }

  function readAccounts() {
    try {
      const stored = JSON.parse(localStorage.getItem(accountKey));
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function writeAccounts(accounts) {
    localStorage.setItem(accountKey, JSON.stringify(accounts));
  }

  function current() {
    return session ? readAccounts().find(account => account.id === session) ?? null : null;
  }

  function withAccounts(update) {
    return navigator.locks ? navigator.locks.request(accountKey, update) : Promise.resolve().then(update);
  }

  function publish() {
    const account = current();
    label.textContent = account ? "Кабинет" : "Войти";
    callToAction.textContent = account ? "Мой кабинет" : "Вступить в клуб";
    document.dispatchEvent(new CustomEvent("nori:account"));
  }

  function setSession(id) {
    session = id;
    try {
      if (id) sessionStorage.setItem(sessionKey, id);
      else sessionStorage.removeItem(sessionKey);
    } catch {
      // The active session remains available in memory.
    }
    publish();
  }

  async function passwordHash(password, salt) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 150000
    }, key, 256);
    return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function amounts(foodTotal, balance, usePoints) {
    const available = Math.min(balance, Math.floor(foodTotal * .3));
    const spent = usePoints ? available : 0;
    return { available, spent, earned: Math.floor((foodTotal - spent) * .05) };
  }

  function recordOrder(ownerId, order, foodTotal, usePoints, quotedPoints) {
    return withAccounts(() => {
      const accounts = readAccounts();
      const account = accounts.find(item => item.id === ownerId);
      if (!account || session !== ownerId) return null;
      const { spent, earned } = amounts(foodTotal, account.balance, usePoints);
      if (spent !== quotedPoints) return null;
      account.balance += earned - spent;
      account.orders = [{ ...order, spent, earned }, ...account.orders].slice(0, 25);
      writeAccounts(accounts);
      return { spent, earned, balance: account.balance };
    });
  }

  function appendText(parent, tag, value, className) {
    const child = document.createElement(tag);
    child.textContent = value;
    if (className) child.className = className;
    parent.append(child);
    return child;
  }

  function renderProfile(account) {
    content.innerHTML = `<div class="account-profile"><h3 class="account-hello" id="account-hello"></h3>
      <div class="account-card"><p class="eyebrow">NORI CLUB</p><div class="balance" id="club-balance"></div><small class="balance-label">Бонусов на счёте</small></div>
      <p class="small-note">Начисляем 5% от оплаченной стоимости блюд. Бонусы можно списать при следующем заказе.</p>
      <section aria-labelledby="history-title"><h3 class="history-title" id="history-title">История заказов</h3><div class="history-list" id="history-list"></div></section>
      <button type="button" class="button subtle" data-signout>Выйти из кабинета</button></div>`;
    document.getElementById("account-hello").textContent = `Здравствуйте, ${account.name}`;
    document.getElementById("club-balance").textContent = currency.format(account.balance);
    const history = document.getElementById("history-list");
    if (!account.orders.length) {
      appendText(history, "p", "Здесь появятся ваши пробные заказы.");
      return;
    }
    for (const order of account.orders) {
      const entry = document.createElement("details");
      appendText(entry, "summary", `№${order.code} · ${currency.format(order.total)} ₽`);
      const time = appendText(entry, "time", dateFormat.format(new Date(order.date)));
      time.dateTime = order.date;
      const items = document.createElement("ul");
      for (const item of order.items) appendText(items, "li", `${item.name} × ${item.quantity}`);
      entry.append(items);
      appendText(entry, "p", `${order.method === "pickup" ? "Самовывоз" : "Доставка"} · Начислено: ${order.earned} · Списано: ${order.spent}`);
      history.append(entry);
    }
  }

  function render() {
    const account = current();
    if (account) {
      renderProfile(account);
      return;
    }
    const registering = mode === "register";
    content.innerHTML = `<div class="account-options" aria-label="Действие с аккаунтом">
      <button type="button" class="category" data-account-mode="login" aria-pressed="${!registering}">Вход</button>
      <button type="button" class="category" data-account-mode="register" aria-pressed="${registering}">Регистрация</button>
      </div><p class="account-intro">Демо NORI Club. Используйте вымышленные данные. Профиль и история сохраняются в этом браузере.</p>
      <form class="account-form" id="club-form">
        ${registering ? `<label class="field">Имя<input name="memberName" placeholder="Алекс" maxlength="50" required pattern=".*\\S.*" autocomplete="off"></label>` : ""}
        <label class="field">Эл. почта<input name="email" type="email" maxlength="120" placeholder="alex@example.com" required autocomplete="off" spellcheck="false"></label>
        <label class="field">Пароль<input name="password" type="password" minlength="6" maxlength="120" required autocomplete="${registering ? "new-password" : "current-password"}">${registering ? `<span class="small-note">От 6 символов</span>` : ""}</label>
        <p class="small-note form-status" id="account-status" role="status" hidden></p>
        <button type="submit" class="button">${registering ? "Создать аккаунт" : "Войти в кабинет"}</button>
      </form>
      <button type="button" class="button subtle account-demo" data-demo-login>Демо-вход · 350 бонусов на старте</button>`;
  }

  function status(message) {
    const target = document.getElementById("account-status");
    if (!target) return;
    target.textContent = message;
    target.hidden = false;
  }

  function signedIn(id) {
    if (!dialog.open) return;
    setSession(id);
    if (returnToOrder) {
      dialog.close();
      const field = document.querySelector("#checkout-loyalty input") ?? document.querySelector("#checkout-form [name=phone]");
      field?.focus();
    } else {
      render();
      const heading = document.getElementById("account-hello");
      heading.tabIndex = -1;
      heading.focus();
    }
  }

  async function authenticate(form) {
    const data = new FormData(form);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = data.get("password");
    if (mode === "register") {
      const salt = crypto.randomUUID();
      const hash = await passwordHash(password, salt);
      const account = {
        id: crypto.randomUUID(), email, name: String(data.get("memberName")).trim(), salt, hash, balance: 0, orders: []
      };
      const created = await withAccounts(() => {
        const accounts = readAccounts();
        if (accounts.some(candidate => candidate.email === email)) return false;
        writeAccounts([...accounts, account]);
        return true;
      });
      if (created) signedIn(account.id);
      else status("Такой аккаунт уже есть. Переключитесь на вход.");
      return;
    }
    const account = readAccounts().find(candidate => candidate.email === email);
    if (account && account.hash === await passwordHash(password, account.salt)) signedIn(account.id);
    else status("Проверьте адрес почты и пароль.");
  }

  async function demo() {
    await withAccounts(() => {
      const accounts = readAccounts();
      if (accounts.some(account => account.id === "demo")) return;
      accounts.push({ id: "demo", name: "гость NORI", balance: 350, orders: [] });
      writeAccounts(accounts);
    });
    signedIn("demo");
  }

  async function runAuth(action) {
    if (busy) return;
    busy = true;
    content.setAttribute("aria-busy", "true");
    try {
      await action();
    } catch {
      status("Не удалось открыть профиль. Проверьте доступ к хранилищу браузера.");
    } finally {
      busy = false;
      content.removeAttribute("aria-busy");
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-open-account]");
    if (!button || dialog.open) return;
    mode = button.dataset.openAccount === "register" ? "register" : "login";
    returnToOrder = Boolean(button.closest("#cart-dialog"));
    render();
    dialog.showModal();
  });

  dialog.addEventListener("click", event => {
    if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left && !busy) dialog.close();
    const button = event.target.closest("button");
    if (!button || busy) return;
    if (button.hasAttribute("data-account-close")) dialog.close();
    if (button.dataset.accountMode) {
      mode = button.dataset.accountMode;
      render();
      content.querySelector("[aria-pressed=true]").focus();
    }
    if (button.hasAttribute("data-demo-login")) runAuth(demo);
    if (button.hasAttribute("data-signout")) {
      setSession(null);
      mode = "login";
      render();
      content.querySelector("[name=email]").focus();
    }
  });

  dialog.addEventListener("submit", event => {
    event.preventDefault();
    runAuth(() => authenticate(event.target));
  });
  dialog.addEventListener("cancel", event => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener("close", () => content.replaceChildren());

  window.addEventListener("storage", event => {
    if (event.key !== accountKey && event.key !== null) return;
    publish();
    if (dialog.open && !busy && current()) render();
  });

  publish();
  return { current, amounts, recordOrder };
})();
