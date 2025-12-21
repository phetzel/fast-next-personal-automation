"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import { ToolCallCard } from "./tool-call-card";
import { MarkdownContent } from "./markdown-content";
import { CopyButton } from "./copy-button";
import { User, Bot } from "lucide-react";

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("group flex gap-2 py-3 sm:gap-4 sm:py-4", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9",
          isUser ? "bg-primary text-primary-foreground" : "bg-orange-500/10 text-orange-500"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 sm:h-5 sm:w-5" />}
      </div>

      <div
        className={cn(
          "max-w-[88%] flex-1 space-y-2 overflow-hidden sm:max-w-[85%]",
          isUser && "flex flex-col items-end"
        )}
      >
        {/* Only show message bubble if there's content or if it's streaming without tool calls */}
        {(message.content ||
          (message.isStreaming && (!message.toolCalls || message.toolCalls.length === 0))) && (
          <div
            className={cn(
              "relative rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5",
              isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"
            )}
          >
            {isUser ? (
              <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose-sm max-w-none text-sm">
                <MarkdownContent content={message.content} />
                {message.isStreaming && (
                  <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-current" />
                )}
              </div>
            )}

            {!isUser && message.content && !message.isStreaming && (
              <div className="absolute -top-1 -right-1 sm:opacity-0 sm:group-hover:opacity-100">
                <CopyButton
                  text={message.content}
                  className="bg-background/80 hover:bg-background shadow-sm"
                />
              </div>
            )}
          </div>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full space-y-2">
            {message.toolCalls.map((toolCall) => (
              <ToolCallCard key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
