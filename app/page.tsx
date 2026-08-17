"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";

interface LabelItem {
  name: string;
  tag?: string;
}

interface ItemEntry {
  id: string;
  text: string;
  subtext: string;
  quantity: number;
}

const DEFAULT_ITEMS: ItemEntry[] = [
  { id: "1", text: "Chicken Sandwiches",          subtext: "",      quantity: 1 },
  { id: "2", text: "Roast Beef Sandwiches",        subtext: "",      quantity: 1 },
  { id: "3", text: "Salami & Swiss Sandwiches",    subtext: "",      quantity: 1 },
  { id: "4", text: "Prosciutto & Brie Sandwiches", subtext: "",      quantity: 1 },
  { id: "5", text: "Veggie Sandwiches",            subtext: "Veg",   quantity: 1 },
  { id: "6", text: "Fruit Cups",                   subtext: "",      quantity: 1 },
  { id: "7", text: "Chicken Shawarma Rice Bowls",  subtext: "",      quantity: 1 },
  { id: "8", text: "Beef Shawarma Rice Bowls",     subtext: "",      quantity: 1 },
  { id: "9", text: "Falafel Rice Bowls",           subtext: "Vegan", quantity: 1 },
];

const MAX_PAGE_HEIGHT = 720;
const MIN_LABEL_HEIGHT = 132;

const newId = () => Math.random().toString(36).slice(2, 9);

const autoResize = (el: HTMLTextAreaElement) => {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
};

const clampQty = (n: number) => Math.max(1, Math.min(99, n));

function parseLine(raw: string): ItemEntry | null {
  // Strip bullets ("- ", "• ") and list numbering ("1. ", "2) ")
  let line = raw.replace(/^\s*(?:[-–—*•·]+|\d{1,2}[.)])\s+/, "").trim();
  if (!line) return null;

  // Drop a trailing price, e.g. "… — $12.50"
  line = line.replace(/\s*[-–—:]?\s*\$\s?\d+(?:[.,]\d{2})?\s*$/, "").trim();

  let quantity = 1;

  // Leading quantity: "2x Item", "2 × Item", "(2) Item", "2 Item"
  let m =
    line.match(/^\(?\s*(\d{1,2})\s*\)?\s*[x×]\s*(.+)$/i) ||
    line.match(/^\(\s*(\d{1,2})\s*\)\s*(.+)$/) ||
    line.match(/^(\d{1,2})\s+(.+)$/);
  if (m) {
    quantity = clampQty(parseInt(m[1], 10));
    line = m[2].trim();
  } else {
    // Trailing quantity: "Item x2", "Item (x2)", "Item — 2", "Item<tab>2", "Item qty 2"
    m =
      line.match(/^(.*?)[\s,–—-]*\(?\s*(?:x|×|qty\.?:?|quantity:?)\s*(\d{1,2})\s*\)?$/i) ||
      line.match(/^(.*?)\s*[–—-]\s*(\d{1,2})$/) ||
      line.match(/^(.*?)\t+\s*(\d{1,2})$/);
    if (m && m[1].trim()) {
      quantity = clampQty(parseInt(m[2], 10));
      line = m[1].trim();
    }
  }

  // Drop everything after a colon, e.g. "Chicken Sandwiches: no mayo"
  const colon = line.indexOf(":");
  if (colon !== -1) {
    line = line.slice(0, colon).trim();
    if (!line) return null;
  }

  // Trailing "(note)" becomes the sub text
  const sub = line.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (sub && sub[1].trim()) {
    return { id: newId(), text: sub[1].trim(), subtext: sub[2].trim(), quantity };
  }

  return { id: newId(), text: line, subtext: "", quantity };
}

function parseImportText(raw: string, previous: ItemEntry[] = []): ItemEntry[] {
  const parsed: ItemEntry[] = [];
  raw.split("\n").forEach(line => {
    const item = parseLine(line);
    // Reuse the id at the same position so rows keep focus/state while typing
    if (item) parsed.push({ ...item, id: previous[parsed.length]?.id ?? item.id });
  });
  return parsed;
}

// Inverse of parseLine — what the list looks like as order text
function serializeItems(items: ItemEntry[]): string {
  return items
    .map(({ text, subtext, quantity }) => {
      const name = text.replace(/\s*\n\s*/g, " ").trim();
      const sub = subtext.replace(/\s*\n\s*/g, " ").trim();
      // A name starting with a number ("7 Layer Dip") needs an explicit qty,
      // otherwise reparsing would read that number as the quantity
      const prefix = quantity > 1 || /^\d/.test(name) ? `${quantity}x ` : "";
      return [prefix, name, sub ? ` (${sub})` : ""].join("");
    })
    .join("\n");
}


