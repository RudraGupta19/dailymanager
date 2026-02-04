const storageKey = "calendar_tasks";
const state = {
  tasks: [],
  startDate: null,
  endDate: null,
  modal: null,
  selectedDate: null,
  projects: [],
  projectFilter: null,
  later: []
};
const projectsKey = "calendar_projects";

function loadTasks() {
  const raw = localStorage.getItem(storageKey);
  state.tasks = raw ? JSON.parse(raw) : [];
}

function saveTasks() {
  localStorage.setItem(storageKey, JSON.stringify(state.tasks));
  if (window.sb && window.sb.client) {
    window.sb.saveAll(state.tasks).catch(() => syncServer(true));
  } else {
    syncServer(true);
  }
}

function loadProjects() {
  const raw = localStorage.getItem(projectsKey);
  state.projects = raw ? JSON.parse(raw) : [];
}

function saveProjects() {
  localStorage.setItem(projectsKey, JSON.stringify(state.projects));
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseDate(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeDates(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  const out = [];
  for (let dt = new Date(s); dt <= e; dt.setDate(dt.getDate() + 1)) {
    out.push(fmtDate(dt));
  }
  return out;
}

function byDate(a, b) {
  if (a.date === b.date) {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.title.localeCompare(b.title);
  }
  return a.date.localeCompare(b.date);
}

function render() {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";
  const tasksByDate = {};
  const visible = state.projectFilter ? state.tasks.filter(t => t.project === state.projectFilter) : state.tasks;
  for (const t of visible) {
    tasksByDate[t.date] = tasksByDate[t.date] || [];
    tasksByDate[t.date].push(t);
  }
  renderDashboard(visible, tasksByDate);
  renderToday(tasksByDate);
  renderMonth(tasksByDate);
  const dates = rangeDates(state.startDate, state.endDate);
  const todayStr = fmtDate(new Date());
  for (const date of dates) {
    if (date === todayStr) continue;
    const col = document.createElement("section");
    col.className = "day-column";
    const header = document.createElement("div");
    header.className = "day-header";
    const left = document.createElement("div");
    const right = document.createElement("div");
    right.className = "day-actions";

    const title = document.createElement("div");
    title.innerHTML = `<strong>${date}</strong> · <span class="muted">${(tasksByDate[date] || []).length} tasks</span>`;
    left.appendChild(title);

    const smsBtn = document.createElement("button");
    smsBtn.className = "btn btn-secondary btn-sm";
    smsBtn.textContent = "SMS";
    smsBtn.addEventListener("click", e => openSmsPopover(date, e.clientX, e.clientY));
    right.appendChild(smsBtn);

    const dlBtn = document.createElement("button");
    dlBtn.className = "btn btn-secondary btn-sm";
    dlBtn.textContent = "CSV";
    dlBtn.addEventListener("click", () => downloadCsvForDate(date));
    right.appendChild(dlBtn);

    const completeBtn = document.createElement("button");
    completeBtn.className = "btn btn-success btn-sm";
    completeBtn.textContent = "Complete";
    completeBtn.addEventListener("click", () => setDayCompleted(date, true));
    right.appendChild(completeBtn);

    header.appendChild(left);
    header.appendChild(right);
    col.appendChild(header);

    const list = document.createElement("div");
    list.className = "tasks";
    list.dataset.date = date;
    list.addEventListener("dragover", e => { e.preventDefault(); list.classList.add("drag-over"); });
    list.addEventListener("dragleave", () => list.classList.remove("drag-over"));
    list.addEventListener("drop", e => {
      e.preventDefault();
      list.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/task-id");
      if (id) moveTaskToDate(id, date);
    });
    const tasks = (tasksByDate[date] || []).slice().sort(byDate);
    for (const t of tasks) {
      const row = document.createElement("div");
      row.className = "task" + (t.completed ? " completed" : "");
      row.draggable = true;
      row.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/task-id", t.id);
      });
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = !!t.completed;
      chk.addEventListener("change", () => {
        t.completed = chk.checked;
        saveTasks();
        render();
      });
      const title = document.createElement("div");
      title.className = "task-title";
      title.textContent = t.title;
      const actions = document.createElement("div");
      actions.className = "task-actions";
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-secondary btn-sm";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEditTask(t));
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        state.tasks = state.tasks.filter(x => x.id !== t.id);
        if (window.sb && window.sb.client) window.sb.deleteTask(t.id);
        saveTasks();
        render();
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      row.appendChild(chk);
      row.appendChild(title);
      row.appendChild(actions);
      list.appendChild(row);
    }
    col.appendChild(list);
    calendar.appendChild(col);
  }
}

