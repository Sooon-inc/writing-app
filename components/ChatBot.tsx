"use client";

import { useEffect, useRef, useState } from "react";
import type { SelectedTarget } from "./OutputTable";

export type { SelectedTarget };

export type ChatOutput =
  | { type: "meo" | "portal"; data: Record<string, unknown> }
  | { type: "hp"; data: Record<string, Record<number, string>>; themes: Record<string, string> }
  | { type: "lp"; data: Record<number, string> };

export type UpdatePayload =
  | { kind: "output"; diff: Record<string, unknown> }
  | { kind: "hp"; diff: Record<string, Record<string, string>> }
  | { kind: "lp"; diff: Record<string, string> };

interface Message {
  role: "user" | "assistant";
  content: string;
  updates?: UpdatePayload | null;
  applied?: boolean;
}

interface Props {
  projectId: string;
  currentOutput: ChatOutput;
  onApply: (updates: UpdatePayload) => Promise<void>;
  selectedTarget?: SelectedTarget | null;
  onClearTarget?: () => void;
}

export default function ChatBot({ projectId, currentOutput, onApply, selectedTarget, onClearTarget }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // 選択が変わったらパネルを開く
  useEffect(() => {
    if (selectedTarget) setIsOpen(true);
  }, [selectedTarget]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: trimmed,
          history,
          currentOutput,
          selectedTarget: selectedTarget ?? null,
        }),
      });
      const data = await res.json() as { reply: string; updates?: UpdatePayload | null };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, updates: data.updates ?? null },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "エラーが発生しました。もう一度お試しください。", updates: null },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleApply = async (msgIndex: number, updates: UpdatePayload) => {
    setApplying(msgIndex);
    await onApply(updates);
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, applied: true } : m))
    );
    setApplying(null);
    onClearTarget?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      send();
    }
  };

  const hasSelection = !!selectedTarget;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors"
        style={{ bottom: "50%", transform: "translateY(50%)" }}
        title="修正アシスタント"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223 3.08 3.08 0 001.396-.114z" clipRule="evenodd" />
        </svg>
        {/* 選択中バッジ */}
        {hasSelection && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            right: "5.5rem",
            bottom: "50%",
            transform: "translateY(50%)",
            width: "400px",
            height: "70vh",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm font-semibold text-gray-800">修正アシスタント</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none w-6 h-6 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center mt-4 space-y-2">
                <p className="text-xs text-gray-400">
                  出力の行をクリックして修正対象を選んでから<br />修正内容を入力してください
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : "order-none"}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-gray-100 text-gray-800 rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Update preview card */}
                  {msg.role === "assistant" && msg.updates && (
                    <div className="mt-2 border border-yellow-300 bg-yellow-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-yellow-700 mb-2">修正案</p>
                      <div className="text-xs text-gray-700 space-y-1 mb-3 max-h-32 overflow-y-auto">
                        {msg.updates.kind === "output" &&
                          Object.entries(msg.updates.diff).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-gray-500">{k}:</span> {String(v)}
                            </div>
                          ))}
                        {msg.updates.kind === "lp" &&
                          Object.entries(msg.updates.diff)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([rn, v]) => (
                              <div key={rn}>
                                <span className="text-gray-500">行{rn}:</span> {v}
                              </div>
                            ))}
                        {msg.updates.kind === "hp" &&
                          Object.entries(msg.updates.diff).map(([key, rows]) => (
                            <div key={key}>
                              <p className="text-gray-500 font-medium">{key}</p>
                              {Object.entries(rows)
                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                .map(([rn, v]) => (
                                  <div key={rn} className="ml-2">
                                    <span className="text-gray-400">行{rn}:</span> {v}
                                  </div>
                                ))}
                            </div>
                          ))}
                      </div>
                      {msg.applied ? (
                        <p className="text-xs text-green-600 font-medium">✓ 適用済み</p>
                      ) : (
                        <button
                          onClick={() => handleApply(i, msg.updates!)}
                          disabled={applying === i}
                          className="w-full text-xs font-medium bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white py-1.5 rounded-lg transition-colors"
                        >
                          {applying === i ? "適用中..." : "この変更を適用する"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                  考え中...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-3 space-y-2">
            {/* 選択中の修正対象チップ */}
            {selectedTarget && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-blue-500 shrink-0">
                  <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                <span className="text-xs text-blue-700 flex-1 truncate font-medium">{selectedTarget.displayText}</span>
                <button
                  onClick={onClearTarget}
                  className="text-blue-400 hover:text-blue-600 text-sm leading-none shrink-0"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedTarget ? "修正内容を入力... (⌘+Enter で送信)" : "行をクリックして対象を選択 または 直接入力... (⌘+Enter で送信)"}
                rows={2}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
