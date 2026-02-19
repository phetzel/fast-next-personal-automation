"use client";

import { useEffect, useRef, useCallback } from "react";
import { useChat, useLocalChat } from "@/hooks";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { Button } from "@/components/ui";
import { Wifi, WifiOff, RotateCcw, Bot } from "lucide-react";
import { useConversationStore, useChatStore, useAuthStore } from "@/stores";
import { useConversations } from "@/hooks";
interface ChatContainerProps {
  useLocalStorage?: boolean;
  area?: string;
  showAreaBanner?: boolean;
}

export function ChatContainer({
  useLocalStorage = false,
  area,
  showAreaBanner = false,
}: ChatContainerProps) {
  const { isAuthenticated } = useAuthStore();

  const shouldUseLocal = useLocalStorage || !isAuthenticated;

  if (shouldUseLocal) {
    return <LocalChatContainer />;
  }

  return <AuthenticatedChatContainer area={area} showAreaBanner={showAreaBanner} />;
}

interface AuthenticatedChatContainerProps {
  area?: string;
  showAreaBanner?: boolean;
}

function AuthenticatedChatContainer({ area, showAreaBanner }: AuthenticatedChatContainerProps) {
  const { currentConversationId, currentMessages } = useConversationStore();
  const { setMessages: setChatMessages } = useChatStore();
  const { fetchConversations } = useConversations();

  // Sync conversation messages to chat store when loading a conversation from sidebar
  // This replaces all messages atomically to avoid race conditions
  useEffect(() => {
    const convertedMessages = currentMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      timestamp: new Date(msg.created_at),
      toolCalls: msg.tool_calls?.map((tc) => ({
        id: tc.tool_call_id,
        name: tc.tool_name,
        args: tc.args,
        result: tc.result,
        status: (tc.status === "failed" ? "error" : tc.status) as
          | "pending"
          | "running"
          | "completed"
          | "error",
      })),
    }));
    setChatMessages(convertedMessages);
  }, [currentMessages, setChatMessages]);

  const handleConversationCreated = useCallback(
    () => {
      // Refresh conversation list when a new conversation is created
      fetchConversations();
    },
    [fetchConversations]
  );

  const { messages, isConnected, isProcessing, connect, disconnect, sendMessage, clearMessages } =
    useChat({
      conversationId: currentConversationId,
      area,
      onConversationCreated: handleConversationCreated,
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ChatUI
      messages={messages}
      isConnected={isConnected}
      isProcessing={isProcessing}
      sendMessage={sendMessage}
      clearMessages={clearMessages}
      messagesEndRef={messagesEndRef}
      area={area}
      showAreaBanner={showAreaBanner}
    />
  );
}

function LocalChatContainer() {
  const { messages, isConnected, isProcessing, connect, disconnect, sendMessage, clearMessages } =
    useLocalChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ChatUI
      messages={messages}
      isConnected={isConnected}
      isProcessing={isProcessing}
      sendMessage={sendMessage}
      clearMessages={clearMessages}
      messagesEndRef={messagesEndRef}
    />
  );
}

interface ChatUIProps {
  messages: import("@/types").ChatMessage[];
  isConnected: boolean;
  isProcessing: boolean;
  sendMessage: (content: string) => void;
  clearMessages: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  area?: string;
  showAreaBanner?: boolean;
}

// Area-specific configurations
const AREA_INFO: Record<string, { title: string; description: string; icon: typeof Bot }> = {
  jobs: {
    title: "Jobs Assistant",
    description: "I help you search for jobs, manage profiles, and track applications.",
    icon: Bot,
  },
};

function ChatUI({
  messages,
  isConnected,
  isProcessing,
  sendMessage,
  clearMessages,
  messagesEndRef,
  area,
  showAreaBanner,
}: ChatUIProps) {
  const areaInfo = area ? AREA_INFO[area] : null;
  const displayTitle = areaInfo?.title || "AI Assistant";
  const displayDescription = areaInfo?.description || "Start a conversation to get help";

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
      {/* Area banner */}
      {showAreaBanner && area && areaInfo && (
        <div className="mx-2 mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:mx-4 sm:mt-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {area.toUpperCase()}
            </span>
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Specialized assistant with access to {area}-related tools only
            </span>
          </div>
        </div>
      )}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-4 sm:px-4 sm:py-6">
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-4">
            <div className="bg-secondary flex h-14 w-14 items-center justify-center rounded-full sm:h-16 sm:w-16">
              <Bot className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <div className="px-4 text-center">
              <p className="text-foreground text-base font-medium sm:text-lg">{displayTitle}</p>
              <p className="text-sm">{displayDescription}</p>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-2 pb-2 sm:px-4 sm:pb-4">
        <div className="bg-card rounded-xl border p-3 shadow-sm sm:p-4">
          <ChatInput
            onSend={sendMessage}
            disabled={!isConnected || isProcessing}
            isProcessing={isProcessing}
          />
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
              )}
              <span className="text-muted-foreground text-xs">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearMessages} className="h-8 px-3 text-xs">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
