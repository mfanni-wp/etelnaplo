const STORAGE_KEY = "etelnaplo.v1";
const DEFAULT_DAY_COUNT = 30;

const mealTypes = {
  breakfast: "Reggeli",
  lunch: "Ebéd",
  dinner: "Vacsora",
  snack: "Nasi",
  extra: "Egyéb étkezés",
};

const allergens = [
  "glutén",
  "tejtermék",
  "tojás",
  "szója",
  "földimogyoró",
  "diósfélék",
  "hal",
  "rákfélék",
  "szezámmag",
  "mustár",
  "zeller",
  "hagyma/fokhagyma",
  "csípős",
  "alkohol",
  "kávé",
  "édesítőszer",
];

const symptomPresets = [
  "Puffadás",
  "Hasmenés",
  "Székrekedés",
  "Hasi fájdalom",
  "Hányinger",
  "Gyomorégés",
  "Bőrviszketés / kiütés",
  "Fejfájás",
  "Fáradtság",
];

const ingredientTriggers = {
  tejtermék: ["tej", "sajt", "joghurt", "kefir", "tejföl", "tejszín", "vaj", "laktóz"],
  glutén: ["búza", "kenyér", "tészta", "liszt", "péksüti", "zsemle", "kifli", "rozs", "árpa"],
  tojás: ["tojás", "majonéz"],
  szója: ["szója", "tofu", "szójaszósz"],
  "hagyma/fokhagyma": ["hagyma", "fokhagyma", "póré", "újhagyma"],
  csípős: ["chili", "csípős", "erős paprika", "jalapeno"],
  kávé: ["kávé", "espresso", "cappuccino", "latte"],
  alkohol: ["bor", "sör", "pezsgő", "alkohol"],
  "édesítőszer": ["xilit", "eritrit", "szorbit", "édesítőszer"],
};

const state = loadState();
let selectedDate = state.selectedDate || isoToday();
let pendingMealPhoto = "";

const el = {
  startDate: document.querySelector("#startDate"),
  todayBtn: document.querySelector("#todayBtn"),
  addMonthBtn: document.querySelector("#addMonthBtn"),
  dayList: document.querySelector("#dayList"),
  rangeText: document.querySelector("#rangeText"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  selectedDayLabel: document.querySelector("#selectedDayLabel"),
  selectedDateTitle: document.querySelector("#selectedDateTitle"),
  mealCountPill: document.querySelector("#mealCountPill"),
  symptomPill: document.querySelector("#symptomPill"),
  mealGroups: document.querySelector("#mealGroups"),
  symptomList: document.querySelector("#symptomList"),
  stressInput: document.querySelector("#stressInput"),
  stressValue: document.querySelector("#stressValue"),
  sleepInput: document.querySelector("#sleepInput"),
  medsInput: document.querySelector("#medsInput"),
  dayNoteInput: document.querySelector("#dayNoteInput"),
  summaryGrid: document.querySelector("#summaryGrid"),
  weeklySummaryList: document.querySelector("#weeklySummaryList"),
  patternList: document.querySelector("#patternList"),
  positivePatternList: document.querySelector("#positivePatternList"),
  reportText: document.querySelector("#reportText"),
  mealDialog: document.querySelector("#mealDialog"),
  mealForm: document.querySelector("#mealForm"),
  symptomDialog: document.querySelector("#symptomDialog"),
  symptomForm: document.querySelector("#symptomForm"),
};

function loadState() {
  const fallback = {
    startDate: isoToday(),
    selectedDate: isoToday(),
    dayCount: DEFAULT_DAY_COUNT,
    days: {},
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return fallback;
  }
}

function saveState() {
  state.selectedDate = selectedDate;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isoToday() {
  const now = new Date();
  return toIsoDate(now);
}

function toIsoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(iso, amount) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

function formatDate(iso, style = "long") {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: style,
  }).format(new Date(`${iso}T12:00:00`));
}

