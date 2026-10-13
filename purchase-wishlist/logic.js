"use strict";

const CATEGORIES = ["전자", "도서", "의류", "생활", "취미", "기타"];
const PRIORITIES = ["now", "soon", "later"];
const PRIORITY_LABEL = {
  now: "지금",
  soon: "곧",
  later: "나중에",
};

function isPriority(value) {
  return value === "now" || value === "soon" || value === "later";
}

function isCategory(value) {
  return CATEGORIES.includes(value);
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSamples() {
  const make = (partial) => ({
    id: partial.id,
    name: partial.name,
    price: partial.price,
    priority: partial.priority,
    category: partial.category,
    note: partial.note ?? "",
    url: partial.url ?? "",
    bought: partial.bought === true,
    sample: true,
  });
  return [
    make({ id: "sample-lamp", name: "데스크 조명", price: 45000, priority: "now", category: "생활" }),
    make({ id: "sample-keyboard", name: "기계식 키보드", price: 189000, priority: "soon", category: "전자", note: "저소음 적축" }),
    make({ id: "sample-shoes", name: "러닝화", price: 129000, priority: "soon", category: "의류" }),
    make({ id: "sample-novel", name: "읽고 싶은 소설", price: 16800, priority: "later", category: "도서" }),
    make({ id: "sample-earbuds", name: "이어폰", price: 89000, priority: "now", category: "전자", bought: true }),
  ];
}

function normalizePrice(price) {
  return Number(String(price).replace(/[,\s원₩]/g, "").trim());
}

function sanitize(raw) {
  if (!raw || typeof raw !== "object") return null;
  const value = raw;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  const price = typeof value.price === "number" ? value.price : Number(value.price);
  if (!Number.isFinite(price) || price < 0) return null;
  return {
    id: value.id,
    name: value.name.trim() || "이름 없음",
    price: Math.round(price),
    priority: isPriority(value.priority) ? value.priority : "soon",
    category: isCategory(value.category) ? value.category : "기타",
    note: typeof value.note === "string" ? value.note : "",
    url: typeof value.url === "string" ? value.url.trim() : "",
    bought: value.bought === true,
    sample: value.sample === true,
  };
}

function hasSavedList(raw) {
  return Boolean(raw && typeof raw === "object" && Array.isArray(raw.items));
}

function readWishlist(raw) {
  if (!hasSavedList(raw)) return createSamples();
  return raw.items.flatMap((item) => {
    const next = sanitize(item);
    return next ? [next] : [];
  });
}

function upsertItem(items, item) {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...items, item];
  const next = items.slice();
  next[index] = item;
  return next;
}

function removeItem(items, id) {
  return items.filter((item) => item.id !== id);
}

function formatWon(amount) {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

function formatNumber(amount) {
  return Math.round(amount).toLocaleString("ko-KR");
}

function summarize(items) {
  let wantedTotal = 0;
  let wantedCount = 0;
  let boughtTotal = 0;
  let boughtCount = 0;
  for (const item of items) {
    if (item.bought) {
      boughtCount += 1;
      boughtTotal += item.price;
    } else {
      wantedCount += 1;
      wantedTotal += item.price;
    }
  }
  return { wantedTotal, wantedCount, boughtTotal, boughtCount };
}

function metaLine(summary) {
  if (summary.wantedCount === 0 && summary.boughtCount === 0) return "담고 있는 것이 없습니다";
  if (summary.wantedCount === 0) return `사고 싶은 것은 없습니다 · 산 것 ${summary.boughtCount}개`;
  const bought = summary.boughtCount > 0 ? ` · 산 것 ${summary.boughtCount}개` : "";
  return `${summary.wantedCount}개${bought}`;
}

function matches(item, query) {
  const needle = query.trim().toLocaleLowerCase("ko-KR");
  if (!needle) return true;
  const haystack = `${item.name} ${item.category} ${item.note} ${item.url} ${PRIORITY_LABEL[item.priority]}`;
  return haystack.toLocaleLowerCase("ko-KR").includes(needle);
}

function byPriceThenName(a, b) {
  return b.price - a.price || a.name.localeCompare(b.name, "ko");
}

function grouped(items, query) {
  const groups = PRIORITIES.map((priority) => ({
    priority,
    label: PRIORITY_LABEL[priority],
    items: [],
  }));
  const byPriority = new Map(groups.map((group) => [group.priority, group]));
  const bought = [];
  for (const item of items) {
    if (!matches(item, query)) continue;
    if (item.bought) {
      bought.push(item);
      continue;
    }
    const group = byPriority.get(item.priority) ?? byPriority.get("soon");
    group.items.push(item);
  }
  for (const group of groups) group.items.sort(byPriceThenName);
  bought.sort(byPriceThenName);
  return {
    groups: groups.filter((group) => group.items.length > 0),
    bought,
  };
}

function itemLine(item) {
  const bits = [item.name, item.category, PRIORITY_LABEL[item.priority] ?? "곧", formatWon(item.price)];
  if (item.url) bits.push(item.url);
  if (item.note) bits.push(item.note);
  return bits.join(" · ");
}

function renderNote(items) {
  const summary = summarize(items);
  const lines = [
    "# 구매 위시리스트",
    "",
    `- 사고 싶은 것: ${formatWon(summary.wantedTotal)}`,
    `- ${metaLine(summary)}`,
    "",
  ];
  const { groups, bought } = grouped(items, "");
  if (groups.length === 0) {
    lines.push("## 사고 싶은 것", "", "- 없음", "");
  } else {
    for (const group of groups) {
      lines.push(`## ${group.label}`, "");
      for (const item of group.items) lines.push(`- ${itemLine(item)}`);
      lines.push("");
    }
  }
  if (bought.length > 0) {
    lines.push("## 샀음", "");
    for (const item of bought) lines.push(`- ${itemLine(item)}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function emptyDraft() {
  return {
    id: null,
    name: "",
    price: "",
    priority: "soon",
    category: "기타",
    note: "",
    url: "",
    wanted: true,
  };
}

function draftFromItem(item) {
  return {
    id: item.id,
    name: item.name,
    price: String(item.price),
    priority: item.priority,
    category: item.category,
    note: item.note,
    url: item.url,
    wanted: !item.bought,
  };
}

function validateDraft(draft) {
  if (!draft.name.trim()) return "이름을 입력하세요.";
  if (String(draft.price).trim() === "") return "금액을 입력하세요.";
  const price = normalizePrice(draft.price);
  if (!Number.isFinite(price) || price < 0) return "금액은 0 이상의 숫자로 적으세요.";
  if (!isPriority(draft.priority)) return "우선순위를 고르세요.";
  if (!isCategory(draft.category)) return "분류를 고르세요.";
  return null;
}

function itemFromDraft(draft) {
  return {
    id: draft.id ?? createId(),
    name: draft.name.trim(),
    price: Math.round(normalizePrice(draft.price)),
    priority: draft.priority,
    category: draft.category,
    note: draft.note.trim(),
    url: draft.url.trim(),
    bought: draft.wanted === false,
    sample: false,
  };
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  PRIORITY_LABEL,
  isPriority,
  isCategory,
  createSamples,
  sanitize,
  hasSavedList,
  readWishlist,
  upsertItem,
  removeItem,
  formatWon,
  formatNumber,
  summarize,
  metaLine,
  matches,
  grouped,
  renderNote,
  emptyDraft,
  draftFromItem,
  validateDraft,
  itemFromDraft,
  normalizePrice,
};
