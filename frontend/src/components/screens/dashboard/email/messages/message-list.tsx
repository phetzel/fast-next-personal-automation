import { Accordion } from "@/components/ui";
import type { EmailMessage } from "@/types";
import { MessageListItem } from "./message-list-item";

interface MessageListProps {
  messages: EmailMessage[];
  expandedMessage: string;
  onExpandMessage: (value: string) => void;
}

export function MessageList({ messages, expandedMessage, onExpandMessage }: MessageListProps) {
  return (
    <Accordion
      type="single"
      value={expandedMessage}
      onValueChange={onExpandMessage}
      collapsible
      className="space-y-3"
    >
      {messages.map((message) => (
        <MessageListItem key={message.id} message={message} />
      ))}
    </Accordion>
  );
}