function dayName(iso) {
  return new Intl.DateTimeFormat("hu-HU", { weekday: "long" }).format(new Date(`${iso}T12:00:00`));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function getDay(iso = selectedDate) {
  if (!state.days[iso]) {
    state.days[iso] = {
      meals: [],
      symptoms: [],
      context: { stress: 0, sleep: "", meds: "", note: "" },
      skippedMeals: [],
    };
  }
  if (!Array.isArray(state.days[iso].meals)) state.days[iso].meals = [];
  if (!Array.isArray(state.days[iso].symptoms)) state.days[iso].symptoms = [];
  if (!Array.isArray(state.days[iso].skippedMeals)) state.days[iso].skippedMeals = [];
  if (!state.days[iso].context) state.days[iso].context = { stress: 0, sleep: "", meds: "", note: "" };
  const day = state.days[iso];
  day.meals.forEach((meal) => {
    if (!Array.isArray(meal.reactions)) meal.reactions = [];
  });
  day.symptoms.forEach((symptom) => {
    if (!Array.isArray(symptom.presets)) symptom.presets = symptom.preset ? [symptom.preset] : [];
    if (!symptom.preset) symptom.preset = symptom.presets[0] || "";
    if (!symptom.mealId) symptom.mealId = "";
  });
  return state.days[iso];
}

function getRange() {
  if (!state.dayCount) state.dayCount = DEFAULT_DAY_COUNT;
  return Array.from({ length: state.dayCount }, (_, index) => addDays(state.startDate, index));
}

function clampSelectedDate() {
  const range = getRange();
  if (!range.includes(selectedDate)) selectedDate = range[0];
}

function render() {
  clampSelectedDate();
  el.startDate.value = state.startDate;
  renderDayList();
  renderDaily();
  renderReport();
  saveState();
}

function renderDayList() {
  const range = getRange();
  const loggedDays = range.filter((date) => {
    const day = state.days[date];
    return day && (day.meals.length || day.symptoms.length || day.skippedMeals?.length || day.context.note || day.context.meds);
  }).length;
  el.rangeText.textContent = `${formatDate(range[0], "medium")} - ${formatDate(range[range.length - 1], "medium")}`;
  el.progressText.textContent = `${loggedDays} / ${state.dayCount} nap vezetve`;
  el.progressBar.style.width = `${Math.round((loggedDays / state.dayCount) * 100)}%`;
  el.dayList.innerHTML = "";

  range.forEach((date, index) => {
    const day = state.days[date] || { meals: [], symptoms: [] };
    const skippedCount = day.skippedMeals?.length || 0;
    const maxSeverity = Math.max(0, ...day.symptoms.map((item) => Number(item.severity || 0)));
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-button ${date === selectedDate ? "active" : ""}`;
    button.innerHTML = `
      <span>
        <strong>${index + 1}. nap - ${formatDate(date, "medium")}</strong>
        <span class="day-meta">${day.meals.length} étkezés, ${day.symptoms.length} tünet${skippedCount ? `, ${skippedCount} kihagyva` : ""}</span>
      </span>
      <span class="severity-dot" style="background:${severityColor(maxSeverity)}" title="Max tüneterősség: ${maxSeverity}"></span>
    `;
    button.addEventListener("click", () => {
      selectedDate = date;
      render();
    });
    el.dayList.append(button);
  });
}

function renderDaily() {
  const day = getDay();
  syncMealReactions(day);
  const rangeIndex = getRange().indexOf(selectedDate) + 1;
  el.selectedDayLabel.textContent = `${rangeIndex}. nap - ${dayName(selectedDate)}`;
  el.selectedDateTitle.textContent = formatDate(selectedDate);
  el.mealCountPill.textContent = `${day.meals.length} étkezés`;
  el.symptomPill.textContent = `${day.symptoms.length} tünet`;
  document.querySelector("#addMealBtn").classList.toggle("is-complete", day.meals.some((meal) => meal.type === "extra"));
  document.querySelector("#addSymptomBtn").classList.toggle("is-complete", day.symptoms.length > 0);
  el.addMonthBtn.classList.toggle("is-complete", (state.dayCount || DEFAULT_DAY_COUNT) > DEFAULT_DAY_COUNT);

  renderMeals(day);
  renderSymptoms(day);

  el.stressInput.value = day.context.stress || 0;
  el.stressValue.textContent = `${day.context.stress || 0}/10`;
  el.sleepInput.value = day.context.sleep || "";
  el.medsInput.value = day.context.meds || "";
  el.dayNoteInput.value = day.context.note || "";
}

function renderMeals(day) {
  el.mealGroups.innerHTML = "";
  Object.entries(mealTypes).forEach(([type, label]) => {
    const group = document.createElement("section");
    group.className = "meal-type";
    const meals = day.meals.filter((meal) => meal.type === type).sort(byTime);
    const isSkipped = day.skippedMeals.includes(type);
    group.innerHTML = `
      <div class="meal-type-heading">
        <h4>${label}</h4>
        <div class="meal-type-actions">
          ${type !== "extra" ? `<button type="button" class="mini-button ${meals.length ? "is-complete" : ""}" data-add-meal-type="${type}">+</button>` : ""}
          ${type !== "extra" && !meals.length ? `<button type="button" class="mini-button ${isSkipped ? "undo-skip" : ""}" data-skip-meal-type="${type}">${isSkipped ? "Mégis volt" : "Nem volt"}</button>` : ""}
          <span class="${isSkipped ? "skip-badge" : ""}">${isSkipped ? "Kihagyva" : meals.length}</span>
        </div>
      </div>
    `;
    if (isSkipped) {
      const skipped = document.createElement("div");
      skipped.className = "empty skipped";
      skipped.textContent = `${label} kihagyva ezen a napon.`;
      group.append(skipped);
    } else if (!meals.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Nincs bejegyzés.";
      group.append(empty);
    } else {
      meals.forEach((meal) => group.append(mealCard(meal)));
    }
    el.mealGroups.append(group);
  });
  el.mealGroups.querySelectorAll("[data-add-meal-type]").forEach((button) => {
    button.addEventListener("click", () => openMealDialog(null, button.dataset.addMealType));
  });
  el.mealGroups.querySelectorAll("[data-skip-meal-type]").forEach((button) => {
    button.addEventListener("click", () => toggleSkippedMeal(button.dataset.skipMealType));
  });
}

function toggleSkippedMeal(type) {
  const day = getDay();
  if (day.skippedMeals.includes(type)) {
    day.skippedMeals = day.skippedMeals.filter((item) => item !== type);
  } else {
    day.skippedMeals.push(type);
  }
  render();
}

function mealCard(meal) {
  const card = document.createElement("article");
  card.className = "entry-card";
  const reactions = meal.reactions || [];
  card.innerHTML = `
    <div class="entry-top">
      <strong>${escapeHtml(meal.food)}</strong>
      <span class="time">${meal.time}</span>
    </div>
    ${meal.photo ? `<img class="meal-photo" src="${meal.photo}" alt="${escapeHtml(meal.food)} fotója">` : ""}
    <div class="muted">${escapeHtml([meal.amount, meal.source].filter(Boolean).join(" - "))}</div>
    <div>${escapeHtml(meal.ingredients || "")}</div>
    <div class="tag-row">${(meal.allergens || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    ${reactions.length ? `<div class="reaction-list">${reactions.map((reaction) => `<span>${escapeHtml(reaction.time)} - ${escapeHtml(reaction.text)}</span>`).join("")}</div>` : ""}
  `;
  const actions = document.createElement("div");
  actions.className = "entry-actions";
  const symptomButton = document.createElement("button");
  symptomButton.type = "button";
  symptomButton.textContent = "Tünet ehhez";
  symptomButton.addEventListener("click", () => openSymptomDialog(null, meal.id));
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "Szerkesztés";
  editButton.addEventListener("click", () => openMealDialog(meal));
  actions.append(symptomButton, editButton);
  card.append(actions);
  return card;
}

function renderSymptoms(day) {
  el.symptomList.innerHTML = "";
  const symptoms = [...day.symptoms].sort(byTime);
  if (!symptoms.length) {
    el.symptomList.innerHTML = `<div class="empty">Nincs rögzített tünet ezen a napon.</div>`;
    return;
  }
  symptoms.forEach((symptom) => {
    const linkedMeal = symptom.mealId ? day.meals.find((meal) => meal.id === symptom.mealId) : null;
    const card = document.createElement("article");
    card.className = "entry-card";
    card.innerHTML = `
      <div class="entry-top">
        <strong>${escapeHtml(symptomLabel(symptom))}</strong>
        <span class="time">${symptom.time}</span>
      </div>
      <div class="tag-row">
        <span class="tag">erősség: ${symptom.severity}/10</span>
        ${symptom.duration ? `<span class="tag">${escapeHtml(symptom.duration)}</span>` : ""}
        ${linkedMeal ? `<span class="tag">étkezés: ${escapeHtml(linkedMeal.food)}</span>` : ""}
      </div>
      <div class="muted">${escapeHtml(symptom.note || "")}</div>
    `;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Szerkesztés";
    button.addEventListener("click", () => openSymptomDialog(symptom));
    card.append(button);
    el.symptomList.append(card);
  });
}

function byTime(a, b) {
  return String(a.time || "").localeCompare(String(b.time || ""));
}

function severityColor(value) {
  if (value >= 7) return "#a33b3b";
  if (value >= 4) return "#c9822b";
  if (value >= 1) return "#315f8c";
  return "#cfd8d1";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function openMealDialog(meal = null, preferredType = "extra") {
  const data = meal || {
    id: "",
    type: preferredType,
    time: new Date().toTimeString().slice(0, 5),
    food: "",
    ingredients: "",
    amount: "",
    source: "",
    allergens: [],
    photo: "",
    reactions: [],
    note: "",
  };
  pendingMealPhoto = data.photo || "";
  document.querySelector("#mealId").value = data.id;
  document.querySelector("#mealType").value = data.type;
  document.querySelector("#mealTime").value = data.time;
  document.querySelector("#mealFood").value = data.food;
  document.querySelector("#mealIngredients").value = data.ingredients || "";
  document.querySelector("#mealAmount").value = data.amount || "";
  document.querySelector("#mealSource").value = data.source || "";
  document.querySelector("#mealNote").value = data.note || "";
  document.querySelector("#mealPhoto").value = "";
  document.querySelector("#deleteMealBtn").hidden = !meal;
  renderMealPhotoPreview();
  renderAllergenChips(data.allergens || []);
  el.mealDialog.showModal();
}

function renderMealPhotoPreview() {
  const preview = document.querySelector("#mealPhotoPreview");
  const removeButton = document.querySelector("#removeMealPhotoBtn");
  preview.innerHTML = pendingMealPhoto
    ? `<img src="${pendingMealPhoto}" alt="Étkezés fotó előnézete"><span>Fotó csatolva</span>`
    : `<span>Nincs csatolt fotó.</span>`;
  removeButton.hidden = !pendingMealPhoto;
}

function renderAllergenChips(selected) {
  const container = document.querySelector("#allergenChips");
  container.innerHTML = "";
  allergens.forEach((name) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${escapeHtml(name)}" ${selected.includes(name) ? "checked" : ""}> ${escapeHtml(name)}`;
    container.append(label);
  });
}

function saveMeal(event) {
  event.preventDefault();
  const id = document.querySelector("#mealId").value || uid();
  const day = getDay();
  const entry = {
    id,
    type: document.querySelector("#mealType").value,
    time: document.querySelector("#mealTime").value,
    food: document.querySelector("#mealFood").value.trim(),
    ingredients: document.querySelector("#mealIngredients").value.trim(),
    amount: document.querySelector("#mealAmount").value.trim(),
    source: document.querySelector("#mealSource").value.trim(),
    allergens: [...document.querySelectorAll("#allergenChips input:checked")].map((input) => input.value),
    photo: pendingMealPhoto,
    reactions: day.meals.find((item) => item.id === id)?.reactions || [],
    note: document.querySelector("#mealNote").value.trim(),
  };
  if (!entry.food && !entry.photo && !entry.note) return;
  if (!entry.food) entry.food = "Fotózott étkezés - később kitöltöm";
  day.skippedMeals = day.skippedMeals.filter((type) => type !== entry.type);
  day.meals = day.meals.filter((item) => item.id !== id);
  day.meals.push(entry);
  syncMealReactions(day);
  el.mealDialog.close();
  render();
}

function readMealPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("load", () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      });
      image.addEventListener("error", reject);
      image.src = reader.result;
    });
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

