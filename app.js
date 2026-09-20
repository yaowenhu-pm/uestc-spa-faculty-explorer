const DEFAULT_SORT = "score";
const gradeOrder = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5, U: 6 };
const state = { faculty: [], statistics: null, search: "", grade: "", department: "", title: "", sort: DEFAULT_SORT, profile: "", visible: 24 };
const $ = (selector) => document.querySelector(selector);
const componentLabels = { hardSignal: ["科研认可", 30], projects: ["科研项目", 30], publications: ["代表成果", 25], recognition: ["学术服务", 10], training: ["培养教学", 5] };
const legacyComponentLabels = { hardSignal: ["外部认可", 30], projects: ["项目证据", 20], publications: ["成果证据", 20], recognition: ["学术任职", 20], training: ["培养教学", 10] };
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const compactVerdict = (value) => String(value || "").replace(/^[SABCDEU]｜[^：]+：/, "");
const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const safeUrl = (value) => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
const list = (value) => Array.isArray(value) ? value : [];
const effectiveGrade = (item) => item.assessmentStatus === "insufficient" || item.evidenceScore == null || !["S", "A", "B", "C", "D", "E"].includes(item.evidenceGrade) ? "U" : item.evidenceGrade;
const isV3 = (item) => Boolean(item.assessmentStatus || item.coverage || /v3/i.test(item.rubricVersion || ""));
const gradeDescription = (grade) => grade === "U" ? "资料不足，暂不分级" : `公开履历分级 ${grade} 级`;


