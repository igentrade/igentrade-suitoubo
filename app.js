(function () {
  "use strict";

  const STORAGE_KEY = "igentrade-suitoubo-v1";
  const METHODS = ["現金", "口座振込", "クレジットカード", "電子マネー", "その他"];

  const DEFAULT_CATEGORIES = {
    income: ["売上", "入金", "借入", "その他収入"],
    expense: ["仕入", "経費", "給料", "家賃", "光熱費", "通信費", "交通費", "雑費", "その他支出"],
  };

  const yen = (n) =>
    new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(Math.round(Number(n) || 0));

  const todayISO = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const el = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function uid() {
    return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function typeLabel(t) {
    return t === "income" ? "収入" : "支出";
  }

  function parseAmount(v) {
    const n = Number(String(v).replace(/[,，\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          transactions: [],
          categories: {
            income: DEFAULT_CATEGORIES.income.slice(),
            expense: DEFAULT_CATEGORIES.expense.slice(),
          },
        };
      }
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") throw new Error("bad");
      const cats = data.categories || {};
      return {
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        categories: {
          income: Array.isArray(cats.income) && cats.income.length
            ? cats.income.map(String)
            : DEFAULT_CATEGORIES.income.slice(),
          expense: Array.isArray(cats.expense) && cats.expense.length
            ? cats.expense.map(String)
            : DEFAULT_CATEGORIES.expense.slice(),
        },
      };
    } catch (_) {
      return {
        transactions: [],
        categories: {
          income: DEFAULT_CATEGORIES.income.slice(),
          expense: DEFAULT_CATEGORIES.expense.slice(),
        },
      };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          transactions: state.transactions,
          categories: state.categories,
        })
      );
    } catch (err) {
      console.warn("localStorage save failed", err);
      alert("ブラウザへの保存に失敗しました。容量不足の可能性があります。");
    }
  }

  let state = loadState();

  function ensureCategoryExists(type, name) {
    const list = state.categories[type];
    if (!list.includes(name) && name) {
      list.push(name);
    }
  }

  function fillCategorySelects() {
    const type = el("txType").value;
    const txCat = el("txCategory");
    const current = txCat.value;
    txCat.innerHTML = "";
    state.categories[type].forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      txCat.appendChild(opt);
    });
    if (current && state.categories[type].includes(current)) {
      txCat.value = current;
    }

    const filterCat = el("filterCategory");
    const prev = filterCat.value;
    filterCat.innerHTML = '<option value="">すべて</option>';
    const all = new Set([
      ...state.categories.income,
      ...state.categories.expense,
      ...state.transactions.map((t) => t.category).filter(Boolean),
    ]);
    [...all].sort((a, b) => a.localeCompare(b, "ja")).forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      filterCat.appendChild(opt);
    });
    if (prev) filterCat.value = prev;
  }

  function renderCategoryEditor() {
    const type = el("catEditType").value;
    const root = el("categoryList");
    root.innerHTML = "";
    state.categories[type].forEach((name, idx) => {
      const row = document.createElement("div");
      row.className = "cat-row";
      row.innerHTML = `
        <input type="text" data-cat-idx="${idx}" value="${escapeHtml(name)}" />
        <button type="button" data-cat-del="${idx}" title="削除">×</button>
      `;
      root.appendChild(row);
    });
  }

  function getFilters() {
    return {
      from: el("filterFrom").value || "",
      to: el("filterTo").value || "",
      type: el("filterType").value || "",
      category: el("filterCategory").value || "",
      memo: (el("filterMemo").value || "").trim().toLowerCase(),
    };
  }

  function filteredTransactions() {
    const f = getFilters();
    return state.transactions
      .filter((t) => {
        if (f.from && t.date < f.from) return false;
        if (f.to && t.date > f.to) return false;
        if (f.type && t.type !== f.type) return false;
        if (f.category && t.category !== f.category) return false;
        if (f.memo) {
          const hay = String(t.memo || "").toLowerCase();
          if (!hay.includes(f.memo)) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.id).localeCompare(String(b.id));
      });
  }

  /** Running balance over ALL transactions chronologically, then map id -> balance */
  function balanceMap() {
    const sorted = state.transactions.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.id).localeCompare(String(b.id));
    });
    const map = new Map();
    let bal = 0;
    sorted.forEach((t) => {
      const amt = Number(t.amount) || 0;
      bal += t.type === "income" ? amt : -amt;
      map.set(t.id, bal);
    });
    return map;
  }

  function periodTotals(list) {
    let income = 0;
    let expense = 0;
    list.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === "income") income += amt;
      else expense += amt;
    });
    return { income, expense, net: income - expense };
  }

  function clearForm() {
    el("editId").value = "";
    el("txDate").value = todayISO();
    el("txType").value = "expense";
    el("txMethod").value = "現金";
    el("txAmount").value = "";
    el("txMemo").value = "";
    fillCategorySelects();
    el("saveTx").textContent = "追加";
    el("cancelEdit").classList.add("hidden");
  }

  function fillForm(tx) {
    el("editId").value = tx.id;
    el("txDate").value = tx.date;
    el("txType").value = tx.type;
    fillCategorySelects();
    ensureCategoryExists(tx.type, tx.category);
    fillCategorySelects();
    el("txCategory").value = tx.category;
    el("txAmount").value = tx.amount;
    el("txMemo").value = tx.memo || "";
    el("txMethod").value = METHODS.includes(tx.method) ? tx.method : "その他";
    el("saveTx").textContent = "更新";
    el("cancelEdit").classList.remove("hidden");
  }

  function renderLedger() {
    const list = filteredTransactions();
    const bals = balanceMap();
    const totals = periodTotals(list);
    const body = el("ledgerBody");
    el("txCount").textContent = `${list.length} 件`;
    el("sumIncome").textContent = yen(totals.income);
    el("sumExpense").textContent = yen(totals.expense);
    el("sumNet").textContent = yen(totals.net);

    const allSorted = state.transactions.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.id).localeCompare(String(b.id));
    });
    const endBal = allSorted.length ? bals.get(allSorted[allSorted.length - 1].id) || 0 : 0;
    el("sumBalance").textContent = yen(endBal);

    if (!list.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty-msg">該当する取引がありません。左のフォームから追加するか、サンプルを読み込んでください。</td></tr>`;
    } else {
      const editId = el("editId").value;
      body.innerHTML = list
        .map((t) => {
          const cls = t.type === "income" ? "type-income" : "type-expense";
          const rowCls = t.id === editId ? "is-editing" : "";
          return `<tr class="${rowCls}" data-id="${escapeHtml(t.id)}">
            <td>${escapeHtml(t.date)}</td>
            <td class="${cls}">${typeLabel(t.type)}</td>
            <td>${escapeHtml(t.category || "")}</td>
            <td class="num">${yen(t.amount)}</td>
            <td>${escapeHtml(t.method || "")}</td>
            <td class="memo-cell">${escapeHtml(t.memo || "")}</td>
            <td class="num">${yen(bals.get(t.id) || 0)}</td>
            <td class="row-actions">
              <button type="button" data-edit="${escapeHtml(t.id)}">編集</button>
              <button type="button" class="del" data-del="${escapeHtml(t.id)}">削除</button>
            </td>
          </tr>`;
        })
        .join("");
    }

    renderSummary(list);
    renderReport(list, bals, totals);
  }

  function monthKey(dateStr) {
    return String(dateStr || "").slice(0, 7);
  }

  function renderSummary(list) {
    const byCat = el("summaryByCategory").checked;
    const head = el("summaryHead");
    const body = el("summaryBody");

    if (!list.length) {
      head.innerHTML = "<tr><th>月</th><th class=\"num\">収入</th><th class=\"num\">支出</th><th class=\"num\">差引</th></tr>";
      body.innerHTML = `<tr><td colspan="4" class="empty-msg">集計データがありません</td></tr>`;
      return;
    }

    if (!byCat) {
      const map = new Map();
      list.forEach((t) => {
        const m = monthKey(t.date);
        if (!map.has(m)) map.set(m, { income: 0, expense: 0 });
        const row = map.get(m);
        const amt = Number(t.amount) || 0;
        if (t.type === "income") row.income += amt;
        else row.expense += amt;
      });
      const months = [...map.keys()].sort();
      head.innerHTML = "<tr><th>月</th><th class=\"num\">収入</th><th class=\"num\">支出</th><th class=\"num\">差引</th></tr>";
      body.innerHTML = months
        .map((m) => {
          const r = map.get(m);
          return `<tr>
            <td>${escapeHtml(m)}</td>
            <td class="num type-income">${yen(r.income)}</td>
            <td class="num type-expense">${yen(r.expense)}</td>
            <td class="num">${yen(r.income - r.expense)}</td>
          </tr>`;
        })
        .join("");
      return;
    }

    const map = new Map();
    list.forEach((t) => {
      const m = monthKey(t.date);
      const key = `${m}\t${t.type}\t${t.category || ""}`;
      if (!map.has(key)) {
        map.set(key, { month: m, type: t.type, category: t.category || "", amount: 0 });
      }
      map.get(key).amount += Number(t.amount) || 0;
    });
    const rows = [...map.values()].sort((a, b) => {
      if (a.month !== b.month) return a.month.localeCompare(b.month);
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.category.localeCompare(b.category, "ja");
    });
    head.innerHTML =
      "<tr><th>月</th><th>区分</th><th>カテゴリ</th><th class=\"num\">金額</th></tr>";
    body.innerHTML = rows
      .map((r) => {
        const cls = r.type === "income" ? "type-income" : "type-expense";
        return `<tr>
          <td>${escapeHtml(r.month)}</td>
          <td class="${cls}">${typeLabel(r.type)}</td>
          <td>${escapeHtml(r.category)}</td>
          <td class="num">${yen(r.amount)}</td>
        </tr>`;
      })
      .join("");
  }

  function renderReport(list, bals, totals) {
    const f = getFilters();
    const period =
      f.from || f.to
        ? `${f.from || "（開始なし）"} 〜 ${f.to || "（終了なし）"}`
        : "全期間";
    el("rPeriod").textContent = period;
    el("rIssued").textContent = todayISO();
    el("rCount").textContent = String(list.length);
    el("rIncome").textContent = yen(totals.income);
    el("rExpense").textContent = yen(totals.expense);
    el("rNet").textContent = yen(totals.net);

    const body = el("reportBody");
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty-msg">該当なし</td></tr>`;
      return;
    }
    body.innerHTML = list
      .map((t) => {
        const cls = t.type === "income" ? "type-income" : "type-expense";
        return `<tr>
          <td>${escapeHtml(t.date)}</td>
          <td class="${cls}">${typeLabel(t.type)}</td>
          <td>${escapeHtml(t.category || "")}</td>
          <td class="num">${yen(t.amount)}</td>
          <td>${escapeHtml(t.method || "")}</td>
          <td>${escapeHtml(t.memo || "")}</td>
          <td class="num">${yen(bals.get(t.id) || 0)}</td>
        </tr>`;
      })
      .join("");
  }

  function saveTransaction() {
    const date = el("txDate").value;
    const type = el("txType").value;
    const category = el("txCategory").value;
    const amount = parseAmount(el("txAmount").value);
    const memo = el("txMemo").value.trim();
    const method = el("txMethod").value;
    const editId = el("editId").value;

    if (!date) {
      alert("日付を入力してください。");
      return;
    }
    if (amount === null || amount <= 0) {
      alert("金額は1円以上の数値で入力してください。");
      return;
    }
    if (!category) {
      alert("カテゴリを選択してください。");
      return;
    }

    if (editId) {
      const idx = state.transactions.findIndex((t) => t.id === editId);
      if (idx >= 0) {
        state.transactions[idx] = {
          ...state.transactions[idx],
          date,
          type,
          category,
          amount,
          memo,
          method,
        };
      }
    } else {
      state.transactions.push({
        id: uid(),
        date,
        type,
        category,
        amount,
        memo,
        method,
      });
    }
    saveState();
    clearForm();
    renderLedger();
  }

  function deleteTransaction(id) {
    if (!confirm("この取引を削除しますか？")) return;
    state.transactions = state.transactions.filter((t) => t.id !== id);
    if (el("editId").value === id) clearForm();
    saveState();
    renderLedger();
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }

  function exportCsv() {
    const list = filteredTransactions();
    const header = ["日付", "区分", "カテゴリ", "金額", "支払方法", "メモ", "ID"];
    const lines = [header.join(",")];
    list.forEach((t) => {
      lines.push(
        [
          t.date,
          typeLabel(t.type),
          t.category,
          t.amount,
          t.method,
          t.memo,
          t.id,
        ]
          .map(csvEscape)
          .join(",")
      );
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n") + "\r\n"], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `suitoubo_${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
    const s = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"') {
          if (s[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (ch === "\r") {
        /* skip */
      } else {
        cur += ch;
      }
    }
    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }

  function importCsvText(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) {
      alert("CSVにデータ行がありません。");
      return;
    }
    const header = rows[0].map((h) => String(h).trim());
    const idx = (names) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const iDate = idx(["日付", "date", "Date"]);
    const iType = idx(["区分", "種別", "type", "Type"]);
    const iCat = idx(["カテゴリ", "category", "Category"]);
    const iAmt = idx(["金額", "amount", "Amount"]);
    const iMethod = idx(["支払方法", "method", "Method"]);
    const iMemo = idx(["メモ", "摘要", "memo", "Memo"]);
    const iId = idx(["ID", "id"]);

    if (iDate < 0 || iType < 0 || iAmt < 0) {
      alert("CSVヘッダーに「日付」「区分」「金額」が必要です。");
      return;
    }

    let added = 0;
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      const date = String(cols[iDate] || "").trim();
      const typeRaw = String(cols[iType] || "").trim();
      const type =
        typeRaw === "収入" || typeRaw.toLowerCase() === "income"
          ? "income"
          : typeRaw === "支出" || typeRaw.toLowerCase() === "expense"
            ? "expense"
            : null;
      const amount = parseAmount(cols[iAmt]);
      if (!date || !type || amount === null || amount <= 0) continue;
      const category =
        (iCat >= 0 ? String(cols[iCat] || "").trim() : "") ||
        (type === "income" ? "その他収入" : "その他支出");
      const method =
        (iMethod >= 0 ? String(cols[iMethod] || "").trim() : "") || "現金";
      const memo = iMemo >= 0 ? String(cols[iMemo] || "").trim() : "";
      const id =
        iId >= 0 && String(cols[iId] || "").trim()
          ? String(cols[iId]).trim()
          : uid();
      ensureCategoryExists(type, category);
      const existing = state.transactions.findIndex((t) => t.id === id);
      const tx = { id, date, type, category, amount, memo, method };
      if (existing >= 0) state.transactions[existing] = tx;
      else {
        state.transactions.push(tx);
        added++;
      }
    }
    saveState();
    fillCategorySelects();
    renderCategoryEditor();
    renderLedger();
    alert(`CSVを取り込みました（新規 ${added} 件。同一IDは上書き）。`);
  }

  function loadSample() {
    if (state.transactions.length && !confirm("サンプルデータを追加しますか？（既存データは残ります）")) {
      return;
    }
    const base = todayISO().slice(0, 8) + "01";
    const y = Number(todayISO().slice(0, 4));
    const m = Number(todayISO().slice(5, 7));
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const pm = `${prevY}-${String(prevM).padStart(2, "0")}`;

    const samples = [
      { date: `${pm}-05`, type: "income", category: "売上", amount: 220000, memo: "先月売上入金", method: "口座振込" },
      { date: `${pm}-10`, type: "expense", category: "家賃", amount: 80000, memo: "事務所家賃", method: "口座振込" },
      { date: `${pm}-15`, type: "expense", category: "光熱費", amount: 12500, memo: "電気・ガス", method: "口座振込" },
      { date: `${pm}-20`, type: "expense", category: "仕入", amount: 45000, memo: "商品仕入", method: "口座振込" },
      { date: `${base}`, type: "income", category: "売上", amount: 85000, memo: "店頭売上", method: "現金" },
      { date: todayISO().slice(0, 8) + "03", type: "expense", category: "交通費", amount: 3200, memo: "営業移動", method: "電子マネー" },
      { date: todayISO().slice(0, 8) + "05", type: "expense", category: "通信費", amount: 8800, memo: "スマホ・回線", method: "クレジットカード" },
      { date: todayISO().slice(0, 8) + "08", type: "income", category: "入金", amount: 50000, memo: "売掛回収", method: "口座振込" },
      { date: todayISO().slice(0, 8) + "12", type: "expense", category: "雑費", amount: 2100, memo: "消耗品", method: "現金" },
      { date: todayISO(), type: "expense", category: "経費", amount: 5400, memo: "会議費", method: "クレジットカード" },
    ];

    samples.forEach((s) => {
      ensureCategoryExists(s.type, s.category);
      state.transactions.push({ id: uid(), ...s });
    });
    saveState();
    fillCategorySelects();
    renderCategoryEditor();
    renderLedger();
  }

  function clearAll() {
    if (!confirm("すべての取引データを削除しますか？この操作は元に戻せません。")) return;
    if (!confirm("本当に全削除してよろしいですか？")) return;
    state.transactions = [];
    saveState();
    clearForm();
    renderLedger();
  }

  function syncBrandFoot() {
    const on = el("showBrand").checked;
    el("brandFoot").classList.toggle("is-hidden", !on);
  }

  function bindEvents() {
    el("txType").addEventListener("change", fillCategorySelects);
    el("saveTx").addEventListener("click", saveTransaction);
    el("cancelEdit").addEventListener("click", () => {
      clearForm();
      renderLedger();
    });

    el("applyFilter").addEventListener("click", renderLedger);
    el("clearFilter").addEventListener("click", () => {
      el("filterFrom").value = "";
      el("filterTo").value = "";
      el("filterType").value = "";
      el("filterCategory").value = "";
      el("filterMemo").value = "";
      renderLedger();
    });
    ["filterFrom", "filterTo", "filterType", "filterCategory"].forEach((id) => {
      el(id).addEventListener("change", renderLedger);
    });
    el("filterMemo").addEventListener("input", () => {
      clearTimeout(el("filterMemo")._t);
      el("filterMemo")._t = setTimeout(renderLedger, 200);
    });

    el("ledgerBody").addEventListener("click", (ev) => {
      const edit = ev.target.closest("[data-edit]");
      const del = ev.target.closest("[data-del]");
      if (edit) {
        const tx = state.transactions.find((t) => t.id === edit.getAttribute("data-edit"));
        if (tx) {
          fillForm(tx);
          renderLedger();
          el("txDate").focus();
        }
      } else if (del) {
        deleteTransaction(del.getAttribute("data-del"));
      }
    });

    el("catEditType").addEventListener("change", renderCategoryEditor);
    el("categoryList").addEventListener("change", (ev) => {
      const input = ev.target.closest("[data-cat-idx]");
      if (!input) return;
      const type = el("catEditType").value;
      const idx = Number(input.getAttribute("data-cat-idx"));
      const val = input.value.trim();
      if (!val) {
        alert("空のカテゴリ名にはできません。");
        renderCategoryEditor();
        return;
      }
      state.categories[type][idx] = val;
      saveState();
      fillCategorySelects();
    });
    el("categoryList").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-cat-del]");
      if (!btn) return;
      const type = el("catEditType").value;
      const idx = Number(btn.getAttribute("data-cat-del"));
      if (state.categories[type].length <= 1) {
        alert("カテゴリは最低1つ必要です。");
        return;
      }
      state.categories[type].splice(idx, 1);
      saveState();
      renderCategoryEditor();
      fillCategorySelects();
    });
    el("addCategory").addEventListener("click", () => {
      const type = el("catEditType").value;
      const name = prompt("新しいカテゴリ名");
      if (!name || !name.trim()) return;
      const n = name.trim();
      if (state.categories[type].includes(n)) {
        alert("同名のカテゴリがあります。");
        return;
      }
      state.categories[type].push(n);
      saveState();
      renderCategoryEditor();
      fillCategorySelects();
    });
    el("resetCategories").addEventListener("click", () => {
      if (!confirm("カテゴリを既定値に戻しますか？")) return;
      state.categories = {
        income: DEFAULT_CATEGORIES.income.slice(),
        expense: DEFAULT_CATEGORIES.expense.slice(),
      };
      saveState();
      renderCategoryEditor();
      fillCategorySelects();
    });

    el("exportCsv").addEventListener("click", exportCsv);
    el("importCsvBtn").addEventListener("click", () => el("importCsv").click());
    el("importCsv").addEventListener("change", (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importCsvText(String(reader.result || ""));
      reader.onerror = () => alert("ファイルの読み込みに失敗しました。");
      reader.readAsText(file, "UTF-8");
    });
    el("loadSample").addEventListener("click", loadSample);
    el("clearAll").addEventListener("click", clearAll);
    el("summaryByCategory").addEventListener("change", renderLedger);
    el("showBrand").addEventListener("change", syncBrandFoot);
    el("printBtn").addEventListener("click", () => {
      syncBrandFoot();
      window.print();
    });
  }

  function init() {
    el("txDate").value = todayISO();
    fillCategorySelects();
    renderCategoryEditor();
    syncBrandFoot();
    bindEvents();
    renderLedger();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
