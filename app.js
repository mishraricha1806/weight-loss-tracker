const STORAGE_KEY = "weight-loss-tracker:v1";
const KG_TO_LB = 2.2046226218;

const state = {
  unit: "kg",
  profile: {
    startWeightKg: null,
    goalWeightKg: null,
    heightCm: "",
  },
  entries: [],
  editingId: null,
};

const elements = {
  unitButtons: document.querySelectorAll("[data-unit]"),
  profileForm: document.querySelector("#profileForm"),
  startWeight: document.querySelector("#startWeight"),
  goalWeight: document.querySelector("#goalWeight"),
  heightCm: document.querySelector("#heightCm"),
  entryForm: document.querySelector("#entryForm"),
  entryDate: document.querySelector("#entryDate"),
  entryWeight: document.querySelector("#entryWeight"),
  entryNote: document.querySelector("#entryNote"),
  entryList: document.querySelector("#entryList"),
  entryTemplate: document.querySelector("#entryTemplate"),
  currentWeight: document.querySelector("#currentWeight"),
  currentDate: document.querySelector("#currentDate"),
  totalChange: document.querySelector("#totalChange"),
  toGoal: document.querySelector("#toGoal"),
  goalStatus: document.querySelector("#goalStatus"),
  bmiValue: document.querySelector("#bmiValue"),
  bmiCategory: document.querySelector("#bmiCategory"),
  trendLabel: document.querySelector("#trendLabel"),
  chart: document.querySelector("#weightChart"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  clearBtn: document.querySelector("#clearBtn"),
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    state.unit = parsed.unit === "lb" ? "lb" : "kg";
    state.profile = { ...state.profile, ...(parsed.profile || {}) };
    state.entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    unit: state.unit,
    profile: state.profile,
    entries: state.entries,
  }));
}

function toKg(value, unit = state.unit) {
  const number = Number(value);
  return unit === "lb" ? number / KG_TO_LB : number;
}

function fromKg(value) {
  return state.unit === "lb" ? value * KG_TO_LB : value;
}

function formatWeight(valueKg, options = {}) {
  if (!Number.isFinite(valueKg)) return "--";
  const value = fromKg(valueKg);
  const sign = options.sign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} ${state.unit}`;
}

function parseWeightInput(input) {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? toKg(value) : null;
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function sortedEntries() {
  return [...state.entries].sort((a, b) => a.date.localeCompare(b.date));
}

function newestEntry() {
  return sortedEntries().at(-1);
}

function firstEntryWeight() {
  const entries = sortedEntries();
  if (entries.length) return entries[0].weightKg;
  return Number.isFinite(state.profile.startWeightKg) ? state.profile.startWeightKg : null;
}

function bmiCategory(bmi) {
  if (!Number.isFinite(bmi)) return "Add height";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy range";
  if (bmi < 30) return "Overweight";
  return "Obese range";
}

function updateForms() {
  elements.startWeight.value = Number.isFinite(state.profile.startWeightKg) ? fromKg(state.profile.startWeightKg).toFixed(1) : "";
  elements.goalWeight.value = Number.isFinite(state.profile.goalWeightKg) ? fromKg(state.profile.goalWeightKg).toFixed(1) : "";
  elements.heightCm.value = state.profile.heightCm;
  elements.entryDate.value = todayIso();
}

function updateUnitToggle() {
  elements.unitButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.unit === state.unit);
  });
}

function updateStats() {
  const current = newestEntry();
  const startWeight = firstEntryWeight();
  const goalWeight = Number.isFinite(state.profile.goalWeightKg) ? state.profile.goalWeightKg : null;
  const heightMeters = Number(state.profile.heightCm) / 100;

  elements.currentWeight.textContent = current ? formatWeight(current.weightKg) : "--";
  elements.currentDate.textContent = current ? formatDate(current.date) : "No entries yet";

  if (current && Number.isFinite(startWeight)) {
    elements.totalChange.textContent = formatWeight(current.weightKg - startWeight, { sign: true });
  } else {
    elements.totalChange.textContent = "--";
  }

  if (current && goalWeight) {
    const remaining = current.weightKg - goalWeight;
    elements.toGoal.textContent = formatWeight(Math.abs(remaining));
    elements.goalStatus.textContent = remaining <= 0 ? "Goal reached" : "remaining";
  } else {
    elements.toGoal.textContent = "--";
    elements.goalStatus.textContent = "Set a goal";
  }

  if (current && heightMeters > 0) {
    const bmi = current.weightKg / (heightMeters * heightMeters);
    elements.bmiValue.textContent = bmi.toFixed(1);
    elements.bmiCategory.textContent = bmiCategory(bmi);
  } else {
    elements.bmiValue.textContent = "--";
    elements.bmiCategory.textContent = "Add height";
  }
}

function renderEntries() {
  elements.entryList.innerHTML = "";
  const entries = sortedEntries().reverse();

  if (!entries.length) {
    elements.entryList.innerHTML = '<div class="empty-state">Add your first weight entry to start tracking progress.</div>';
    return;
  }

  entries.forEach((entry) => {
    const node = elements.entryTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = entry.id;
    node.querySelector(".entry-weight").textContent = formatWeight(entry.weightKg);
    node.querySelector(".entry-date").textContent = formatDate(entry.date);
    node.querySelector(".entry-note").textContent = entry.note || "No note";
    elements.entryList.append(node);
  });
}

function resizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(640, Math.floor(rect.width * ratio));
  canvas.height = Math.max(280, Math.floor(rect.height * ratio));
  return ratio;
}

function drawChart() {
  const canvas = elements.chart;
  const ctx = canvas.getContext("2d");
  const ratio = resizeCanvas(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const padding = 52 * ratio;
  const entries = sortedEntries();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcf8";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d9ded6";
  ctx.lineWidth = ratio;
  for (let i = 0; i < 5; i += 1) {
    const y = padding + ((height - padding * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  if (entries.length < 2) {
    ctx.fillStyle = "#66736d";
    ctx.font = `${16 * ratio}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("Add at least two entries to see your trend.", width / 2, height / 2);
    elements.trendLabel.textContent = entries.length ? "One entry logged" : "Waiting for data";
    return;
  }

  const weights = entries.map((entry) => fromKg(entry.weightKg));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(1, max - min);
  const xStep = (width - padding * 2) / (entries.length - 1);

  const points = weights.map((weight, index) => ({
    x: padding + xStep * index,
    y: height - padding - ((weight - min) / range) * (height - padding * 2),
  }));

  const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
  gradient.addColorStop(0, "rgba(31, 122, 107, 0.28)");
  gradient.addColorStop(1, "rgba(31, 122, 107, 0.02)");

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.lineTo(points.at(-1).x, height - padding);
  ctx.lineTo(points[0].x, height - padding);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = "#1f7a6b";
  ctx.lineWidth = 4 * ratio;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5 * ratio, 0, Math.PI * 2);
    ctx.fillStyle = "#fffdf8";
    ctx.fill();
    ctx.strokeStyle = "#1f7a6b";
    ctx.lineWidth = 3 * ratio;
    ctx.stroke();
  });

  ctx.fillStyle = "#66736d";
  ctx.font = `${12 * ratio}px system-ui`;
  ctx.textAlign = "left";
  ctx.fillText(`${max.toFixed(1)} ${state.unit}`, 10 * ratio, padding + 4 * ratio);
  ctx.fillText(`${min.toFixed(1)} ${state.unit}`, 10 * ratio, height - padding + 4 * ratio);

  const delta = entries.at(-1).weightKg - entries[0].weightKg;
  elements.trendLabel.textContent = delta < 0 ? `${formatWeight(Math.abs(delta))} down` : `${formatWeight(delta, { sign: true })} change`;
}