function openSymptomDialog(symptom = null, mealId = "") {
  const data = symptom || {
    id: "",
    time: new Date().toTimeString().slice(0, 5),
    preset: "",
    presets: [],
    type: "",
    severity: 5,
    mealId,
    duration: "",
    note: "",
  };
  renderSymptomMealOptions(data.mealId || mealId);
  renderSymptomPresetChips(data.presets || (data.preset ? [data.preset] : []));
  document.querySelector("#symptomId").value = data.id;
  document.querySelector("#linkedMealId").value = data.mealId || mealId || "";
  document.querySelector("#symptomTime").value = data.time;
  document.querySelector("#symptomType").value = data.type;
  document.querySelector("#symptomSeverity").value = data.severity;
  document.querySelector("#symptomSeverityValue").textContent = `${data.severity}/10`;
  document.querySelector("#durationInput").value = data.duration || "";
  document.querySelector("#symptomNote").value = data.note || "";
  document.querySelector("#deleteSymptomBtn").hidden = !symptom;
  el.symptomDialog.showModal();
}

function renderSymptomPresetChips(selected = []) {
  const container = document.querySelector("#symptomPresetChips");
  container.innerHTML = "";
  symptomPresets.forEach((name) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${escapeHtml(name)}" ${selected.includes(name) ? "checked" : ""}> ${escapeHtml(name)}`;
    container.append(label);
  });
}

