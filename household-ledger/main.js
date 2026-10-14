"use strict";

const logic = (function () {
  const module = { exports: {} };
  const exports = module.exports;
const CATEGORIES = ["식비", "카페", "교통", "생활", "의료", "문화", "기타"];
const KINDS = ["expense", "income"];
const KIND_LABEL = {
  expense: "지출",
  income: "수입",
};

function isCategory(value) {
  return CATEGORIES.includes(value);
}

function isKind(value) {
  return value === "expense" || value === "income";
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseISODate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isISODate(value) {
  if (typeof value !== "string") return false;
  const date = parseISODate(value);
  return !Number.isNaN(date.getTime()) && formatISODate(date) === value;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function createSamples(today) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const make = (partial) => ({
    id: partial.id,
    name: partial.name,
    amount: partial.amount,
    date: partial.date,
    category: partial.category,
    note: partial.note ?? "",
    kind: "expense",
    sample: true,
  });
  return [
    make({ id: "sample-lunch", name: "점심", amount: 12000, date: formatISODate(day), category: "식비" }),
    make({ id: "sample-coffee", name: "커피", amount: 4500, date: formatISODate(day), category: "카페" }),
    make({ id: "sample-transit", name: "지하철", amount: 1550, date: formatISODate(addDays(day, -1)), category: "교통" }),
    make({
      id: "sample-market",
      name: "마트",
      amount: 28400,
      date: formatISODate(addDays(day, -3)),
      category: "생활",
      note: "장보기",
    }),
    make({ id: "sample-movie", name: "영화", amount: 14000, date: formatISODate(addDays(day, -32)), category: "문화" }),
  ];
}

function normalizeAmount(amount) {
  return Number(String(amount).replace(/[,\s원₩]/g, "").trim());
}

function sanitize(raw) {
  if (!raw || typeof raw !== "object") return null;
  const value = raw;
  if (typeof value.id !== "string" || typeof value.name !== "string" || !isISODate(value.date)) return null;
  const amount = typeof value.amount === "number" ? value.amount : normalizeAmount(value.amount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return {
    id: value.id,
    name: value.name.trim() || "이름 없음",
    amount: Math.round(amount),
    date: value.date,
    category: isCategory(value.category) ? value.category : "기타",
    note: typeof value.note === "string" ? value.note : "",
    kind: isKind(value.kind) ? value.kind : "expense",
    sample: value.sample === true,
  };
}

function hasSavedList(raw) {
  return Boolean(raw && typeof raw === "object" && Array.isArray(raw.entries));
}

function readLedger(raw, today) {
  if (!hasSavedList(raw)) return createSamples(today);
  return raw.entries.flatMap((entry) => {
    const next = sanitize(entry);
    return next ? [next] : [];
  });
}

function upsertEntry(entries, entry) {
  const index = entries.findIndex((item) => item.id === entry.id);
  if (index === -1) return [...entries, entry];
  const next = entries.slice();
  next[index] = entry;
  return next;
}

function removeEntry(entries, id) {
  return entries.filter((entry) => entry.id !== id);
}

function formatWon(amount) {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

function formatNumber(amount) {
  return Math.round(amount).toLocaleString("ko-KR");
}

function inSameMonth(iso, today) {
  const date = parseISODate(iso);
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

function summarize(entries, today) {
  let spent = 0;
  let income = 0;
  let count = 0;
  let incomeCount = 0;
  for (const entry of entries) {
    if (!inSameMonth(entry.date, today)) continue;
    if (entry.kind === "income") {
      income += entry.amount;
      incomeCount += 1;
    } else {
      spent += entry.amount;
      count += 1;
    }
  }
  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    spent,
    income,
    count,
    incomeCount,
  };
}

function monthTitle(today) {
  return `${today.getMonth() + 1}월에 쓴 돈`;
}

function metaLine(summary) {
  const income = summary.income > 0 ? ` · 들어온 ${formatWon(summary.income)}` : "";
  if (summary.count === 0 && summary.income === 0) return "이번 달 기록은 없습니다";
  if (summary.count === 0) return `이번 달 쓴 돈은 없습니다${income}`;
  return `${summary.count}건${income}`;
}

function monthLabel(iso, today) {
  const date = parseISODate(iso);
  const month = `${date.getMonth() + 1}월`;
  if (date.getFullYear() === today.getFullYear()) return month;
  return `${date.getFullYear()}년 ${month}`;
}

function dayNumber(iso) {
  return parseISODate(iso).getDate();
}

function matches(entry, query) {
  const needle = query.trim().toLocaleLowerCase("ko-KR");
  if (!needle) return true;
  const haystack = `${entry.name} ${entry.category} ${entry.note} ${KIND_LABEL[entry.kind]} ${entry.date}`;
  return haystack.toLocaleLowerCase("ko-KR").includes(needle);
}

function grouped(entries, query, today) {
  const matched = entries.filter((entry) => matches(entry, query));
  matched.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, "ko"));
  const groups = [];
  for (const entry of matched) {
    const label = monthLabel(entry.date, today);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, items: [entry] });
    else last.items.push(entry);
  }
  return groups;
}

function entryLine(entry) {
  const bits = [
    `${dayNumber(entry.date)}일`,
    entry.name,
    entry.category,
    KIND_LABEL[entry.kind] ?? "지출",
    formatWon(entry.amount),
  ];
  if (entry.note) bits.push(entry.note);
  return bits.join(" · ");
}

function renderNote(entries, today) {
  const summary = summarize(entries, today);
  const lines = [
    "# 가계부",
    "",
    `- ${monthTitle(today)}: ${formatWon(summary.spent)}`,
    `- ${metaLine(summary)}`,
    "",
  ];
  const groups = grouped(entries, "", today);
  if (groups.length === 0) {
    lines.push("## 기록", "", "- 없음", "");
  } else {
    for (const group of groups) {
      lines.push(`## ${group.label}`, "");
      for (const entry of group.items) lines.push(`- ${entryLine(entry)}`);
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function emptyDraft(today) {
  return {
    id: null,
    name: "",
    amount: "",
    date: formatISODate(today),
    category: "식비",
    note: "",
    kind: "expense",
  };
}

function draftFromEntry(entry) {
  return {
    id: entry.id,
    name: entry.name,
    amount: String(entry.amount),
    date: entry.date,
    category: entry.category,
    note: entry.note,
    kind: entry.kind,
  };
}

function validateDraft(draft) {
  if (!draft.name.trim()) return "이름을 입력하세요.";
  if (String(draft.amount).trim() === "") return "금액을 입력하세요.";
  const amount = normalizeAmount(draft.amount);
  if (!Number.isFinite(amount) || amount < 0) return "금액은 0 이상의 숫자로 적으세요.";
  if (!isISODate(draft.date)) return "날짜를 고르세요.";
  if (!isCategory(draft.category)) return "분류를 고르세요.";
  if (!isKind(draft.kind)) return "구분을 고르세요.";
  return null;
}

function entryFromDraft(draft) {
  return {
    id: draft.id ?? createId(),
    name: draft.name.trim(),
    amount: Math.round(normalizeAmount(draft.amount)),
    date: draft.date,
    category: draft.category,
    note: draft.note.trim(),
    kind: draft.kind,
    sample: false,
  };
}

module.exports = {
  CATEGORIES,
  KINDS,
  KIND_LABEL,
  isCategory,
  isKind,
  createSamples,
  sanitize,
  hasSavedList,
  readLedger,
  upsertEntry,
  removeEntry,
  formatWon,
  formatNumber,
  summarize,
  monthTitle,
  metaLine,
  monthLabel,
  dayNumber,
  matches,
  grouped,
  renderNote,
  emptyDraft,
  draftFromEntry,
  validateDraft,
  entryFromDraft,
  normalizeAmount,
  formatISODate,
  parseISODate,
};

  return module.exports;
})();

const { Plugin, PluginSettingTab, Setting, ItemView, Notice, TFile } = require("obsidian");

const VIEW_TYPE = "household-ledger";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readDraft(form, id) {
  const data = new FormData(form);
  const category = String(data.get("category") ?? "");
  const kind = String(data.get("kind") ?? "");
  return {
    id,
    name: String(data.get("name") ?? ""),
    amount: String(data.get("amount") ?? ""),
    date: String(data.get("date") ?? ""),
    category: logic.isCategory(category) ? category : "기타",
    note: String(data.get("note") ?? ""),
    kind: logic.isKind(kind) ? kind : "expense",
  };
}

function textInput(name, value, type) {
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.value = value;
  input.autocomplete = "off";
  if (name === "amount") input.inputMode = "numeric";
  return input;
}

function selectInput(name, value, choices) {
  const select = document.createElement("select");
  select.name = name;
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    option.selected = choice.value === value;
    select.append(option);
  }
  return select;
}

function subline(entry) {
  const bits = [entry.category, logic.KIND_LABEL[entry.kind]];
  if (entry.note) bits.push(entry.note);
  return bits.join(" · ");
}

function appendRow(parent, entry, handlers) {
  const row = el("button", entry.kind === "income" ? "row is-income" : "row");
  row.type = "button";
  const main = el("span", "main");
  const detail = el("span", "sub");
  const tick = el("span", "tick");
  tick.dataset.cat = entry.category;
  detail.append(tick, document.createTextNode(subline(entry)));
  main.append(el("span", "name", entry.name), detail);
  row.append(el("span", "day", String(logic.dayNumber(entry.date))), main, el("span", "amount", logic.formatWon(entry.amount)));
  row.addEventListener("click", () => handlers.onEdit(entry.id));
  parent.append(row);
}

function appendEditor(parent, draft, error, focus, handlers) {
  const form = el("form", "editor");
  if (error) {
    const message = el("p", "editor-error", error);
    message.setAttribute("role", "alert");
    form.append(message);
  }
  const fields = [
    { label: "이름", node: textInput("name", draft.name, "text") },
    { label: "금액", node: textInput("amount", draft.amount, "text") },
    { label: "날짜", node: textInput("date", draft.date, "date") },
    {
      label: "분류",
      node: selectInput(
        "category",
        draft.category,
        logic.CATEGORIES.map((category) => ({ value: category, label: category })),
      ),
    },
    {
      label: "구분",
      node: selectInput(
        "kind",
        draft.kind,
        logic.KINDS.map((kind) => ({ value: kind, label: logic.KIND_LABEL[kind] })),
      ),
    },
    { label: "메모", node: textInput("note", draft.note, "text") },
  ];
  for (const field of fields) {
    const wrap = el("label", "field");
    wrap.append(el("span", "label", field.label), field.node);
    form.append(wrap);
  }
  form.append(el("p", "field-help", "쓴 돈은 지출, 들어온 돈은 수입입니다. 위의 합계는 이번 달 지출입니다."));
  const actions = el("div", "editor-actions");
  const save = el("button", "add", "저장");
  save.type = "submit";
  actions.append(save);
  if (draft.id) {
    const remove = el("button", "text-btn danger", "지우기");
    remove.type = "button";
    remove.addEventListener("click", () => {
      if (remove.dataset.armed !== "1") {
        remove.dataset.armed = "1";
        remove.textContent = "다시 누르면 지웁니다";
        return;
      }
      if (draft.id) handlers.onDelete(draft.id);
    });
    actions.append(remove);
  }
  form.append(actions);
  let saving = false;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    handlers.onSubmit(readDraft(form, draft.id));
  });
  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handlers.onCancel();
    }
  });
  parent.append(form);
  if (focus) form.querySelector("input[name='name']")?.focus();
}