function buildWidget(date, titleText, tasksByDate, options = {}) {
  const card = document.createElement("div");
  card.className = "widget";
  const header = document.createElement("div");
  header.className = "widget-header";
  const title = document.createElement("div");
  title.className = "widget-title";
  title.textContent = titleText;
  const subtitle = document.createElement("div");
  subtitle.className = "widget-subtitle";
  subtitle.textContent = `${(tasksByDate[date] || []).length} tasks`;
  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "8px";
  if (options.showClear) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "btn btn-ghost";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => { state.selectedDate = null; render(); });
    right.appendChild(clearBtn);
  }
  if (options.toolbar === "today") {
    const phone = document.createElement("input");
    phone.type = "tel";
    phone.placeholder = "+91xxxxxxxxxx";
    phone.value = localStorage.getItem("smsPhone") || "";
    phone.inputMode = "tel";
    phone.style.width = "140px";
    phone.onchange = () => localStorage.setItem("smsPhone", phone.value);
    const smsBtn = document.createElement("button");
    smsBtn.className = "btn btn-secondary btn-sm";
    smsBtn.textContent = "SMS";
    smsBtn.onclick = () => { const p = phone.value; if (p) sendSms(date, p); };
    const csvBtn = document.createElement("button");
    csvBtn.className = "btn btn-secondary btn-sm";
    csvBtn.textContent = "CSV";
    csvBtn.onclick = () => downloadCsvForDate(date);
    const completeBtn = document.createElement("button");
    completeBtn.className = "btn btn-success btn-sm";
    completeBtn.textContent = "Complete";
    completeBtn.onclick = () => setDayCompleted(date, true);
    right.appendChild(phone);
    right.appendChild(smsBtn);
    right.appendChild(csvBtn);
    right.appendChild(completeBtn);
  }
  header.appendChild(title);
  header.appendChild(subtitle);
  header.appendChild(right);
  const list = document.createElement("div");
  list.className = "widget-list";
  list.dataset.date = date;
  list.addEventListener("dragover", e => { e.preventDefault(); list.classList.add("drag-over"); });
  list.addEventListener("dragleave", () => list.classList.remove("drag-over"));
  list.addEventListener("drop", e => {
    e.preventDefault();
    list.classList.remove("drag-over");
    const id = e.dataTransfer.getData("text/task-id");
    if (id) moveTaskToDate(id, date);
  });
  const tasks = (tasksByDate[date] || []).slice().sort(byDate);
  for (const t of tasks) {
    const row = document.createElement("div");
    row.className = "task" + (t.completed ? " completed" : "");
    row.draggable = true;
    row.addEventListener("dragstart", e => e.dataTransfer.setData("text/task-id", t.id));
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!t.completed;
    chk.addEventListener("change", () => { t.completed = chk.checked; saveTasks(); render(); });
    const titleEl = document.createElement("div");
    titleEl.className = "task-title";
    titleEl.textContent = t.title;
    const actions = document.createElement("div");
    actions.className = "task-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditTask(t));
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-sm";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => { state.tasks = state.tasks.filter(x => x.id !== t.id); if (window.sb && window.sb.client) window.sb.deleteTask(t.id); saveTasks(); render(); });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(chk);
    row.appendChild(titleEl);
    row.appendChild(actions);
    list.appendChild(row);
  }
  card.appendChild(header);
  card.appendChild(list);
  return card;
}

function renderDashboard(tasks, tasksByDate) {
  const stats = document.getElementById("quickStats");
  const actions = document.getElementById("quickActions");
  if (!stats || !actions) return;
  // Stats
  const today = fmtDate(new Date());
  const ym = today.slice(0,7);
  const monthTasks = tasks.filter(t => t.date.startsWith(ym));
  const completed = monthTasks.filter(t => t.completed).length;
  const total = monthTasks.length;
  // Streak: consecutive days with completed tasks
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = fmtDate(d);
    const anyDone = tasksByDate[ds]?.some(t => t.completed);
    if (anyDone) streak++; else break;
  }
  stats.innerHTML = `
    <div class="card-title">Quick Stats</div>
    <div class="stats-grid">
      <div class="stat"><div class="value">${total}</div><div class="label">Tasks this month</div></div>
      <div class="stat"><div class="value">${completed}</div><div class="label">Completed</div></div>
      <div class="stat"><div class="value">${streak}</div><div class="label">Day streak</div></div>
    </div>
    <div class="heatmap" id="heatmap"></div>
  `;
  const heat = document.getElementById("heatmap");
  if (heat) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startOffset = (first.getDay() + 6) % 7;
    for (let i = 0; i < startOffset; i++) heat.appendChild(document.createElement("div"));
    for (let day = 1; day <= last.getDate(); day++) {
      const d = fmtDate(new Date(year, month, day));
      const count = (tasksByDate[d] || []).length;
      const cell = document.createElement("div");
      const level = Math.min(4, Math.floor(count / 3));
      cell.className = `heat-cell level-${level}`;
      heat.appendChild(cell);
    }
  }
  // Actions
  const laterCount = state.later.length;
  actions.innerHTML = `
    <div class="card-title">Inbox</div>
    <div class="actions">
      <button class="btn btn-secondary" id="inboxLater">Later Queue (${laterCount})</button>
      <button class="btn btn-secondary" id="inboxImport">Import CSV</button>
      <button class="btn btn-secondary" id="inboxDownload">Download All CSV</button>
    </div>
  `;
  document.getElementById("inboxLater").onclick = () => openLaterPanel();
  document.getElementById("inboxImport").onclick = () => document.getElementById("csvFile").click();
  document.getElementById("inboxDownload").onclick = () => downloadAllCsv();
}

