"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Copy, Check, RefreshCw, Sparkles, Square } from "lucide-react";
import { api, errorMessage, streamText } from "@/lib/client";
import { useHubConfig } from "@/lib/hooks";
import { cx, truncate } from "@/lib/format";
import type { ChatMessage, Thread } from "@/lib/types";
import { Markdown } from "./Markdown";
import { ModelPicker, type ModelChoice } from "./ModelPicker";
import { Button, ErrorBanner, Spinner } from "./ui";

const HUB_SUGGESTIONS = [
  "What's the status across all my projects right now?",
  "What's blocked, and who's waiting on what?",
  "Summarise everything that happened this week.",
  "What should I prioritise next?",
];

const PROJECT_SUGGESTIONS = [
  "Bring me up to speed on this project — I'm new to it.",
  "What's the current status and what's blocking us?",
  "Summarise the decisions made so far.",
  "Draft a status update I can send to stakeholders.",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard is blocked without a secure context — nothing to do.
        }
      }}
      title="Copy"
      aria-label="Copy message"
      className="rounded-md p-1 text-ink-faint opacity-0 transition-all group-hover:opacity-100 hover:bg-surface-2 hover:text-ink"
    >
      {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
    </button>
  );
}

export function ChatPanel({
  projectId = null,
  threadId = null,
  onThreadCreated,
  onThreadUpdated,
  className,
  heading,
}: {
  /** null = hub-wide: the model sees every project. */
  projectId?: string | null;
  threadId?: string | null;
  onThreadCreated?: (thread: Thread) => void;
  onThreadUpdated?: (thread: Thread) => void;
  className?: string;
  heading?: string;
}) {
  const config = useHubConfig();
  const [choice, setChoice] = useState<ModelChoice>({ provider: undefined, model: undefined });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The thread this panel is writing into; null until one exists.
  const activeThreadRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ----- load the selected thread ----- */
  useEffect(() => {
    // The parent echoes back the id of a thread this panel just created. The
    // transcript is already on screen, so don't refetch and flicker.
    if (threadId && threadId === activeThreadRef.current) return;

    activeThreadRef.current = threadId;
    if (!threadId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingThread(true);
    api
      .get<Thread>(`/api/threads/${threadId}`)
      .then((thread) => {
        if (cancelled) return;
        setMessages(thread.messages ?? []);
        if (thread.provider || thread.model) {
          setChoice({
            provider: (thread.provider as ModelChoice["provider"]) || undefined,
            model: thread.model || undefined,
          });
        }
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoadingThread(false));

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  /* ----- keep the transcript pinned to the bottom ----- */
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, streaming]);

  /* ----- stop streaming if the panel goes away ----- */
  useEffect(() => () => abortRef.current?.abort(), []);

  const persist = useCallback(
    async (next: ChatMessage[]) => {
      try {
        const payload = {
          messages: next,
          provider: choice.provider ?? config?.defaultProvider ?? "anthropic",
          model: choice.model ?? "",
        };

        if (activeThreadRef.current) {
          const thread = await api.patch<Thread>(
            `/api/threads/${activeThreadRef.current}`,
            payload,
          );
          onThreadUpdated?.(thread);
        } else {
          const firstUser = next.find((message) => message.role === "user");
          const thread = await api.post<Thread>("/api/threads", {
            ...payload,
            projectId,
            title: truncate(firstUser?.content ?? "New chat", 60),
          });
          activeThreadRef.current = thread._id;
          onThreadCreated?.(thread);
        }
      } catch {
        // The conversation is still on screen; a failed save shouldn't
        // interrupt it. The next turn will try again.
      }
    },
    [choice, config, projectId, onThreadCreated, onThreadUpdated],
  );

  const run = useCallback(
    async (history: ChatMessage[]) => {
      setStreaming(true);
      setError(null);
      setMessages([...history, { role: "assistant", content: "" }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const full = await streamText(
          "/api/chat",
          {
            messages: history.map(({ role, content }) => ({ role, content })),
            projectId,
            provider: choice.provider,
            model: choice.model,
          },
          (_delta, soFar) => {
            setMessages([...history, { role: "assistant", content: soFar }]);
          },
          controller.signal,
        );

        const next: ChatMessage[] = [
          ...history,
          { role: "assistant", content: full || "_(empty response)_" },
        ];
        setMessages(next);
        void persist(next);
      } catch (err) {
        setError(errorMessage(err));
        setMessages(history);
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [choice, persist, projectId],
  );

  function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    void run([...messages, { role: "user", content: text }]);
  }

  /** Drop the last answer and ask again. */
  function regenerate() {
    const lastUser = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUser === -1) return;
    const cutoff = messages.length - lastUser;
    void run(messages.slice(0, cutoff));
  }

  const suggestions = projectId ? PROJECT_SUGGESTIONS : HUB_SUGGESTIONS;
  const empty = messages.length === 0 && !loadingThread;

  return (
    <div className={cx("flex min-h-0 flex-col", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles size={15} className="shrink-0 text-accent-soft" />
          <span className="truncate text-sm font-medium text-ink">
            {heading ?? (projectId ? "Project assistant" : "Hub assistant")}
          </span>
          <span className="hidden truncate text-xs text-ink-faint sm:inline">
            · sees {projectId ? "this project" : "every project"}
          </span>
        </div>
        <ModelPicker config={config} value={choice} onChange={setChoice} compact />
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {loadingThread ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : empty ? (
          <div className="mx-auto max-w-2xl py-8 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/25">
              <Sparkles size={20} className="text-accent-soft" />
            </div>
            <h3 className="font-medium text-ink">Ask about your work</h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-faint">
              It can read your {projectId ? "project's" : "projects,"} tasks, meeting minutes and
              documents — ask for a status, a summary, or a draft.
            </p>
            <div className="mx-auto mt-5 grid max-w-xl gap-2 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-left text-[13px] text-ink-dim transition-colors hover:border-accent/40 hover:text-ink"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message, index) => {
              const isLast = index === messages.length - 1;
              const isUser = message.role === "user";

              return (
                <div
                  key={index}
                  className={cx("group flex gap-3", isUser && "justify-end")}
                >
                  {!isUser && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/25">
                      <Sparkles size={13} className="text-accent-soft" />
                    </div>
                  )}

                  <div className={cx("min-w-0", isUser ? "max-w-[85%]" : "flex-1")}>
                    {isUser ? (
                      <div className="rounded-xl rounded-br-sm border border-line bg-surface-2 px-3.5 py-2.5 text-sm whitespace-pre-wrap text-ink">
                        {message.content}
                      </div>
                    ) : (
                      <>
                        <Markdown
                          compact
                          className={cx(streaming && isLast && !message.content && "min-h-5")}
                        >
                          {message.content}
                        </Markdown>
                        {streaming && isLast && (
                          <span className="stream-caret" aria-label="Generating" />
                        )}
                        {!streaming && message.content && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <CopyButton text={message.content} />
                            {isLast && (
                              <button
                                onClick={regenerate}
                                title="Regenerate"
                                aria-label="Regenerate answer"
                                className="rounded-md p-1 text-ink-faint opacity-0 transition-all group-hover:opacity-100 hover:bg-surface-2 hover:text-ink"
                              >
                                <RefreshCw size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line px-4 py-3">
        <div className="mx-auto max-w-3xl space-y-2">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <div className="flex items-end gap-2 rounded-xl border border-line bg-surface-2 p-2 focus-within:border-accent/50">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                // Grow with the content, up to a sensible ceiling.
                const node = event.target;
                node.style.height = "auto";
                node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={
                projectId ? "Ask about this project…" : "Ask about any of your projects…"
              }
              className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />

            {streaming ? (
              <Button
                size="icon"
                variant="secondary"
                onClick={() => abortRef.current?.abort()}
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square size={13} className="fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="primary"
                onClick={send}
                disabled={!input.trim()}
                title="Send"
                aria-label="Send message"
              >
                <ArrowUp size={16} />
              </Button>
            )}
          </div>

          <p className="text-center text-[11px] text-ink-faint">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