function renderSymptomMealOptions(selectedMealId = "") {
  const select = document.querySelector("#symptomMealSelect");
  const day = getDay();
  select.innerHTML = `<option value="">Nem kötöm konkrét étkezéshez</option>`;
  day.meals.slice().sort(byTime).forEach((meal) => {
    const option = document.createElement("option");
    option.value = meal.id;
    option.textContent = `${meal.time} - ${mealTypes[meal.type]}: ${meal.food}`;
    option.selected = meal.id === selectedMealId;
    select.append(option);
  });
}

function saveSymptom(event) {
  event.preventDefault();
  const id = document.querySelector("#symptomId").value || uid();
  const day = getDay();
  const presets = [...document.querySelectorAll("#symptomPresetChips input:checked")].map((input) => input.value);
  const preset = presets[0] || "";
  const detail = document.querySelector("#symptomType").value.trim();
  const mealId = document.querySelector("#symptomMealSelect").value || document.querySelector("#linkedMealId").value;
  const label = [...presets, detail && !presets.includes(detail) ? detail : ""].filter(Boolean).join(", ") || "Egyéb tünet";
  const entry = {
    id,
    time: document.querySelector("#symptomTime").value,
    preset,
    presets,
    type: detail || presets.join(", ") || "Egyéb tünet",
    severity: Number(document.querySelector("#symptomSeverity").value),
    mealId,
    duration: document.querySelector("#durationInput").value.trim(),
    note: document.querySelector("#symptomNote").value.trim(),
  };
  if (!entry.time) return;
  day.symptoms = day.symptoms.filter((item) => item.id !== id);
  day.symptoms.push(entry);
  syncMealReactions(day);
  el.symptomDialog.close();
  render();
}

