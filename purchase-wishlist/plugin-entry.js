"use strict";

const { Plugin, PluginSettingTab, Setting, ItemView, Notice, TFile } = require("obsidian");

const VIEW_TYPE = "purchase-wishlist";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readDraft(form, id) {
  const data = new FormData(form);
  const priority = String(data.get("priority") ?? "");
  const category = String(data.get("category") ?? "");
  return {
    id,
    name: String(data.get("name") ?? ""),
    price: String(data.get("price") ?? ""),
    priority: logic.isPriority(priority) ? priority : "soon",
    category: logic.isCategory(category) ? category : "기타",
    note: String(data.get("note") ?? ""),
    url: String(data.get("url") ?? ""),
    wanted: data.get("wanted") === "on",
  };
}

function textInput(name, value) {
  const input = document.createElement("input");
  input.name = name;
  input.type = "text";
  input.value = value;
  input.autocomplete = "off";
  if (name === "price") input.inputMode = "numeric";
  if (name === "url") {
    input.placeholder = "주소 또는 상점";
    input.spellcheck = false;
  }
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

function subline(item) {
  const bits = [item.category, logic.PRIORITY_LABEL[item.priority]];
  if (item.bought) bits.push("샀음");
  if (item.url) bits.push(item.url);
  if (item.note) bits.push(item.note);
  return bits.join(" · ");
}

function appendRow(parent, item, handlers) {
  const row = el("button", item.bought ? "row is-bought" : "row");
  row.type = "button";
  const main = el("span", "main");
  const detail = el("span", "sub");
  const tick = el("span", "tick");
  tick.dataset.cat = item.category;
  detail.append(tick, document.createTextNode(subline(item)));
  main.append(el("span", "name", item.name), detail);
  const amount = el("span", "amount", logic.formatWon(item.price));
  row.append(main, amount);
  row.addEventListener("click", () => handlers.onEdit(item.id));
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
    { label: "이름", node: textInput("name", draft.name) },
    { label: "금액", node: textInput("price", draft.price) },
    {
      label: "분류",
      node: selectInput(
        "category",
        draft.category,
        logic.CATEGORIES.map((category) => ({ value: category, label: category })),
      ),
    },
    {
      label: "우선순위",
      node: selectInput(
        "priority",
        draft.priority,
        logic.PRIORITIES.map((priority) => ({ value: priority, label: logic.PRIORITY_LABEL[priority] })),
      ),
    },
    { label: "링크", node: textInput("url", draft.url) },
    { label: "메모", node: textInput("note", draft.note) },
  ];
  for (const field of fields) {
    const wrap = el("label", "field");
    wrap.append(el("span", "label", field.label), field.node);
    form.append(wrap);
  }
  const status = el("label", "field");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = "wanted";
  checkbox.checked = draft.wanted;
  const statusControl = el("span", "check");
  statusControl.append(checkbox, el("span", "check-text", "사고 싶음"));
  status.append(el("span", "label", "상태"), statusControl);
  form.append(status);
  form.append(el("p", "field-help", "금액은 예상 가격입니다. 샀으면 ‘사고 싶음’을 끄세요."));
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

function appendHeader(sheet, total, meta, draftOpen, onAdd, onCancel) {
  const head = el("header", "head");
  const intro = el("div", "intro");
  intro.append(el("p", "kicker", "사고 싶은 것"));
  const sum = el("p", "total");
  sum.append(el("span", "num", logic.formatNumber(total)), el("span", "unit", "원"));
  intro.append(sum, el("p", "meta", meta));
  const action = el("button", "add", draftOpen ? "닫기" : "추가");
  action.type = "button";
  action.addEventListener("click", () => (draftOpen ? onCancel() : onAdd()));
  head.append(intro, action);
  sheet.append(head);
}

function renderWishlist(root, model, handlers) {
  const previousFind = root.querySelector("input.find");
  const restoreFind = previousFind !== null && root.ownerDocument.activeElement === previousFind;
  const caret = previousFind?.selectionStart ?? null;
  root.replaceChildren();
  const sheet = el("div", "sheet");
  if (model.items.length === 0 && !model.draft) {
    const head = el("header", "head");
    const intro = el("div", "intro");
    intro.append(
      el("p", "kicker", "구매 위시리스트"),
      el("h2", "empty-title", "아직 담고 싶은 것이 없습니다"),
      el("p", "meta", "이름과 예상 금액만 적으면 여기에 모입니다."),
    );
    head.append(intro);
    const add = el("button", "add", "항목 추가");
    add.type = "button";
    add.addEventListener("click", () => handlers.onAdd());
    sheet.append(head, add);
    root.append(sheet);
    return;
  }
  const summary = logic.summarize(model.items);
  appendHeader(
    sheet,
    summary.wantedTotal,
    logic.metaLine(summary),
    model.draft !== null,
    handlers.onAdd,
    handlers.onCancel,
  );
  const sampleCount = model.items.filter((item) => item.sample).length;
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
  const showFind = model.items.length >= 8 && !model.draft;
  if (showFind) {
    const find = el("input", "find");
    find.type = "text";
    find.placeholder = "찾기";
    find.value = model.query;
    find.setAttribute("aria-label", "위시리스트 찾기");
    find.addEventListener("input", () => handlers.onQuery(find.value));
    sheet.append(find);
    if (restoreFind) {
      find.focus();
      if (caret !== null) find.setSelectionRange(caret, caret);
    }
  }
  const query = showFind ? model.query : "";
  const { groups, bought } = logic.grouped(model.items, query);
  for (const group of groups) {
    const section = el("section", "group");
    section.append(el("h2", undefined, group.label));
    for (const item of group.items) appendRow(section, item, handlers);
    sheet.append(section);
  }
  if (bought.length > 0) {
    const section = el("section", "group bought");
    section.append(el("h2", undefined, "샀음"));
    for (const item of bought) appendRow(section, item, handlers);
    sheet.append(section);
  }
  if (query.trim() && groups.length === 0 && bought.length === 0) {
    sheet.append(el("p", "empty-filter", "찾는 이름이 없습니다."));
  }
  if (model.items.length > 0) {
    const foot = el("p", "foot");
    const exportButton = el("button", "text-btn", "노트로 내보내기");
    exportButton.type = "button";
    exportButton.addEventListener("click", () => handlers.onExport());
    foot.append(exportButton);
    sheet.append(foot);
  }
  root.append(sheet);
}

class WishlistSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      text: "사고 싶은 것과 예상 금액을 장부로 보여 줍니다. 왼쪽 리본의 장바구니 아이콘이나 명령 팔레트에서 열 수 있습니다.",
    });
    new Setting(containerEl)
      .setName("구매 위시리스트 열기")
      .addButton((button) => button.setButtonText("열기").setCta().onClick(() => void this.plugin.activateView()));
    new Setting(containerEl)
      .setName("예시 지우기")
      .setDesc("아직 고치지 않은 예시만 지웁니다.")
      .addButton((button) => button.setButtonText("지우기").onClick(() => void this.plugin.clearSamples()));
    new Setting(containerEl)
      .setName("노트로 내보내기")
      .setDesc("보관함의 구매 위시리스트.md를 현재 목록으로 덮어씁니다.")
      .addButton((button) => button.setButtonText("내보내기").onClick(() => void this.plugin.exportNote()));
    new Setting(containerEl).setName("저장 위치").setHeading();
    const storage = containerEl.createEl("p");
    storage.appendText("목록은 노트가 아니라 플러그인 데이터 파일에 저장됩니다: ");
    storage.createEl("code", { text: this.plugin.dataPath() });
  }
}

