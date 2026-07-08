/* CommutePilot web client v3.
   - Fresh content every load: card slots rotate through their chains
     (already-played picks deprioritized), splatter re-samples with a
     recently-seen exclusion window.
   - Continue card: your last pick pins to the top while it's plausibly
     unfinished (longer than one commute), until you mark it done.
   - Stars: save any episode for later; saving nudges its topics up.
   - Exploration floor: 30% of every splatter ignores your weights. */

const state = {
  session: null,
  validated: null,
  taxonomy: null,
  discover: null,
  interests: {},
  swapIdx: {},              // slot -> offset within the slot's (shuffled) chain
  chains: {},               // slot -> ordered episode-id chain for this load
  splatter: [],
  itemIndex: {},            // id -> snapshot (everything rendered this load)
};

const EXPLORATION_SHARE = 0.3;
const SPLATTER_SIZE = 12;
const SEEN_WINDOW = 36;     // splatter ids excluded from re-sampling
const CONTINUE_MAX_AGE_H = 72;

const BRANCH_COLORS = {
  engineering: "#4c9aff", science: "#b07ce8", history: "#e8a04c",
  craft: "#56c58f", business: "#4cc9c0", comedy: "#e87ca0",
};

const $ = (sel, el = document) => el.querySelector(sel);

/* ---------- storage helpers ---------- */

function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function logEvent(type, payload) {
  const events = lsGet("cp_events", []);
  events.push({ ts: new Date().toISOString(), type, payload });
  lsSet("cp_events", events.slice(-500));
}

/* ---------- interests ---------- */

function leafNodes() {
  return (state.taxonomy?.nodes || []).filter(n => n.parent !== null);
}

function loadInterests() {
  const saved = lsGet("cp_interests", {});
  leafNodes().forEach(n => {
    state.interests[n.id] = saved[n.id] ?? Math.max(0, n.weight);
  });
}

function saveInterests() { lsSet("cp_interests", state.interests); }

function boostTopics(topics, amount) {
  (topics || []).forEach(t => {
    if (t in state.interests) {
      state.interests[t] = Math.min(1, state.interests[t] + amount);
    }
  });
  saveInterests();
}

/* ---------- episode / snapshot helpers ---------- */

function episode(id) {
  const ep = state.session.episodes[id];
  if (!ep) return null;
  const v = state.validated?.episodes?.[id];
  return v ? {
    ...ep,
    apple_track_id: ep.apple_track_id ?? v.apple_track_id,
    artwork_url: v.artwork_url || ep.artwork_url || null,
    apple_episode_url: v.apple_episode_url || null,
  } : ep;
}

function snapshot(id, src) {
  const snap = {
    id, show: src.show, title: src.title,
    apple_collection_id: src.apple_collection_id,
    apple_track_id: src.apple_track_id ?? null,
    apple_episode_url: src.apple_episode_url ?? null,
    duration_min: src.duration_min ?? null,
    artwork_url: src.artwork_url ?? null,
    topics: src.topics || [],
    hook: src.hook || src.summary || src.title,
  };
  state.itemIndex[id] = snap;
  return snap;
}

function links(item) {
  const cid = item.apple_collection_id;
  const apple = item.apple_episode_url
    || (item.apple_track_id
        ? `https://podcasts.apple.com/us/podcast/id${cid}?i=${item.apple_track_id}`
        : `https://podcasts.apple.com/us/podcast/id${cid}`);
  return { apple, overcast: `https://overcast.fm/itunes${cid}`, podlink: `https://pod.link/${cid}` };
}

