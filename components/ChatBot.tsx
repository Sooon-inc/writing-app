"use client";

import { useEffect, useRef, useState } from "react";
import type { SelectedTarget } from "./OutputTable";

export type { SelectedTarget };

export type ChatOutput =
  | { type: "meo" | "portal"; data: Record<string, unknown> }
  | { type: "hp"; data: Record<string, Record<string | number, string>>; themes: Record<string, string> }
  | { type: "lp"; data: Record<string | number, string> };

export type UpdatePayload =
  | { kind: "output"; diff: Record<string, unknown> }
  | { kind: "hp"; diff: Record<string, Record<string, string>> }
  | { kind: "lp"; diff: Record<string, string> };

interface Message {
  role: "user" | "assistant";
  content: string;
  updates?: UpdatePayload | null;
  applied?: boolean;
  applyError?: string;
  instruction?: string;
  targets?: SelectedTarget[];
  learned?: boolean;
  learning?: boolean;
  learnError?: string;
}

interface Props {
  projectId: string;
  currentOutput: ChatOutput;
  onApply: (updates: UpdatePayload) => Promise<void>;
  selectedTargets?: SelectedTarget[];
  onClearTargets?: () => void;
  embedded?: boolean;
  onClose?: () => void;
  onReplaceAll?: (search: string, replacement: string) => Promise<number>;
}

function previewValue(value: unknown): string {
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value ?? "");
}

