/* Trip Check — a packing checklist that clears itself each new day.
   Everything lives in localStorage: no backend, no accounts. */

(function () {
  "use strict";

  var STORAGE_KEY = "tripCheck.v1";
  var HOLD_MS = 550; // keep in sync with --hold in styles.css
  var MOVE_TOLERANCE = 12; // px of finger drift before a hold counts as a scroll

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
  var addBtn = document.getElementById("addBtn");
  var popoverEl = document.getElementById("popover");
  var popoverHintEl = document.getElementById("popoverHint");
  var formEl = document.getElementById("addForm");
  var inputEl = document.getElementById("addInput");
  var resetBtn = document.getElementById("resetBtn");
  var scrimEl = document.getElementById("scrim");
  var toastEl = document.getElementById("toast");
  var toastMsgEl = document.getElementById("toastMsg");
  var toastActionEl = document.getElementById("toastAction");

  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  var TRASH_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
    '<path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>';

  /* ---------- toast ---------- */

  var toastTimer;
  var undoHandler = null;

  function toast(msg, onUndo) {
    toastMsgEl.textContent = msg;
    undoHandler = onUndo || null;
    toastActionEl.hidden = !undoHandler;
    toastEl.classList.add("is-visible");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, undoHandler ? 4000 : 2200);
  }

  function hideToast() {
    toastEl.classList.remove("is-visible");
    undoHandler = null;
    toastActionEl.hidden = true;
  }

  toastActionEl.addEventListener("click", function () {
    if (undoHandler) undoHandler();
    hideToast();
  });

  /* ---------- rendering ---------- */

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

    fillEl.style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
    fillEl.classList.toggle("is-done", total > 0 && done === total);

    if (!total) {
      progressTextEl.textContent = "No items yet";
    } else if (done === total) {
      progressTextEl.textContent = "All packed — you're good to go";
    } else {
      progressTextEl.textContent = done + " of " + total + " packed";
    }

    emptyEl.hidden = total > 0;
  }

  function createItemEl(item, index) {
    var li = document.createElement("li");
    li.className = "item" + (item.checked ? " is-checked" : "");
    li.dataset.id = item.id;
    li.style.setProperty("--i", index);
    li.setAttribute("role", "checkbox");
    li.setAttribute("aria-checked", item.checked ? "true" : "false");
    li.tabIndex = 0;

    var box = document.createElement("span");
    box.className = "item__box";
    box.innerHTML = CHECK_SVG;

    var label = document.createElement("span");
    label.className = "item__label";
    label.textContent = item.label;

    var hold = document.createElement("span");
    hold.className = "item__hold";
    hold.innerHTML = TRASH_SVG;

    li.appendChild(box);
    li.appendChild(label);
    li.appendChild(hold);
    return li;
  }

  function renderList() {
    listEl.innerHTML = "";
    state.items.forEach(function (item, i) {
      listEl.appendChild(createItemEl(item, i));
    });
    renderProgress();
  }

  /* ---------- actions ---------- */

  function findItem(id) {
    return state.items.find(function (it) {
      return it.id === id;
    });
  }

  // Updates just this tile instead of rebuilding the grid, so nothing flickers
  // and the entrance animations don't replay.
  function toggle(id) {
    var item = findItem(id);
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
    var index = state.items.findIndex(function (it) {
      return it.id === id;
    });
    if (index === -1) return;

    var item = state.items[index];
    var li = listEl.querySelector('[data-id="' + id + '"]');

    state.items.splice(index, 1);
    save();

    if (li) {
      li.classList.remove("is-holding");
      li.classList.add("is-removing");
      setTimeout(function () {
        if (li.parentNode) li.parentNode.removeChild(li);
      }, 260);
    }
    renderProgress();

    toast("Removed " + item.label, function () {
      state.items.splice(Math.min(index, state.items.length), 0, item);
      save();
      renderList();
    });
  }

  function existing(label) {
    var wanted = label.trim().toLowerCase();
    return state.items.find(function (it) {
      return it.label.toLowerCase() === wanted;
    });
  }

  function showHint(msg) {
    popoverHintEl.textContent = msg;
    popoverHintEl.classList.add("is-visible");
    popoverEl.classList.remove("is-shaking");
    void popoverEl.offsetWidth; // restart the animation
    popoverEl.classList.add("is-shaking");
  }

  function clearHint() {
    popoverHintEl.classList.remove("is-visible");
    popoverEl.classList.remove("is-shaking");
  }

  // Points out the tile that already exists rather than silently doing nothing.
  function flash(id) {
    var li = listEl.querySelector('[data-id="' + id + '"]');
    if (!li) return;
    li.scrollIntoView({ block: "nearest", behavior: "smooth" });
    li.classList.remove("is-flash");
    void li.offsetWidth;
    li.classList.add("is-flash");
    setTimeout(function () {
      li.classList.remove("is-flash");
    }, 700);
  }

  function add(rawLabel) {
    var label = rawLabel.trim().replace(/\s+/g, " ");
    if (!label) return;

    var dupe = existing(label);
    if (dupe) {
      showHint('"' + dupe.label + '" is already on the list');
      flash(dupe.id);
      inputEl.select();
      return;
    }

    var item = makeItem(label);
    state.items.push(item);
    save();

    var li = createItemEl(item, 0);
    listEl.appendChild(li);
    renderProgress();

    inputEl.value = "";
    clearHint();
  }

  function resetChecks() {
    resetBtn.classList.remove("is-spinning");
    void resetBtn.offsetWidth;
    resetBtn.classList.add("is-spinning");

    var checked = state.items.filter(function (it) {
      return it.checked;
    });
    if (!checked.length) {
      toast("Nothing to reset");
      return;
    }

    checked.forEach(function (it) {
      it.checked = false;
    });
    state.date = today();
    save();

    Array.prototype.forEach.call(
      listEl.querySelectorAll(".item.is-checked"),
      function (li) {
        li.classList.remove("is-checked");
        li.setAttribute("aria-checked", "false");
      }
    );
    renderProgress();

    toast("Checklist cleared", function () {
      checked.forEach(function (it) {
        it.checked = true;
      });
      save();
      renderList();
    });
  }

  /* ---------- popover ---------- */

  function openPopover() {
    popoverEl.classList.add("is-open");
    scrimEl.classList.add("is-open");
    addBtn.classList.add("is-open");
    addBtn.setAttribute("aria-expanded", "true");
    clearHint();
    setTimeout(function () {
      inputEl.focus();
    }, 120);
  }

  function closePopover() {
    popoverEl.classList.remove("is-open");
    scrimEl.classList.remove("is-open");
    addBtn.classList.remove("is-open");
    addBtn.setAttribute("aria-expanded", "false");
    inputEl.blur();
    clearHint();
  }

  function togglePopover() {
    if (popoverEl.classList.contains("is-open")) closePopover();
    else openPopover();
  }

  addBtn.addEventListener("click", togglePopover);
  scrimEl.addEventListener("click", closePopover);

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    add(inputEl.value);
  });

  inputEl.addEventListener("input", clearHint);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && popoverEl.classList.contains("is-open")) {
      closePopover();
    }
  });

  /* ---------- tap to check, hold to delete ---------- */

  var holdTimer = null;
  var holdEl = null;
  var holdFired = false;
  var startX = 0;
  var startY = 0;

  function cancelHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    if (holdEl) holdEl.classList.remove("is-holding");
    holdEl = null;
  }

  listEl.addEventListener("pointerdown", function (e) {
    var li = e.target.closest(".item");
    if (!li || e.button === 2) return;

    holdFired = false;
    holdEl = li;
    startX = e.clientX;
    startY = e.clientY;
    li.classList.add("is-holding");

    holdTimer = setTimeout(function () {
      holdFired = true;
      var id = li.dataset.id;
      cancelHold();
      remove(id);
    }, HOLD_MS);
  });

  // A finger that drifts is a scroll, not a hold.
  listEl.addEventListener("pointermove", function (e) {
    if (!holdEl) return;
    if (
      Math.abs(e.clientX - startX) > MOVE_TOLERANCE ||
      Math.abs(e.clientY - startY) > MOVE_TOLERANCE
    ) {
      cancelHold();
    }
  });

  listEl.addEventListener("pointerup", function (e) {
    var li = e.target.closest(".item");
    var wasHolding = holdEl;
    cancelHold();
    if (holdFired || !li || li !== wasHolding) return;
    toggle(li.dataset.id);
  });

  listEl.addEventListener("pointercancel", cancelHold);
  listEl.addEventListener("pointerleave", cancelHold);

  // Stop iOS/desktop showing their own long-press menus over a tile.
  listEl.addEventListener("contextmenu", function (e) {
    if (e.target.closest(".item")) e.preventDefault();
  });

  listEl.addEventListener("keydown", function (e) {
    var li = e.target.closest(".item");
    if (!li) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(li.dataset.id);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(li.dataset.id);
    }
  });

  resetBtn.addEventListener("click", resetChecks);

  // If the app is left open (or backgrounded on the phone) past midnight,
  // roll over as soon as it comes back into view.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (rolloverIfNewDay()) {
      renderDate();
      renderList();
      toast("New day — checklist reset");
    }
  });

  /* ---------- start ---------- */

  renderDate();
  renderList();
  if (rolledOver) toast("New day — checklist reset");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
