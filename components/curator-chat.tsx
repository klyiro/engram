"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Brain, Paperclip, Square } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { CURATOR_MODELS, DEFAULT_CURATOR_MODEL } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function CuratorChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_CURATOR_MODEL);
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [activity, setActivity] = useState<string>(""); // "thinking" | "reading …"
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText, activity]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setError("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setStreamText("");
    setActivity("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = "";
    try {
      const res = await fetch("/api/curator/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, model, thinking }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5).trim());
          if (ev.type === "text") {
            acc += ev.text;
            setActivity("");
            setStreamText(acc);
          } else if (ev.type === "thinking") {
            setActivity("thinking…");
          } else if (ev.type === "tool") {
            const verb = ev.name === "brain_search" ? "searching the vault…" : ev.name === "brain_read" ? "reading a note…" : "checking the vault…";
            setActivity(verb);
          } else if (ev.type === "error") {
            setError(ev.message || "error");
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "stream failed");
    } finally {
      if (acc.trim()) setMessages((m) => [...m, { role: "assistant", content: acc }]);
      setStreamText("");
      setActivity("");
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function attach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 200_000) {
      setError("File too large (max 200KB text).");
      return;
    }
    const content = await file.text();
    setInput((v) => `Attached file \`${file.name}\`:\n\n\`\`\`\n${content}\n\`\`\`\n\n${v}`);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <Brain size={15} className="text-muted-foreground" />
        <span className="text-sm font-medium">Curator</span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger size="sm" className="w-auto text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURATOR_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setThinking((t) => !t)}
            title="Extended thinking"
            className={thinking ? "border-primary/40 text-foreground" : "text-muted-foreground"}
          >
            <span className={`size-1.5 rounded-full ${thinking ? "bg-emerald-500" : "bg-muted-foreground/40"}`} /> thinking
          </Button>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => { setMessages([]); setError(""); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scrollbar-none flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Ask the Curator about your brain. It reads your notes to answer — try
              <span className="text-foreground"> “what did we decide about pricing?”</span> or
              <span className="text-foreground"> “summarize the Shroom Shop thread.”</span>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-3.5 py-2 text-sm">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="text-sm">
                <Markdown content={m.content} resolve={(s) => `/n/${s}`} />
              </div>
            ),
          )}
          {streaming && (
            <div className="text-sm">
              {streamText ? (
                <Markdown content={streamText} resolve={(s) => `/n/${s}`} />
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
                  {activity || "…"}
                </div>
              )}
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <Button asChild variant="outline" size="icon" className="shrink-0 cursor-pointer text-muted-foreground" title="Attach a text file">
            <label>
              <Paperclip size={15} />
              <input type="file" accept=".md,.txt,.json,.csv,.ts,.tsx,.js,.py,text/*" className="hidden" onChange={attach} />
            </label>
          </Button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask the Curator…"
            rows={1}
            className="scrollbar-none max-h-40 min-h-9 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
          />
          {streaming ? (
            <Button onClick={stop} size="icon" className="shrink-0" title="Stop">
              <Square size={13} className="fill-current" />
            </Button>
          ) : (
            <Button onClick={send} disabled={!input.trim()} size="icon" className="shrink-0" title="Send">
              <ArrowUp size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
