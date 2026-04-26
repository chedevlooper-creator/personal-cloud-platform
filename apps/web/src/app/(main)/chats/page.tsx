import { MessageCircle } from 'lucide-react';
import { ModulePlaceholder } from '@/components/app-shell/module-placeholder';

export default function ChatsPage() {
  return (
    <ModulePlaceholder
      icon={MessageCircle}
      title="Chats"
      description="Conversation history will appear here. Start with New chat from the main canvas."
    />
  );
}