function renderToday(tasksByDate) {
  const wrap = document.getElementById("today");
  wrap.innerHTML = "";
  const today = fmtDate(new Date());
  if (state.selectedDate && state.selectedDate !== today) {
    const split = document.createElement("div");
    split.className = "split";
    split.appendChild(buildWidget(today, "Today", tasksByDate, { toolbar: "today" }));
    split.appendChild(buildWidget(state.selectedDate, state.selectedDate, tasksByDate, { showClear: true }));
    wrap.appendChild(split);
  } else {
    wrap.appendChild(buildWidget(today, "Today", tasksByDate, { toolbar: "today" }));
  }
}

function renderMonth(tasksByDate) {
  const wrap = document.getElementById("month");
  wrap.innerHTML = "";
  const offset = state.monthOffset || 0;
  const base = new Date();
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const year = first.getFullYear();
  const month = first.getMonth();
  const header = document.createElement("div");
  header.className = "month-header";
  const headerLeft = document.createElement("div");
  headerLeft.style.display = "flex";
  headerLeft.style.alignItems = "center";
  headerLeft.style.gap = "8px";
  const prevBtn = document.createElement("button");
  prevBtn.className = "btn btn-ghost btn-icon";
  prevBtn.textContent = "‹";
  prevBtn.onclick = () => { state.monthOffset = (state.monthOffset || 0) - 1; render(); };
  const title = document.createElement("div");
  title.className = "month-title";
  title.textContent = first.toLocaleString(undefined, { month: "long", year: "numeric" });
  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-ghost btn-icon";
  nextBtn.textContent = "›";
  nextBtn.onclick = () => { state.monthOffset = (state.monthOffset || 0) + 1; render(); };
  headerLeft.appendChild(prevBtn);
  headerLeft.appendChild(title);
  headerLeft.appendChild(nextBtn);
  header.appendChild(headerLeft);
  const grid = document.createElement("div");
  grid.className = "month-grid";
  const startOffset = (first.getDay() + 6) % 7;
  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "month-cell";
    grid.appendChild(empty);
  }
  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(year, month, day);
    const dateStr = fmtDate(d);
    const cell = document.createElement("div");
    cell.className = "month-cell";
    cell.dataset.date = dateStr;
    cell.classList.toggle("selected", state.selectedDate === dateStr);
    cell.addEventListener("click", () => { state.selectedDate = dateStr; render(); });
    cell.addEventListener("dragover", e => { e.preventDefault(); cell.classList.add("drag-over"); });
    cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
    cell.addEventListener("drop", e => {
      e.preventDefault();
      cell.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/task-id");
      if (id) moveTaskToDate(id, dateStr);
    });
    cell.addEventListener("mouseenter", e => showTooltip(dateStr, e.clientX, e.clientY));
    cell.addEventListener("mousemove", e => moveTooltip(e.clientX, e.clientY));
    cell.addEventListener("mouseleave", hideTooltip);
    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    const dateEl = document.createElement("div");
    dateEl.className = "date";
    dateEl.textContent = String(day);
    const countEl = document.createElement("div");
    countEl.className = "count";
    const cnt = (tasksByDate[dateStr] || []).length;
    countEl.textContent = cnt ? String(cnt) : "";
    top.appendChild(dateEl);
    top.appendChild(countEl);
    cell.appendChild(top);
    grid.appendChild(cell);
  }
  const totalFilled = startOffset + last.getDate();
  const trailing = (7 - (totalFilled % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    const d = new Date(year, month + 1, day);
    const dateStr = fmtDate(d);
    const cell = document.createElement("div");
    cell.className = "month-cell outside";
    cell.dataset.date = dateStr;
    cell.classList.toggle("selected", state.selectedDate === dateStr);
    cell.addEventListener("click", () => { state.selectedDate = dateStr; render(); });
    cell.addEventListener("dragover", e => { e.preventDefault(); cell.classList.add("drag-over"); });
    cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
    cell.addEventListener("drop", e => {
      e.preventDefault();
      cell.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/task-id");
      if (id) moveTaskToDate(id, dateStr);
    });
    cell.addEventListener("mouseenter", e => showTooltip(dateStr, e.clientX, e.clientY));
    cell.addEventListener("mousemove", e => moveTooltip(e.clientX, e.clientY));
    cell.addEventListener("mouseleave", hideTooltip);
    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    const dateEl = document.createElement("div");
    dateEl.className = "date";
    dateEl.textContent = String(day);
    const countEl = document.createElement("div");
    countEl.className = "count";
    const cnt = (tasksByDate[dateStr] || []).length;
    countEl.textContent = cnt ? String(cnt) : "";
    top.appendChild(dateEl);
    top.appendChild(countEl);
    cell.appendChild(top);
    grid.appendChild(cell);
  }
  wrap.appendChild(header);
  wrap.appendChild(grid);
}

