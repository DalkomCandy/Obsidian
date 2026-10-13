"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SubscriptionPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/types.ts
var CATEGORIES = ["\uC601\uC0C1", "\uC74C\uC545", "\uD1B5\uC2E0", "\uC18C\uD504\uD2B8\uC6E8\uC5B4", "\uC0DD\uD65C", "\uAE30\uD0C0"];
var CYCLES = ["weekly", "monthly", "yearly"];
var CYCLE_LABEL = {
  weekly: "\uB9E4\uC8FC",
  monthly: "\uB9E4\uC6D4",
  yearly: "\uB9E4\uB144"
};

// src/card.ts
var listPrice = (sub) => ({
  listAmount: sub.amount,
  amount: sub.amount,
  discount: 0,
  rule: null,
  card: null,
  status: sub.card ? "missing" : "none"
});
function parseCardLink(value) {
  let text = value.trim();
  const wiki = /^\[\[([^\]]*)\]\]$/.exec(text);
  if (wiki) text = wiki[1] ?? "";
  text = text.replace(/^\[\[|\]\]$/g, "");
  const pipe = text.indexOf("|");
  if (pipe !== -1) text = text.slice(0, pipe);
  const hash = text.indexOf("#");
  if (hash !== -1) text = text.slice(0, hash);
  text = text.trim();
  if (text.toLowerCase().endsWith(".md")) text = text.slice(0, -3);
  return text;
}
function cardLinkText(card) {
  return card ? `[[${card}]]` : "";
}
function cardDisplayName(card) {
  const parts = card.split("/");
  return parts[parts.length - 1] ?? card;
}
var RULE_LIST_KEYS = ["discounts", "discount", "\uD560\uC778", "\uD61C\uD0DD", "benefits"];
var MATCH_KEYS = ["match", "\uB300\uC0C1", "target", "for", "name", "\uC774\uB984"];
var RATE_KEYS = ["rate", "\uBE44\uC728", "percent", "\uD560\uC778\uC728"];
var AMOUNT_KEYS = ["amount", "\uAE08\uC561", "off", "\uD560\uC778\uAE08\uC561", "\uD560\uC778\uC561"];
var MAX_KEYS = ["max", "\uCD5C\uB300", "cap", "limit", "\uD55C\uB3C4"];
var DEFAULT_MATCHES = ["*", "all", "default", "\uC804\uCCB4", "\uAE30\uBCF8", "\uBAA8\uB450"];
var KNOWN_RULE_KEYS = /* @__PURE__ */ new Set([...MATCH_KEYS, ...RATE_KEYS, ...AMOUNT_KEYS, ...MAX_KEYS]);
function pick(record, keys) {
  for (const key of keys) {
    if (key in record && record[key] !== null && record[key] !== void 0) return record[key];
  }
  return void 0;
}
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[,\s원%]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
function normalizeMatch(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || DEFAULT_MATCHES.includes(text.toLowerCase())) return null;
  return text;
}
function ruleFromScalar(match, value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return { match, rate: null, amount: value, max: null };
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  const number = toNumber(text);
  if (number === null || number < 0) return null;
  if (text.endsWith("%")) return { match, rate: number, amount: null, max: null };
  return { match, rate: null, amount: number, max: null };
}
function ruleFromObject(matchHint, record) {
  const rate = toNumber(pick(record, RATE_KEYS));
  const amount = toNumber(pick(record, AMOUNT_KEYS));
  const max = toNumber(pick(record, MAX_KEYS));
  if (rate === null && amount === null) return [];
  const matchValue = pick(record, MATCH_KEYS);
  const matches2 = Array.isArray(matchValue) ? matchValue.map(normalizeMatch) : [matchValue === void 0 ? matchHint : normalizeMatch(matchValue)];
  const unique = Array.from(new Set(matches2));
  return unique.map((match) => ({
    match,
    rate: rate !== null && rate >= 0 ? rate : null,
    amount: amount !== null && amount >= 0 ? amount : null,
    max: max !== null && max >= 0 ? max : null
  }));
}
function rulesFromValue(matchHint, value) {
  if (value === null || value === void 0) return [];
  if (Array.isArray(value)) return value.flatMap((item) => rulesFromValue(matchHint, item));
  if (typeof value === "object") {
    const record = value;
    const keys = Object.keys(record);
    const looksLikeRule = keys.some((key) => KNOWN_RULE_KEYS.has(key));
    if (looksLikeRule) return ruleFromObject(matchHint, record);
    return keys.flatMap((key) => rulesFromValue(normalizeMatch(key), record[key]));
  }
  const rule = ruleFromScalar(matchHint, value);
  return rule ? [rule] : [];
}
function rulesFromFrontmatter(frontmatter) {
  if (!frontmatter || typeof frontmatter !== "object") return [];
  const record = frontmatter;
  const value = pick(record, RULE_LIST_KEYS);
  return rulesFromValue(null, value);
}
function fold(text) {
  return text.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}