class WishlistView extends ItemView {
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
    return "구매 위시리스트";
  }

  getIcon() {
    return "shopping-bag";
  }

  async onOpen() {
    this.render();
  }

  async onClose() {
    this.contentEl.replaceChildren();
    this.contentEl.removeClass("purchase-wishlist");
  }

  startAdd() {
    this.draft = logic.emptyDraft();
    this.error = "";
    this.focusEditor = true;
    this.render();
  }

  render() {
    const draft = this.draft;
    if (draft?.id && !this.plugin.getItems().some((item) => item.id === draft.id)) {
      this.draft = null;
      this.error = "";
    }
    const openForm = this.contentEl.querySelector("form.editor");
    if (openForm && this.draft) this.draft = readDraft(openForm, this.draft.id);
    this.contentEl.addClass("purchase-wishlist");
    renderWishlist(
      this.contentEl,
      {
        items: this.plugin.getItems(),
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
          void this.plugin.saveItem(logic.itemFromDraft(next));
        },
        onEdit: (id) => {
          const item = this.plugin.getItems().find((entry) => entry.id === id);
          if (!item) return;
          this.draft = logic.draftFromItem(item);
          this.error = "";
          this.focusEditor = true;
          this.render();
        },
        onDelete: (id) => {
          this.draft = null;
          this.error = "";
          void this.plugin.deleteItem(id);
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

class PurchaseWishlistPlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.items = [];
  }

  async onload() {
    const raw = await this.loadData();
    this.items = logic.readWishlist(raw);
    if (!logic.hasSavedList(raw)) await this.saveData({ items: this.items });
    this.registerView(VIEW_TYPE, (leaf) => new WishlistView(leaf, this));
    this.addRibbonIcon("shopping-bag", "구매 위시리스트", () => void this.activateView());
    this.addSettingTab(new WishlistSettingTab(this.app, this));
    this.addCommand({
      id: "open-purchase-wishlist",
      name: "열기",
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "add-wishlist-item",
      name: "항목 추가",
      callback: () => void this.openAndAdd(),
    });
    this.addCommand({
      id: "export-wishlist-note",
      name: "노트로 내보내기",
      callback: () => void this.exportNote(),
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  getItems() {
    return this.items;
  }

  async saveItem(item) {
    this.items = logic.upsertItem(this.items, item);
    this.refresh();
    await this.persist();
  }

  async deleteItem(id) {
    this.items = logic.removeItem(this.items, id);
    this.refresh();
    await this.persist();
  }

  async clearSamples() {
    const next = this.items.filter((item) => !item.sample);
    if (next.length === this.items.length) {
      new Notice("지울 예시가 없습니다.");
      return;
    }
    this.items = next;
    this.refresh();
    await this.persist();
    new Notice("예시를 지웠습니다.");
  }

  async persist() {
    try {
      await this.saveData({ items: this.items });
    } catch (error) {
      console.error(error);
      new Notice("목록을 저장하지 못했습니다.");
    }
  }

  async exportNote() {
    const path = "구매 위시리스트.md";
    const body = logic.renderNote(this.items);
    const existing = this.app.vault.getAbstractFileByPath(path);
    try {
      if (existing instanceof TFile) await this.app.vault.modify(existing, body);
      else if (existing) {
        new Notice("구매 위시리스트.md 자리에 다른 항목이 있습니다.");
        return;
      } else await this.app.vault.create(path, body);
      new Notice("구매 위시리스트.md에 적어 두었습니다.");
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
    if (existing?.view instanceof WishlistView) {
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
    if (leaf?.view instanceof WishlistView) leaf.view.startAdd();
  }

  refresh() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof WishlistView) leaf.view.render();
    }
  }
}

module.exports = PurchaseWishlistPlugin;
module.exports.default = PurchaseWishlistPlugin;