function fmtDur(min) {
  if (!min) return "";
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`;
}

function branchOf(item) {
  const t = item.topics?.[0] || "";
  return t.split("/")[0] || "other";
}

/* ---------- stars ---------- */

function savedMap() { return lsGet("cp_saved", {}); }

function isSaved(id) { return id in savedMap(); }

function toggleStar(id) {
  const saved = savedMap();
  if (saved[id]) {
    delete saved[id];
    logEvent("unsaved", { episode_id: id });
  } else {
    const snap = state.itemIndex[id];
    if (!snap) return;
    saved[id] = { ...snap, saved_at: new Date().toISOString() };
    boostTopics(snap.topics, 0.05);
    logEvent("saved", { episode_id: id, topics: snap.topics });
  }
  lsSet("cp_saved", saved);
  renderSavedShelf();
  document.querySelectorAll(`[data-star="${CSS.escape(id)}"]`).forEach(b => {
    b.textContent = isSaved(id) ? "★" : "☆";
    b.classList.toggle("on", isSaved(id));
  });
}

function starBtn(id) {
  const on = isSaved(id);
  return `<button class="star ${on ? "on" : ""}" data-star="${id}" aria-label="Save for later">${on ? "★" : "☆"}</button>`;
}

/* ---------- continue card ---------- */

function currentContinue() {
  const last = lsGet("cp_lastpick", null);
  if (!last) return null;
  const ageH = (Date.now() - new Date(last.ts).getTime()) / 3.6e6;
  const commuteMin = state.session.commute.content_minutes || 27;
  if (ageH > CONTINUE_MAX_AGE_H) return null;
  if ((last.duration_min || 0) <= commuteMin + 5) return null; // plausibly finished in one drive
  return last;
}

function renderContinue() {
  const el = $("#continue-slot");
  const c = currentContinue();
  if (!c) { el.innerHTML = ""; return; }
  snapshot(c.id, c);
  const l = links(c);
  el.innerHTML = `<article class="card continue">
    <span class="chip">Continue</span>
    ${starBtn(c.id)}
    <div class="head">
      ${c.artwork_url ? `<img class="art" src="${c.artwork_url}" alt="" loading="lazy">` : ""}
      <div>
        <p class="show">${c.show}</p>
        <h2>${c.title}</h2>
      </div>
    </div>
    <p class="fit">Picking back up where you left off — your app remembers the spot.</p>
    <div class="btns">
      <a class="primary" href="${l.apple}" target="_blank" rel="noopener" data-ev="picked" data-ep="${c.id}" data-app="Apple Podcasts" data-ctx="continue">Resume</a>
      <a href="${l.overcast}" target="_blank" rel="noopener" data-ev="picked" data-ep="${c.id}" data-app="Overcast" data-ctx="continue">Overcast</a>
      <button class="done" id="continue-done">Done with it ✓</button>
    </div>
  </article>`;
  $("#continue-done").addEventListener("click", () => {
    logEvent("finished", { episode_id: c.id, topics: c.topics });
    boostTopics(c.topics, 0.05);
    lsSet("cp_lastpick", null);
    renderContinue();
  });
  bindPickLogging(el);
  bindStars(el);
}

/* ---------- fresh card chains ---------- */

function pickedHistory() { return lsGet("cp_history", []); }

function buildChains() {
  const history = new Set(pickedHistory());
  state.session.cards.forEach(card => {
    const all = [card.episode_id, ...(card.alternates || [])];
    const fresh = all.filter(id => !history.has(id));
    const stale = all.filter(id => history.has(id));
    // Shuffle the fresh ones so each load leads with something new;
    // already-played picks sink to the back of the chain.
    const shuffled = fresh.sort(() => Math.random() - 0.5).concat(stale);
    state.chains[card.slot] = shuffled.length ? shuffled : all;
  });
}

/* ---------- the splatter ---------- */

function splatterPool() {
  if (state.discover?.items?.length) return state.discover.items;
  return Object.keys(state.session.episodes).map(id => snapshot(id, episode(id)));
}

function interestScore(item) {
  const ts = item.topics || [];
  if (!ts.length) return 0.5;
  const vals = ts.map(t => state.interests[t] ?? 0.5);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function sampleSplatter() {
  let pool = [...splatterPool()];
  if (!pool.length) return [];

  const seen = new Set(lsGet("cp_seen", []));
  if (pool.length > SPLATTER_SIZE * 2) {
    const unseen = pool.filter(i => !seen.has(i.id));
    if (unseen.length >= SPLATTER_SIZE) pool = unseen;
  }

  const nExplore = Math.round(SPLATTER_SIZE * EXPLORATION_SHARE);
  const nWeighted = Math.min(SPLATTER_SIZE - nExplore, pool.length);

  const scored = pool
    .map(item => ({ item, s: interestScore(item) + (Math.random() - 0.5) * 0.6 }))
    .sort((a, b) => b.s - a.s);

  const picked = [];
  const perShow = {};
  for (const { item } of scored) {
    if (picked.length >= nWeighted) break;
    if ((perShow[item.show] || 0) >= 2) continue;
    picked.push(item);
    perShow[item.show] = (perShow[item.show] || 0) + 1;
  }

  const rest = pool.filter(i => !picked.includes(i));
  for (let k = 0; k < nExplore && rest.length; k++) {
    const idx = Math.floor(Math.random() * rest.length);
    const item = rest.splice(idx, 1)[0];
    if ((perShow[item.show] || 0) >= 2) { k--; continue; }
    item._explore = true;
    picked.push(item);
    perShow[item.show] = (perShow[item.show] || 0) + 1;
  }

  const remaining = [...picked].sort(() => Math.random() - 0.5);
  const ordered = [];
  while (remaining.length) {
    const prev = ordered[ordered.length - 1];
    let idx = remaining.findIndex(i => !prev || branchOf(i) !== branchOf(prev));
    if (idx === -1) idx = 0;
    ordered.push(remaining.splice(idx, 1)[0]);
  }

  // Remember what was shown so next load skews new
  const seenArr = lsGet("cp_seen", []).concat(ordered.map(i => i.id));
  lsSet("cp_seen", seenArr.slice(-SEEN_WINDOW));

  ordered.forEach(i => snapshot(i.id, i));
  return ordered;
}

function renderSplatter() {
  const el = $("#splatter-body");
  if (!state.splatter.length) { el.innerHTML = ""; return; }
  el.innerHTML = state.splatter.map(item => {
    const l = links(item);
    const dot = BRANCH_COLORS[branchOf(item)] || "var(--text-dim)";
    return `<div class="sp-item">
      ${item.artwork_url ? `<img class="sp-art" src="${item.artwork_url}" alt="" loading="lazy">` : `<div class="sp-art"></div>`}
      <div class="sp-info">
        <p class="sp-hook">${item.hook || item.title}</p>
        <p class="sp-meta"><span class="dot" style="background:${dot}"></span>${item.show} · ${fmtDur(item.duration_min)}${item._explore ? ` · <span class="wild">wildcard</span>` : ""}</p>
      </div>
      ${starBtn(item.id)}
      <a class="go" href="${l.apple}" target="_blank" rel="noopener"
         data-ev="picked" data-ep="${item.id}" data-app="Apple Podcasts" data-ctx="splatter${item._explore ? "-explore" : ""}">Play</a>
    </div>`;
  }).join("");
  bindPickLogging(el);
  bindStars(el);
}

/* ---------- saved shelf ---------- */

function renderSavedShelf() {
  const el = $("#saved-shelf");
  const saved = Object.values(savedMap()).sort((a, b) => (b.saved_at || "").localeCompare(a.saved_at || ""));
  if (!saved.length) { el.innerHTML = ""; return; }
  saved.forEach(s => { state.itemIndex[s.id] = s; });
  el.innerHTML = `<details class="cat" open>
    <summary><span>Saved for later<span class="desc">${saved.length} starred — saving also teaches your interests.</span></span></summary>
    ${saved.map(item => {
      const l = links(item);
      return `<div class="ep-row">
        <div class="info">
          <div class="t">${item.title}</div>
          <div class="s">${item.show} · ${fmtDur(item.duration_min)}</div>
        </div>
        ${starBtn(item.id)}
        <a class="go" href="${l.apple}" target="_blank" rel="noopener"
           data-ev="picked" data-ep="${item.id}" data-app="Apple Podcasts" data-ctx="saved">Play</a>
      </div>`;
    }).join("")}
  </details>`;
  bindPickLogging(el);
  bindStars(el);
}

/* ---------- interests panel ---------- */

function renderInterests() {
  const el = $("#interests-body");
  if (!state.taxonomy) { el.innerHTML = ""; return; }
  el.innerHTML = leafNodes().map(n => `
    <label class="int-row">
      <span class="int-label">${n.label}</span>
      <input type="range" min="0" max="100" value="${Math.round((state.interests[n.id] ?? 0.5) * 100)}" data-node="${n.id}">
    </label>`).join("") +
    `<p class="int-note">These tilt the splatter — but 3 in 10 picks always ignore them. Surprise is the point.</p>`;

  el.querySelectorAll("input[type=range]").forEach(input => {
    input.addEventListener("change", () => {
      state.interests[input.dataset.node] = Number(input.value) / 100;
      saveInterests();
      logEvent("interest_adjusted", { node: input.dataset.node, value: Number(input.value) / 100 });
      state.splatter = sampleSplatter();
      renderSplatter();
    });
  });
}

/* ---------- session cards ---------- */

function playButtons(item, ctx) {
  const l = links(item);
  const mk = (href, label, cls) =>
    `<a class="${cls}" href="${href}" target="_blank" rel="noopener"
        data-ev="picked" data-ep="${item.id}" data-app="${label}" data-ctx="${ctx}">${label}</a>`;
  return `<div class="btns">
    ${mk(l.apple, "Apple Podcasts", "primary")}
    ${mk(l.overcast, "Overcast", "")}
    ${mk(l.podlink, "pod.link", "")}
  </div>`;
}

function renderCard(card) {
  const chain = state.chains[card.slot] || [card.episode_id];
  const idx = (state.swapIdx[card.slot] || 0) % chain.length;
  const id = chain[idx];
  const ep = episode(id);
  if (!ep) return "";
  const snap = snapshot(id, ep);

  const isPrimary = id === card.episode_id;
  const why = isPrimary ? card.why_line : (ep.summary || "");

  return `<article class="card" data-archetype="${card.archetype}">
    <span class="chip">${card.archetype_label}</span>
    ${starBtn(id)}
    <div class="head">
      ${ep.artwork_url ? `<img class="art" src="${ep.artwork_url}" alt="" loading="lazy">` : ""}
      <div>
        <p class="show">${ep.show}</p>
        <h2>${ep.title}</h2>
      </div>
    </div>
    <p class="why">${why}</p>
    <p class="meta">${fmtDur(ep.duration_min)} · ${ep.release_date}</p>
    ${playButtons(snap, `card-${card.archetype}`)}
    ${chain.length > 1 ? `<button class="swap" data-slot="${card.slot}">show me a different ${card.archetype_label.toLowerCase()} pick</button>` : ""}
  </article>`;
}

/* ---------- pinned fusion tour ---------- */

function renderFusionTour() {
  const cat = state.session.categories.find(c => c.id === "fusion-tour");
  if (!cat) return "";
  return `
    <details class="cat">
      <summary><span>${cat.label}<span class="desc">${cat.description}</span></span></summary>
      ${cat.groups.map(g => `
        <div class="group-label">${g.label}</div>
        ${g.episode_ids.map(id => {
          const ep = episode(id);
          if (!ep) return "";
          snapshot(id, ep);
          const l = links(ep);
          return `<div class="ep-row">
            <div class="info">
              <div class="t">${ep.title}</div>
              <div class="s">${ep.show} · ${fmtDur(ep.duration_min)}</div>
            </div>
            ${starBtn(id)}
            <a class="go" href="${l.apple}" target="_blank" rel="noopener"
               data-ev="picked" data-ep="${id}" data-app="Apple Podcasts" data-ctx="fusion-tour">Play</a>
          </div>`;
        }).join("")}
      `).join("")}
    </details>`;
}

/* ---------- wiring ---------- */

function bindPickLogging(scope) {
  scope.querySelectorAll("[data-ev='picked']").forEach(a => {
    a.addEventListener("click", () => {
      const id = a.dataset.ep;
      logEvent("picked", { episode_id: id, app: a.dataset.app, context: a.dataset.ctx });

      const history = pickedHistory();
      if (!history.includes(id)) lsSet("cp_history", history.concat(id).slice(-200));

      const snap = state.itemIndex[id];
      if (snap && a.dataset.ctx !== "continue") {
        lsSet("cp_lastpick", { ...snap, ts: new Date().toISOString() });
      }
    });
  });
}

function bindStars(scope) {
  scope.querySelectorAll("[data-star]").forEach(btn => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleStar(btn.dataset.star);
    });
  });
}

function render() {
  const s = state.session;
  $("#built-at").textContent =
    `Built ${new Date(s.built_at).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}`;
  renderContinue();
  $("#cards").innerHTML = s.cards.map(renderCard).join("");
  $("#fusion-tour").innerHTML = renderFusionTour();

  document.querySelectorAll(".swap").forEach(btn => {
    btn.addEventListener("click", () => {
      const slot = Number(btn.dataset.slot);
      state.swapIdx[slot] = (state.swapIdx[slot] || 0) + 1;
      logEvent("refreshed_slot", { slot });
      render();
    });
  });
  bindPickLogging($("#cards"));
  bindStars($("#cards"));
  bindPickLogging($("#fusion-tour"));
  bindStars($("#fusion-tour"));
  renderSplatter();
  renderSavedShelf();
}

async function fetchJson(path) {
  try {
    const res = await fetch(path, { cache: "no-cache" });
    return res.ok ? await res.json() : null;
  } catch (_) { return null; }
}

async function init() {
  state.session = await fetchJson("data/session.json");
  if (!state.session) {
    $("#cards").innerHTML = `<div class="error-box">Couldn't load the session. Check your connection and reload.</div>`;
    return;
  }
  [state.validated, state.taxonomy, state.discover] = await Promise.all([
    fetchJson("data/validated-links.json"),
    fetchJson("data/taxonomy.json"),
    fetchJson("data/discover.json"),
  ]);

  loadInterests();
  buildChains();
  state.splatter = sampleSplatter();
  render();
  renderInterests();
  logEvent("session_shown", { session_id: state.session.session_id });

  $("#refresh-all").addEventListener("click", () => {
    state.session.cards.forEach(c => {
      if ((state.chains[c.slot] || []).length > 1) state.swapIdx[c.slot] = (state.swapIdx[c.slot] || 0) + 1;
    });
    logEvent("refreshed_all", {});
    render();
  });

  $("#reshuffle").addEventListener("click", () => {
    state.splatter = sampleSplatter();
    logEvent("reshuffled_splatter", {});
    renderSplatter();
  });
}

init();
