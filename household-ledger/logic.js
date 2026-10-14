"use strict";

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
