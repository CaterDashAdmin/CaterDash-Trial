"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";

interface LabelItem {
  name: string;
  tag?: string;
  inline?: boolean;
  forceNewLine?: boolean;
}

const DEFAULT_MENU_ITEMS = `Chicken Sandwiches
Roast Beef Sandwiches
Salami & Swiss Sandwiches
Prosciutto & Brie Sandwiches
Veggie Sandwiches \\tag{Veg}
Fruit Cups
Chicken Shawarma Rice Bowls
Beef Shawarma Rice Bowls
Falafel Rice Bowls \\tag{Vegan}`;

const MAX_TEXT_WIDTH = 680;
const LABELS_PER_PAGE = 5;

let measureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(text: string) {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = "700 36px ui-sans-serif, system-ui, sans-serif";
  return ctx.measureText(text).width;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export default function LabelMaker() {
  const [inputText, setInputText] = useState("");
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [pageTitle, setPageTitle] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const generateLabels = (text: string) => {
    const lines = text.split("\n").filter(Boolean);
    const parsed = lines.map((line) => {
      const forceNewLine = line.includes("\\n");
      const cleanedLine = line.replace(/\\n/g, "\n").trim();
      const tagMatches = [...cleanedLine.matchAll(/\\tag\{([^}]+)\}/g)];
      const name = cleanedLine.replace(/\\tag\{[^}]+\}/g, "").trim();
      const tag = tagMatches.length > 0 ? tagMatches.map((m) => m[1]).join(" · ") : undefined;
      return { name, tag, forceNewLine };
    });
    setLabels(parsed);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    generateLabels(val);
  };

  const loadExample = () => {
    setInputText(DEFAULT_MENU_ITEMS);
    generateLabels(DEFAULT_MENU_ITEMS);
  };

  const clearAll = () => {
    setInputText("");
    setLabels([]);
    setPageTitle("");
  };

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

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

  const computedLabels = useMemo(() => {
    return labels.map((item) => ({ ...item, inline: !item.forceNewLine }));
  }, [labels]);

  const pages = useMemo(() => {
    return chunkArray(computedLabels, LABELS_PER_PAGE);
  }, [computedLabels]);

  if (!isMounted) return null;

  return (
    <div className="min-h-screen print:bg-white print:p-0">
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.25in;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-page {
            page-break-after: always;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .print-page:last-child {
            page-break-after: avoid;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <header className="no-print bg-white border-b border-gray-300 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  CaterDash Labels
                </h1>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              disabled={computedLabels.length === 0}
              className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Print Labels
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="no-print max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Input */}
          <div className="space-y-4">
            {/* Page Title Input */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Page Title
                <span className="font-normal text-gray-400 ml-1">
                  (optional)
                </span>
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm transition-shadow"
                placeholder="e.g., Monday Lunch - ABC Company"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
              />
              <p className="mt-2 text-xs text-gray-400">
                Appears in the bottom right of each page
              </p>
            </div>

            {/* Menu Items Input */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Menu Items
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={loadExample}
                    className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Load example
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={clearAll}
                    className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <textarea
                className="w-full h-64 px-4 py-3 border border-gray-200 rounded-lg font-mono text-sm transition-shadow resize-none"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Enter items, one per line&#10;&#10;Add sub text:&#10;Veggie Wrap \tag{Vegan}&#10;&#10;Multiple tags:&#10;Chicken Wrap \tag{Halal}\tag{GF}&#10;&#10;Extra spacing before tag:&#10;Long Food Name \n\tag{Halal}"
              />

              {/* Instruction Panel */}
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 font-mono">
                <div className="font-sans font-semibold text-gray-600 mb-2 text-xs uppercase tracking-wide">Commands</div>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <span className="text-gray-800 font-semibold whitespace-nowrap">\tag{"{...}"}</span>
                    <div>
                      <div className="text-gray-600">Add sub text (stackable)</div>
                      <div className="text-gray-400">Chicken Wrap \tag{"{Halal}"}\tag{"{GF}"}</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-800 font-semibold whitespace-nowrap">\n</span>
                    <div>
                      <div className="text-gray-600">Force sub text to new line</div>
                      <div className="text-gray-400">Long Food Name \n\tag{"{Halal}"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    <span className="font-medium">{computedLabels.length}</span>{" "}
                    labels
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="font-medium">{pages.length}</span> page
                    {pages.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-gray-400 text-xs">5 labels per page</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Preview Header */}
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  On-screen preview (not to scale)
                </h2>
              </div>
            </div>

            {/* Preview Content */}
            <div ref={previewContainerRef} className="p-4 bg-gray-200 h-[479px] overflow-y-auto">
              {computedLabels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg
                    className="w-16 h-16 mb-4 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <p className="text-sm font-medium">No labels yet</p>
                  <p className="text-xs mt-1">
                    Enter menu items or load an example
                  </p>
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
                        }}
                      >
                        {pageLabels.map((item, index) => (
                          <div
                            key={index}
                            style={{ width: 944, height: 132 }}
                            className="border-b border-r border-gray-300 bg-white flex items-center px-6 gap-6 overflow-hidden"
                          >
                            <img
                              src="/label.png"
                              alt="CaterDash Logo"
                              className="h-20 w-auto object-contain ml-5 flex-shrink-0"
                            />
                            <div className="flex-grow min-w-0 flex flex-col justify-center mx-4">
                              {item.inline ? (
                                <h2 className="text-4xl font-bold" style={{ whiteSpace: "pre-line" }}>
                                  {item.name}{" "}
                                  {item.tag && (
                                    <span className="text-gray-800">({item.tag})</span>
                                  )}
                                </h2>
                              ) : (
                                <>
                                  <h2 className="text-4xl font-bold" style={{ whiteSpace: "pre-line" }}>{item.name}</h2>
                                  {item.tag && (
                                    <p className="text-xl italic text-gray-600 mt-1">
                                      ({item.tag})
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {Array.from({
                          length: LABELS_PER_PAGE - pageLabels.length,
                        }).map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            style={{ width: 944, height: 132 }}
                            className="border-b border-r border-gray-300 bg-white"
                          />
                        ))}
                        {(pageTitle || pages.length > 1) && (
                          <div className="absolute bottom-2 right-4 text-right text-gray-500">
                            {pageTitle && (
                              <p className="text-sm font-medium">{pageTitle}</p>
                            )}
                            <p className="text-xs">
                              Page {pageIndex + 1} of {pages.length}
                            </p>
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

      {/* Print Layout - Hidden on screen */}
      <div className="hidden print:block">
        {pages.map((pageLabels, pageIndex) => (
          <div
            key={pageIndex}
            className="print-page flex flex-col w-full relative"
          >
            {/* Labels on this page */}
            {pageLabels.map((item, index) => (
              <div
                key={index}
                style={{ width: "9.83in", height: "1.374in" }}
                className="border-b border-r border-gray-300 bg-white flex items-center px-6 gap-6 overflow-hidden"
              >
                <img
                  src="/label.png"
                  alt="CaterDash Logo"
                  loading="eager"
                  decoding="sync"
                  className="h-20 w-auto object-contain ml-5 flex-shrink-0"
                />

                <div className="flex-grow min-w-0 flex flex-col justify-center mx-4">
                  {item.inline ? (
                    <h2 className="text-4xl font-bold" style={{ whiteSpace: "pre-line" }}>
                      {item.name}{" "}
                      {item.tag && (
                        <span className="text-gray-800">({item.tag})</span>
                      )}
                    </h2>
                  ) : (
                    <>
                      <h2 className="text-4xl font-bold" style={{ whiteSpace: "pre-line" }}>{item.name}</h2>
                      {item.tag && (
                        <p className="text-xl italic text-gray-600 mt-1">
                          ({item.tag})
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Bottom right: title and page number */}
            {(pageTitle || pages.length > 1) && (
              <div className="absolute bottom-2 right-4 text-right text-gray-500">
                {pageTitle && (
                  <p className="text-sm font-medium">{pageTitle}</p>
                )}
                <p className="text-xs">
                  Page {pageIndex + 1} of {pages.length}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
