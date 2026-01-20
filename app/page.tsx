"use client";

import React, { useState, useEffect, useMemo } from "react";

interface LabelItem {
  name: string;
  tag?: string;
  inline?: boolean;
}

const DEFAULT_MENU_ITEMS = `Example Items:
Chicken Sandwiches
Roast Beef Sandwiches
Salami & Swiss Sandwiches
Prosciutto & Brie Sandwiches
Veggie Sandwiches (Veg)
Fruit Cups
Chicken Shawarma Rice Bowls
Beef Shawarma Rice Bowls
Falafel Rice Bowls (Vegan)`;

const MAX_TEXT_WIDTH = 680;

let measureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(text: string) {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return 0;

  ctx.font = "700 36px ui-sans-serif, system-ui, sans-serif";
  return ctx.measureText(text).width;
}

export default function LabelMaker() {
  const [inputText, setInputText] = useState(DEFAULT_MENU_ITEMS);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    generateLabels(DEFAULT_MENU_ITEMS);
  }, []);

  const generateLabels = (text: string) => {
    const lines = text.split("\n").filter(Boolean);

    const parsed = lines.map((line) => {
      const tagMatch = line.match(/\(([^)]+)\)/);
      const name = line.replace(/\([^)]+\)/, "").trim();
      const tag = tagMatch ? tagMatch[1] : undefined;

      return { name, tag };
    });

    setLabels(parsed);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    generateLabels(val);
  };

  const computedLabels = useMemo(() => {
    if (!isMounted) return labels;

    return labels.map((item) => {
      if (!item.tag) return { ...item, inline: true };

      const width = measureTextWidth(`${item.name} (${item.tag})`);
      return { ...item, inline: width < MAX_TEXT_WIDTH };
    });
  }, [labels, isMounted]);

  if (!isMounted) return null;

  return (
    <div className="p-8 bg-gray-50 min-h-screen print:bg-white print:p-0">
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="print:hidden max-w-2xl mx-auto mb-10 bg-white p-6 rounded-lg shadow border">
        <h1 className="text-2xl font-bold mb-4">CaterDash Label Generator</h1>

        <textarea
          className="w-full h-64 p-3 border rounded-md mb-4 font-mono text-sm"
          value={inputText}
          onChange={handleInputChange}
        />

        <button
          onClick={() => window.print()}
          className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700"
        >
          Print Labels
        </button>
      </div>

      {/* Labels */}
      <div className="flex flex-col w-full">
        {computedLabels.map((item, index) => (
          <div
            key={index}
            style={{ width: "9.83in", height: "1.374in" }}
            className="border-b border-r bg-white flex items-center justify-between px-6 gap-6 overflow-hidden break-inside-avoid"
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
                <h2 className="text-4xl font-bold">
                  {item.name}{" "}
                  {item.tag && (
                    <span className="text-gray-800">({item.tag})</span>
                  )}
                </h2>
              ) : (
                <>
                  <h2 className="text-4xl font-bold">{item.name}</h2>
                  {item.tag && (
                    <p className="text-2xl italic text-gray-600 mt-1 truncate">
                      ({item.tag})
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
