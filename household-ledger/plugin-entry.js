"use strict";

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