function ruleMatches(rule, sub) {
  if (rule.match === null) return true;
  const needle = fold(rule.match);
  if (!needle) return true;
  if (fold(sub.category) === needle) return true;
  const name = fold(sub.name);
  return name.includes(needle) || needle.includes(name);
}
function pickRule(rules, sub) {
  const specific = rules.find((rule) => rule.match !== null && ruleMatches(rule, sub));
  if (specific) return specific;
  return rules.find((rule) => rule.match === null) ?? null;
}
function discountAmount(rule, listAmount) {
  let discount = 0;
  if (rule.rate !== null) discount += listAmount * rule.rate / 100;
  if (rule.amount !== null) discount += rule.amount;
  if (rule.max !== null) discount = Math.min(discount, rule.max);
  return Math.max(0, Math.min(Math.round(discount), listAmount));
}
function pricingFor(sub, resolve) {
  if (!sub.card) return listPrice(sub);
  const card = resolve(sub.card);
  if (!card) return { ...listPrice(sub), status: "missing" };
  const rule = pickRule(card.rules, sub);
  if (!rule) return { listAmount: sub.amount, amount: sub.amount, discount: 0, rule: null, card, status: "no-rule" };
  const discount = discountAmount(rule, sub.amount);
  return {
    listAmount: sub.amount,
    amount: sub.amount - discount,
    discount,
    rule,
    card,
    status: discount > 0 ? "applied" : "no-rule"
  };
}
function makePricer(resolve) {
  const cache = /* @__PURE__ */ new Map();
  return (sub) => {
    const key = `${sub.id}\0${sub.card}\0${sub.amount}\0${sub.name}\0${sub.category}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const pricing = pricingFor(sub, resolve);
    cache.set(key, pricing);
    return pricing;
  };
}
function won(amount) {
  return `${Math.round(amount).toLocaleString("ko-KR")}\uC6D0`;
}
function describeRule(rule) {
  const parts = [];
  if (rule.rate !== null) parts.push(`${rule.rate}%`);
  if (rule.amount !== null) parts.push(won(rule.amount));
  let text = parts.join(" + ");
  if (rule.max !== null) text += ` (\uCD5C\uB300 ${won(rule.max)})`;
  return `${rule.match ?? "\uC804\uCCB4"} ${text}`.trim();
}
function cardNoteTemplate(name) {
  return [
    "---",
    "\uD560\uC778:",
    "  - \uB300\uC0C1: \uB137\uD50C\uB9AD\uC2A4",
    "    \uBE44\uC728: 10",
    "    \uCD5C\uB300: 5000",
    "  - \uB300\uC0C1: \uC601\uC0C1",
    "    \uAE08\uC561: 2000",
    "---",
    "",
    `# ${name}`,
    "",
    "\uAD6C\uB3C5\uD568\uC5D0\uC11C \uC774 \uCE74\uB4DC\uB97C \uACB0\uC81C \uCE74\uB4DC\uB85C \uACE0\uB974\uBA74 \uC704 `\uD560\uC778` \uADDC\uCE59\uC774 \uBE44\uC6A9\uC5D0 \uBC18\uC601\uB429\uB2C8\uB2E4.",
    "",
    "- `\uB300\uC0C1`: \uAD6C\uB3C5 \uC774\uB984\uC758 \uC77C\uBD80(\uC608: \uB137\uD50C\uB9AD\uC2A4) \uB610\uB294 \uBD84\uB958(\uC601\uC0C1, \uC74C\uC545, \uD1B5\uC2E0, \uC18C\uD504\uD2B8\uC6E8\uC5B4, \uC0DD\uD65C, \uAE30\uD0C0). \uBE44\uC6B0\uBA74 \uBAA8\uB4E0 \uAD6C\uB3C5\uC5D0 \uC801\uC6A9\uB418\uB294 \uAE30\uBCF8 \uD560\uC778.",
    "- `\uBE44\uC728`: \uC815\uB960 \uD560\uC778(%). `\uAE08\uC561`: \uC815\uC561 \uD560\uC778(\uC6D0). \uB458 \uB2E4 \uC4F0\uBA74 \uD569\uC0B0.",
    "- `\uCD5C\uB300`: \uADF8 \uADDC\uCE59\uC73C\uB85C \uAE4E\uC744 \uC218 \uC788\uB294 \uCD5C\uB300 \uAE08\uC561(\uC6D0).",
    "- \uB300\uC0C1\uC774 \uC788\uB294 \uADDC\uCE59\uC774 \uAE30\uBCF8 \uD560\uC778\uBCF4\uB2E4 \uBA3C\uC800 \uC801\uC6A9\uB418\uBA70, \uAD6C\uB3C5 \uD558\uB098\uC5D0\uB294 \uADDC\uCE59 \uD558\uB098\uB9CC \uC801\uC6A9\uB429\uB2C8\uB2E4.",
    ""
  ].join("\n");
}

// src/data.ts
function anchorDate(year, month, billingDay) {
  const last = new Date(year, month, 0).getDate();
  const day = Math.min(billingDay, last);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function createSamples(today) {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const make = (partial) => {
    const billingMonth = partial.billingMonth ?? month;
    return {
      id: partial.id,
      name: partial.name,
      amount: partial.amount,
      cycle: partial.cycle,
      billingDay: partial.billingDay,
      billingMonth,
      anchorDate: anchorDate(year, billingMonth, partial.billingDay),
      category: partial.category,
      note: partial.note ?? "",
      active: partial.active ?? true,
      sample: true,
      card: partial.card ?? ""
    };
  };
  return [
    make({ id: "sample-netflix", name: "\uB137\uD50C\uB9AD\uC2A4 \uC2A4\uD0E0\uB2E4\uB4DC", amount: 13500, cycle: "monthly", billingDay: 15, category: "\uC601\uC0C1" }),
    make({ id: "sample-youtube", name: "\uC720\uD29C\uBE0C \uD504\uB9AC\uBBF8\uC5C4", amount: 14900, cycle: "monthly", billingDay: 18, category: "\uC601\uC0C1" }),
    make({ id: "sample-melon", name: "\uBA5C\uB860", amount: 10900, cycle: "monthly", billingDay: 21, category: "\uC74C\uC545" }),
    make({ id: "sample-icloud", name: "\uC544\uC774\uD074\uB77C\uC6B0\uB4DC+", amount: 1100, cycle: "monthly", billingDay: 8, category: "\uC18C\uD504\uD2B8\uC6E8\uC5B4", note: "50GB" }),
    make({ id: "sample-millie", name: "\uBC00\uB9AC\uC758 \uC11C\uC7AC", amount: 9900, cycle: "monthly", billingDay: 3, category: "\uC0DD\uD65C" }),
    make({ id: "sample-domain", name: "\uB3C4\uBA54\uC778", amount: 24e3, cycle: "yearly", billingDay: 27, category: "\uC18C\uD504\uD2B8\uC6E8\uC5B4", note: "\uC608\uC2DC.com" }),
    make({ id: "sample-tving", name: "\uD2F0\uBE59", amount: 13500, cycle: "monthly", billingDay: 12, category: "\uC601\uC0C1", active: false })
  ];
}
function isCycle(value) {
  return value === "weekly" || value === "monthly" || value === "yearly";
}
function isCategory(value) {
  return CATEGORIES.includes(value);
}
function sanitize(raw) {
  if (!raw || typeof raw !== "object") return null;
  const value = raw;
  if (typeof value.id !== "string" || typeof value.name !== "string" || !isCycle(value.cycle)) {
    return null;
  }
  const amount = typeof value.amount === "number" ? value.amount : Number(value.amount);
  const billingDay = Math.round(Number(value.billingDay));
  const billingMonth = Math.round(Number(value.billingMonth));
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (!Number.isFinite(billingDay) || !Number.isFinite(billingMonth)) return null;
  const category = isCategory(value.category) ? value.category : "\uAE30\uD0C0";
  const anchor = typeof value.anchorDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.anchorDate) ? value.anchorDate : "2026-01-01";
  return {
    id: value.id,
    name: value.name.trim() || "\uC774\uB984 \uC5C6\uC74C",
    amount: Math.round(amount),
    cycle: value.cycle,
    billingDay: Math.min(31, Math.max(1, billingDay)),
    billingMonth: Math.min(12, Math.max(1, billingMonth)),
    anchorDate: anchor,
    category,
    note: typeof value.note === "string" ? value.note : "",
    active: value.active !== false,
    sample: value.sample === true,
    card: typeof value.card === "string" ? parseCardLink(value.card) : ""
  };
}
function readShelf(raw, today) {
  if (!raw || typeof raw !== "object") return createSamples(today);
  const subscriptions = raw.subscriptions;
  if (!Array.isArray(subscriptions)) return createSamples(today);
  return subscriptions.flatMap((item) => {
    const sub = sanitize(item);
    return sub ? [sub] : [];
  });
}
function upsertSubscription(subs, sub) {
  const index = subs.findIndex((item) => item.id === sub.id);
  if (index === -1) return [...subs, sub];
  const next = subs.slice();
  next[index] = sub;
  return next;
}
function removeSubscription(subs, id) {
  return subs.filter((item) => item.id !== id);
}

