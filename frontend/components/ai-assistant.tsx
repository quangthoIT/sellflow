"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Bot, User, X } from "lucide-react";
import { executeAICommand, getQuickActions, type AIResult } from "@/lib/ai-assistant";
import { useNav } from "@/lib/nav";
import { toast } from "sonner";

type Message = {
  role: "user" | "ai";
  text: string;
  details?: string[];
  quoteId?: string;
  pending?: boolean;
};

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [processing, setProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { navigate } = useNav();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (cmd?: string) => {
    const command = (cmd ?? input).trim();
    if (!command || processing) return;

    setInput("");
    setProcessing(true);
    setMessages((prev) => [...prev, { role: "user", text: command }]);

    try {
      const result: AIResult = await executeAICommand(command);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: result.summary,
          details: result.details,
          quoteId: result.quoteId,
        },
      ]);

      if (result.action === "create_quote" && result.quoteId) {
        toast.success("Đã tạo báo giá tự động");
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Có lỗi xảy ra. Vui lòng thử lại." },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const handleViewQuote = (quoteId: string) => {
    setOpen(false);
    navigate("quotes", { id: quoteId });
  };

  const quickActions = getQuickActions();

  return (
    <>
      {/* Floating bubble button */}
      <Button
        onClick={() => setOpen((v) => !v)}
        size="icon"
        className="fixed bottom-6 right-4 z-50 size-14 rounded-full shadow-lg transition-transform hover:scale-105 sm:right-6"
        title="Trợ lý AI"
        aria-label="Mở trợ lý AI"
      >
        <Sparkles className="size-6" />
      </Button>

      {/* Chat bubble panel */}
      {open && (
        <section
          aria-label="Trợ lý AI"
          className="fixed bottom-24 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border bg-background shadow-2xl sm:right-6"
        >
          <header className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </div>
              Trợ lý AI
              <Badge variant="secondary" className="text-xs">Beta</Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setOpen(false)}
              aria-label="Đóng trợ lý AI"
            >
              <X className="size-4" />
            </Button>
          </header>
          <Separator />

          {/* Messages area */}
          <ScrollArea className="h-[min(55vh,400px)] px-4 py-3" ref={scrollRef}>
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Xin chào!</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tôi có thể tạo báo giá, kiểm tra tồn kho, công nợ bằng lệnh tự nhiên
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {quickActions.map((qa) => (
                      <Button
                        key={qa.label}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleSend(qa.command)}
                      >
                        {qa.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="size-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}>
                    <p>{msg.text}</p>
                    {msg.details && msg.details.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                        {msg.details.map((d, i) => (
                          <p key={i} className="text-xs text-muted-foreground">{d}</p>
                        ))}
                      </div>
                    )}
                    {msg.quoteId && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-2 h-auto p-0 text-xs"
                        onClick={() => handleViewQuote(msg.quoteId!)}
                      >
                        Xem báo giá →
                      </Button>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary">
                      <User className="size-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {processing && (
                <div className="flex gap-2 justify-start">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2">
                    <div className="flex gap-1">
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Nhập lệnh... ví dụ: Báo giá cho khách A sản phẩm X x 2"
                rows={1}
                className="min-h-[40px] max-h-[120px] resize-none text-sm"
                disabled={processing}
              />
              <Button
                onClick={() => handleSend()}
                disabled={processing || !input.trim()}
                size="icon"
                className="shrink-0"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
