/* Trip Check — a packing checklist that clears itself each new day.
   Everything lives in localStorage: no backend, no accounts. */

(function () {
  "use strict";

  var STORAGE_KEY = "tripCheck.v1";

  var DEFAULT_ITEMS = [
    "Wallet",
    "Phone charger",
    "Water bottle",
    "Towel",
    "Shoes",
    "Toothbrush",
    "Earphones",
    "Power bank",
  ];

  // Local calendar day (NOT UTC) so the reset happens at your midnight.
  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function makeItem(label) {
    return {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
      label: label,
      checked: false,
    };
  }

  function defaultState() {
    return { date: today(), items: DEFAULT_ITEMS.map(makeItem) };
  }

  function load() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return defaultState(); // private mode / storage blocked
    }
    if (!raw) return defaultState();

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return defaultState(); // corrupted — start fresh
    }
    if (!parsed || !Array.isArray(parsed.items)) return defaultState();

    return { date: parsed.date, items: parsed.items };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage full or blocked — the UI still works for this session */
    }
  }

  /* ---------- state ---------- */

  var state = load();

  // Clears ticks (keeps the list) when the stored day is not today.
  function rolloverIfNewDay() {
    if (state.date === today()) return false;
    state.date = today();
    state.items.forEach(function (it) {
      it.checked = false;
    });
    save();
    return true;
  }

  var rolledOver = rolloverIfNewDay();

  /* ---------- elements ---------- */

  var listEl = document.getElementById("list");
  var emptyEl = document.getElementById("empty");
  var dateLineEl = document.getElementById("dateLine");
  var fillEl = document.getElementById("progressFill");
  var progressTextEl = document.getElementById("progressText");
  var formEl = document.getElementById("addForm");
  var inputEl = document.getElementById("addInput");
  var resetBtn = document.getElementById("resetBtn");
  var toastEl = document.getElementById("toast");

  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2200);
  }

  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  /* ---------- render ---------- */

  function renderDate() {
    dateLineEl.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function renderProgress() {
    var total = state.items.length;
    var done = state.items.filter(function (it) {
      return it.checked;
    }).length;
    var pct = total ? Math.round((done / total) * 100) : 0;

    fillEl.style.width = pct + "%";
    fillEl.classList.toggle("is-done", total > 0 && done === total);

    if (!total) {
      progressTextEl.textContent = "No items yet";
    } else if (done === total) {
      progressTextEl.textContent = "All packed — you're good to go";
    } else {
      progressTextEl.textContent = done + " of " + total + " packed";
    }
  }

  function renderList() {
    listEl.innerHTML = "";

    state.items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "item" + (item.checked ? " is-checked" : "");
      li.dataset.id = item.id;
      li.setAttribute("role", "checkbox");
      li.setAttribute("aria-checked", item.checked ? "true" : "false");
      li.tabIndex = 0;

      var box = document.createElement("span");
      box.className = "item__box";
      box.innerHTML = CHECK_SVG;

      var label = document.createElement("span");
      label.className = "item__label";
      label.textContent = item.label;

      var del = document.createElement("button");
      del.className = "item__del";
      del.type = "button";
      del.textContent = "✕";
      del.setAttribute("aria-label", "Delete " + item.label);

      li.appendChild(box);
      li.appendChild(label);
      li.appendChild(del);
      listEl.appendChild(li);
    });

    emptyEl.hidden = state.items.length > 0;
    renderProgress();
  }

  function render() {
    renderDate();
    renderList();
  }

  /* ---------- actions ---------- */

  // Updates just this row instead of rebuilding the list, so tapping stays
  // snappy and nothing flickers.
  function toggle(id) {
    var item = state.items.find(function (it) {
      return it.id === id;
    });
    if (!item) return;

    item.checked = !item.checked;
    save();

    var li = listEl.querySelector('[data-id="' + id + '"]');
    if (li) {
      li.classList.toggle("is-checked", item.checked);
      li.setAttribute("aria-checked", item.checked ? "true" : "false");
    }
    renderProgress();
  }

  function remove(id) {
    var item = state.items.find(function (it) {
      return it.id === id;
    });
    state.items = state.items.filter(function (it) {
      return it.id !== id;
    });
    save();
    renderList();
    if (item) toast("Removed " + item.label);
  }

  function add(label) {
    label = label.trim();
    if (!label) return;

    var dupe = state.items.some(function (it) {
      return it.label.toLowerCase() === label.toLowerCase();
    });
    if (dupe) {
      toast(label + " is already on the list");
      return;
    }

    state.items.push(makeItem(label));
    save();
    renderList();
  }

  function resetChecks() {
    var any = state.items.some(function (it) {
      return it.checked;
    });
    if (!any) {
      toast("Nothing to reset");
      return;
    }
    state.items.forEach(function (it) {
      it.checked = false;
    });
    state.date = today();
    save();
    renderList();
    toast("Checklist cleared");
  }

  /* ---------- events ---------- */

  listEl.addEventListener("click", function (e) {
    var li = e.target.closest(".item");
    if (!li) return;
    if (e.target.closest(".item__del")) {
      remove(li.dataset.id);
    } else {
      toggle(li.dataset.id);
    }
  });

  listEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var li = e.target.closest(".item");
    if (!li) return;
    e.preventDefault();
    toggle(li.dataset.id);
  });

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    add(inputEl.value);
    inputEl.value = "";
    inputEl.blur();
  });

  resetBtn.addEventListener("click", resetChecks);

  // If the app is left open (or backgrounded on the phone) past midnight,
  // roll over as soon as it comes back into view.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (rolloverIfNewDay()) {
      render();
      toast("New day — checklist reset");
    }
  });

  /* ---------- start ---------- */

  render();
  if (rolledOver) toast("New day — checklist reset");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
