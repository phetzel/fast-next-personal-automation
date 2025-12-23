"use client";

import { useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { useConversationStore, useChatStore } from "@/stores";
import type { Conversation, ConversationMessage } from "@/types";

interface CreateConversationResponse {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
}

export function useConversations() {
  const {
    conversations,
    currentConversationId,
    currentMessages,
    isLoading,
    error,
    setConversations,
    addConversation,
    updateConversation,
    removeConversation,
    setCurrentConversationId,
    setCurrentMessages,
    setLoading,
    setError,
  } = useConversationStore();

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Backend returns array directly, not wrapped in { items: [...] }
      const response = await apiClient.get<Conversation[]>("/conversations");
      setConversations(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch conversations";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [setConversations, setLoading, setError]);

  const createConversation = useCallback(
    async (title?: string): Promise<Conversation | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<CreateConversationResponse>("/conversations", {
          title,
        });
        const newConversation: Conversation = {
          id: response.id,
          title: response.title,
          created_at: response.created_at,
          updated_at: response.updated_at,
          is_archived: response.is_archived,
        };
        addConversation(newConversation);
        return newConversation;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create conversation";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [addConversation, setLoading, setError]
  );

  const { clearMessages } = useChatStore();

  const selectConversation = useCallback(
    async (id: string) => {
      setCurrentConversationId(id);
      setLoading(true);
      setError(null);
      try {
        // Backend returns array directly, not wrapped in { items: [...] }
        const response = await apiClient.get<ConversationMessage[]>(`/conversations/${id}/messages`);
        console.log("[selectConversation] Fetched messages:", response.length);
        response.forEach((msg, i) => {
          console.log(`[selectConversation] Message ${i}: role=${msg.role}, tool_calls=${msg.tool_calls?.length || 0}`);
          if (msg.tool_calls) {
            msg.tool_calls.forEach(tc => {
              console.log(`[selectConversation]   Tool call: ${tc.tool_name} status=${tc.status}`);
            });
          }
        });
        // Setting currentMessages triggers useEffect in ChatContainer that syncs to chat store
        setCurrentMessages(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch messages";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [setCurrentConversationId, setCurrentMessages, setLoading, setError]
  );

  const archiveConversation = useCallback(
    async (id: string) => {
      try {
        await apiClient.patch(`/conversations/${id}`, { is_archived: true });
        updateConversation(id, { is_archived: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to archive conversation";
        setError(message);
      }
    },
    [updateConversation, setError]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/conversations/${id}`);
        removeConversation(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete conversation";
        setError(message);
      }
    },
    [removeConversation, setError]
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        await apiClient.patch(`/conversations/${id}`, { title });
        updateConversation(id, { title });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to rename conversation";
        setError(message);
      }
    },
    [updateConversation, setError]
  );

  const startNewChat = useCallback(() => {
    setCurrentConversationId(null);
    setCurrentMessages([]);
    clearMessages();
  }, [setCurrentConversationId, setCurrentMessages, clearMessages]);

  return {
    conversations,
    currentConversationId,
    currentMessages,
    isLoading,
    error,
    fetchConversations,
    createConversation,
    selectConversation,
    archiveConversation,
    deleteConversation,
    renameConversation,
    startNewChat,
  };
}