function moveTaskToDate(id, date) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.date = date;
  t.completed = false;
  saveTasks();
  render();
}

function openEditTask(task) {
  const modal = document.getElementById("modal");
  state.modal = { type: "edit", taskId: task.id };
  document.getElementById("modalTitle").textContent = "Edit Task";
  const body = document.getElementById("modalBody");
  body.innerHTML = "";
  const form = document.createElement("div");
  form.className = "rollover-grid";
  const title = document.createElement("input");
  title.type = "text";
  title.value = task.title;
  const date = document.createElement("input");
  date.type = "date";
  date.value = task.date;
  const notes = document.createElement("input");
  notes.type = "text";
  notes.placeholder = "Notes";
  notes.value = task.notes || "";
  form.appendChild(title);
  form.appendChild(date);
  form.appendChild(notes);
  body.appendChild(form);
  document.getElementById("applyModal").onclick = () => {
    task.title = title.value.trim();
    task.date = date.value;
    task.notes = notes.value || null;
    saveTasks();
    closeModal();
    render();
  };
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function openCompleteDayModal(date) {
  const modal = document.getElementById("modal");
  state.modal = { type: "complete-day", date };
  document.getElementById("modalTitle").textContent = `Complete ${date}`;
  const dayTasks = state.tasks.filter(t => t.date === date);
  const body = document.getElementById("modalBody");
  body.innerHTML = "";

  const section1 = document.createElement("div");
  section1.innerHTML = `<strong>Select completed tasks</strong>`;
  body.appendChild(section1);
  const checkGrid = document.createElement("div");
  checkGrid.className = "rollover-grid";
  const completedIds = new Set();
  for (const t of dayTasks) {
    const row = document.createElement("label");
    row.className = "rollover-row";
    const left = document.createElement("div");
    left.textContent = t.title;
    const right = document.createElement("input");
    right.type = "checkbox";
    right.addEventListener("change", () => {
      if (right.checked) completedIds.add(t.id); else completedIds.delete(t.id);
    });
    row.appendChild(left);
    row.appendChild(right);
    checkGrid.appendChild(row);
  }
  body.appendChild(checkGrid);

  const section2 = document.createElement("div");
  section2.innerHTML = `<strong>Rollover remaining tasks</strong>`;
  body.appendChild(section2);
  const setAll = document.createElement("div");
  setAll.className = "rollover-row";
  const allLabel = document.createElement("div");
  allLabel.textContent = "Set all remaining to";
  const allDate = document.createElement("input");
  allDate.type = "date";
  setAll.appendChild(allLabel);
  setAll.appendChild(allDate);
  body.appendChild(setAll);

  const remainGrid = document.createElement("div");
  remainGrid.className = "rollover-grid";
  const rows = [];
  for (const t of dayTasks) {
    const row = document.createElement("div");
    row.className = "rollover-row";
    const left = document.createElement("div");
    left.className = "muted";
    left.textContent = t.title;
    const right = document.createElement("input");
    right.type = "date";
    row.appendChild(left);
    row.appendChild(right);
    rows.push({ t, right });
    remainGrid.appendChild(row);
  }
  body.appendChild(remainGrid);

  allDate.addEventListener("change", () => {
    for (const r of rows) {
      if (!completedIds.has(r.t.id)) r.right.value = allDate.value;
    }
  });

  document.getElementById("applyModal").onclick = () => {
    for (const t of dayTasks) {
      t.completed = completedIds.has(t.id);
    }
    for (const r of rows) {
      if (!completedIds.has(r.t.id)) {
        const newDate = r.right.value;
        if (newDate) r.t.date = newDate;
        r.t.completed = false;
      }
    }
    saveTasks();
    closeModal();
    render();
  };
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.classList.add("hidden");
  modal.classList.remove("panel");
  state.modal = null;
  document.body.classList.remove("modal-open");
  document.body.classList.remove("panel-open");
}

function addTaskDialog() {
  const modal = document.getElementById("modal");
  state.modal = { type: "add" };
  document.getElementById("modalTitle").textContent = "Add Task";
  const body = document.getElementById("modalBody");
  body.innerHTML = "";
  const form = document.createElement("div");
  form.className = "rollover-grid";
  const title = document.createElement("input");
  title.type = "text";
  title.placeholder = "Title";
  const date = document.createElement("input");
  date.type = "date";
  date.value = state.startDate || fmtDate(new Date());
  const notes = document.createElement("input");
  notes.type = "text";
  notes.placeholder = "Notes";
  form.appendChild(title);
  form.appendChild(date);
  form.appendChild(notes);
  body.appendChild(form);
  document.getElementById("applyModal").onclick = () => {
    const t = title.value.trim();
    const d = date.value;
    if (!t || !d) return;
    state.tasks.push({ id: uid(), title: t, date: d, notes: notes.value || null, completed: false });
    saveTasks();
    closeModal();
    render();
  };
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function sendSms(date, phone) {
  const tasks = state.tasks.filter(t => t.date === date).map(t => ({
    title: t.title,
    notes: t.notes,
    completed: !!t.completed
  }));
  fetch("/api/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: phone, date, tasks })
  }).then(r => r.json()).then(j => {
    alert(j.ok ? "Sent" : "Failed: " + (j.error || ""));
  }).catch(() => alert("Failed"));
}

function toCsv(rows) {
  const header = ["Title","Date","Notes","Completed"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const cells = [r.title, r.date, r.notes || "", r.completed ? "true" : "false"];
    lines.push(cells.map(x => String(x).replaceAll("\"", "")) .join(","));
  }
  return lines.join("\n");
}

function download(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadAllCsv() {
  const csv = toCsv(state.tasks.slice().sort(byDate));
  download("tasks_all.csv", csv);
}

function downloadCsvForDate(date) {
  const rows = state.tasks.filter(t => t.date === date).slice().sort(byDate);
  const csv = toCsv(rows);
  download(`tasks_${date}.csv`, csv);
}

function importCsvFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    importCsvText(text);
  };
  reader.readAsText(file);
}

