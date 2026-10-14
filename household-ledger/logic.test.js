"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("./build");
const logic = require("./logic");

const today = new Date(2026, 9, 14);
const samples = logic.readLedger(null, today);
assert.equal(samples.length, 5);
assert.ok(samples.every((entry) => entry.sample && entry.kind === "expense"));

const summary = logic.summarize(samples, today);
assert.equal(summary.spent, 12000 + 4500 + 1550 + 28400);
assert.equal(summary.count, 4);
assert.equal(summary.income, 0);
assert.equal(logic.monthTitle(today), "10월에 쓴 돈");
assert.equal(logic.metaLine(summary), "4건");

const groups = logic.grouped(samples, "", today);
assert.deepEqual(
  groups.map((group) => group.label),
  ["10월", "9월"],
);
assert.equal(groups[1].items[0].name, "영화");
assert.deepEqual(
  groups[0].items.filter((entry) => entry.date === "2026-10-14").map((entry) => entry.name),
  ["점심", "커피"].sort((a, b) => a.localeCompare(b, "ko")),
);

assert.deepEqual(logic.readLedger({ entries: [] }, today), []);
assert.equal(logic.hasSavedList({ entries: [] }), true);
assert.equal(logic.hasSavedList(null), false);

const dirty = logic.sanitize({
  id: "a",
  name: "  택시  ",
  amount: "8,000원",
  date: "2026-10-02",
  category: "없는분류",
  kind: "nope",
  note: 1,
});
assert.equal(dirty.name, "택시");
assert.equal(dirty.amount, 8000);
assert.equal(dirty.category, "기타");
assert.equal(dirty.kind, "expense");
assert.equal(dirty.note, "");
assert.equal(logic.sanitize({ id: "a", name: "x", amount: 1, date: "2026-02-31" }), null);
assert.equal(logic.sanitize({ id: "a", name: "x", amount: -1, date: "2026-10-01" }), null);

const saved = logic.readLedger(
  {
    entries: [
      dirty,
      { id: "bad" },
      { id: "b", name: "용돈", amount: 50000, date: "2026-10-01", category: "기타", kind: "income", note: "" },
    ],
  },
  today,
);
assert.equal(saved.length, 2);
const mixed = logic.summarize(saved, today);
assert.equal(mixed.spent, 8000);
assert.equal(mixed.income, 50000);
assert.match(logic.metaLine(mixed), /들어온 50,000원/);

assert.equal(logic.validateDraft(logic.emptyDraft(today)), "이름을 입력하세요.");
assert.equal(
  logic.validateDraft({ ...logic.emptyDraft(today), name: "점심", amount: "" }),
  "금액을 입력하세요.",
);
assert.equal(
  logic.validateDraft({ ...logic.emptyDraft(today), name: "점심", amount: "-5" }),
  "금액은 0 이상의 숫자로 적으세요.",
);
const draft = {
  id: "keep",
  name: "  점심 ",
  amount: "12,000원",
  date: "2026-10-14",
  category: "식비",
  note: " 회사 근처 ",
  kind: "expense",
};
assert.equal(logic.validateDraft(draft), null);
const entry = logic.entryFromDraft(draft);
assert.equal(entry.id, "keep");
assert.equal(entry.name, "점심");
assert.equal(entry.amount, 12000);
assert.equal(entry.note, "회사 근처");
assert.equal(entry.sample, false);
assert.equal(logic.draftFromEntry(entry).amount, "12000");

let entries = [];
entries = logic.upsertEntry(entries, entry);
entries = logic.upsertEntry(entries, { ...entry, amount: 9000 });
assert.equal(entries.length, 1);
assert.equal(entries[0].amount, 9000);
entries = logic.removeEntry(entries, "keep");
assert.equal(entries.length, 0);

const note = logic.renderNote(samples, today);
assert.match(note, /^# 가계부\n/);
assert.match(note, /10월에 쓴 돈: 46,450원/);
assert.match(note, /## 10월\n/);
assert.match(note, /## 9월\n/);
assert.ok(note.indexOf("## 10월") < note.indexOf("## 9월"));

const found = logic.grouped(samples, "마트", today);
assert.equal(found.length, 1);
assert.equal(found[0].items[0].name, "마트");

build();
const bundled = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
assert.equal(bundled.includes('require("./logic")'), false);
assert.equal(bundled.includes('require("obsidian")'), true);
const logicStart = bundled.indexOf("const logic = (function () {");
const pluginStart = bundled.indexOf('const { Plugin, PluginSettingTab, Setting, ItemView, Notice, TFile } = require("obsidian");');
assert.ok(logicStart >= 0 && pluginStart > logicStart);
const bundledLogic = new Function(`${bundled.slice(logicStart, pluginStart)}\nreturn logic;`)();
assert.equal(bundledLogic.summarize(bundledLogic.createSamples(today), today).spent, 46450);

console.log("household-ledger logic tests passed");