function symptomLabel(symptom) {
  const presets = Array.isArray(symptom.presets) ? symptom.presets : (symptom.preset ? [symptom.preset] : []);
  if (presets.length && symptom.type && symptom.type !== presets.join(", ") && !presets.includes(symptom.type)) {
    return `${presets.join(", ")} - ${symptom.type}`;
  }
  return symptom.type || presets.join(", ") || "Tünet";
}

function syncMealReactions(day) {
  day.meals.forEach((meal) => {
    meal.reactions = day.symptoms
      .filter((symptom) => symptom.mealId === meal.id)
      .sort(byTime)
      .map((symptom) => ({
        id: symptom.id,
        time: symptom.time,
        text: `${symptomLabel(symptom)} (${symptom.severity}/10)`,
      }));
  });
}

function renderReport() {
  const rows = getAllRows();
  const meals = rows.flatMap((day) => day.meals.map((meal) => ({ ...meal, date: day.date })));
  const symptoms = rows.flatMap((day) => day.symptoms.map((symptom) => ({ ...symptom, date: day.date })));
  const severeSymptoms = symptoms.filter((symptom) => symptom.severity >= 7);
  const avgSeverity = symptoms.length
    ? (symptoms.reduce((sum, symptom) => sum + symptom.severity, 0) / symptoms.length).toFixed(1)
    : "0";

  el.summaryGrid.innerHTML = [
    ["Naplózott nap", rows.filter((day) => day.meals.length || day.symptoms.length || day.skippedMeals.length).length],
    ["Étkezés", meals.length],
    ["Tünet", symptoms.length],
    ["Átlagos erősség", avgSeverity],
  ].map(([label, value]) => `<div class="summary-card"><strong>${value}</strong><span>${label}</span></div>`).join("");

  const patterns = getPatterns(meals, symptoms);
  const positivePatterns = getPositivePatterns(meals, symptoms);
  const weeklySummaries = getWeeklySummaries(rows);
  el.weeklySummaryList.innerHTML = weeklySummaries.length
    ? weeklySummaries.map((week) => `
      <div class="pattern-item weekly">
        <strong>${week.label}</strong>
        <div class="muted">Problémás összetevők: ${escapeHtml(week.problemIngredients || "nem rajzolódott ki egyértelmű minta")}</div>
        <div class="muted">Tünetek: ${escapeHtml(week.symptomTypes || "nem volt rögzített tünet")}</div>
        <div class="muted">Jobb napok: ${escapeHtml(week.betterDays || "nem volt kiugróan könnyű nap")}</div>
        <div class="muted">Nehezebb napok: ${escapeHtml(week.harderDays || "nem volt kiugróan nehéz nap")}</div>
      </div>
    `).join("")
    : `<div class="empty">Még nincs heti bontáshoz elég adat.</div>`;
  el.patternList.innerHTML = patterns.length
    ? patterns.map((item) => `
      <div class="pattern-item">
        <strong>${escapeHtml(item.name)}</strong>
        <div class="muted">${item.count} tünet előtt 24 órán belül, átlagos tüneterősség: ${item.avg}</div>
      </div>
    `).join("")
    : `<div class="empty">Még nincs elég adat mintákhoz. Pár nap után itt látszanak a gyakran tünet előtt szereplő elemek.</div>`;
  el.positivePatternList.innerHTML = positivePatterns.length
    ? positivePatterns.map((item) => `
      <div class="pattern-item positive">
        <strong>${escapeHtml(item.name)}</strong>
        <div class="muted">${item.count} alkalom, ${item.goodRate}% tünetmentes vagy enyhe 24 órán belül</div>
      </div>
    `).join("")
    : `<div class="empty">Még nincs elég ismétlődő, jól tolerált elem. Ez akkor lesz hasznos, ha ugyanaz az étel vagy allergén többször is előfordul.</div>`;

  el.reportText.value = buildReportText(rows, meals, symptoms, severeSymptoms, patterns, positivePatterns, weeklySummaries);
}