function importCsvText(text) {
  const rows = csvRows(text);
  if (rows.length === 0) return;
  let header = rows[0].map(s => s.trim().toLowerCase());
  let start = 1;
  const hasHeader = header.includes("title") || header.includes("task") || header.includes("date");
  if (!hasHeader) {
    header = ["title","date","notes","completed"];
    start = 0;
  }
  function findIdx(names) {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  }
  const idxTitle = findIdx(["title","task","name"]);
  const idxDate = findIdx(["date","due","due_date","day"]);
  const idxNotes = findIdx(["notes","note","details","desc","description"]);
  const idxCompleted = findIdx(["completed","done","status"]);
  const imported = [];
  for (let i = start; i < rows.length; i++) {
    const cells = rows[i];
    const title = idxTitle >= 0 ? (cells[idxTitle] || "").trim() : "";
    const date = idxDate >= 0 ? (cells[idxDate] || "").trim() : "";
    if (!title) continue;
    const notes = idxNotes >= 0 ? (cells[idxNotes] || "").trim() || null : null;
    let completed = false;
    if (idxCompleted >= 0) {
      const v = (cells[idxCompleted] || "").trim().toLowerCase();
      completed = v === "true" || v === "yes" || v === "y" || v === "1" || v === "done";
    }
    imported.push({ id: uid(), title, date, notes, completed });
  }
  if (imported.length > 0) {
    openScheduleImportedModal(imported);
  }
}

function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ""; }
      else if (ch === '\n') { row.push(cell); cell = ""; rows.push(row.map(s => s.trim())); row = []; }
      else if (ch === '\r') { }
      else { cell += ch; }
    }
    i++;
  }
  row.push(cell);
  rows.push(row.map(s => s.trim()));
  return rows.filter(r => r.some(c => c.length > 0));
}