// src/calc.ts
function parseISODate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return /* @__PURE__ */ new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function formatWon(amount) {
  return `${Math.round(amount).toLocaleString("ko-KR")}\uC6D0`;
}
function formatNumber(amount) {
  return Math.round(amount).toLocaleString("ko-KR");
}
function monthTitle(today) {
  return `${today.getMonth() + 1}\uC6D4\uC5D0 \uB098\uAC00\uB294 \uB3C8`;
}
function mod(value, divisor) {
  return (value % divisor + divisor) % divisor;
}
function lastDay(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}
function clampedDate(year, monthIndex, billingDay) {
  const day = Math.min(Math.max(billingDay, 1), lastDay(year, monthIndex));
  return new Date(year, monthIndex, day);
}
function anchorOf(sub) {
  const anchor = startOfDay(parseISODate(sub.anchorDate));
  return Number.isNaN(anchor.getTime()) ? null : anchor;
}
function occurrenceInMonth(sub, year, monthIndex) {
  if (sub.cycle === "yearly" && sub.billingMonth !== monthIndex + 1) return null;
  if (sub.cycle === "weekly") return null;
  return clampedDate(year, monthIndex, sub.billingDay);
}
function weeklyDates(sub, year, monthIndex, from) {
  const anchor = startOfDay(parseISODate(sub.anchorDate));
  if (Number.isNaN(anchor.getTime())) return [];
  const dates = [];
  const last = lastDay(year, monthIndex);
  for (let day = 1; day <= last; day += 1) {
    const date = new Date(year, monthIndex, day);
    if (from && date < from) continue;
    const diff = Math.round((date.getTime() - anchor.getTime()) / 864e5);
    if (diff >= 0 && mod(diff, 7) === 0) dates.push(date);
  }
  return dates;
}
function chargeInMonth(sub, year, monthIndex, price = listPrice) {
  if (!sub.active) return 0;
  const amount = price(sub).amount;
  if (sub.cycle === "weekly") return weeklyDates(sub, year, monthIndex, null).length * amount;
  const date = occurrenceInMonth(sub, year, monthIndex);
  const anchor = anchorOf(sub);
  if (!date || anchor && date < anchor) return 0;
  return amount;
}
function remainingInMonth(sub, today, price = listPrice) {
  if (!sub.active) return 0;
  const amount = price(sub).amount;
  const start = startOfDay(today);
  const year = start.getFullYear();
  const monthIndex = start.getMonth();
  if (sub.cycle === "weekly") return weeklyDates(sub, year, monthIndex, start).length * amount;
  const date = occurrenceInMonth(sub, year, monthIndex);
  const anchor = anchorOf(sub);
  if (!date || date < start || anchor && date < anchor) return 0;
  return amount;
}
function monthlyAverage(sub, price = listPrice) {
  if (!sub.active) return 0;
  const amount = price(sub).amount;
  if (sub.cycle === "monthly") return amount;
  if (sub.cycle === "yearly") return amount / 12;
  return amount * 52 / 12;
}
function summarize(subs, today, price = listPrice) {
  const day = startOfDay(today);
  let charge = 0;
  let remaining = 0;
  let average = 0;
  let saved = 0;
  let activeCount = 0;
  for (const sub of subs) {
    if (!sub.active) continue;
    activeCount += 1;
    const discounted = chargeInMonth(sub, day.getFullYear(), day.getMonth(), price);
    charge += discounted;
    remaining += remainingInMonth(sub, day, price);
    average += monthlyAverage(sub, price);
    saved += chargeInMonth(sub, day.getFullYear(), day.getMonth(), listPrice) - discounted;
  }
  return {
    year: day.getFullYear(),
    month: day.getMonth() + 1,
    charge,
    remaining,
    average,
    saved,
    activeCount
  };
}
function nextDate(sub, today) {
  const start = startOfDay(today);
  if (sub.cycle === "weekly") {
    const anchor2 = startOfDay(parseISODate(sub.anchorDate));
    if (Number.isNaN(anchor2.getTime())) return start;
    if (anchor2 >= start) return anchor2;
    const diff = Math.round((start.getTime() - anchor2.getTime()) / 864e5);
    const remainder = mod(diff, 7);
    const add = remainder === 0 ? 0 : 7 - remainder;
    const next = new Date(start);
    next.setDate(start.getDate() + add);
    return next;
  }
  const anchor = anchorOf(sub);
  if (sub.cycle === "yearly") {
    let year = start.getFullYear();
    let candidate2 = clampedDate(year, sub.billingMonth - 1, sub.billingDay);
    if (candidate2 < start) {
      year += 1;
      candidate2 = clampedDate(year, sub.billingMonth - 1, sub.billingDay);
    }
    let guard2 = 0;
    while (anchor && candidate2 < anchor && guard2 < 100) {
      guard2 += 1;
      year += 1;
      candidate2 = clampedDate(year, sub.billingMonth - 1, sub.billingDay);
    }
    return candidate2;
  }
  let candidate = clampedDate(start.getFullYear(), start.getMonth(), sub.billingDay);
  if (candidate < start) {
    candidate = clampedDate(start.getFullYear(), start.getMonth() + 1, sub.billingDay);
  }
  let guard = 0;
  while (anchor && candidate < anchor && guard < 240) {
    guard += 1;
    candidate = clampedDate(candidate.getFullYear(), candidate.getMonth() + 1, sub.billingDay);
  }
  return candidate;
}
function daysUntil(date, today) {
  return Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 864e5);
}
function relativeLabel(days) {
  if (days < 0 || days > 7) return null;
  if (days === 0) return "\uC624\uB298";
  if (days === 1) return "\uB0B4\uC77C";
  return `${days}\uC77C \uB4A4`;
}
function groupLabel(date, today) {
  const month = `${date.getMonth() + 1}\uC6D4`;
  if (date.getFullYear() === today.getFullYear()) return month;
  return `${date.getFullYear()}\uB144 ${month}`;
}
function metaLine(summary) {
  if (summary.activeCount === 0) return "\uC0AC\uC6A9 \uC911\uC778 \uAD6C\uB3C5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4";
  const average = `\uC6D4 \uD658\uC0B0 ${formatWon(summary.average)}`;
  const count = `${summary.activeCount}\uAC1C`;
  const saved = summary.saved > 0 ? ` \xB7 \uCE74\uB4DC \uD560\uC778 ${formatWon(summary.saved)}` : "";
  if (summary.charge === 0 && summary.saved === 0) return `\uC774\uBC88 \uB2EC \uCCAD\uAD6C\uB294 \uC5C6\uC2B5\uB2C8\uB2E4 \xB7 ${average} \xB7 ${count}`;
  if (summary.remaining === 0) return `\uC774\uBC88 \uB2EC\uC740 \uB2E4 \uB0C8\uC2B5\uB2C8\uB2E4${saved} \xB7 ${average} \xB7 ${count}`;
  if (summary.remaining === summary.charge) return `${average}${saved} \xB7 ${count}`;
  return `\uB0A8\uC740 ${formatWon(summary.remaining)}${saved} \xB7 ${average} \xB7 ${count}`;
}
function upcoming(subs, today) {
  return subs.filter((sub) => sub.active).map((sub) => ({ sub, date: nextDate(sub, today) })).sort((a, b) => a.date.getTime() - b.date.getTime() || a.sub.name.localeCompare(b.sub.name, "ko"));
}

