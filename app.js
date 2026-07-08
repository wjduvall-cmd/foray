/* CommutePilot web client v2 — 4-card session + serendipity splatter.
   Discovery principle: weighted by interests, but 30% of every splatter
   ignores the weights entirely (exploration floor — no echo chambers). */

const state = {
  session: null,
  validated: null,          // data/validated-links.json overlay (track ids, artwork)
  taxonomy: null,
  discover: null,           // data/discover.json pool (optional, richer)
  interests: {},            // nodeId -> 0..1 (localStorage-backed)
  swapIdx: {},              // card slot -> index into [primary, ...alternates]
  splatter: [],             // current sample
};

const EXPLORATION_SHARE = 0.3;
const SPLATTER_SIZE = 12;

const BRANCH_COLORS = {
  engineering: "#4c9aff", science: "#b07ce8", history: "#e8a04c",
  craft: "#56c58f", business: "#4cc9c0", comedy: "#e87ca0",
};

const $ = (sel, el = document) => el.querySelector(sel);

function logEvent(type, payload) {
  try {
    const events = JSON.parse(localStorage.getItem("cp_events") || "[]");
    events.push({ ts: new Date().toISOString(), type, payload });
    localStorage.setItem("cp_events", JSON.stringify(events.slice(-500)));
  } catch (_) { /* never break the page over storage */ }
}

/* ---------- interests ---------- */

function leafNodes() {
  return (state.taxonomy?.nodes || []).filter(n => n.parent !== null);
}

function loadInterests() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("cp_interests") || "{}"); } catch (_) {}
  leafNodes().forEach(n => {
    state.interests[n.id] = saved[n.id] ?? Math.max(0, n.weight);
  });
}

function saveInterests() {
  try { localStorage.setItem("cp_interests", JSON.stringify(state.interests)); } catch (_) {}
}

/* ---------- episode helpers ---------- */

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

function links(ep) {
  const cid = ep.apple_collection_id;
  const apple = ep.apple_episode_url
    || (ep.apple_track_id
        ? `https://podcasts.apple.com/us/podcast/id${cid}?i=${ep.apple_track_id}`
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

/* ---------- the splatter ---------- */

function splatterPool() {
  if (state.discover?.items?.length) return state.discover.items;
  // Fallback before discover.json exists: session episodes as pool
  return Object.entries(state.session.episodes).map(([id, ep]) => {
    const merged = episode(id);
    return {
      id, show: merged.show, title: merged.title,
      apple_collection_id: merged.apple_collection_id,
      apple_track_id: merged.apple_track_id,
      apple_episode_url: merged.apple_episode_url || null,
      release_date: merged.release_date, duration_min: merged.duration_min,
      artwork_url: merged.artwork_url || null,
      topics: merged.topics || [], hook: merged.summary,
    };
  });
}

function interestScore(item) {
  const ts = item.topics || [];
  if (!ts.length) return 0.5;
  const vals = ts.map(t => state.interests[t] ?? 0.5);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function sampleSplatter() {
  const pool = [...splatterPool()];
  if (!pool.length) return [];

  const nExplore = Math.round(SPLATTER_SIZE * EXPLORATION_SHARE);
  const nWeighted = Math.min(SPLATTER_SIZE - nExplore, pool.length);

  // Weighted picks: interest score + heavy jitter so it never becomes a fixed top-list
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

  // Exploration floor: uniform random from the rest, interests ignored on purpose
  const rest = pool.filter(i => !picked.includes(i));
  for (let k = 0; k < nExplore && rest.length; k++) {
    const idx = Math.floor(Math.random() * rest.length);
    const item = rest.splice(idx, 1)[0];
    if ((perShow[item.show] || 0) >= 2) { k--; continue; }
    item._explore = true;
    picked.push(item);
    perShow[item.show] = (perShow[item.show] || 0) + 1;
  }

  // Interleave: greedy reorder so neighbors never share a top-level branch
  const remaining = [...picked].sort(() => Math.random() - 0.5);
  const ordered = [];
  while (remaining.length) {
    const prev = ordered[ordered.length - 1];
    let idx = remaining.findIndex(i => !prev || branchOf(i) !== branchOf(prev));
    if (idx === -1) idx = 0;
    ordered.push(remaining.splice(idx, 1)[0]);
  }
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
      <a class="go" href="${l.apple}" target="_blank" rel="noopener"
         data-ev="picked" data-ep="${item.id}" data-app="Apple Podcasts" data-ctx="splatter${item._explore ? "-explore" : ""}">Play</a>
    </div>`;
  }).join("");
  bindPickLogging(el);
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

function playButtons(ep, ctx) {
  const l = links(ep);
  const mk = (href, label, cls) =>
    `<a class="${cls}" href="${href}" target="_blank" rel="noopener"
        data-ev="picked" data-ep="${ep._id}" data-app="${label}" data-ctx="${ctx}">${label}</a>`;
  return `<div class="btns">
    ${mk(l.apple, "Apple Podcasts", "primary")}
    ${mk(l.overcast, "Overcast", "")}
    ${mk(l.podlink, "pod.link", "")}
  </div>`;
}

function renderCard(card) {
  const chain = [card.episode_id, ...(card.alternates || [])];
  const idx = (state.swapIdx[card.slot] || 0) % chain.length;
  const ep = episode(chain[idx]);
  if (!ep) return "";
  ep._id = chain[idx];

  const isAlternate = idx !== 0;
  const why = isAlternate ? (ep.summary || "") : card.why_line;
  const fit = isAlternate
    ? `${fmtDur(ep.duration_min)} — alternate pick ${idx} of ${chain.length - 1}`
    : card.fit_line;

  return `<article class="card" data-archetype="${card.archetype}">
    <span class="chip">${card.archetype_label}</span>
    <div class="head">
      ${ep.artwork_url ? `<img class="art" src="${ep.artwork_url}" alt="" loading="lazy">` : ""}
      <div>
        <p class="show">${ep.show}</p>
        <h2>${ep.title}</h2>
      </div>
    </div>
    <p class="why">${why}</p>
    <p class="fit">${fit}</p>
    <p class="meta">${fmtDur(ep.duration_min)} · ${ep.release_date}</p>
    ${playButtons(ep, `card-${card.archetype}`)}
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
          ep._id = id;
          const l = links(ep);
          return `<div class="ep-row">
            <div class="info">
              <div class="t">${ep.title}</div>
              <div class="s">${ep.show} · ${fmtDur(ep.duration_min)}</div>
            </div>
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
      logEvent("picked", { episode_id: a.dataset.ep, app: a.dataset.app, context: a.dataset.ctx });
    });
  });
}

function render() {
  const s = state.session;
  $("#built-at").textContent =
    `Built ${new Date(s.built_at).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}` +
    ` · tuned for a ${s.commute.minutes}-min drive at ${s.commute.playback_speed}×`;
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
  bindPickLogging(document);
  renderSplatter();
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
  state.splatter = sampleSplatter();
  render();
  renderInterests();
  logEvent("session_shown", { session_id: state.session.session_id });

  $("#refresh-all").addEventListener("click", () => {
    state.session.cards.forEach(c => {
      if (c.alternates?.length) state.swapIdx[c.slot] = (state.swapIdx[c.slot] || 0) + 1;
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