function getAllRows() {
  return getRange().map((date) => ({ date, ...getDay(date) }));
}

function toDateTime(date, time) {
  return new Date(`${date}T${time || "00:00"}:00`).getTime();
}

function getPatterns(meals, symptoms) {
  const bucket = new Map();
  symptoms.forEach((symptom) => {
    const symptomTime = toDateTime(symptom.date, symptom.time);
    meals.forEach((meal) => {
      const mealTime = toDateTime(meal.date, meal.time);
      const hours = (symptomTime - mealTime) / 36e5;
      if (hours >= 0 && hours <= 24) {
        const keys = getMealKeys(meal);
        keys.forEach((key) => {
          if (!bucket.has(key)) bucket.set(key, []);
          bucket.get(key).push(symptom.severity);
        });
      }
    });
  });
  return [...bucket.entries()]
    .map(([name, values]) => ({
      name,
      count: values.length,
      avg: (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1),
    }))
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count || b.avg - a.avg)
    .slice(0, 8);
}

function getPositivePatterns(meals, symptoms) {
  const bucket = new Map();
  meals.forEach((meal) => {
    const mealTime = toDateTime(meal.date, meal.time);
    const relatedSymptoms = symptoms.filter((symptom) => {
      const symptomTime = toDateTime(symptom.date, symptom.time);
      const hours = (symptomTime - mealTime) / 36e5;
      return hours >= 0 && hours <= 24;
    });
    const worstSeverity = relatedSymptoms.length ? Math.max(...relatedSymptoms.map((symptom) => symptom.severity)) : 0;
    const keys = getMealKeys(meal);
    keys.forEach((key) => {
      if (!bucket.has(key)) bucket.set(key, { count: 0, good: 0, totalSeverity: 0 });
      const item = bucket.get(key);
      item.count += 1;
      item.totalSeverity += worstSeverity;
      if (worstSeverity <= 2) item.good += 1;
    });
  });
  return [...bucket.entries()]
    .map(([name, item]) => ({
      name,
      count: item.count,
      goodRate: Math.round((item.good / item.count) * 100),
      avgSeverity: item.totalSeverity / item.count,
    }))
    .filter((item) => item.count >= 2 && item.goodRate >= 70)
    .sort((a, b) => b.goodRate - a.goodRate || b.count - a.count || a.avgSeverity - b.avgSeverity)
    .slice(0, 8);
}

function getMealKeys(meal) {
  return [...new Set([...(meal.allergens || []), ...detectIngredientTriggers(meal), ...extractFoodWords(meal.food)])];
}

function detectIngredientTriggers(meal) {
  const haystack = `${meal.food || ""} ${meal.ingredients || ""} ${meal.note || ""}`.toLowerCase();
  return Object.entries(ingredientTriggers)
    .filter(([, words]) => words.some((word) => haystack.includes(word)))
    .map(([trigger]) => trigger);
}