// src/note.ts
function priceText(sub, price) {
  const pricing = price(sub);
  if (pricing.discount <= 0) return formatWon(pricing.amount);
  return `${formatWon(pricing.amount)} (\uC815\uAC00 ${formatWon(pricing.listAmount)})`;
}
function cardText(sub) {
  return sub.card ? ` \xB7 [[${sub.card}|${cardDisplayName(sub.card)}]]` : "";
}
function renderNote(subs, today, price = listPrice) {
  const summary = summarize(subs, today, price);
  const lines = [
    "# \uAD6C\uB3C5\uD568",
    "",
    `- ${summary.month}\uC6D4\uC5D0 \uB098\uAC00\uB294 \uB3C8: ${formatWon(summary.charge)}`,
    `- ${metaLine(summary)}`,
    "",
    "## \uB2E4\uC74C \uACB0\uC81C",
    ""
  ];
  const items = upcoming(subs, today);
  if (items.length === 0) {
    lines.push("- \uC5C6\uC74C");
  } else {
    for (const item of items) {
      const note = item.sub.note ? ` \xB7 ${item.sub.note}` : "";
      lines.push(
        `- ${groupLabel(item.date, today)} ${item.date.getDate()}\uC77C \xB7 ${item.sub.name} \xB7 ${item.sub.category} \xB7 ${CYCLE_LABEL[item.sub.cycle]} \xB7 ${priceText(item.sub, price)}${cardText(item.sub)}${note}`
      );
    }
  }
  const paused = subs.filter((sub) => !sub.active);
  if (paused.length > 0) {
    lines.push("", "## \uC26C\uACE0 \uC788\uC74C", "");
    for (const sub of paused) {
      lines.push(`- ${sub.name} \xB7 ${sub.category} \xB7 ${CYCLE_LABEL[sub.cycle]} \xB7 ${priceText(sub, price)}${cardText(sub)}`);
    }
  }
  return lines.join("\n");
}

// src/settings.ts
var import_obsidian = require("obsidian");
var ShelfSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin, actions) {
    super(app, plugin);
    this.actions = actions;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      text: "\uC774\uBC88 \uB2EC \uCCAD\uAD6C\uC640 \uB2E4\uC74C \uACB0\uC81C\uC77C\uC744 \uC7A5\uBD80\uB85C \uBCF4\uC5EC \uC90D\uB2C8\uB2E4. \uC67C\uCABD \uB9AC\uBCF8\uC758 \uC9C0\uAC11 \uC544\uC774\uCF58\uC774\uB098 \uBA85\uB839 \uD314\uB808\uD2B8\uC5D0\uC11C \uC5F4 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
    });
    new import_obsidian.Setting(containerEl).setName("\uAD6C\uB3C5\uD568 \uC5F4\uAE30").addButton((button) => button.setButtonText("\uC5F4\uAE30").setCta().onClick(() => void this.actions.activateView()));
    new import_obsidian.Setting(containerEl).setName("\uC608\uC2DC \uC9C0\uC6B0\uAE30").setDesc("\uC544\uC9C1 \uACE0\uCE58\uC9C0 \uC54A\uC740 \uC608\uC2DC\uB9CC \uC9C0\uC6C1\uB2C8\uB2E4.").addButton((button) => button.setButtonText("\uC9C0\uC6B0\uAE30").onClick(() => void this.actions.clearSamples()));
    new import_obsidian.Setting(containerEl).setName("\uB178\uD2B8\uB85C \uB0B4\uBCF4\uB0B4\uAE30").setDesc("\uBCF4\uAD00\uD568\uC758 \uAD6C\uB3C5\uD568.md\uB97C \uD604\uC7AC \uBAA9\uB85D\uC73C\uB85C \uB36E\uC5B4\uC501\uB2C8\uB2E4.").addButton((button) => button.setButtonText("\uB0B4\uBCF4\uB0B4\uAE30").onClick(() => void this.actions.exportNote()));
    new import_obsidian.Setting(containerEl).setName("\uCE74\uB4DC \uD560\uC778").setHeading();
    containerEl.createEl("p", {
      text: "\uAD6C\uB3C5\uB9C8\uB2E4 \uACB0\uC81C \uCE74\uB4DC\uB97C [[\uCE74\uB4DC \uC774\uB984]] \uD615\uC2DD\uC73C\uB85C \uC801\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uCE74\uB4DC\uB294 \uBCF4\uAD00\uD568\uC758 \uC77C\uBC18 \uB178\uD2B8\uC774\uACE0, \uADF8 \uB178\uD2B8\uC758 \uD504\uB7F0\uD2B8\uB9E4\uD130\uC5D0 \uC801\uD78C \uD560\uC778 \uADDC\uCE59\uC774 \uCCAD\uAD6C \uAE08\uC561\uC5D0 \uBC18\uC601\uB429\uB2C8\uB2E4."
    });
    new import_obsidian.Setting(containerEl).setName("\uCE74\uB4DC \uB178\uD2B8 \uB9CC\uB4E4\uAE30").setDesc("\uD560\uC778 \uADDC\uCE59 \uC608\uC2DC\uAC00 \uB4E4\uC5B4 \uC788\uB294 \uCE74\uB4DC \uB178\uD2B8\uB97C \uC0C8\uB85C \uB9CC\uB4E4\uC5B4 \uC5FD\uB2C8\uB2E4. \uC774\uB984\uACFC \uADDC\uCE59\uC740 \uB178\uD2B8\uC5D0\uC11C \uACE0\uCE58\uBA74 \uB429\uB2C8\uB2E4.").addButton((button) => button.setButtonText("\uB9CC\uB4E4\uAE30").onClick(() => void this.actions.createCardNote()));
    new import_obsidian.Setting(containerEl).setName("\uC800\uC7A5 \uC704\uCE58").setHeading();
    const storage = containerEl.createEl("p");
    storage.appendText("\uAD6C\uB3C5 \uBAA9\uB85D\uC740 \uB178\uD2B8\uAC00 \uC544\uB2C8\uB77C \uD50C\uB7EC\uADF8\uC778 \uB370\uC774\uD130 \uD30C\uC77C\uC5D0 \uC800\uC7A5\uB429\uB2C8\uB2E4: ");
    storage.createEl("code", { text: this.actions.dataPath() });
    storage.appendText(
      " (.obsidian \uD3F4\uB354\uB294 \uD30C\uC77C \uD0D0\uC0C9\uAE30\uC5D0 \uBCF4\uC774\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.) \uB3D9\uAE30\uD654\xB7\uBC31\uC5C5 \uB300\uC0C1\uC5D0 .obsidian \uD3F4\uB354\uAC00 \uD3EC\uD568\uB418\uC5B4 \uC788\uB294\uC9C0 \uD655\uC778\uD558\uC138\uC694. \uB178\uD2B8\uB85C\uB3C4 \uB0A8\uAE30\uACE0 \uC2F6\uC73C\uBA74 \uC704\uC758 \u201C\uB178\uD2B8\uB85C \uB0B4\uBCF4\uB0B4\uAE30\u201D\uB97C \uC4F0\uC138\uC694."
    );
  }
};