function updateUrl() {
  const params = new URLSearchParams();
  for (const key of ["search", "grade", "department", "title", "sort", "profile"]) if (state[key] && !(key === "sort" && state[key] === DEFAULT_SORT)) params.set(key, state[key]);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function filteredFaculty() {
  const needle = normalize(state.search);
  const result = state.faculty.filter((item) => {
    const haystack = normalize([item.name, item.title, ...list(item.departments), ...list(item.researchDirections), ...list(item.focusKeywords)].join(" "));
    return (!needle || haystack.includes(needle))
      && (!state.grade || effectiveGrade(item) === state.grade)
      && (!state.department || (state.department === "官网未列出" ? !list(item.departments).length : list(item.departments).includes(state.department)))
      && (!state.title || item.title === state.title);
  });
  return result.sort((a, b) => state.sort === "name" ? a.name.localeCompare(b.name, "zh-CN") : state.sort === "directory" ? a.directoryOrder - b.directoryOrder : gradeOrder[effectiveGrade(a)] - gradeOrder[effectiveGrade(b)] || (Number(b.evidenceScore) || 0) - (Number(a.evidenceScore) || 0) || a.directoryOrder - b.directoryOrder);
}

function renderCard(item) {
  const grade = effectiveGrade(item);
  const keywords = [...new Set([...list(item.researchDirections), ...list(item.focusKeywords)])].slice(0, 3);
  return `<article class="faculty-card" tabindex="0" role="button" aria-label="查看${esc(item.name)}的公开资料" data-id="${esc(item.profileId)}">
    <div class="card-top"><div class="identity"><h2>${esc(item.name)}</h2><p>${esc(item.title)}</p></div><b class="badge grade-${grade}" aria-label="${gradeDescription(grade)}" title="${gradeDescription(grade)}">${grade === "U" ? "—" : grade}</b></div>
    <p class="card-department">${esc(list(item.departments).join(" / ") || "官网未列学系")}</p>
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
    const label = key === "search" ? `搜索：${state[key]}` : key === "grade" ? (state[key] === "U" ? "资料不足" : `分级 ${state[key]} 级`) : state[key];
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

function evidenceGroup(type) {
  if (/科研认可|外部认可|奖项|奖励|荣誉|人才/.test(type)) return "科研认可";
  if (/科研项目|项目|课题|基金/.test(type)) return "科研项目";
  if (/代表成果|成果|论文|著作|专利|报告/.test(type)) return "代表成果";
  if (/学术服务|学术任职|学会|编委|任职/.test(type)) return "学术服务";
  if (/培养|教学|课程|学生/.test(type)) return "培养教学";
  return "其他官网资料";
}

function renderEvidence(snippets) {
  const groups = new Map([...Object.values(componentLabels).map(([label]) => label), "其他官网资料"].map((label) => [label, []]));
  for (const entry of list(snippets)) groups.get(evidenceGroup(String(entry.type || ""))).push(entry);
  return [...groups].filter(([, entries]) => entries.length).map(([label, entries]) => `<details class="evidence-group"><summary>${label}<span>${entries.length} 条</span></summary><div class="evidence-group-body">${entries.map((entry) => `<div class="evidence-item"><b>${esc(entry.conclusion || entry.type)}</b>${entry.excerpt ? `<blockquote>${esc(entry.excerpt)}</blockquote>` : ""}${safeUrl(entry.sourceUrl) ? `<a class="evidence-source" href="${esc(safeUrl(entry.sourceUrl))}" target="_blank" rel="noreferrer">查看官网原文 ↗</a>` : ""}${renderAuthorVerification(entry.authorVerification)}</div>`).join("")}</div></details>`).join("") || "<p>暂无可展示的官网摘录。</p>";
}

function renderAuthorVerification(verification) {
  const url = safeUrl(verification?.sourceUrl);
  const position = Number(verification?.authorPosition);
  if (!url || !verification.authorFullName || !Number.isInteger(position) || position < 1) return "";
  return `<a class="evidence-source author-verification" href="${esc(url)}" target="_blank" rel="noreferrer">署名核对 · ${esc(verification.authorFullName)}，第${position}位 ↗</a>`;
}

function missingInformation(item) {
  const gaps = list(item.limitations).filter(Boolean);
  if (gaps.length) return gaps;
  const coverage = item.coverage;
  if (coverage && !coverage.projects) gaps.push("缺少可核对的科研项目信息。");
  if (coverage && !coverage.works) gaps.push("缺少可核对的代表成果信息。");
  return gaps.length ? gaps : ["当前公开资料不足以完成分级，需补充可核对的具名项目或包含年份、出处的代表成果。"];
}

function openDialog(item) {
  if (!item) return;
  const grade = effectiveGrade(item);
  const insufficient = grade === "U";
  const labels = isV3(item) ? componentLabels : legacyComponentLabels;
  const reason = item.gradeReason || (insufficient ? "目前可核对的公开履历信息不足，暂不判定等级。" : compactVerdict(item.verdict));
  const coverageSummary = item.coverage?.summary || "";
  const components = Object.entries(labels).map(([key, [label, max]]) => {
    const value = Number(item.scoreComponents?.[key]) || 0;
    return `<div class="component-row"><span>${label}</span><div class="component-track"><div class="component-fill" style="width:${Math.min(100, Math.max(0, Math.round(value / max * 100)))}%"></div></div><b>${value}/${max}</b></div>`;
  }).join("");
  const notes = list(item.scoringNotes).filter(Boolean);
  const limitations = list(item.limitations).filter(Boolean);
  const breakdown = insufficient ? `<details class="scoring-details"><summary>资料不足 · 查看待补信息与判定细则</summary><div class="assessment-limitations"><h3>资料局限</h3><ul>${missingInformation(item).map((text) => `<li>${esc(text)}</li>`).join("")}</ul></div>${notes.length ? `<div class="assessment-limitations"><h3>判定细则</h3><ul>${notes.map((text) => `<li>${esc(text)}</li>`).join("")}</ul></div>` : ""}</details>` : `<div class="score-line"><strong>${esc(item.evidenceScore)}</strong><span>/ 100 · 公开履历分级 ${grade}</span></div><details class="scoring-details"><summary>查看分项与判定细则</summary><div class="component-list">${components}</div>${notes.length ? `<ul>${notes.map((text) => `<li>${esc(text)}</li>`).join("")}</ul>` : ""}${limitations.length ? `<div class="assessment-limitations"><h3>资料局限</h3><ul>${limitations.map((text) => `<li>${esc(text)}</li>`).join("")}</ul></div>` : ""}</details>`;
  $("#dialog-content").innerHTML = `<div class="dialog-hero"><div><span class="kicker">教师公开履历</span><h2 id="dialog-name">${esc(item.name)}</h2><p>${esc(item.title)} · ${esc(list(item.departments).join(" / ") || "官网未列学系")}</p></div><div class="dialog-grade grade-${grade}" aria-label="${gradeDescription(grade)}">${insufficient ? "—" : grade}</div></div>
    <div class="dialog-body"><p class="grade-reason">${esc(reason)}</p>${coverageSummary ? `<p class="coverage-summary">${esc(coverageSummary)}</p>` : ""}
      ${breakdown}
      <section class="dialog-section"><h3>研究方向</h3><div class="keywords">${[...new Set([...list(item.researchDirections), ...list(item.focusKeywords)])].map((keyword) => `<span>${esc(keyword)}</span>`).join("") || "<span>官网未明确列出</span>"}</div></section>
      <section class="dialog-section"><h3>官网依据</h3>${renderEvidence(item.evidenceSnippets)}</section>
      <p class="dialog-disclaimer">分级依据可核对的公开履历，不代表教师能力或学术质量排名。</p>
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
  const found = [...new Set(state.faculty.flatMap((item) => list(item.departments).length ? item.departments : ["官网未列出"]))];
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
  const [facultyResponse, statisticsResponse] = await Promise.all([fetch("./data/faculty.public.json?v=20260921-v3"), fetch("./data/statistics.json?v=20260921-v3")]);
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