function render() {
  updateUnitToggle();
  updateStats();
  renderEntries();
  drawChart();
  saveState();
}

function resetEntryForm() {
  state.editingId = null;
  elements.entryForm.querySelector("button").textContent = "Add entry";
  elements.entryDate.value = todayIso();
  elements.entryWeight.value = "";
  elements.entryNote.value = "";
}

elements.unitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.unit = button.dataset.unit;
    updateForms();
    render();
  });
});

elements.profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.profile = {
    startWeightKg: parseWeightInput(elements.startWeight.value),
    goalWeightKg: parseWeightInput(elements.goalWeight.value),
    heightCm: elements.heightCm.value,
  };
  render();
});

elements.entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const weightKg = parseWeightInput(elements.entryWeight.value);
  if (!weightKg) return;

  const payload = {
    date: elements.entryDate.value,
    weightKg,
    note: elements.entryNote.value.trim(),
  };

  if (state.editingId) {
    state.entries = state.entries.map((entry) => entry.id === state.editingId ? { ...entry, ...payload } : entry);
  } else {
    state.entries.push({ id: createId(), ...payload });
  }

  resetEntryForm();
  render();
});

elements.entryList.addEventListener("click", (event) => {
  const row = event.target.closest(".entry-row");
  if (!row) return;
  const entry = state.entries.find((item) => item.id === row.dataset.id);
  if (!entry) return;

  if (event.target.closest(".delete-entry")) {
    state.entries = state.entries.filter((item) => item.id !== entry.id);
    render();
  }

  if (event.target.closest(".edit-entry")) {
    state.editingId = entry.id;
    elements.entryDate.value = entry.date;
    elements.entryWeight.value = fromKg(entry.weightKg).toFixed(1);
    elements.entryNote.value = entry.note;
    elements.entryForm.querySelector("button").textContent = "Update entry";
    elements.entryWeight.focus();
  }
});

elements.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({
    profile: state.profile,
    unit: state.unit,
    entries: state.entries,
    exportedAt: new Date().toISOString(),
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "weight-loss-tracker.json";
  link.click();
  URL.revokeObjectURL(url);
});

elements.importInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    state.unit = imported.unit === "lb" ? "lb" : "kg";
    state.profile = { ...state.profile, ...(imported.profile || {}) };
    state.entries = Array.isArray(imported.entries) ? imported.entries.filter((entry) => entry.date && Number.isFinite(entry.weightKg)) : [];
    updateForms();
    render();
  } catch {
    alert("That file does not look like a valid tracker export.");
  } finally {
    elements.importInput.value = "";
  }
});

elements.clearBtn.addEventListener("click", () => {
  if (!state.entries.length) return;
  if (confirm("Clear all weight entries? Your saved goal will stay in place.")) {
    state.entries = [];
    resetEntryForm();
    render();
  }
});

window.addEventListener("resize", drawChart);

loadState();
updateForms();
render();