// src/view.ts
var import_obsidian3 = require("obsidian");

// src/draft.ts
function emptyDraft(today) {
  return {
    id: null,
    name: "",
    amount: "",
    cycle: "monthly",
    date: formatISODate(today),
    category: "\uAE30\uD0C0",
    note: "",
    active: true,
    card: ""
  };
}
function draftFromSubscription(sub, today) {
  return {
    id: sub.id,
    name: sub.name,
    amount: String(sub.amount),
    cycle: sub.cycle,
    date: formatISODate(nextDate(sub, today)),
    category: sub.category,
    note: sub.note,
    active: sub.active,
    card: cardLinkText(sub.card)
  };
}
function normalizedAmount(amount) {
  return Number(amount.replace(/[, 원]/g, "").trim());
}
function validateDraft(draft) {
  if (!draft.name.trim()) return "\uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.";
  if (draft.amount.trim() === "") return "\uAE08\uC561\uC744 \uC785\uB825\uD558\uC138\uC694.";
  const amount = normalizedAmount(draft.amount);
  if (!Number.isFinite(amount) || amount < 0) return "\uAE08\uC561\uC740 0 \uC774\uC0C1\uC758 \uC22B\uC790\uB85C \uC801\uC73C\uC138\uC694.";
  const date = parseISODate(draft.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(date.getTime())) {
    return "\uACB0\uC81C\uC77C\uC744 \uACE0\uB974\uC138\uC694.";
  }
  return null;
}
function subscriptionFromDraft(draft) {
  const date = parseISODate(draft.date);
  return {
    id: draft.id ?? crypto.randomUUID(),
    name: draft.name.trim(),
    amount: Math.round(normalizedAmount(draft.amount)),
    cycle: draft.cycle,
    billingDay: date.getDate(),
    billingMonth: date.getMonth() + 1,
    anchorDate: draft.date,
    category: draft.category,
    note: draft.note.trim(),
    active: draft.active,
    sample: false,
    card: parseCardLink(draft.card)
  };
}
function isCycle2(value) {
  return value === "weekly" || value === "monthly" || value === "yearly";
}
function isCategory2(value) {
  return CATEGORIES.includes(value);
}

