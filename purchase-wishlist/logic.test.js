"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("./build");
const logic = require("./logic");

build();
const bundled = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
assert.equal(bundled.includes('require("./logic")'), false);
assert.equal(bundled.includes('require("obsidian")'), true);
const logicStart = bundled.indexOf("const logic = (function () {");
const pluginStart = bundled.indexOf('const { Plugin, PluginSettingTab, Setting, ItemView, Notice, TFile } = require("obsidian");');
assert.ok(logicStart >= 0 && pluginStart > logicStart);
const bundledLogic = new Function(`${bundled.slice(logicStart, pluginStart)}\nreturn logic;`)();
assert.equal(bundledLogic.summarize(bundledLogic.createSamples()).wantedCount, 4);

const samples = logic.readWishlist(null);
assert.equal(samples.length, 5);
assert.ok(samples.every((item) => item.sample));
assert.equal(logic.summarize(samples).wantedCount, 4);
assert.equal(logic.summarize(samples).wantedTotal, 45000 + 189000 + 129000 + 16800);
assert.equal(logic.summarize(samples).boughtCount, 1);

assert.deepEqual(logic.readWishlist({ items: [] }), []);
assert.equal(logic.hasSavedList({ items: [] }), true);
assert.equal(logic.hasSavedList(null), false);

const dirty = logic.sanitize({
  id: "a",
  name: "  책  ",
  price: "12000",
  priority: "nope",
  category: "없는분류",
  note: 1,
  url: "  https://example.com  ",
});
assert.equal(dirty.name, "책");
assert.equal(dirty.price, 12000);
assert.equal(dirty.priority, "soon");
assert.equal(dirty.category, "기타");
assert.equal(dirty.note, "");
assert.equal(dirty.url, "https://example.com");
assert.equal(logic.sanitize({ id: 1, name: "x", price: 1 }), null);
assert.equal(logic.sanitize({ id: "a", name: "x", price: -1 }), null);

const saved = logic.readWishlist({
  items: [
    dirty,
    { id: "bad" },
    { id: "b", name: "산 것", price: 3000, priority: "now", category: "취미", bought: true },
  ],
});
assert.equal(saved.length, 2);
assert.equal(logic.summarize(saved).wantedTotal, 12000);
assert.equal(logic.summarize(saved).boughtTotal, 3000);

assert.equal(logic.validateDraft(logic.emptyDraft()), "이름을 입력하세요.");
assert.equal(
  logic.validateDraft({ ...logic.emptyDraft(), name: "램프", price: "" }),
  "금액을 입력하세요.",
);
assert.equal(
  logic.validateDraft({ ...logic.emptyDraft(), name: "램프", price: "-5" }),
  "금액은 0 이상의 숫자로 적으세요.",
);
const draft = {
  id: "keep",
  name: "  램프 ",
  price: "18,500원",
  priority: "now",
  category: "생활",
  note: " 따뜻한 빛 ",
  url: " 상점 ",
  wanted: false,
};
assert.equal(logic.validateDraft(draft), null);
const item = logic.itemFromDraft(draft);
assert.equal(item.id, "keep");
assert.equal(item.name, "램프");
assert.equal(item.price, 18500);
assert.equal(item.bought, true);
assert.equal(item.sample, false);
assert.equal(item.note, "따뜻한 빛");
assert.equal(item.url, "상점");

const roundTrip = logic.draftFromItem(item);
assert.equal(roundTrip.wanted, false);
assert.equal(roundTrip.price, "18500");

let items = [];
items = logic.upsertItem(items, item);
items = logic.upsertItem(items, { ...item, price: 20000 });
assert.equal(items.length, 1);
assert.equal(items[0].price, 20000);
items = logic.removeItem(items, "keep");
assert.equal(items.length, 0);

const groups = logic.grouped(samples, "키");
assert.equal(groups.groups.length, 1);
assert.equal(groups.groups[0].items[0].name, "기계식 키보드");
assert.equal(groups.bought.length, 0);

const note = logic.renderNote(samples);
assert.match(note, /^# 구매 위시리스트\n/);
assert.match(note, /## 지금\n/);
assert.match(note, /## 곧\n/);
assert.match(note, /## 나중에\n/);
assert.match(note, /## 샀음\n/);
assert.match(note, /이어폰/);
assert.doesNotMatch(note.split("## 샀음")[0], /이어폰/);

const ordered = logic.grouped(samples, "").groups.find((group) => group.priority === "soon");
assert.deepEqual(
  ordered.items.map((entry) => entry.name),
  ["기계식 키보드", "러닝화"],
);

console.log("purchase-wishlist logic tests passed");
