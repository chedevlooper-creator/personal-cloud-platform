'use client';

import { useState } from 'react';
import type React from 'react';
import { Send, Bot } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { agentApi, getApiErrorMessage } from '@/lib/api';

export default function WorkspaceChat({ workspaceId }: { workspaceId: string }) {
  const [messages, setMessages] = useState([
    { id: 1, role: 'agent', content: `Hello! I am your AI Agent for workspace ${workspaceId}. How can I help you today?` },
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    agentApi
      .post('/agent/tasks', { workspaceId, input: userMsg.content })
      .then((res) => {
        const task = res.data as { id: string; status: string };
        const agentMsg = {
          id: Date.now() + 1,
          role: 'agent',
          content: `Task ${task.id} is ${task.status}. I will update this chat when task streaming is available.`,
        };
        setMessages((prev) => [...prev, agentMsg]);
      })
      .catch((error) => {
        const agentMsg = {
          id: Date.now() + 1,
          role: 'agent',
          content: getApiErrorMessage(error, 'The agent service is not available.'),
        };
        setMessages((prev) => [...prev, agentMsg]);
      });
  };

  return (
    <div className="flex h-full flex-col bg-[#252526]">
      <div className="flex h-10 items-center justify-between border-b border-[#333333] px-4 font-semibold uppercase tracking-wider text-zinc-400">
        <span>Agent Chat</span>
        <Bot className="h-5 w-5 text-blue-400" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] ${
              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#37373d] text-zinc-200'
              }`}
            >
              {msg.content}
            </div>
            <span className="mt-1 text-[10px] text-zinc-500">
              {msg.role === 'user' ? 'You' : 'Agent'}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-[#333333] p-3">
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask agent to do something..."
            className="h-9 flex-1 bg-[#3c3c3c] border-none text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-blue-500"
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 bg-blue-600 hover:bg-blue-500"
            disabled={!input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