function openScheduleImportedModal(imported) {
  const modal = document.getElementById("modal");
  state.modal = { type: "schedule-import" };
  document.getElementById("modalTitle").textContent = "Schedule Imported Tasks";
  const body = document.getElementById("modalBody");
  body.innerHTML = "";
  modal.classList.add("panel");

  const stack = document.createElement("div");
  stack.className = "schedule-stack";
  const previewCard = document.createElement("div");
  previewCard.className = "preview-card";
  const previewTitle = document.createElement("div");
  previewTitle.className = "title";
  previewTitle.textContent = "Scheduled";
  const previewList = document.createElement("div");
  previewList.className = "list";
  const pushBtn = document.createElement("button");
  pushBtn.className = "btn btn-secondary";
  pushBtn.textContent = "Add Scheduled";

  previewCard.appendChild(previewTitle);
  previewCard.appendChild(previewList);
  previewCard.appendChild(pushBtn);

  const editorCard = document.createElement("div");
  editorCard.className = "editor-card";
  const setAll = document.createElement("div");
  setAll.className = "rollover-row";
  const allLabel = document.createElement("div");
  allLabel.textContent = "Set all to";
  const allDate = document.createElement("input");
  allDate.type = "date";
  setAll.appendChild(allLabel);
  setAll.appendChild(allDate);
  const grid = document.createElement("div");
  grid.className = "rollover-grid";
  editorCard.appendChild(setAll);
  editorCard.appendChild(grid);

  stack.appendChild(previewCard);
  stack.appendChild(editorCard);
  body.appendChild(stack);

  const rows = [];
  function updatePreview() {
    previewList.innerHTML = "";
    const scheduled = rows.filter(r => !!r.dateInput.value);
    if (scheduled.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No scheduled tasks";
      previewList.appendChild(empty);
      return;
    }
    for (const r of scheduled) {
      const item = document.createElement("div");
      item.className = "item";
      const when = document.createElement("div");
      when.textContent = r.dateInput.value;
      const what = document.createElement("div");
      what.textContent = r.t.title;
      item.appendChild(when);
      item.appendChild(what);
      previewList.appendChild(item);
    }
  }

  function addScheduledAndPrune() {
    const keep = [];
    const toAdd = [];
    for (const r of rows) {
      const d = r.dateInput.value;
      if (d) {
        toAdd.push({ id: uid(), title: r.t.title, date: d, notes: r.t.notes || null, completed: !!r.t.completed });
        r.row.remove();
      } else {
        keep.push(r);
      }
    }
    rows.length = 0; rows.push(...keep);
    if (toAdd.length) { state.tasks = state.tasks.concat(toAdd); saveTasks(); render(); }
    updatePreview();
  }

  for (const t of imported) {
    const row = document.createElement("div");
    row.className = "rollover-row";
    const left = document.createElement("div");
    left.className = "muted";
    left.textContent = t.title;
    const right = document.createElement("div");
    right.style.display = "grid"; right.style.gridTemplateColumns = "160px auto"; right.style.gap = "8px";
    const dateInput = document.createElement("input");
    dateInput.type = "date"; dateInput.value = t.date || "";
    const laterBtn = document.createElement("button");
    laterBtn.className = "btn btn-later btn-icon";
    laterBtn.textContent = "→";
    laterBtn.title = "Push to Later";
    laterBtn.setAttribute("aria-label", "Push to Later");
    laterBtn.onclick = () => {
      state.later.push({ id: uid(), title: t.title, notes: t.notes || null });
      saveLaterToServer();
      row.remove();
      const idx = rows.findIndex(x => x.row === row);
      if (idx >= 0) rows.splice(idx, 1);
      updatePreview();
    };
    dateInput.addEventListener("input", updatePreview);
    right.style.width = "100%";
    right.style.gridTemplateColumns = "1fr 28px";
    right.appendChild(dateInput);
    right.appendChild(laterBtn);
    row.appendChild(left);
    row.appendChild(right);
    const r = { t, dateInput, row };
    rows.push(r);
    grid.appendChild(row);
  }
  updatePreview();
  allDate.addEventListener("change", () => { for (const r of rows) { r.dateInput.value = allDate.value; } updatePreview(); });
  pushBtn.onclick = addScheduledAndPrune;

  document.getElementById("applyModal").onclick = () => {
    const scheduled = [];
    for (const r of rows) {
      const d = r.dateInput.value || r.t.date || "";
      if (!d) continue;
      scheduled.push({ id: uid(), title: r.t.title, date: d, notes: r.t.notes || null, completed: !!r.t.completed });
    }
    if (scheduled.length > 0) {
      state.tasks = state.tasks.concat(scheduled);
      saveTasks();
    }
    closeModal();
    render();
  };
  modal.classList.remove("hidden");
  document.body.classList.add("panel-open");
}

