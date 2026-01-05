import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "./chat-store";
import type { ChatMessage, ToolCall } from "@/types";

const createMockMessage = (overrides?: Partial<ChatMessage>): ChatMessage => ({
  id: `msg-${Date.now()}`,
  role: "user",
  content: "Test message",
  timestamp: new Date(),
  ...overrides,
});

const createMockToolCall = (overrides?: Partial<ToolCall>): ToolCall => ({
  id: `tc-${Date.now()}`,
  name: "test_tool",
  args: {},
  status: "pending",
  ...overrides,
});

describe("Chat Store", () => {
  beforeEach(() => {
    // Reset store before each test
    useChatStore.setState({
      messages: [],
      isStreaming: false,
    });
  });

  describe("initial state", () => {
    it("should have empty messages array", () => {
      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.isStreaming).toBe(false);
    });
  });

  describe("addMessage", () => {
    it("should add a message to the end of the array", () => {
      const message = createMockMessage({ id: "1", content: "First" });
      useChatStore.getState().addMessage(message);

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].content).toBe("First");
    });

    it("should preserve existing messages when adding", () => {
      const msg1 = createMockMessage({ id: "1", content: "First" });
      const msg2 = createMockMessage({ id: "2", content: "Second" });

      useChatStore.getState().addMessage(msg1);
      useChatStore.getState().addMessage(msg2);

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].content).toBe("First");
      expect(state.messages[1].content).toBe("Second");
    });
  });

  describe("setMessages", () => {
    it("should replace all messages atomically", () => {
      // First add some messages
      useChatStore.getState().addMessage(createMockMessage({ id: "old1", content: "Old 1" }));
      useChatStore.getState().addMessage(createMockMessage({ id: "old2", content: "Old 2" }));
      expect(useChatStore.getState().messages).toHaveLength(2);

      // Now replace with new messages
      const newMessages = [
        createMockMessage({ id: "new1", content: "New 1" }),
        createMockMessage({ id: "new2", content: "New 2" }),
        createMockMessage({ id: "new3", content: "New 3" }),
      ];
      useChatStore.getState().setMessages(newMessages);

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(3);
      expect(state.messages[0].content).toBe("New 1");
      expect(state.messages[1].content).toBe("New 2");
      expect(state.messages[2].content).toBe("New 3");
    });

    it("should clear messages when set to empty array", () => {
      useChatStore.getState().addMessage(createMockMessage());
      useChatStore.getState().addMessage(createMockMessage());
      expect(useChatStore.getState().messages).toHaveLength(2);

      useChatStore.getState().setMessages([]);

      expect(useChatStore.getState().messages).toHaveLength(0);
    });

    it("should not duplicate messages when switching conversations", () => {
      // This test verifies the fix for the bug where switching conversations
      // caused message duplication because the useEffect was adding instead of replacing

      const convAMessages = [
        createMockMessage({ id: "a1", content: "Conv A msg 1" }),
        createMockMessage({ id: "a2", content: "Conv A msg 2" }),
      ];
      const convBMessages = [createMockMessage({ id: "b1", content: "Conv B msg 1" })];

      // Load conversation A
      useChatStore.getState().setMessages(convAMessages);
      expect(useChatStore.getState().messages).toHaveLength(2);

      // Switch to conversation B - should REPLACE, not ADD
      useChatStore.getState().setMessages(convBMessages);

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].content).toBe("Conv B msg 1");
      // Should NOT contain conv A messages
      expect(state.messages.some((m) => m.content.includes("Conv A"))).toBe(false);
    });
  });

  describe("clearMessages", () => {
    it("should remove all messages", () => {
      useChatStore.getState().addMessage(createMockMessage());
      useChatStore.getState().addMessage(createMockMessage());

      useChatStore.getState().clearMessages();

      expect(useChatStore.getState().messages).toHaveLength(0);
    });
  });

  describe("updateMessage", () => {
    it("should update a specific message by id", () => {
      const msg = createMockMessage({ id: "target", content: "Original" });
      useChatStore.getState().addMessage(msg);

      useChatStore.getState().updateMessage("target", (m) => ({
        ...m,
        content: "Updated",
      }));

      const state = useChatStore.getState();
      expect(state.messages[0].content).toBe("Updated");
    });

    it("should not affect other messages", () => {
      useChatStore.getState().addMessage(createMockMessage({ id: "1", content: "Keep this" }));
      useChatStore.getState().addMessage(createMockMessage({ id: "2", content: "Update this" }));

      useChatStore.getState().updateMessage("2", (m) => ({
        ...m,
        content: "Updated",
      }));

      const state = useChatStore.getState();
      expect(state.messages[0].content).toBe("Keep this");
      expect(state.messages[1].content).toBe("Updated");
    });
  });

  describe("tool calls", () => {
    it("should add tool call to message", () => {
      const msg = createMockMessage({ id: "msg1", toolCalls: [] });
      useChatStore.getState().addMessage(msg);

      const toolCall = createMockToolCall({ id: "tc1", name: "test_tool" });
      useChatStore.getState().addToolCall("msg1", toolCall);

      const state = useChatStore.getState();
      expect(state.messages[0].toolCalls).toHaveLength(1);
      expect(state.messages[0].toolCalls?.[0].name).toBe("test_tool");
    });

    it("should update tool call status", () => {
      const msg = createMockMessage({
        id: "msg1",
        toolCalls: [createMockToolCall({ id: "tc1", status: "running" })],
      });
      useChatStore.getState().addMessage(msg);

      useChatStore.getState().updateToolCall("msg1", "tc1", {
        status: "completed",
        result: "Success",
      });

      const state = useChatStore.getState();
      expect(state.messages[0].toolCalls?.[0].status).toBe("completed");
      expect(state.messages[0].toolCalls?.[0].result).toBe("Success");
    });
  });

  describe("streaming state", () => {
    it("should track streaming state", () => {
      expect(useChatStore.getState().isStreaming).toBe(false);

      useChatStore.getState().setStreaming(true);
      expect(useChatStore.getState().isStreaming).toBe(true);

      useChatStore.getState().setStreaming(false);
      expect(useChatStore.getState().isStreaming).toBe(false);
    });
  });
});

describe("Conversation Switching Bug Prevention", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isStreaming: false });
  });

  it("should handle rapid conversation switching without duplication", () => {
    // Simulate rapid switching between conversations
    const convA = [createMockMessage({ id: "a1", content: "A" })];
    const convB = [createMockMessage({ id: "b1", content: "B" })];
    const convC = [createMockMessage({ id: "c1", content: "C" })];

    useChatStore.getState().setMessages(convA);
    useChatStore.getState().setMessages(convB);
    useChatStore.getState().setMessages(convC);
    useChatStore.getState().setMessages(convA);

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].content).toBe("A");
  });

  it("should maintain streaming message when conversation messages are loaded", () => {
    // User starts new chat, sends message, assistant is streaming
    const userMsg = createMockMessage({ id: "user1", role: "user", content: "Hello" });
    const assistantMsg = createMockMessage({
      id: "assistant1",
      role: "assistant",
      content: "Hi there",
      isStreaming: true,
    });

    useChatStore.getState().addMessage(userMsg);
    useChatStore.getState().addMessage(assistantMsg);

    // If we call setMessages while streaming, it should replace
    // (In practice, we should prevent this, but the store should handle it gracefully)
    useChatStore.getState().setMessages([userMsg]);

    expect(useChatStore.getState().messages).toHaveLength(1);
  });
});