function appendHeader(sheet, today, total, meta, draftOpen, onAdd, onCancel) {
  const head = el("header", "head");
  const intro = el("div", "intro");
  intro.append(el("p", "kicker", logic.monthTitle(today)));
  const sum = el("p", "total");
  sum.append(el("span", "num", logic.formatNumber(total)), el("span", "unit", "원"));
  intro.append(sum, el("p", "meta", meta));
  const action = el("button", "add", draftOpen ? "닫기" : "추가");
  action.type = "button";
  action.addEventListener("click", () => (draftOpen ? onCancel() : onAdd()));
  head.append(intro, action);
  sheet.append(head);
}

function renderLedger(root, model, handlers) {
  const previousFind = root.querySelector("input.find");
  const restoreFind = previousFind !== null && root.ownerDocument.activeElement === previousFind;
  const caret = previousFind?.selectionStart ?? null;
  root.replaceChildren();
  const sheet = el("div", "sheet");
  if (model.entries.length === 0 && !model.draft) {
    const head = el("header", "head");
    const intro = el("div", "intro");
    intro.append(
      el("p", "kicker", "가계부"),
      el("h2", "empty-title", "아직 적은 금액이 없습니다"),
      el("p", "meta", "이름, 금액, 날짜만 적으면 이번 달 합계가 여기에 모입니다."),
    );
    head.append(intro);
    const add = el("button", "add", "금액 적기");
    add.type = "button";
    add.addEventListener("click", () => handlers.onAdd());
    sheet.append(head, add);
    root.append(sheet);
    return;
  }
  const summary = logic.summarize(model.entries, model.today);
  appendHeader(
    sheet,
    model.today,
    summary.spent,
    logic.metaLine(summary),
    model.draft !== null,
    handlers.onAdd,
    handlers.onCancel,
  );
  const sampleCount = model.entries.filter((entry) => entry.sample).length;
  if (sampleCount > 0) {
    const line = el("p", "sample-line", `예시 ${sampleCount}건이 들어 있습니다. `);
    const clear = el("button", "text-btn", "예시 지우기");
    clear.type = "button";
    clear.title = "아직 고치지 않은 예시만 지웁니다.";
    clear.addEventListener("click", () => handlers.onClearSamples());
    line.append(clear);
    sheet.append(line);
  }
  if (model.draft) appendEditor(sheet, model.draft, model.error, model.focusEditor, handlers);
  const showFind = model.entries.length >= 8 && !model.draft;
  if (showFind) {
    const find = el("input", "find");
    find.type = "text";
    find.placeholder = "찾기";
    find.value = model.query;
    find.setAttribute("aria-label", "가계부 찾기");
    find.addEventListener("input", () => handlers.onQuery(find.value));
    sheet.append(find);
    if (restoreFind) {
      find.focus();
      if (caret !== null) find.setSelectionRange(caret, caret);
    }
  }
  const query = showFind ? model.query : "";
  const groups = logic.grouped(model.entries, query, model.today);
  for (const group of groups) {
    const section = el("section", "group");
    section.append(el("h2", undefined, group.label));
    for (const entry of group.items) appendRow(section, entry, handlers);
    sheet.append(section);
  }
  if (query.trim() && groups.length === 0) {
    sheet.append(el("p", "empty-filter", "찾는 이름이 없습니다."));
  }
  if (model.entries.length > 0) {
    const foot = el("p", "foot");
    const exportButton = el("button", "text-btn", "노트로 내보내기");
    exportButton.type = "button";
    exportButton.addEventListener("click", () => handlers.onExport());
    foot.append(exportButton);
    sheet.append(foot);
  }
  root.append(sheet);
}

class LedgerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      text: "사용한 금액과 날짜를 장부로 보여 줍니다. 왼쪽 리본의 영수증 아이콘이나 명령 팔레트에서 열 수 있습니다.",
    });
    new Setting(containerEl)
      .setName("가계부 열기")
      .addButton((button) => button.setButtonText("열기").setCta().onClick(() => void this.plugin.activateView()));
    new Setting(containerEl)
      .setName("예시 지우기")
      .setDesc("아직 고치지 않은 예시만 지웁니다.")
      .addButton((button) => button.setButtonText("지우기").onClick(() => void this.plugin.clearSamples()));
    new Setting(containerEl)
      .setName("노트로 내보내기")
      .setDesc("보관함의 가계부.md를 현재 목록으로 덮어씁니다.")
      .addButton((button) => button.setButtonText("내보내기").onClick(() => void this.plugin.exportNote()));
    new Setting(containerEl).setName("저장 위치").setHeading();
    const storage = containerEl.createEl("p");
    storage.appendText("목록은 노트가 아니라 플러그인 데이터 파일에 저장됩니다: ");
    storage.createEl("code", { text: this.plugin.dataPath() });
  }
}

class LedgerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.query = "";
    this.draft = null;
    this.error = "";
    this.focusEditor = false;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "가계부";
  }

  getIcon() {
    return "receipt";
  }

  async onOpen() {
    this.render();
  }

  async onClose() {
    this.contentEl.replaceChildren();
    this.contentEl.removeClass("household-ledger");
  }

  startAdd() {
    this.draft = logic.emptyDraft(new Date());
    this.error = "";
    this.focusEditor = true;
    this.render();
  }

  render() {
    const draft = this.draft;
    if (draft?.id && !this.plugin.getEntries().some((entry) => entry.id === draft.id)) {
      this.draft = null;
      this.error = "";
    }
    const openForm = this.contentEl.querySelector("form.editor");
    if (openForm && this.draft) this.draft = readDraft(openForm, this.draft.id);
    this.contentEl.addClass("household-ledger");
    renderLedger(
      this.contentEl,
      {
        entries: this.plugin.getEntries(),
        today: new Date(),
        query: this.query,
        draft: this.draft,
        error: this.error,
        focusEditor: this.focusEditor,
      },
      {
        onQuery: (value) => {
          this.query = value;
          this.focusEditor = false;
          this.render();
        },
        onAdd: () => this.startAdd(),
        onCancel: () => {
          this.draft = null;
          this.error = "";
          this.render();
        },
        onSubmit: (next) => {
          const message = logic.validateDraft(next);
          if (message) {
            this.draft = next;
            this.error = message;
            this.focusEditor = false;
            this.render();
            return;
          }
          this.draft = null;
          this.error = "";
          this.focusEditor = false;
          void this.plugin.saveEntry(logic.entryFromDraft(next));
        },
        onEdit: (id) => {
          const entry = this.plugin.getEntries().find((item) => item.id === id);
          if (!entry) return;
          this.draft = logic.draftFromEntry(entry);
          this.error = "";
          this.focusEditor = true;
          this.render();
        },
        onDelete: (id) => {
          this.draft = null;
          this.error = "";
          void this.plugin.deleteEntry(id);
        },
        onClearSamples: () => {
          void this.plugin.clearSamples();
        },
        onExport: () => {
          void this.plugin.exportNote();
        },
      },
    );
    this.focusEditor = false;
  }
}

class HouseholdLedgerPlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.entries = [];
  }

  async onload() {
    const today = new Date();
    const raw = await this.loadData();
    this.entries = logic.readLedger(raw, today);
    if (!logic.hasSavedList(raw)) await this.saveData({ entries: this.entries });
    this.registerView(VIEW_TYPE, (leaf) => new LedgerView(leaf, this));
    this.addRibbonIcon("receipt", "가계부", () => void this.activateView());
    this.addSettingTab(new LedgerSettingTab(this.app, this));
    this.addCommand({
      id: "open-household-ledger",
      name: "열기",
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "add-ledger-entry",
      name: "금액 적기",
      callback: () => void this.openAndAdd(),
    });
    this.addCommand({
      id: "export-ledger-note",
      name: "노트로 내보내기",
      callback: () => void this.exportNote(),
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  getEntries() {
    return this.entries;
  }

  async saveEntry(entry) {
    this.entries = logic.upsertEntry(this.entries, entry);
    this.refresh();
    await this.persist();
  }

  async deleteEntry(id) {
    this.entries = logic.removeEntry(this.entries, id);
    this.refresh();
    await this.persist();
  }

  async clearSamples() {
    const next = this.entries.filter((entry) => !entry.sample);
    if (next.length === this.entries.length) {
      new Notice("지울 예시가 없습니다.");
      return;
    }
    this.entries = next;
    this.refresh();
    await this.persist();
    new Notice("예시를 지웠습니다.");
  }

  async persist() {
    try {
      await this.saveData({ entries: this.entries });
    } catch (error) {
      console.error(error);
      new Notice("목록을 저장하지 못했습니다.");
    }
  }

  async exportNote() {
    const path = "가계부.md";
    const body = logic.renderNote(this.entries, new Date());
    const existing = this.app.vault.getAbstractFileByPath(path);
    try {
      if (existing instanceof TFile) await this.app.vault.modify(existing, body);
      else if (existing) {
        new Notice("가계부.md 자리에 다른 항목이 있습니다.");
        return;
      } else await this.app.vault.create(path, body);
      new Notice("가계부.md에 적어 두었습니다.");
    } catch (error) {
      console.error(error);
      new Notice("노트를 쓰지 못했습니다.");
    }
  }

  dataPath() {
    return `${this.app.vault.configDir}/plugins/${this.manifest.id}/data.json`;
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (existing?.view instanceof LedgerView) {
      await this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openAndAdd() {
    await this.activateView();
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (leaf?.view instanceof LedgerView) leaf.view.startAdd();
  }

  refresh() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof LedgerView) leaf.view.render();
    }
  }
}

module.exports = HouseholdLedgerPlugin;
module.exports.default = HouseholdLedgerPlugin;