export default function LabelMaker() {
  const [items, setItems] = useState<ItemEntry[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [pageTitle, setPageTitle] = useState("");
  const [blankLabels, setBlankLabels] = useState(0);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [showImport, setShowImport] = useState(true);
  const [orderText, setOrderText] = useState("");

  const focusNextId = useRef<string | null>(null);
  const dragIndex = useRef<number>(-1);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted) return;
    const el = previewContainerRef.current;
    if (!el) return;
    const update = () => setPreviewScale((el.clientWidth - 32) / 1056);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMounted]);

  useEffect(() => {
    if (focusNextId.current) {
      const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-focus-id="${focusNextId.current}"]`);
      el?.focus();
      focusNextId.current = null;
    }
    document.querySelectorAll<HTMLTextAreaElement>("textarea[data-autoresize]").forEach(autoResize);
  });

  const computedLabels = useMemo((): LabelItem[] => {
    const named = items.flatMap((item) => {
      if (!item.text.trim()) return [];
      const qty = Math.max(1, Math.min(99, item.quantity));
      const label: LabelItem = {
        name: item.text.trim(),
        tag: item.subtext.trim() || undefined,
      };
      return Array.from({ length: qty }, () => label);
    });
    const blanks = Array.from({ length: Math.max(0, blankLabels) }, () => ({ name: "", tag: undefined }));
    return [...named, ...blanks];
  }, [items, blankLabels]);

  const [pages, setPages] = useState<LabelItem[][]>([]);
  const measureRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isMounted) return;
    const root = measureRef.current;
    const chunks: LabelItem[][] = [];
    if (computedLabels.length > 0 && root) {
      const els = root.querySelectorAll<HTMLElement>("[data-measure]");
      const heights = Array.from(els).map(el => el.offsetHeight);
      let current: LabelItem[] = [];
      let currentHeight = 0;
      computedLabels.forEach((label, i) => {
        const h = heights[i] || MIN_LABEL_HEIGHT;
        if (currentHeight + h > MAX_PAGE_HEIGHT && current.length) {
          chunks.push(current);
          current = [];
          currentHeight = 0;
        }
        current.push(label);
        currentHeight += h;
      });
      if (current.length) chunks.push(current);
    }
    setPages(prev => {
      if (
        prev.length === chunks.length &&
        prev.every((p, i) =>
          p.length === chunks[i].length &&
          p.every((l, j) => l.name === chunks[i][j].name && l.tag === chunks[i][j].tag)
        )
      ) return prev;
      return chunks;
    });
  }, [computedLabels, isMounted]);

  // The list and the order text are two views of the same data, kept in sync.
  // Editing the text reparses the list; editing the list rewrites the text.
  const commitItems = (next: ItemEntry[]) => {
    setItems(next);
    setOrderText(serializeItems(next));
  };

  const editOrderText = (text: string) => {
    setOrderText(text);
    setItems(prev => parseImportText(text, prev));
  };

  const addItem = () => {
    const id = newId();
    focusNextId.current = id;
    commitItems([...items, { id, text: "", subtext: "", quantity: 1 }]);
  };

  const updateItem = (id: string, patch: Partial<ItemEntry>) => {
    commitItems(items.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const removeItem = (id: string) => commitItems(items.filter(i => i.id !== id));

  const moveItem = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commitItems(next);
  };

  const loadExample = () => commitItems(DEFAULT_ITEMS);
  const clearAll = () => { commitItems([]); setPageTitle(""); setBlankLabels(0); };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen print:bg-white print:p-0">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.25in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-page {
            page-break-after: always;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .print-page:last-child { page-break-after: avoid; }
          .no-print { display: none !important; }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        textarea { resize: vertical; }
      `}</style>

      {/* Hidden measurement container — used to compute label heights for pagination */}
      <div
        ref={measureRef}
        aria-hidden
        className="no-print"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
          visibility: "hidden",
          zIndex: -1,
        }}
      >
        {computedLabels.map((item, i) => (
          <div
            key={i}
            data-measure
            style={{ width: 944, minHeight: MIN_LABEL_HEIGHT }}
            className="border-b border-r border-gray-300 bg-white flex items-center px-6 py-4 gap-6"
          >
            <img src="/label.png" alt="" className="h-20 w-auto object-contain ml-5 flex-shrink-0" />
            <div className="flex-grow min-w-0 flex flex-col justify-center mx-4">
              <h2 className="text-4xl font-bold leading-tight capitalize">{item.name}</h2>
              {item.tag && <p className="text-xl text-gray-500 mt-0.5 capitalize">({item.tag})</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="no-print bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">CaterDash Labels</h1>
          <button
            onClick={() => window.print()}
            disabled={computedLabels.length === 0}
            className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Labels
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="no-print max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Left Panel */}
          <div className="space-y-4">

            {/* Order text — a live, editable view of the item list */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowImport(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-700">Order Text</span>
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  {showImport ? "Hide" : "Show"}
                  <svg
                    className={`w-4 h-4 transition-transform ${showImport ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>

              {showImport && (
                <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Paste the order email here — one item per line. Labels update as you type, and this box
                    stays in sync with the list below, so you can edit in either place. Quantities like{" "}
                    <span className="font-mono bg-gray-100 px-1 rounded">2x</span> are picked up, text in{" "}
                    <span className="font-mono bg-gray-100 px-1 rounded">(brackets)</span> becomes sub text, and
                    anything after a <span className="font-mono bg-gray-100 px-1 rounded">:</span> is dropped.
                  </p>
                  <textarea
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono leading-6 focus:outline-none focus:ring-2 focus:ring-red-300 transition resize-y"
                    placeholder={"2x Chicken Sandwiches\nVeggie Sandwiches (Veg)\n3x Falafel Rice Bowls (Vegan)"}
                    value={orderText}
                    onChange={(e) => editOrderText(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Page Title */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Page Title <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition"
                placeholder="e.g., Monday Lunch — ABC Company"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
              />
              <p className="mt-2 text-xs text-gray-400">Appears in the bottom right of each page</p>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Blank Labels</p>
                  <p className="text-xs text-gray-400 mt-0.5">Added at the end for handwriting</p>
                </div>
                <div className="flex items-stretch border border-gray-200 rounded-lg overflow-hidden w-[72px] h-[36px]">
                  <button
                    onClick={() => setBlankLabels(b => Math.max(0, b - 1))}
                    className="px-1.5 text-gray-500 hover:bg-gray-100 text-base leading-none font-medium transition-colors"
                  >−</button>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={blankLabels}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setBlankLabels(Math.max(0, Math.min(99, v))); }}
                    onBlur={(e) => { const v = parseInt(e.target.value, 10); setBlankLabels(isNaN(v) ? 0 : Math.max(0, Math.min(99, v))); }}
                    className="w-7 text-center text-sm font-medium bg-white focus:outline-none border-x border-gray-200"
                  />
                  <button
                    onClick={() => setBlankLabels(b => Math.min(99, b + 1))}
                    className="px-1.5 text-gray-500 hover:bg-gray-100 text-base leading-none font-medium transition-colors"
                  >+</button>
                </div>
              </div>
            </div>

            {/* Menu Items Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">Menu Items</span>
                <div className="flex items-center gap-3">
                  <button onClick={loadExample} className="text-xs text-gray-500 hover:text-red-600 transition-colors">
                    Load example
                  </button>
                  <span className="text-gray-200">|</span>
                  <button onClick={clearAll} className="text-xs text-gray-500 hover:text-red-600 transition-colors">
                    Clear all
                  </button>
                </div>
              </div>

              {/* Item list */}
              <div className="max-h-[520px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">No items yet</p>
                    <p className="text-xs text-gray-400 mb-4">Paste the order above, or add items one at a time</p>
                    <button onClick={addItem} className="text-sm text-red-600 font-medium hover:text-red-700 transition-colors">
                      + Add your first item
                    </button>
                  </div>
                ) : (
                  <div>
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => { dragIndex.current = index; }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                        onDrop={() => { moveItem(dragIndex.current, dragOverIndex); setDragOverIndex(-1); }}
                        onDragEnd={() => setDragOverIndex(-1)}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 transition-colors ${
                          dragOverIndex === index ? "ring-2 ring-inset ring-red-300 bg-red-50" : "hover:bg-gray-50"
                        }`}
                      >
                        {/* Drag handle */}
                        <div className="mt-2 w-5 flex items-center justify-center cursor-grab text-gray-300 hover:text-gray-500 shrink-0 select-none">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                          </svg>
                        </div>

                        {/* Stacked text + subtext */}
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <textarea
                            data-focus-id={item.id}
                            data-autoresize
                            style={{ height: "auto", minHeight: "38px" }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition overflow-hidden"
                            placeholder="Item name"
                            value={item.text}
                            onChange={(e) => updateItem(item.id, { text: e.target.value })}
                            onInput={(e) => autoResize(e.currentTarget)}
                          />
                          <textarea
                            data-autoresize
                            style={{ height: "auto", minHeight: "38px" }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-300 transition overflow-hidden"
                            placeholder="Sub text (optional)"
                            value={item.subtext}
                            onChange={(e) => updateItem(item.id, { subtext: e.target.value })}
                            onInput={(e) => autoResize(e.currentTarget)}
                            onKeyDown={(e) => {
                              if (e.key === "Tab" && !e.shiftKey && index === items.length - 1) {
                                e.preventDefault();
                                addItem();
                              }
                            }}
                          />
                        </div>

                        {/* Quantity control */}
                        <div className="mt-1 flex items-stretch border border-gray-200 rounded-lg overflow-hidden shrink-0 w-[72px] h-[36px]">
                          <button
                            onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                            className="px-1.5 text-gray-500 hover:bg-gray-100 text-base leading-none font-medium transition-colors"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={item.quantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v)) updateItem(item.id, { quantity: v });
                            }}
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10);
                              updateItem(item.id, { quantity: isNaN(v) ? 1 : Math.max(1, Math.min(99, v)) });
                            }}
                            className="w-7 text-center text-sm font-medium bg-white focus:outline-none border-x border-gray-200"
                          />
                          <button
                            onClick={() => updateItem(item.id, { quantity: Math.min(99, item.quantity + 1) })}
                            className="px-1.5 text-gray-500 hover:bg-gray-100 text-base leading-none font-medium transition-colors"
                          >
                            +
                          </button>
                        </div>

                        {/* Delete */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="mt-1 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                          title="Remove item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add item button */}
              <div className="px-4 py-3 border-t border-gray-100">
                <button
                  onClick={addItem}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-gray-500 hover:text-red-600 border border-dashed border-gray-200 hover:border-red-300 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add item
                </button>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center justify-between text-sm px-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span className="font-medium">{computedLabels.length}</span> label{computedLabels.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">{pages.length}</span> page{pages.length !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-xs text-gray-400">Up to 5 labels per page</span>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">
                Preview <span className="font-normal text-gray-400">(not to scale)</span>
              </h2>
            </div>
            <div ref={previewContainerRef} className="p-4 bg-gray-200 min-h-[479px] overflow-y-auto">
              {computedLabels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg className="w-14 h-14 mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <p className="text-sm font-medium">No labels yet</p>
                  <p className="text-xs mt-1">Add items on the left to see a preview</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pages.filter(Boolean).map((pageLabels, pageIndex) => (
                    <div
                      key={pageIndex}
                      className="bg-white rounded shadow-md border border-gray-300 relative overflow-hidden"
                      style={{ aspectRatio: "11 / 8.5" }}
                    >
                      <div
                        style={{
                          width: 1056,
                          height: 816,
                          transformOrigin: "top left",
                          transform: `scale(${previewScale})`,
                          position: "absolute",
                          top: 0,
                          left: 0,
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {pageLabels.map((item, index) => (
                          <div
                            key={index}
                            style={{ width: 944, minHeight: 132 }}
                            className="border-b border-r border-gray-300 bg-white flex items-center px-6 py-4 gap-6"
                          >
                            <img
                              src="/label.png"
                              alt="CaterDash Logo"
                              className="h-20 w-auto object-contain ml-5 flex-shrink-0"
                            />
                            <div className="flex-grow min-w-0 flex flex-col justify-center mx-4">
                              <h2 className="text-4xl font-bold leading-tight capitalize">{item.name}</h2>
                              {item.tag && (
                                <p className="text-xl text-gray-500 mt-0.5 capitalize">({item.tag})</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {(pageTitle || pages.length > 1) && (
                          <div className="mt-auto self-end pr-4 pb-2 text-right text-gray-500">
                            {pageTitle && <p className="text-sm font-medium">{pageTitle}</p>}
                            <p className="text-xs">Page {pageIndex + 1} of {pages.length}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Print Layout */}
      <div className="hidden print:block">
        {pages.map((pageLabels, pageIndex) => (
          <div key={pageIndex} className="print-page flex flex-col w-full">
            {pageLabels.map((item, index) => (
              <div
                key={index}
                style={{ width: "9.83in", minHeight: "1.374in" }}
                className="border-b border-r border-gray-300 bg-white flex items-center px-6 py-4 gap-6"
              >
                <img
                  src="/label.png"
                  alt="CaterDash Logo"
                  loading="eager"
                  decoding="sync"
                  className="h-20 w-auto object-contain ml-5 flex-shrink-0"
                />
                <div className="flex-grow min-w-0 flex flex-col justify-center mx-4">
                  <h2 className="text-4xl font-bold leading-tight capitalize">{item.name}</h2>
                  {item.tag && (
                    <p className="text-xl text-gray-500 mt-0.5 capitalize">({item.tag})</p>
                  )}
                </div>
              </div>
            ))}
            {(pageTitle || pages.length > 1) && (
              <div className="mt-auto self-end pr-4 pb-2 text-right text-gray-500">
                {pageTitle && <p className="text-sm font-medium">{pageTitle}</p>}
                <p className="text-xs">Page {pageIndex + 1} of {pages.length}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