async function openLaterPanel() {
  const modal = document.getElementById("modal");
  state.modal = { type: "later" };
  document.getElementById("modalTitle").textContent = "Later";
  const body = document.getElementById("modalBody");
  body.innerHTML = "";
  modal.classList.add("panel");
  await loadLaterFromServer();
  const card = document.createElement("div");
  card.className = "editor-card";
  const setAll = document.createElement("div");
  setAll.className = "rollover-row";
  const allLabel = document.createElement("div");
  allLabel.textContent = "Set all to";
  const allDate = document.createElement("input");
  allDate.type = "date";
  setAll.appendChild(allLabel);
  setAll.appendChild(allDate);
  card.appendChild(setAll);
  const grid = document.createElement("div");
  grid.className = "rollover-grid";
  card.appendChild(grid);
  body.appendChild(card);
  const rows = [];
  for (const t of state.later) {
    const row = document.createElement("div");
    row.className = "rollover-row";
    const left = document.createElement("div");
    left.className = "muted";
    left.textContent = t.title;
    const right = document.createElement("div");
    right.style.display = "grid"; right.style.gridTemplateColumns = "1fr auto"; right.style.gap = "8px"; right.style.width = "100%";
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    const scheduleBtn = document.createElement("button");
    scheduleBtn.className = "btn btn-primary btn-sm";
    scheduleBtn.textContent = "Schedule";
    scheduleBtn.onclick = () => {
      const d = dateInput.value;
      if (!d) return;
      state.tasks.push({ id: uid(), title: t.title, date: d, notes: t.notes || null, completed: false });
      state.later = state.later.filter(x => x !== t);
      saveTasks();
      saveLaterToServer();
      row.remove();
      render();
    };
    right.appendChild(dateInput);
    right.appendChild(scheduleBtn);
    row.appendChild(left);
    row.appendChild(right);
    rows.push({ t, dateInput, row });
    grid.appendChild(row);
  }
  allDate.addEventListener("change", () => { for (const r of rows) r.dateInput.value = allDate.value; });
  modal.classList.remove("hidden");
  document.body.classList.add("panel-open");
}

async function init() {
  loadTasks();
  loadProjects();
  await loadServerTasks();
  await loadLaterFromServer();
  const today = fmtDate(new Date());
  state.startDate = state.startDate || today;
  state.endDate = state.endDate || today;
  const rangeStart = document.getElementById("rangeStart");
  const rangeEnd = document.getElementById("rangeEnd");
  rangeStart.value = state.startDate;
  rangeEnd.value = state.endDate;
  document.getElementById("rangeBtn").className = "btn btn-secondary";
  document.getElementById("rangeApply").className = "btn btn-primary";
  document.getElementById("importCsv").className = "btn btn-secondary";
  document.getElementById("downloadAllCsv").className = "btn btn-secondary";
  document.getElementById("addTask").className = "btn btn-success";
  document.getElementById("applyModal").className = "btn btn-primary";
  document.getElementById("closeModal").className = "btn btn-ghost";
  document.getElementById("rangeApply").onclick = () => {
    const s = rangeStart.value;
    const e = rangeEnd.value;
    if (!s || !e) return;
    state.startDate = s;
    state.endDate = e;
    render();
  };
  const pop = document.getElementById("rangePopover");
  document.getElementById("rangeBtn").onclick = () => { pop.classList.toggle("hidden"); };
  document.getElementById("closePopover").onclick = () => { pop.classList.add("hidden"); };
  document.getElementById("addTask").onclick = () => addTaskDialog();
  document.getElementById("downloadAllCsv").onclick = () => downloadAllCsv();
  const csvInput = document.getElementById("csvFile");
  csvInput.onchange = () => { const f = csvInput.files[0]; if (f) importCsvFile(f); };
  const importBtn = document.getElementById("importCsv");
  importBtn.onclick = () => { const f = csvInput.files[0]; if (f) importCsvFile(f); else csvInput.click(); };
  const drawer = document.getElementById("navDrawer");
  const backdrop = document.getElementById("drawerBackdrop");
  function openDrawer() { drawer.classList.add("open"); backdrop.classList.add("show"); backdrop.classList.remove("hidden"); }
  function closeDrawer() { drawer.classList.remove("open"); backdrop.classList.remove("show"); backdrop.classList.add("hidden"); }
  document.getElementById("menuToggle").onclick = openDrawer;
  document.getElementById("drawerClose").onclick = closeDrawer;
  backdrop.onclick = closeDrawer;
  document.getElementById("openLater").onclick = () => openLaterPanel();
  const dz = document.getElementById("csvDrop");
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("drag"); const file = e.dataTransfer.files[0]; if (file) importCsvFile(file); });
  dz.addEventListener("click", () => document.getElementById("csvFile").click());
  document.getElementById("closeModal").onclick = () => closeModal();
  setupTooltip();
  window.addEventListener("beforeunload", () => syncServer(true));
  render();
}

init();

function syncServer(reliable = false) {
  try {
    const payload = JSON.stringify({ tasks: state.tasks });
    if (reliable && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/tasks", blob);
    } else {
      fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
    }
  } catch {}
}