export default function ChatBot({
  projectId,
  currentOutput,
  onApply,
  selectedTargets = [],
  onClearTargets,
  embedded = false,
  onClose,
  onReplaceAll,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const [searchWord, setSearchWord] = useState("");
  const [replacementWord, setReplacementWord] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [replaceResult, setReplaceResult] = useState("");
  const [learningModal, setLearningModal] = useState<{ msgIndex: number; msg: Message } | null>(null);
  const [learningBackground, setLearningBackground] = useState("");
  const [learningSaving, setLearningSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // 選択が変わったらパネルを開く
  useEffect(() => {
    if (!embedded && selectedTargets.length > 0 && window.innerWidth >= 900) setIsOpen(true);
  }, [embedded, selectedTargets.length]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const targetSnapshot = selectedTargets.map((target) => ({ ...target }));
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
          selectedTargets,
        }),
      });
      const data = await res.json() as { reply: string; updates?: UpdatePayload | null };
      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
        updates: data.updates ?? null,
        instruction: trimmed,
        targets: targetSnapshot,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.updates) {
        const targetIndex = messages.length + 1;
        setApplying(targetIndex);
        try {
          await onApply(data.updates);
          setMessages((prev) =>
            prev.map((m, i) => (i === targetIndex ? { ...m, applied: true, applyError: "" } : m))
          );
          onClearTargets?.();
        } catch (error) {
          setMessages((prev) =>
            prev.map((m, i) =>
              i === targetIndex
                ? { ...m, applyError: error instanceof Error ? error.message : "修正の反映に失敗しました" }
                : m
            )
          );
        } finally {
          setApplying(null);
        }
      }
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
    onClearTargets?.();
  };

  const openLearningModal = (msgIndex: number, msg: Message) => {
    if (!msg.updates || msg.learned || msg.learning) return;
    setLearningModal({ msgIndex, msg });
    setLearningBackground("");
  };

  const closeLearningModal = (force = false) => {
    if (learningSaving && !force) return;
    setLearningModal(null);
    setLearningBackground("");
  };

  const handleLearn = async (msgIndex: number, msg: Message, background: string) => {
    if (!msg.updates || msg.learned || msg.learning) return;
    setLearningSaving(true);
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, learning: true, learnError: "" } : m))
    );
    try {
      const res = await fetch("/api/learning-memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          outputType: currentOutput.type,
          instruction: msg.instruction ?? "",
          background,
          assistantReply: msg.content,
          updates: msg.updates,
          targets: msg.targets ?? [],
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "学習保存に失敗しました");
      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, learning: false, learned: true, learnError: "" } : m))
      );
      setLearningSaving(false);
      closeLearningModal(true);
    } catch (error) {
      setLearningSaving(false);
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? { ...m, learning: false, learnError: error instanceof Error ? error.message : "学習保存に失敗しました" }
            : m
        )
      );
    }
  };

  const submitLearning = async () => {
    if (!learningModal) return;
    await handleLearn(learningModal.msgIndex, learningModal.msg, learningBackground);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      send();
    }
  };

  const hasSelection = selectedTargets.length > 0;

  const replaceAll = async () => {
    if (!searchWord || replacing || !onReplaceAll) return;
    setReplacing(true);
    setReplaceResult("");
    try {
      const count = await onReplaceAll(searchWord, replacementWord);
      setReplaceResult(
        count > 0
          ? `${count}箇所を「${replacementWord || "（空欄）"}」へ置換しました`
          : "一致する文字がありませんでした"
      );
    } catch {
      setReplaceResult("置換に失敗しました");
    } finally {
      setReplacing(false);
    }
  };

  return (
    <>
      {!embedded && (
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="fixed right-6 z-50 w-14 h-14 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg flex items-center justify-center transition-colors"
          style={{ bottom: "50%", transform: "translateY(50%)" }}
          title="修正アシスタント"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223 3.08 3.08 0 001.396-.114z" clipRule="evenodd" />
          </svg>
          {hasSelection && <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white" />}
        </button>
      )}

      {/* Panel */}
      {(embedded || isOpen) && (
        <div
          className={embedded
            ? "h-full bg-white flex flex-col overflow-hidden"
            : "fixed z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"}
          style={embedded ? undefined : {
            right: "5.5rem",
            bottom: "50%",
            transform: "translateY(50%)",
            width: "400px",
            height: "70vh",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-300 text-white grid place-items-center text-xs font-bold shadow-md shadow-sky-100">AI</div>
              <div>
                <span className="block text-sm font-semibold text-slate-700">修正アシスタント</span>
                <span className="block text-[10px] text-slate-400">選択した文章をまとめて調整</span>
              </div>
            </div>
            <button
              onClick={() => embedded ? onClose?.() : setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* Global find and replace */}
          {onReplaceAll && (
            <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-600">生成結果を一括置換</p>
                <span className="text-[10px] text-slate-400">全ページ・全項目が対象</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input
                  type="text"
                  value={searchWord}
                  onChange={(event) => {
                    setSearchWord(event.target.value);
                    setReplaceResult("");
                  }}
                  placeholder="置換前"
                  className="min-w-0 border border-slate-200 bg-white rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                <span className="text-slate-300">→</span>
                <input
                  type="text"
                  value={replacementWord}
                  onChange={(event) => {
                    setReplacementWord(event.target.value);
                    setReplaceResult("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      replaceAll();
                    }
                  }}
                  placeholder="置換後（空欄で削除）"
                  className="min-w-0 border border-slate-200 bg-white rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
              <button
                type="button"
                onClick={replaceAll}
                disabled={!searchWord || replacing}
                className="mt-2 w-full rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-slate-200 text-white py-2 text-xs font-bold"
              >
                {replacing ? "置換中..." : "すべて置換"}
              </button>
              {replaceResult && (
                <p className={`mt-1.5 text-[11px] ${replaceResult.includes("失敗") ? "text-red-500" : "text-sky-700"}`}>
                  {replaceResult}
                </p>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center mt-4 space-y-2">
                <p className="text-xs text-gray-400">
                  出力の左側チェックで修正対象を選んでから<br />同じ指示でまとめて修正できます
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
                              <span className="text-gray-500">{k}:</span> <span className="whitespace-pre-wrap">{previewValue(v)}</span>
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
                        <div className="space-y-2">
                          <p className="text-xs text-green-600 font-medium">✓ 適用済み</p>
                          {msg.learned ? (
                            <p className="rounded-lg bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-700">
                              ✓ 今回の修正を学習済み
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openLearningModal(i, msg)}
                              disabled={msg.learning}
                              className="w-full rounded-lg border border-sky-200 bg-white py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50 disabled:text-slate-300 disabled:border-slate-200"
                            >
                              {msg.learning ? "学習保存中..." : "今回の修正を学習させる"}
                            </button>
                          )}
                          {msg.learnError && (
                            <p className="text-[11px] text-red-500">{msg.learnError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-xs text-yellow-700 font-medium">
                            {applying === i ? "修正を反映中..." : "修正を自動反映します"}
                          </p>
                          {msg.applyError && (
                            <>
                              <p className="text-[11px] text-red-500">{msg.applyError}</p>
                              <button
                                onClick={() => handleApply(i, msg.updates!)}
                                disabled={applying === i}
                                className="w-full text-xs font-medium bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white py-1.5 rounded-lg transition-colors"
                              >
                                {applying === i ? "適用中..." : "手動で再適用する"}
                              </button>
                            </>
                          )}
                        </div>
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
            {hasSelection && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-blue-500 shrink-0">
                  <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                <span className="text-xs text-blue-700 flex-1 truncate font-medium">
                  {selectedTargets.length}件を選択中
                </span>
                <button
                  onClick={onClearTargets}
                  className="text-blue-400 hover:text-blue-600 text-sm leading-none shrink-0"
                >
                  ×
                </button>
                </div>
                <div className="mt-1 max-h-20 overflow-y-auto space-y-0.5">
                  {selectedTargets.map((target) => (
                    <p key={target.id} className="truncate text-[11px] text-blue-700">
                      {target.displayText}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasSelection ? "選択中の項目へ同じ修正指示を入力... (⌘+Enter で送信)" : "左側チェックで対象を選択 または 直接入力... (⌘+Enter で送信)"}
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

      {learningModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-700">今回の修正を学習させる</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                なぜこの修正をしたのか、今後も守りたい判断基準を入力してください。
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-500">修正指示</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
                  {learningModal.msg.instruction || "（指示なし）"}
                </p>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">修正の背景・意図</span>
                <textarea
                  value={learningBackground}
                  onChange={(event) => setLearningBackground(event.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="例：専門用語が多すぎると読者が離脱するため、初心者にも伝わる表現を優先する。地域名は不自然に連呼せず、文脈上必要な箇所だけに入れる。"
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <p className="text-[11px] leading-relaxed text-slate-400">
                入力内容は次回以降の修正アシスタントで、文体・判断基準・言い換え方の参考として使用します。
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => closeLearningModal()}
                disabled={learningSaving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submitLearning}
                disabled={learningSaving}
                className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600 disabled:bg-slate-300"
              >
                {learningSaving ? "保存中..." : "背景も含めて学習する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