function getWeeklySummaries(rows) {
  const weeks = [];
  for (let index = 0; index < rows.length; index += 7) {
    const slice = rows.slice(index, index + 7);
    const meals = slice.flatMap((day) => day.meals.map((meal) => ({ ...meal, date: day.date })));
    const symptoms = slice.flatMap((day) => day.symptoms);
    const activeDays = slice.filter((day) => day.meals.length || day.symptoms.length || day.skippedMeals.length);
    if (!activeDays.length) continue;
    const symptomKeys = new Map();
    symptoms.forEach((symptom) => {
      symptomLabel(symptom).split(",").map((item) => item.trim()).filter(Boolean).forEach((key) => {
        symptomKeys.set(key, (symptomKeys.get(key) || 0) + 1);
      });
    });
    const problemScores = new Map();
    symptoms.forEach((symptom) => {
      if ((symptom.severity || 0) < 4) return;
      const symptomTime = toDateTime(symptom.date, symptom.time);
      meals.forEach((meal) => {
        const hours = (symptomTime - toDateTime(meal.date, meal.time)) / 36e5;
        if (hours >= 0 && hours <= 24) {
          getMealKeys(meal).forEach((key) => {
            problemScores.set(key, (problemScores.get(key) || 0) + symptom.severity);
          });
        }
      });
    });
    const dayScores = slice
      .filter((day) => day.meals.length || day.symptoms.length || day.skippedMeals.length)
      .map((day) => ({
        date: day.date,
        score: day.symptoms.reduce((sum, symptom) => sum + (symptom.severity || 0), 0),
        symptoms: day.symptoms.length,
      }));
    const betterDays = dayScores
      .filter((day) => day.score <= 2)
      .map((day) => formatDate(day.date, "medium"))
      .slice(0, 3);
    const harderDays = dayScores
      .filter((day) => day.score >= 6 || day.symptoms >= 2)
      .sort((a, b) => b.score - a.score)
      .map((day) => `${formatDate(day.date, "medium")} (${day.score}/10)`)
      .slice(0, 3);
    weeks.push({
      label: `${index + 1}-${Math.min(index + 7, rows.length)}. nap`,
      problemIngredients: topEntries(problemScores, 4).join(", "),
      symptomTypes: topEntries(symptomKeys, 5).join(", "),
      betterDays: betterDays.join(", "),
      harderDays: harderDays.join(", "),
    });
  }
  return weeks;
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

function extractFoodWords(food) {
  return String(food || "")
    .toLowerCase()
    .split(/[,\s]+/)
    .map((word) => word.replace(/[^a-z0-9A-Z\u00C0-\u017F/-]/g, ""))
    .filter((word) => word.length > 3)
    .slice(0, 4);
}

function buildReportText(rows, meals, symptoms, severeSymptoms, patterns, positivePatterns, weeklySummaries) {
  const start = formatDate(getRange()[0]);
  const end = formatDate(getRange()[state.dayCount - 1]);
  const logged = rows.filter((day) => day.meals.length || day.symptoms.length || day.skippedMeals.length).length;
  const lines = [
    `Étel- és tünetnapló (${start} - ${end})`,
    "",
    `Vezetett napok: ${logged}/${state.dayCount}`,
    `Rögzített étkezések: ${meals.length}`,
    `Rögzített tünetek: ${symptoms.length}`,
    `Erős tünetek (7-10): ${severeSymptoms.length}`,
    "",
    "Heti összefoglalók:",
    ...(weeklySummaries.length
      ? weeklySummaries.map((week) => `- ${week.label}: problémás összetevők: ${week.problemIngredients || "nincs egyértelmű minta"}; tünetek: ${week.symptomTypes || "nincs"}; jobb napok: ${week.betterDays || "nincs kiugró"}; nehezebb napok: ${week.harderDays || "nincs kiugró"}`)
      : ["- Még nincs elég adat."]),
    "",
    "Gyakran tünet előtt szereplő elemek:",
    ...(patterns.length ? patterns.map((item) => `- ${item.name}: ${item.count} alkalom, átlag ${item.avg}/10`) : ["- Még nincs elég adat."]),
    "",
    "Legjobban tolerált elemek:",
    ...(positivePatterns.length ? positivePatterns.map((item) => `- ${item.name}: ${item.count} alkalom, ${item.goodRate}% enyhe vagy tünetmentes`) : ["- Még nincs elég adat."]),
    "",
    "Napi bontás:",
  ];
  rows.forEach((day) => {
    if (!day.meals.length && !day.symptoms.length && !day.skippedMeals.length && !day.context.note && !day.context.meds) return;
    lines.push("");
    lines.push(`${formatDate(day.date)} (${dayName(day.date)})`);
    day.meals.sort(byTime).forEach((meal) => {
      lines.push(`  Étkezés ${meal.time} - ${mealTypes[meal.type]}: ${meal.food}${meal.allergens?.length ? ` [${meal.allergens.join(", ")}]` : ""}`);
    });
    day.skippedMeals.forEach((type) => {
      lines.push(`  Kihagyott étkezés: ${mealTypes[type]}`);
    });
    day.symptoms.sort(byTime).forEach((symptom) => {
      const linkedMeal = symptom.mealId ? day.meals.find((meal) => meal.id === symptom.mealId) : null;
      lines.push(`  Tünet ${symptom.time}: ${symptomLabel(symptom)}, erősség ${symptom.severity}/10${linkedMeal ? `, kapcsolódó étkezés: ${linkedMeal.food}` : ""}`);
    });
    if (day.context.meds) lines.push(`  Gyógyszer/kiegészítő: ${day.context.meds}`);
    if (day.context.note) lines.push(`  Megjegyzés: ${day.context.note}`);
  });
  return lines.join("\n");
}

function exportCsv() {
  const headers = ["dátum", "típus", "időpont", "kategória", "leírás", "részletek", "erősség", "allergének"];
  const rows = [headers];
  getAllRows().forEach((day) => {
    day.meals.forEach((meal) => rows.push([
      day.date,
      "étkezés",
      meal.time,
      mealTypes[meal.type],
      meal.food,
      [meal.ingredients, meal.amount, meal.source, meal.note].filter(Boolean).join(" | "),
      "",
      (meal.allergens || []).join("; "),
    ]));
    day.skippedMeals.forEach((type) => rows.push([
      day.date,
      "kihagyott étkezés",
      "",
      mealTypes[type],
      "",
      "Nem volt ilyen étkezés",
      "",
      "",
    ]));
    day.symptoms.forEach((symptom) => rows.push([
      day.date,
      "tünet",
      symptom.time,
      symptomLabel(symptom),
      [symptom.note, symptom.mealId ? `kapcsolódó étkezés: ${findMealName(day, symptom.mealId)}` : ""].filter(Boolean).join(" | "),
      symptom.duration,
      symptom.severity,
      "",
    ]));
  });
  download("etelnaplo.csv", rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

function findMealName(day, mealId) {
  return day.meals.find((meal) => meal.id === mealId)?.food || "";
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function wireEvents() {
  document.querySelector("#addMealBtn").addEventListener("click", () => openMealDialog(null, "extra"));
  document.querySelector("#addSymptomBtn").addEventListener("click", () => openSymptomDialog());
  el.mealForm.addEventListener("submit", saveMeal);
  el.symptomForm.addEventListener("submit", saveSymptom);
  document.querySelector("#deleteMealBtn").addEventListener("click", () => {
    const id = document.querySelector("#mealId").value;
    const day = getDay();
    day.meals = day.meals.filter((meal) => meal.id !== id);
    day.symptoms.forEach((symptom) => {
      if (symptom.mealId === id) symptom.mealId = "";
    });
    syncMealReactions(day);
    el.mealDialog.close();
    render();
  });
  document.querySelector("#cancelMealBtn").addEventListener("click", () => {
    el.mealDialog.close();
  });
  document.querySelector("#deleteSymptomBtn").addEventListener("click", () => {
    const id = document.querySelector("#symptomId").value;
    const day = getDay();
    day.symptoms = day.symptoms.filter((symptom) => symptom.id !== id);
    syncMealReactions(day);
    el.symptomDialog.close();
    render();
  });
  document.querySelector("#cancelSymptomBtn").addEventListener("click", () => {
    el.symptomDialog.close();
  });
  document.querySelector("#mealPhoto").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    pendingMealPhoto = await readMealPhoto(file);
    renderMealPhotoPreview();
  });
  document.querySelector("#removeMealPhotoBtn").addEventListener("click", () => {
    pendingMealPhoto = "";
    document.querySelector("#mealPhoto").value = "";
    renderMealPhotoPreview();
  });
  document.querySelector("#symptomSeverity").addEventListener("input", (event) => {
    document.querySelector("#symptomSeverityValue").textContent = `${event.target.value}/10`;
  });
  el.stressInput.addEventListener("input", (event) => {
    getDay().context.stress = Number(event.target.value);
    el.stressValue.textContent = `${event.target.value}/10`;
    renderReport();
    saveState();
  });
  [el.sleepInput, el.medsInput, el.dayNoteInput].forEach((input) => {
    input.addEventListener("input", () => {
      const context = getDay().context;
      context.sleep = el.sleepInput.value;
      context.meds = el.medsInput.value.trim();
      context.note = el.dayNoteInput.value.trim();
      renderDayList();
      renderReport();
      saveState();
    });
  });
  el.startDate.addEventListener("change", () => {
    state.startDate = el.startDate.value || isoToday();
    selectedDate = state.startDate;
    render();
  });
  el.todayBtn.addEventListener("click", () => {
    state.startDate = isoToday();
    selectedDate = state.startDate;
    render();
  });
  el.addMonthBtn.addEventListener("click", () => {
    state.dayCount = (state.dayCount || DEFAULT_DAY_COUNT) + 30;
    render();
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector(`#${tab.dataset.tab}Panel`).classList.add("active");
      renderReport();
    });
  });
  document.querySelector("#exportCsvBtn").addEventListener("click", exportCsv);
  document.querySelector("#exportPdfBtn").addEventListener("click", () => window.print());
  document.querySelector("#copyReportBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(el.reportText.value);
  });
  document.querySelector("#printBtn").addEventListener("click", () => window.print());
  document.querySelector("#exportJsonBtn").addEventListener("click", () => {
    download("etelnaplo-adatmentes.json", JSON.stringify(state, null, 2), "application/json");
  });
  document.querySelector("#importJsonInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const imported = JSON.parse(await file.text());
    Object.assign(state, imported);
    selectedDate = state.selectedDate || state.startDate || isoToday();
    render();
    event.target.value = "";
  });
}

wireEvents();
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
