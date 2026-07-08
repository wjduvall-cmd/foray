/* Foray web client v3.
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
  cardSlots: [],            // the four dealt cards: {slot, branch, chain, idx}
  splatter: [],
  itemIndex: {},            // id -> snapshot (everything rendered this load)
};

const EXPLORATION_SHARE = 0.3;
const SPLATTER_SIZE = 12;
const SEEN_WINDOW = 36;     // splatter ids excluded from re-sampling
const CONTINUE_MAX_AGE_H = 72;

const $ = (sel, el = document) => el.querySelector(sel);

/* All catalog data flows through innerHTML templates; escape every
   data-derived string so a hostile episode title in a feed can never
   become markup. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Scheme-check any URL that lands in href/src. esc() stops markup injection
   but not javascript: URLs; this closes that hole before sessions ever come
   from live RSS data. */
function safeUrl(u) {
  try {
    const p = new URL(u);
    if (p.protocol === "https:" || p.protocol === "http:") return u;
  } catch (_) {}
  return "#";
}

/* ---------- storage helpers ---------- */

function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function logEvent(type, payload) {
  const events = lsGet("cp_events", []);
  const builder = state.session?.builder || "unknown";
  events.push({ ts: new Date().toISOString(), type, builder, payload });
  // 5000-event buffer: this is the retention telemetry until a durable
  // /events endpoint exists (REQUIREMENTS-DELTA R2) — don't let it wrap.
  lsSet("cp_events", events.slice(-5000));
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
      ${c.artwork_url ? `<img class="art" src="${esc(safeUrl(c.artwork_url))}" alt="" loading="lazy">` : ""}
      <div>
        <p class="show">${esc(c.show)}</p>
        <h2>${esc(c.title)}</h2>
      </div>
    </div>
    <p class="fit">Picking back up where you left off — your app remembers the spot.</p>
    <div class="btns">
      <a class="primary" href="${esc(safeUrl(l.apple))}" target="_blank" rel="noopener" data-ev="picked" data-ep="${c.id}" data-app="Apple Podcasts" data-ctx="continue">Resume</a>
      <a href="${esc(safeUrl(l.overcast))}" target="_blank" rel="noopener" data-ev="picked" data-ep="${c.id}" data-app="Overcast" data-ctx="continue">Overcast</a>
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

/* ---------- the four cards ----------
   Variety by construction, invisibly: the four cards draw from the whole
   pool and are guaranteed to span four distinct topic branches, but no
   category name ever appears in the UI and no slot is owned by a topic.
   Branch choice is interests-weighted with heavy jitter so every load
   (and every refresh) deals a different spread. */

function pickedHistory() { return lsGet("cp_history", []); }

function fullPool() {
  const pool = [];
  const seen = new Set();
  for (const id of Object.keys(state.session.episodes)) {
    pool.push(snapshot(id, episode(id)));
    seen.add(id);
  }
  for (const item of (state.discover?.items || [])) {
    if (!seen.has(item.id)) pool.push(snapshot(item.id, item));
  }
  return pool;
}

/* Hand-crafted why-lines survive where they exist (the original curated
   picks); everything else uses its hook. */
function whyFor(id, item) {
  const curated = state.session.cards.find(c => c.episode_id === id);
  return curated ? curated.why_line : (item.hook || "");
}

function buildCards() {
  const pool = fullPool();
  const history = new Set(pickedHistory());
  const byBranch = {};
  pool.forEach(i => { (byBranch[branchOf(i)] = byBranch[branchOf(i)] || []).push(i); });

  const rankedBranches = Object.keys(byBranch)
    .map(b => {
      const avg = byBranch[b].reduce((s, i) => s + interestScore(i), 0) / byBranch[b].length;
      return { b, s: avg + (Math.random() - 0.5) * 0.7 };
    })
    .sort((x, y) => y.s - x.s)
    .map(x => x.b);

  state.cardSlots = rankedBranches.slice(0, 4).map((branch, i) => {
    const items = byBranch[branch];
    const fresh = items.filter(it => !history.has(it.id)).sort(() => Math.random() - 0.5);
    const stale = items.filter(it => history.has(it.id));
    return { slot: i + 1, branch, chain: fresh.concat(stale), idx: 0 };
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
    return `<div class="sp-item">
      ${item.artwork_url ? `<img class="sp-art" src="${esc(safeUrl(item.artwork_url))}" alt="" loading="lazy">` : `<div class="sp-art"></div>`}
      <div class="sp-info">
        <p class="sp-hook">${esc(item.hook || item.title)}</p>
        <p class="sp-meta"><span class="dot dot-${esc(branchOf(item))}"></span>${esc(item.show)} · ${fmtDur(item.duration_min)}${item._explore ? ` · <span class="wild">wildcard</span>` : ""}</p>
      </div>
      ${starBtn(item.id)}
      <a class="go" href="${esc(safeUrl(l.apple))}" target="_blank" rel="noopener"
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
          <div class="t">${esc(item.title)}</div>
          <div class="s">${esc(item.show)} · ${fmtDur(item.duration_min)}</div>
        </div>
        ${starBtn(item.id)}
        <a class="go" href="${esc(safeUrl(l.apple))}" target="_blank" rel="noopener"
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
      <span class="int-label">${esc(n.label)}</span>
      <input type="range" min="0" max="100" value="${Math.round((state.interests[n.id] ?? 0.5) * 100)}" data-node="${n.id}">
    </label>`).join("") +
    `<p class="int-note">These tilt the cards and the splatter — but surprise is built in and always wins a share. New topics appear on their own.</p>`;

  el.querySelectorAll("input[type=range]").forEach(input => {
    input.addEventListener("change", () => {
      state.interests[input.dataset.node] = Number(input.value) / 100;
      saveInterests();
      logEvent("interest_adjusted", { node: input.dataset.node, value: Number(input.value) / 100 });
      buildCards();
      state.splatter = sampleSplatter();
      render();
    });
  });
}

/* ---------- session cards ---------- */

function playButtons(item, ctx) {
  const l = links(item);
  const mk = (href, label, cls) =>
    `<a class="${cls}" href="${esc(safeUrl(href))}" target="_blank" rel="noopener"
        data-ev="picked" data-ep="${item.id}" data-app="${label}" data-ctx="${ctx}">${label}</a>`;
  return `<div class="btns">
    ${mk(l.apple, "Apple Podcasts", "primary")}
    ${mk(l.overcast, "Overcast", "")}
    ${mk(l.podlink, "pod.link", "")}
  </div>`;
}

function renderCard(slotObj) {
  const chain = slotObj.chain;
  if (!chain.length) return "";
  const item = chain[slotObj.idx % chain.length];
  const why = whyFor(item.id, item);

  return `<article class="card" data-branch="${esc(slotObj.branch)}">
    ${starBtn(item.id)}
    <div class="head">
      ${item.artwork_url ? `<img class="art" src="${esc(safeUrl(item.artwork_url))}" alt="" loading="lazy">` : ""}
      <div>
        <p class="show">${esc(item.show)}</p>
        <h2>${esc(item.title)}</h2>
      </div>
    </div>
    <p class="why">${esc(why)}</p>
    <p class="meta">${fmtDur(item.duration_min)}${item.release_date ? ` · ${esc(item.release_date)}` : ""}</p>
    ${playButtons(item, `card-${slotObj.branch}`)}
    ${chain.length > 1 ? `<button class="swap" data-slot="${slotObj.slot}">show me something different here</button>` : ""}
  </article>`;
}

/* ---------- pinned fusion tour ---------- */

function renderFusionTour() {
  const cat = state.session.categories.find(c => c.id === "fusion-tour");
  if (!cat) return "";
  return `
    <details class="cat">
      <summary><span>${esc(cat.label)}<span class="desc">${esc(cat.description)}</span></span></summary>
      ${cat.groups.map(g => `
        <div class="group-label">${esc(g.label)}</div>
        ${g.episode_ids.map(id => {
          const ep = episode(id);
          if (!ep) return "";
          snapshot(id, ep);
          const l = links(ep);
          return `<div class="ep-row">
            <div class="info">
              <div class="t">${esc(ep.title)}</div>
              <div class="s">${esc(ep.show)} · ${fmtDur(ep.duration_min)}</div>
            </div>
            ${starBtn(id)}
            <a class="go" href="${esc(safeUrl(l.apple))}" target="_blank" rel="noopener"
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
  $("#cards").innerHTML = (state.cardSlots || []).map(renderCard).join("");
  $("#fusion-tour").innerHTML = renderFusionTour();

  document.querySelectorAll(".swap").forEach(btn => {
    btn.addEventListener("click", () => {
      const slot = state.cardSlots.find(sl => sl.slot === Number(btn.dataset.slot));
      if (slot) slot.idx += 1;
      logEvent("refreshed_slot", { slot: Number(btn.dataset.slot), branch: slot?.branch });
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
  buildCards();
  state.splatter = sampleSplatter();
  render();
  renderInterests();
  logEvent("session_shown", { session_id: state.session.session_id });

  $("#refresh-all").addEventListener("click", () => {
    buildCards(); // full re-deal: new branches, new picks
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
