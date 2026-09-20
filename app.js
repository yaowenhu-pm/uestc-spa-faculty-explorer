const DEFAULT_SORT = "score";
const gradeOrder = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5 };
const state = { faculty: [], statistics: null, search: "", grade: "", department: "", title: "", sort: DEFAULT_SORT, profile: "", visible: 24 };
const $ = (selector) => document.querySelector(selector);
const componentLabels = { hardSignal: ["外部认可", 30], projects: ["项目证据", 20], publications: ["成果证据", 20], recognition: ["学术任职", 20], training: ["培养教学", 10] };
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const compactVerdict = (value) => String(value || "").replace(/^[SABCDE]｜[^：]+：/, "");
const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const safeUrl = (value) => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };

function updateUrl() {
  const params = new URLSearchParams();
  for (const key of ["search", "grade", "department", "title", "sort", "profile"]) if (state[key] && !(key === "sort" && state[key] === DEFAULT_SORT)) params.set(key, state[key]);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function filteredFaculty() {
  const needle = normalize(state.search);
  const result = state.faculty.filter((item) => {
    const haystack = normalize([item.name, item.title, ...item.departments, ...item.researchDirections, ...item.focusKeywords].join(" "));
    return (!needle || haystack.includes(needle))
      && (!state.grade || item.evidenceGrade === state.grade)
      && (!state.department || (state.department === "官网未列出" ? !item.departments.length : item.departments.includes(state.department)))
      && (!state.title || item.title === state.title);
  });
  return result.sort((a, b) => state.sort === "name" ? a.name.localeCompare(b.name, "zh-CN") : state.sort === "directory" ? a.directoryOrder - b.directoryOrder : gradeOrder[a.evidenceGrade] - gradeOrder[b.evidenceGrade] || b.evidenceScore - a.evidenceScore || a.directoryOrder - b.directoryOrder);
}

function renderCard(item) {
  const keywords = [...new Set([...item.researchDirections, ...item.focusKeywords])].slice(0, 3);
  return `<article class="faculty-card" tabindex="0" role="button" aria-label="查看${esc(item.name)}的公开资料" data-id="${esc(item.profileId)}">
    <div class="card-top"><div class="identity"><h2>${esc(item.name)}</h2><p>${esc(item.title)}</p></div><b class="badge grade-${esc(item.evidenceGrade)}" aria-label="官网证据评级 ${esc(item.evidenceGrade)} 级" title="官网证据评级 ${esc(item.evidenceGrade)} 级">${esc(item.evidenceGrade)}</b></div>
    <p class="card-department">${esc(item.departments.join(" / ") || "官网未列学系")}</p>
    <div class="research-directions">${keywords.length ? keywords.map((keyword) => `<span>${esc(keyword)}</span>`).join("") : "<span>官网未列研究方向</span>"}</div>
  </article>`;
}

function renderFaculty() {
  const result = filteredFaculty();
  $("#result-count").textContent = `${result.length} 位教师`;
  const visible = result.slice(0, state.visible);
  $("#faculty-grid").innerHTML = visible.length ? visible.map(renderCard).join("") : $("#empty-template").innerHTML;
  $("#load-more").hidden = visible.length >= result.length;
  $("#display-count").textContent = result.length ? `已显示 ${visible.length} / ${result.length} 位教师` : "";
  $("#faculty-grid").setAttribute("aria-busy", "false");
  document.querySelectorAll(".faculty-card").forEach((card) => {
    const open = () => openDialog(state.faculty.find((item) => String(item.profileId) === card.dataset.id));
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  });
  renderFilterState(); updateUrl();
}

function renderFilterState() {
  document.querySelectorAll("#department-tabs button").forEach((button) => {
    const selected = button.dataset.department === state.department;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const active = ["search", "grade", "department", "title"].filter((key) => state[key]);
  $("#active-filter-row").hidden = !active.length && state.sort === DEFAULT_SORT;
  $("#active-filters").innerHTML = active.map((key) => {
    const label = key === "search" ? `搜索：${state[key]}` : key === "grade" ? `评级 ${state[key]} 级` : state[key];
    return `<button type="button" data-clear="${key}" aria-label="移除筛选：${esc(label)}">${esc(label)}<span aria-hidden="true">×</span></button>`;
  }).join("");
}

function syncControls() {
  for (const key of ["search", "grade", "title", "sort"]) $("#" + key).value = state[key];
}

function resetFilters() {
  Object.assign(state, { search: "", grade: "", department: "", title: "", sort: DEFAULT_SORT, visible: 24 });
  syncControls();
  renderFaculty();
}

function openDialog(item) {
  if (!item) return;
  const components = Object.entries(componentLabels).map(([key, [label, max]]) => {
    const value = Number(item.scoreComponents[key]) || 0;
    return `<div class="component-row"><span>${label}</span><div class="component-track"><div class="component-fill" style="width:${Math.min(100, Math.max(0, Math.round(value / max * 100)))}%"></div></div><b>${value}/${max}</b></div>`;
  }).join("");
  const evidence = item.evidenceSnippets.length ? item.evidenceSnippets.map((entry) => `<div class="evidence-item"><b>${esc(entry.type)}｜${esc(entry.conclusion)}</b><blockquote>${esc(entry.excerpt)}</blockquote>${safeUrl(entry.sourceUrl) ? `<a class="evidence-source" href="${esc(safeUrl(entry.sourceUrl))}" target="_blank" rel="noreferrer">查看官网原文 ↗</a>` : ""}</div>`).join("") : "<p>学院官网公开资料有限，暂无可展示摘录。</p>";
  $("#dialog-content").innerHTML = `<div class="dialog-hero"><div><span class="kicker">教师公开资料</span><h2 id="dialog-name">${esc(item.name)}</h2><p>${esc(item.title)} · ${esc(item.departments.join(" / ") || "官网未列学系")}</p></div><div class="dialog-grade grade-${esc(item.evidenceGrade)}" aria-label="官网证据评级 ${esc(item.evidenceGrade)} 级">${esc(item.evidenceGrade)}</div></div>
    <div class="dialog-body"><div class="score-line"><strong>${item.evidenceScore}</strong><span>/ 100 · 官网证据评级 · ${esc(item.evidenceLabel)}</span></div><p>${esc(compactVerdict(item.verdict))}</p>
      <div class="component-list">${components}</div>
      <section class="dialog-section"><h3>研究方向</h3><div class="keywords">${[...new Set([...item.researchDirections, ...item.focusKeywords])].map((keyword) => `<span>${esc(keyword)}</span>`).join("") || "<span>官网未明确列出</span>"}</div></section>
      <section class="dialog-section"><h3>资料局限</h3><ul>${item.limitations.map((text) => `<li>${esc(text)}</li>`).join("")}</ul></section>
      <section class="dialog-section"><h3>官网依据摘录</h3>${evidence}</section>
      <p class="dialog-disclaimer">评级依据官网公开证据，不代表对教师实际能力或教学质量的完整评价。</p>
      <div class="dialog-actions"><a class="button primary" href="${esc(safeUrl(item.profileUrl))}" target="_blank" rel="noreferrer">打开教师官网 ↗</a><button class="button secondary" id="copy-profile-link" type="button">复制教师链接</button><a class="button secondary" href="./methodology.html">查看分级方法</a></div><p id="share-status" class="share-status" role="status" aria-live="polite"></p>
    </div>`;
  state.profile = String(item.profileId);
  updateUrl();
  if (!$("#faculty-dialog").open) $("#faculty-dialog").showModal();
  $("#dialog-content").scrollTop = 0;
  $("#copy-profile-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); $("#share-status").textContent = "已复制，可分享此教师资料页。"; }
    catch { $("#share-status").textContent = "暂时无法复制，请复制浏览器地址栏中的链接。"; }
  });
}

function populateFilters() {
  const departmentOrder = ["行政管理系", "城市管理系", "公共政策系", "信息管理系", "新闻传播系", "法学系", "特聘讲席教授"];
  const found = [...new Set(state.faculty.flatMap((item) => item.departments.length ? item.departments : ["官网未列出"]))];
  const departments = [...departmentOrder.filter((value) => found.includes(value)), ...found.filter((value) => !departmentOrder.includes(value))];
  const titles = [...new Set(state.faculty.map((item) => item.title))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  $("#department-tabs").insertAdjacentHTML("beforeend", departments.map((value) => `<button type="button" data-department="${esc(value)}" aria-pressed="false">${esc(value === "特聘讲席教授" ? "特聘教授" : value.replace(/系$/, ""))}</button>`).join(""));
  $("#title").insertAdjacentHTML("beforeend", titles.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join(""));
}

function renderStats() {
  const stats = state.statistics;
  $("#snapshot-date").textContent = stats.sourceCollectedAt.slice(0, 10);
}

function bindControls() {
  $("#search").addEventListener("input", (event) => { state.search = event.target.value; state.visible = 24; renderFaculty(); });
  ["grade", "title", "sort"].forEach((id) => $("#" + id).addEventListener("change", (event) => { state[id] = event.target.value; state.visible = 24; renderFaculty(); }));
  $("#department-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-department]");
    if (!button) return;
    state.department = button.dataset.department; state.visible = 24;
    renderFaculty();
  });
  $("#department-tabs").addEventListener("focusin", (event) => {
    event.target.closest("button")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  $("#department-tabs").addEventListener("keydown", (event) => {
    const buttons = [...$("#department-tabs").querySelectorAll("button")];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus({ preventScroll: true });
  });
  $("#reset-filters").addEventListener("click", () => { resetFilters(); $(".results-heading h1").focus({ preventScroll: true }); });
  $("#faculty-grid").addEventListener("click", (event) => {
    if (event.target.closest("[data-reset]")) { resetFilters(); $(".results-heading h1").focus({ preventScroll: true }); }
  });
  $("#active-filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-clear]"); if (!button) return;
    state[button.dataset.clear] = ""; state.visible = 24;
    syncControls(); renderFaculty();
    ($("#active-filters button") || $(".results-heading h1")).focus({ preventScroll: true });
  });
  $("#load-more").addEventListener("click", () => {
    const firstNew = state.visible;
    state.visible += 24; renderFaculty();
    document.querySelectorAll(".faculty-card")[firstNew]?.focus({ preventScroll: true });
  });
  $("#dialog-close").addEventListener("click", () => $("#faculty-dialog").close());
  $("#faculty-dialog").addEventListener("close", () => {
    if ($("#faculty-dialog").open) return;
    state.profile = ""; updateUrl();
    if (document.activeElement === document.body) $(".results-heading h1").focus({ preventScroll: true });
  });
  $("#faculty-dialog").addEventListener("click", (event) => { if (event.target === $("#faculty-dialog")) $("#faculty-dialog").close(); });
  window.addEventListener("popstate", restoreUrl);
}

function restoreUrl() {
  const params = new URLSearchParams(location.search);
  for (const key of ["search", "grade", "department", "title", "profile"]) state[key] = params.get(key) || "";
  state.sort = params.get("sort") || DEFAULT_SORT;
  for (const key of ["grade", "title", "sort"]) {
    if (![...$("#" + key).options].some((option) => option.value === state[key])) state[key] = key === "sort" ? DEFAULT_SORT : "";
  }
  if (![...$("#department-tabs").querySelectorAll("button")].some((button) => button.dataset.department === state.department)) state.department = "";
  const profile = state.faculty.find((item) => String(item.profileId) === state.profile);
  if (!profile) state.profile = "";
  state.visible = 24;
  syncControls(); renderFaculty();
  if (profile) openDialog(profile);
  else if ($("#faculty-dialog").open) $("#faculty-dialog").close();
  $("#department-tabs button.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

async function init() {
  const [facultyResponse, statisticsResponse] = await Promise.all([fetch("./data/faculty.public.json"), fetch("./data/statistics.json")]);
  if (!facultyResponse.ok || !statisticsResponse.ok) throw new Error("数据加载失败");
  state.faculty = await facultyResponse.json(); state.statistics = await statisticsResponse.json();
  populateFilters(); renderStats(); bindControls(); restoreUrl();
}

init().catch(() => {
  $("#result-count").textContent = "暂时无法加载";
  $("#faculty-grid").setAttribute("aria-busy", "false");
  $("#faculty-grid").innerHTML = `<div class="empty-state"><strong>教师资料暂时无法加载</strong><p>请检查网络连接后重试。</p><button class="button secondary" id="retry-load" type="button">重新加载</button></div>`;
  $("#retry-load").addEventListener("click", () => location.reload());
});
