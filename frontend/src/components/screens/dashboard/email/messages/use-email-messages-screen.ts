"use client";

import { useEffect, useMemo, useState } from "react";
import { useEmailMessagesQuery, useEmailSourcesQuery } from "@/hooks/queries/email";
import type { EmailSource } from "@/types";

const EMPTY_SOURCES: EmailSource[] = [];

export function useEmailMessagesScreen() {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [expandedMessage, setExpandedMessage] = useState("");

  const sourcesQuery = useEmailSourcesQuery();
  const sources = sourcesQuery.data ?? EMPTY_SOURCES;

  useEffect(() => {
    if (sources.length > 0 && !selectedSourceId) {
      setSelectedSourceId(sources[0].id);
    }
  }, [selectedSourceId, sources]);

  const messagesQuery = useEmailMessagesQuery(selectedSourceId, 50);
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources]
  );

  return {
    sources,
    selectedSource,
    messages: messagesQuery.data ?? [],
    expandedMessage,
    isLoading:
      sourcesQuery.isLoading ||
      sourcesQuery.isFetching ||
      messagesQuery.isLoading ||
      messagesQuery.isFetching,
    onExpandMessage: setExpandedMessage,
    onSelectSource: (source: EmailSource) => setSelectedSourceId(source.id),
  };
}