// src/render.ts
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
}
function matches(sub, query) {
  const needle = query.trim().toLocaleLowerCase("ko-KR");
  if (!needle) return true;
  return `${sub.name} ${sub.category} ${sub.note} ${cardDisplayName(sub.card)}`.toLocaleLowerCase("ko-KR").includes(needle);
}
function subline(sub, today, date, paused) {
  const bits = [sub.category, CYCLE_LABEL[sub.cycle]];
  if (paused) {
    bits.unshift(groupLabel(date, today));
    bits.push("\uC27C");
  } else {
    const soon = relativeLabel(daysUntil(date, today));
    if (soon) bits.push(soon);
  }
  if (sub.note) bits.push(sub.note);
  return bits.join(" \xB7 ");
}
function appendRow(parent, sub, date, today, paused, model, handlers) {
  const row = el("button", paused ? "row is-paused" : "row");
  row.type = "button";
  const day = el("span", "day", String(date.getDate()));
  const main = el("span", "main");
  const name = el("span", "name", sub.name);
  const detail = el("span", "sub");
  const tick = el("span", "tick");
  tick.dataset.cat = sub.category;
  detail.append(tick, document.createTextNode(subline(sub, today, date, paused)));
  main.append(name, detail);
  const pricing = model.price(sub);
  if (sub.card) {
    const card = el("span", `card card-${pricing.status}`);
    card.append(el("span", "card-name", cardDisplayName(sub.card)));
    if (pricing.status === "applied" && pricing.rule) {
      card.append(document.createTextNode(` \xB7 ${describeRule(pricing.rule)}`));
    } else if (pricing.status === "no-rule") {
      card.append(document.createTextNode(" \xB7 \uB9DE\uB294 \uD560\uC778 \uADDC\uCE59 \uC5C6\uC74C"));
    } else if (pricing.status === "missing") {
      card.append(document.createTextNode(" \xB7 \uCE74\uB4DC \uB178\uD2B8 \uC5C6\uC74C"));
    }
    main.append(card);
  }
  const amount = el("span", "amount");
  if (pricing.discount > 0) {
    amount.append(el("s", "was", formatWon(pricing.listAmount)), el("span", "now", formatWon(pricing.amount)));
  } else {
    amount.append(el("span", "now", formatWon(pricing.amount)));
  }
  row.append(day, main, amount);
  row.addEventListener("click", () => handlers.onEdit(sub.id));
  parent.append(row);
}
function readDraft(form, id) {
  const data = new FormData(form);
  const cycle = String(data.get("cycle") ?? "");
  const category = String(data.get("category") ?? "");
  return {
    id,
    name: String(data.get("name") ?? ""),
    amount: String(data.get("amount") ?? ""),
    cycle: isCycle2(cycle) ? cycle : "monthly",
    date: String(data.get("date") ?? ""),
    category: isCategory2(category) ? category : "\uAE30\uD0C0",
    note: String(data.get("note") ?? ""),
    active: data.get("active") === "on",
    card: String(data.get("card") ?? "")
  };
}
function updateCardStatus(status, form, model, handlers) {
  status.replaceChildren();
  const draft = readDraft(form, null);
  const card = parseCardLink(draft.card);
  if (!card) {
    status.className = "card-status is-none";
    status.append(document.createTextNode("\uCE74\uB4DC\uB97C \uC801\uC9C0 \uC54A\uC73C\uBA74 \uC815\uAC00\uB85C \uACC4\uC0B0\uD569\uB2C8\uB2E4."));
    return;
  }
  const amount = normalizedAmount(draft.amount);
  const pricing = pricingFor(
    {
      name: draft.name,
      category: draft.category,
      amount: Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0,
      card
    },
    model.resolveCard
  );
  const shown = cardDisplayName(card);
  status.className = `card-status is-${pricing.status}`;
  const link = el("button", "text-btn card-link", shown);
  link.type = "button";
  if (pricing.status === "missing") {
    status.append(document.createTextNode(`"${shown}" \uB178\uD2B8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. `));
    const create = el("button", "text-btn", "\uCE74\uB4DC \uB178\uD2B8 \uB9CC\uB4E4\uAE30");
    create.type = "button";
    create.addEventListener("click", () => handlers.onCreateCard(card));
    status.append(create);
    return;
  }
  link.addEventListener("click", () => handlers.onOpenCard(card));
  status.append(link);
  if (pricing.status === "no-rule") {
    status.append(
      document.createTextNode(
        pricing.card && pricing.card.rules.length === 0 ? ": \uB178\uD2B8\uC5D0 \uD560\uC778 \uADDC\uCE59\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uD504\uB7F0\uD2B8\uB9E4\uD130\uC5D0 \uD560\uC778 \uD56D\uBAA9\uC744 \uCD94\uAC00\uD558\uC138\uC694." : ": \uC774 \uAD6C\uB3C5\uC5D0 \uB9DE\uB294 \uD560\uC778 \uADDC\uCE59\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."
      )
    );
    return;
  }
  const rule = pricing.rule ? describeRule(pricing.rule) : "";
  status.append(document.createTextNode(`: ${rule} \u2192 ${formatWon(pricing.amount)} (${formatWon(pricing.discount)} \uD560\uC778)`));
}
function appendEditor(parent, draft, error, focus, model, handlers) {
  const form = el("form", "editor");
  if (error) {
    const message = el("p", "editor-error", error);
    message.setAttribute("role", "alert");
    form.append(message);
  }
  const cardInput = textInput("card", draft.card, "text");
  cardInput.placeholder = "[[\uCE74\uB4DC \uC774\uB984]]";
  cardInput.spellcheck = false;
  const fields = [
    { label: "\uC774\uB984", node: textInput("name", draft.name, "text") },
    { label: "\uAE08\uC561", node: textInput("amount", draft.amount, "text") },
    { label: "\uC8FC\uAE30", node: cycleSelect(draft) },
    { label: "\uACB0\uC81C\uC77C", node: textInput("date", draft.date, "date") },
    { label: "\uBD84\uB958", node: categorySelect(draft) },
    { label: "\uCE74\uB4DC", node: cardInput },
    { label: "\uBA54\uBAA8", node: textInput("note", draft.note, "text") }
  ];
  for (const field of fields) {
    const wrap = el("label", "field");
    wrap.append(el("span", "label", field.label), field.node);
    form.append(wrap);
    if (field.node === cardInput) {
      const status2 = el("p", "card-status");
      form.append(status2);
      const refresh = () => updateCardStatus(status2, form, model, handlers);
      refresh();
      for (const name of ["card", "name", "amount"]) {
        form.querySelector(`input[name='${name}']`)?.addEventListener("input", refresh);
      }
      form.querySelector("select[name='category']")?.addEventListener("change", refresh);
      handlers.attachCardSuggest(cardInput, refresh);
    }
  }
  const status = el("label", "field");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = "active";
  checkbox.checked = draft.active;
  const statusText = el("span", "check-text", "\uC0AC\uC6A9 \uC911");
  const statusControl = el("span", "check");
  statusControl.append(checkbox, statusText);
  status.append(el("span", "label", "\uC0C1\uD0DC"), statusControl);
  form.append(status);
  form.append(el("p", "field-help", "\uB9E4\uC6D4\uC740 \uAC19\uC740 \uC77C, \uB9E4\uB144\uC740 \uAC19\uC740 \uB0A0\uC9DC, \uB9E4\uC8FC\uB294 \uAC19\uC740 \uC694\uC77C\uB85C \uBC18\uBCF5\uB429\uB2C8\uB2E4. \uAE08\uC561\uC740 \uD560\uC778 \uC804 \uC815\uAC00\uB97C \uC801\uC73C\uC138\uC694."));
  const actions = el("div", "editor-actions");
  const save = el("button", "add", "\uC800\uC7A5");
  save.type = "submit";
  actions.append(save);
  if (draft.id) {
    const remove = el("button", "text-btn danger", "\uC9C0\uC6B0\uAE30");
    remove.type = "button";
    remove.addEventListener("click", () => {
      if (remove.dataset.armed !== "1") {
        remove.dataset.armed = "1";
        remove.textContent = "\uB2E4\uC2DC \uB204\uB974\uBA74 \uC9C0\uC6C1\uB2C8\uB2E4";
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
  if (focus) {
    form.querySelector("input[name='name']")?.focus();
  }
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
function cycleSelect(draft) {
  const select = document.createElement("select");
  select.name = "cycle";
  for (const cycle of CYCLES) {
    const option = document.createElement("option");
    option.value = cycle;
    option.textContent = CYCLE_LABEL[cycle];
    option.selected = cycle === draft.cycle;
    select.append(option);
  }
  return select;
}
function categorySelect(draft) {
  const select = document.createElement("select");
  select.name = "category";
  for (const category of CATEGORIES) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    option.selected = category === draft.category;
    select.append(option);
  }
  return select;
}
function appendHeader(sheet, today, summaryCharge, meta, draftOpen, onAdd, onCancel) {
  const head = el("header", "head");
  const intro = el("div", "intro");
  intro.append(el("p", "kicker", monthTitle(today)));
  const total = el("p", "total");
  total.append(el("span", "num", formatNumber(summaryCharge)), el("span", "unit", "\uC6D0"));
  intro.append(total, el("p", "meta", meta));
  const action = el("button", "add", draftOpen ? "\uB2EB\uAE30" : "\uCD94\uAC00");
  action.type = "button";
  action.addEventListener("click", () => draftOpen ? onCancel() : onAdd());
  head.append(intro, action);
  sheet.append(head);
}
function renderShelf(root, model, handlers) {
  const previousFind = root.querySelector("input.find");
  const restoreFind = previousFind !== null && root.ownerDocument.activeElement === previousFind;
  const caret = previousFind?.selectionStart ?? null;
  root.replaceChildren();
  const sheet = el("div", "sheet");
  if (model.subscriptions.length === 0 && !model.draft) {
    const head = el("header", "head");
    const intro = el("div", "intro");
    intro.append(
      el("p", "kicker", "\uAD6C\uB3C5\uD568"),
      el("h2", "empty-title", "\uC544\uC9C1 \uAD6C\uB3C5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4"),
      el("p", "meta", "\uC774\uB984, \uAE08\uC561, \uB2E4\uC74C \uACB0\uC81C\uC77C\uB9CC \uC801\uC73C\uBA74 \uC774\uBC88 \uB2EC \uCCAD\uAD6C\uAC00 \uC5EC\uAE30\uC5D0 \uBAA8\uC785\uB2C8\uB2E4.")
    );
    head.append(intro);
    const add = el("button", "add", "\uAD6C\uB3C5 \uCD94\uAC00");
    add.type = "button";
    add.addEventListener("click", () => handlers.onAdd());
    sheet.append(head, add);
    root.append(sheet);
    return;
  }
  const summary = summarize(model.subscriptions, model.today, model.price);
  appendHeader(sheet, model.today, summary.charge, metaLine(summary), model.draft !== null, handlers.onAdd, handlers.onCancel);
  const sampleCount = model.subscriptions.filter((sub) => sub.sample).length;
  if (sampleCount > 0) {
    const line = el("p", "sample-line", `\uC608\uC2DC ${sampleCount}\uAC74\uC774 \uB4E4\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. `);
    const clear = el("button", "text-btn", "\uC608\uC2DC \uC9C0\uC6B0\uAE30");
    clear.type = "button";
    clear.title = "\uC544\uC9C1 \uACE0\uCE58\uC9C0 \uC54A\uC740 \uC608\uC2DC\uB9CC \uC9C0\uC6C1\uB2C8\uB2E4.";
    clear.addEventListener("click", () => handlers.onClearSamples());
    line.append(clear);
    sheet.append(line);
  }
  if (model.draft) {
    appendEditor(sheet, model.draft, model.error, model.focusEditor, model, handlers);
  }
  const showFind = model.subscriptions.length >= 8 && !model.draft;
  if (showFind) {
    const find = el("input", "find");
    find.type = "text";
    find.placeholder = "\uCC3E\uAE30";
    find.value = model.query;
    find.setAttribute("aria-label", "\uAD6C\uB3C5 \uCC3E\uAE30");
    find.addEventListener("input", () => handlers.onQuery(find.value));
    sheet.append(find);
    if (restoreFind) {
      find.focus();
      if (caret !== null) find.setSelectionRange(caret, caret);
    }
  }
  const query = showFind ? model.query : "";
  const groups = [];
  for (const item of upcoming(model.subscriptions, model.today)) {
    if (!matches(item.sub, query)) continue;
    const label = groupLabel(item.date, model.today);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, items: [item] });
    else last.items.push(item);
  }
  for (const group of groups) {
    const section = el("section", "group");
    section.append(el("h2", void 0, group.label));
    for (const item of group.items) {
      appendRow(section, item.sub, item.date, model.today, false, model, handlers);
    }
    sheet.append(section);
  }
  const paused = model.subscriptions.filter((sub) => !sub.active && matches(sub, query));
  if (paused.length > 0) {
    const section = el("section", "group paused");
    section.append(el("h2", void 0, "\uC26C\uACE0 \uC788\uC74C"));
    for (const sub of paused) {
      appendRow(section, sub, nextDate(sub, model.today), model.today, true, model, handlers);
    }
    sheet.append(section);
  }
  if (query.trim() && groups.length === 0 && paused.length === 0) {
    sheet.append(el("p", "empty-filter", "\uCC3E\uB294 \uC774\uB984\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."));
  }
  if (model.subscriptions.length > 0) {
    const foot = el("p", "foot");
    const exportButton = el("button", "text-btn", "\uB178\uD2B8\uB85C \uB0B4\uBCF4\uB0B4\uAE30");
    exportButton.type = "button";
    exportButton.addEventListener("click", () => handlers.onExport());
    foot.append(exportButton);
    sheet.append(foot);
  }
  root.append(sheet);
}

// src/suggest.ts
var import_obsidian2 = require("obsidian");
var CardSuggest = class extends import_obsidian2.AbstractInputSuggest {
  constructor(app, input, isCard, onPick) {
    super(app, input);
    this.isCard = isCard;
    this.limit = 20;
    this.onSelect((file) => {
      this.setValue(`[[${this.app.metadataCache.fileToLinktext(file, "")}]]`);
      this.close();
      onPick();
    });
  }
  getSuggestions(query) {
    const needle = parseCardLink(query).toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
    const files = this.app.vault.getMarkdownFiles();
    const hits = files.filter((file) => {
      if (!needle) return true;
      const haystack = file.path.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
      return haystack.includes(needle);
    });
    return hits.map((file) => ({ file, card: this.isCard(file) })).sort((a, b) => Number(b.card) - Number(a.card) || a.file.basename.localeCompare(b.file.basename, "ko")).map((entry) => entry.file);
  }
  renderSuggestion(file, el2) {
    el2.addClass("subscription-shelf-suggest");
    el2.createDiv({ cls: "suggest-title", text: file.basename });
    const parent = file.parent && file.parent.path !== "/" ? file.parent.path : "";
    const hint = [this.isCard(file) ? "\uD560\uC778 \uADDC\uCE59 \uC788\uC74C" : "", parent].filter(Boolean).join(" \xB7 ");
    if (hint) el2.createDiv({ cls: "suggest-hint", text: hint });
  }
};

// src/view.ts
var VIEW_TYPE = "subscription-shelf";
var SubscriptionView = class extends import_obsidian3.ItemView {
  constructor(leaf, shelf) {
    super(leaf);
    this.shelf = shelf;
    this.query = "";
    this.draft = null;
    this.error = "";
    this.focusEditor = false;
    this.suggest = null;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "\uAD6C\uB3C5\uD568";
  }
  getIcon() {
    return "wallet";
  }
  async onOpen() {
    this.render();
  }
  async onClose() {
    this.suggest?.close();
    this.suggest = null;
    this.contentEl.replaceChildren();
    this.contentEl.removeClass("subscription-shelf");
  }
  startAdd() {
    this.draft = emptyDraft(/* @__PURE__ */ new Date());
    this.error = "";
    this.focusEditor = true;
    this.render();
  }
  render() {
    const draft = this.draft;
    if (draft?.id && !this.shelf.getSubscriptions().some((item) => item.id === draft.id)) {
      this.draft = null;
      this.error = "";
    }
    const openForm = this.contentEl.querySelector("form.editor");
    if (openForm && this.draft) this.draft = readDraft(openForm, this.draft.id);
    this.suggest?.close();
    this.suggest = null;
    this.contentEl.addClass("subscription-shelf");
    renderShelf(
      this.contentEl,
      {
        subscriptions: this.shelf.getSubscriptions(),
        today: /* @__PURE__ */ new Date(),
        query: this.query,
        draft: this.draft,
        error: this.error,
        focusEditor: this.focusEditor,
        price: makePricer(this.shelf.resolveCard),
        resolveCard: this.shelf.resolveCard
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
          const message = validateDraft(next);
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
          void this.shelf.saveSubscription(subscriptionFromDraft(next));
          this.render();
        },
        onEdit: (id) => {
          const sub = this.shelf.getSubscriptions().find((item) => item.id === id);
          if (!sub) return;
          this.draft = draftFromSubscription(sub, /* @__PURE__ */ new Date());
          this.error = "";
          this.focusEditor = true;
          this.render();
        },
        onDelete: (id) => {
          this.draft = null;
          this.error = "";
          void this.shelf.deleteSubscription(id);
          this.render();
        },
        onClearSamples: () => {
          void this.shelf.clearSamples();
        },
        onExport: () => {
          void this.shelf.exportNote();
        },
        onOpenCard: (card) => {
          void this.shelf.openCard(card);
        },
        onCreateCard: (name) => {
          void this.shelf.createCardNote(name);
        },
        attachCardSuggest: (input, onPick) => {
          this.suggest = new CardSuggest(this.app, input, (file) => this.shelf.isCardNote(file), onPick);
        }
      }
    );
    this.focusEditor = false;
  }
};

// src/main.ts
var SubscriptionPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.subscriptions = [];
    this.refreshSoon = (0, import_obsidian4.debounce)(() => this.refresh(), 150, true);
    // --- 카드 ---------------------------------------------------------------
    this.resolveCard = (link) => {
      const file = this.cardFile(link);
      if (!file) return null;
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      return {
        name: file.basename,
        path: file.path,
        rules: rulesFromFrontmatter(frontmatter)
      };
    };
  }
  async onload() {
    const raw = await this.loadData();
    this.subscriptions = readShelf(raw, /* @__PURE__ */ new Date());
    if (!hasSavedList(raw)) await this.saveData({ subscriptions: this.subscriptions });
    this.registerView(VIEW_TYPE, (leaf) => new SubscriptionView(leaf, this));
    this.addRibbonIcon("wallet", "\uAD6C\uB3C5\uD568", () => void this.activateView());
    this.addSettingTab(new ShelfSettingTab(this.app, this, this));
    this.addCommand({ id: "open-subscription-shelf", name: "\uC5F4\uAE30", callback: () => void this.activateView() });
    this.addCommand({ id: "add-subscription", name: "\uAD6C\uB3C5 \uCD94\uAC00", callback: () => void this.openAndAdd() });
    this.addCommand({ id: "export-subscription-note", name: "\uB178\uD2B8\uB85C \uB0B4\uBCF4\uB0B4\uAE30", callback: () => void this.exportNote() });
    this.addCommand({ id: "create-card-note", name: "\uCE74\uB4DC \uB178\uD2B8 \uB9CC\uB4E4\uAE30", callback: () => void this.createCardNote() });
    this.registerEvent(this.app.metadataCache.on("changed", (file) => this.onCardMaybeChanged(file)));
    this.registerEvent(this.app.metadataCache.on("deleted", (file) => this.onCardMaybeChanged(file)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => void this.onRename(file, oldPath)));
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", (file) => this.onCardMaybeChanged(file)));
    });
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
  getSubscriptions() {
    return this.subscriptions;
  }
  async saveSubscription(sub) {
    this.subscriptions = upsertSubscription(this.subscriptions, sub);
    await this.saveData({ subscriptions: this.subscriptions });
    this.refresh();
  }
  async deleteSubscription(id) {
    this.subscriptions = removeSubscription(this.subscriptions, id);
    await this.saveData({ subscriptions: this.subscriptions });
    this.refresh();
  }
  async clearSamples() {
    const next = this.subscriptions.filter((sub) => !sub.sample);
    if (next.length === this.subscriptions.length) {
      new import_obsidian4.Notice("\uC9C0\uC6B8 \uC608\uC2DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    this.subscriptions = next;
    await this.saveData({ subscriptions: this.subscriptions });
    this.refresh();
    new import_obsidian4.Notice("\uC608\uC2DC\uB97C \uC9C0\uC6E0\uC2B5\uB2C8\uB2E4.");
  }
  async exportNote() {
    const path = "\uAD6C\uB3C5\uD568.md";
    const body = `${renderNote(this.subscriptions, /* @__PURE__ */ new Date(), makePricer(this.resolveCard))}
`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    try {
      if (existing instanceof import_obsidian4.TFile) await this.app.vault.modify(existing, body);
      else if (existing) {
        new import_obsidian4.Notice("\uAD6C\uB3C5\uD568.md \uC790\uB9AC\uC5D0 \uB2E4\uB978 \uD56D\uBAA9\uC774 \uC788\uC2B5\uB2C8\uB2E4.");
        return;
      } else await this.app.vault.create(path, body);
      new import_obsidian4.Notice("\uAD6C\uB3C5\uD568.md\uC5D0 \uC801\uC5B4 \uB450\uC5C8\uC2B5\uB2C8\uB2E4.");
    } catch (error) {
      console.error(error);
      new import_obsidian4.Notice("\uB178\uD2B8\uB97C \uC4F0\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    }
  }
  /** `.obsidian/plugins/subscription-shelf/data.json` */
  dataPath() {
    return `${this.app.vault.configDir}/plugins/${this.manifest.id}/data.json`;
  }
  isCardNote(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return rulesFromFrontmatter(frontmatter).length > 0;
  }
  async openCard(card) {
    const file = this.cardFile(card);
    if (!file) {
      new import_obsidian4.Notice(`"${card}" \uB178\uD2B8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`);
      return;
    }
    await this.app.workspace.getLeaf(false).openFile(file);
  }
  async createCardNote(name = "\uC0C8 \uCE74\uB4DC") {
    const existing = this.cardFile(name);
    if (existing) {
      await this.app.workspace.getLeaf(false).openFile(existing);
      return;
    }
    const folder = this.app.fileManager.getNewFileParent("").path;
    const safeName = name.replace(/[\\/:*?"<>|#^[\]]/g, " ").trim() || "\uC0C8 \uCE74\uB4DC";
    const path = (0, import_obsidian4.normalizePath)(folder === "/" || folder === "" ? `${safeName}.md` : `${folder}/${safeName}.md`);
    try {
      const file = await this.app.vault.create(path, cardNoteTemplate(safeName));
      await this.app.workspace.getLeaf(false).openFile(file);
      new import_obsidian4.Notice(`${safeName} \uB178\uD2B8\uB97C \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4. \uD504\uB7F0\uD2B8\uB9E4\uD130\uC758 \uD560\uC778 \uADDC\uCE59\uC744 \uACE0\uCCD0 \uC4F0\uC138\uC694.`);
    } catch (error) {
      console.error(error);
      new import_obsidian4.Notice("\uCE74\uB4DC \uB178\uD2B8\uB97C \uB9CC\uB4E4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    }
  }
  cardFile(link) {
    if (!link) return null;
    return this.app.metadataCache.getFirstLinkpathDest(link, "");
  }
  onCardMaybeChanged(file) {
    if (!(file instanceof import_obsidian4.TFile)) return;
    const linked = this.subscriptions.some((sub) => {
      if (!sub.card) return false;
      const target = this.cardFile(sub.card);
      return target ? target.path === file.path : file.basename === sub.card || file.path === `${sub.card}.md`;
    });
    if (linked) this.refreshSoon();
  }
  async onRename(file, oldPath) {
    if (!(file instanceof import_obsidian4.TFile)) return;
    const oldLink = oldPath.replace(/\.md$/i, "");
    const oldBase = oldLink.split("/").pop() ?? oldLink;
    const nextLink = this.app.metadataCache.fileToLinktext(file, "");
    let changed = false;
    const next = this.subscriptions.map((sub) => {
      if (!sub.card || sub.card !== oldLink && sub.card !== oldBase) return sub;
      changed = true;
      return { ...sub, card: nextLink };
    });
    if (!changed) return;
    this.subscriptions = next;
    await this.saveData({ subscriptions: this.subscriptions });
    this.refresh();
  }
  // --- 뷰 -----------------------------------------------------------------
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (existing?.view instanceof SubscriptionView) {
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
    if (leaf?.view instanceof SubscriptionView) leaf.view.startAdd();
  }
  refresh() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof SubscriptionView) leaf.view.render();
    }
  }
};
function hasSavedList(raw) {
  return Boolean(raw && typeof raw === "object" && Array.isArray(raw.subscriptions));
}