async function loadServerTasks() {
  try {
    if (window.sb && window.sb.client) {
      const rows = await window.sb.loadTasks();
      if (rows.length > 0) {
        state.tasks = rows;
        localStorage.setItem(storageKey, JSON.stringify(state.tasks));
      } else {
        await window.sb.saveAll(state.tasks);
      }
    } else {
      const r = await fetch("/api/tasks");
      const j = await r.json();
      if (Array.isArray(j.tasks) && j.tasks.length > 0) {
        state.tasks = j.tasks;
        localStorage.setItem(storageKey, JSON.stringify(state.tasks));
      } else {
        syncServer();
      }
    }
  } catch {}
}

async function loadLaterFromServer() {
  try {
    const r = await fetch("/api/later");
    const j = await r.json();
    const serverLater = Array.isArray(j.tasks) ? j.tasks : [];
    const backupRaw = localStorage.getItem("later_backup");
    const backup = backupRaw ? JSON.parse(backupRaw) : [];
    if (serverLater.length > 0) {
      state.later = serverLater;
      localStorage.setItem("later_backup", JSON.stringify(serverLater));
    } else if (backup.length > 0) {
      state.later = backup;
      saveLaterToServer();
    } else {
      state.later = [];
    }
  } catch {}
}

function saveLaterToServer() {
  try {
    localStorage.setItem("later_backup", JSON.stringify(state.later));
    if (window.sb && window.sb.client) {
      window.sb.saveLater(state.later);
    } else {
      fetch("/api/later", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks: state.later }) });
    }
  } catch {}
}

let tooltipEl;
function setupTooltip() {
  tooltipEl = document.getElementById("tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "tooltip";
    tooltipEl.className = "tooltip";
    document.body.appendChild(tooltipEl);
  }
}

function showTooltip(date, x, y) {
  const items = state.tasks.filter(t => t.date === date).slice().sort(byDate);
  const title = `<div class="title">${date} · ${items.length} tasks</div>`;
  const list = items.slice(0, 8).map(t => `<div class="item"><div>${t.title}</div></div>`).join("");
  tooltipEl.innerHTML = `${title}<div class="list">${list || "<div class=\"muted\">No tasks</div>"}</div>`;
  tooltipEl.classList.add("show");
  moveTooltip(x, y);
}

function setDayCompleted(date, value = true) {
  for (const t of state.tasks) {
    if (t.date === date) t.completed = !!value;
  }
  saveTasks();
  render();
}

function moveTooltip(x, y) {
  if (!tooltipEl) return;
  const pad = 14;
  const w = tooltipEl.offsetWidth || 300;
  const h = tooltipEl.offsetHeight || 120;
  let left = x + pad;
  let top = y + pad;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left + w + 8 > vw) left = x - w - pad;
  if (top + h + 8 > vh) top = y - h - pad;
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove("show");
}
let smsPopover;
function openSmsPopover(date, x, y) {
  if (!smsPopover) {
    smsPopover = document.createElement("div");
    smsPopover.className = "mini-popover";
    document.body.appendChild(smsPopover);
  }
  smsPopover.innerHTML = "";
  const label = document.createElement("div");
  label.textContent = `Send SMS for ${date}`;
  label.style.fontWeight = "700";
  label.style.marginBottom = "6px";
  const row = document.createElement("div");
  row.className = "row";
  const input = document.createElement("input");
  input.type = "tel";
  input.placeholder = "+1xxxxxxxxxx";
  input.inputMode = "tel";
  const send = document.createElement("button");
  send.className = "btn btn-primary btn-sm";
  send.textContent = "Send";
  send.onclick = () => { if (input.value) sendSms(date, input.value); closeSmsPopover(); };
  const actions = document.createElement("div");
  actions.style.display = "flex"; actions.style.gap = "8px"; actions.style.marginTop = "8px";
  const close = document.createElement("button");
  close.className = "btn btn-ghost btn-sm";
  close.textContent = "Close";
  close.onclick = closeSmsPopover;
  row.appendChild(input);
  row.appendChild(send);
  smsPopover.appendChild(label);
  smsPopover.appendChild(row);
  actions.appendChild(close);
  smsPopover.appendChild(actions);
  positionMiniPopover(smsPopover, x, y);
}

function closeSmsPopover() { if (smsPopover) smsPopover.remove(); smsPopover = null; }

function positionMiniPopover(el, x, y) {
  const pad = 12;
  const w = el.offsetWidth || 280;
  const h = el.offsetHeight || 120;
  let left = x + pad;
  let top = y + pad;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left + w + 8 > vw) left = x - w - pad;
  if (top + h + 8 > vh) top = y - h - pad;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
