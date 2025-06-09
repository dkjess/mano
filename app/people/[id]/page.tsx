"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Person, Message } from '@/types/database';

export default function PersonDetailPage() {
  const params = useParams();
  const personId = params.id as string;
  
  const [person, setPerson] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [retryData, setRetryData] = useState<{message: string, shouldShow: boolean} | null>(null);
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPersonAndMessages();
  }, [personId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]); // Also scroll when sending state changes

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchPersonAndMessages = async () => {
    try {
      // Fetch person details
      const peopleResponse = await fetch('/api/people');
      const peopleData = await peopleResponse.json();
      const foundPerson = peopleData.people?.find((p: Person) => p.id === personId);
      
      if (!foundPerson) {
        console.error('Person not found');
        return;
      }
      
      setPerson(foundPerson);

      // Fetch messages
      const messagesResponse = await fetch(`/api/messages?person_id=${personId}`);
      const messagesData = await messagesResponse.json();
      setMessages(messagesData.messages || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent, retryMessage?: string) => {
    e.preventDefault();
    const messageText = retryMessage || newMessage.trim();
    if (!messageText || sending) return;

    setSending(true);
    if (!retryMessage) {
      setNewMessage('');
    }
    setRetryData(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId,
          message: messageText
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Add both user and assistant messages
        setMessages(prev => [...prev, data.userMessage, data.assistantMessage]);
        
        // Show retry option if Claude had an error
        if (data.shouldRetry) {
          setRetryData({
            message: messageText,
            shouldShow: true
          });
        }
      } else {
        console.error('Error sending message:', data.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const insertMarkdown = (syntax: string, cursorOffset: number = 0) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newMessage.substring(start, end);
    
    let replacement = '';
    if (syntax === '**bold**') {
      replacement = selectedText ? `**${selectedText}**` : '**bold text**';
    } else if (syntax === '*italic*') {
      replacement = selectedText ? `*${selectedText}*` : '*italic text*';
    } else if (syntax === '- list') {
      replacement = selectedText ? `- ${selectedText}` : '- list item';
    } else if (syntax === '```code```') {
      replacement = selectedText ? `\`\`\`\n${selectedText}\n\`\`\`` : '```\ncode block\n```';
    }

    const newText = newMessage.substring(0, start) + replacement + newMessage.substring(end);
    setNewMessage(newText);

    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + replacement.length - cursorOffset;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const getRelationshipEmoji = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return '👥';
      case 'manager': return '👆';
      case 'stakeholder': return '🤝';
      case 'peer': return '👋';
      default: return '🙋';
    }
  };

  const getRelationshipLabel = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return 'Direct Report';
      case 'manager': return 'Manager';
      case 'stakeholder': return 'Stakeholder';
      case 'peer': return 'Peer';
      default: return relationshipType;
    }
  };

  // Loading component for Mano's response
  const ManoLoadingMessage = () => (
    <div className="flex justify-start">
      <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900">
        <div className="text-sm font-medium mb-1">
          🤚 Mano
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <span className="text-sm text-gray-500">thinking...</span>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 font-sf">
        <div className="text-center">
          <div className="text-2xl mb-2">🤚</div>
          <div className="text-gray-600 font-medium-bold">Loading conversation...</div>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="text-center py-12 font-sf">
        <div className="text-4xl mb-4">🤷</div>
        <h3 className="text-lg font-medium-bold text-gray-900 mb-2">Person not found</h3>
        <Button asChild>
          <Link href="/people">👈 Back to People</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-screen flex flex-col font-sf">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/people">👈 Back</Link>
            </Button>
            <div className="flex items-center space-x-3">
              <div className="text-2xl">
                {getRelationshipEmoji(person.relationship_type)}
              </div>
              <div>
                <h1 className="text-xl font-medium-bold text-gray-900">
                  {person.name}
                </h1>
                <p className="text-sm text-gray-600">
                  {person.role || 'No role specified'} • {getRelationshipLabel(person.relationship_type)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMarkdownHelp(!showMarkdownHelp)}
              className="text-xs"
            >
              📝 Markdown
            </Button>
            <div className="text-xs text-gray-400">
              Last contact: {messages.length > 0 ? new Date(messages[messages.length - 1].created_at).toLocaleDateString() : 'Never'}
            </div>
          </div>
        </div>
      </div>

      {/* Markdown Help */}
      {showMarkdownHelp && (
        <div className="bg-blue-50 border-b border-blue-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">📝 Markdown Formatting</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMarkdownHelp(false)}
              className="text-blue-600 h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs text-blue-800">
            <div>
              <div className="font-medium mb-1">Formatting:</div>
              <div>**bold** → <strong>bold</strong></div>
              <div>*italic* → <em>italic</em></div>
              <div>`code` → <code className="bg-blue-100 px-1 rounded">code</code></div>
            </div>
            <div>
              <div className="font-medium mb-1">Structure:</div>
              <div>- list item</div>
              <div>```code block```</div>
              <div># heading</div>
            </div>
          </div>
          <div className="mt-2 flex space-x-2">
            <Button size="sm" variant="outline" onClick={() => insertMarkdown('**bold**', 2)}>
              <strong>B</strong>
            </Button>
            <Button size="sm" variant="outline" onClick={() => insertMarkdown('*italic*', 1)}>
              <em>I</em>
            </Button>
            <Button size="sm" variant="outline" onClick={() => insertMarkdown('- list', 0)}>
              📋
            </Button>
            <Button size="sm" variant="outline" onClick={() => insertMarkdown('```code```', 4)}>
              💻
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !sending ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">👋</div>
            <h3 className="text-lg font-medium-bold text-gray-900 mb-2">
              Start a conversation about {person.name}
            </h3>
            <p className="text-gray-600">
              Ask me anything about managing your relationship with {person.name}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              💡 Tip: You can use **markdown** formatting in your messages
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.is_user
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {message.is_user ? 'You' : '🤚 Mano'}
                  </div>
                  <div className={`prose prose-sm max-w-none ${
                    message.is_user 
                      ? 'prose-user-message' 
                      : ''
                  }`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({node, inline, className, children, ...props}) {
                          return inline ? (
                            <code
                              className={`px-1 py-0.5 rounded text-sm font-medium ${
                                message.is_user 
                                  ? 'bg-blue-500/20 text-blue-200' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <pre className={`p-2 rounded text-sm overflow-x-auto ${
                              message.is_user 
                                ? 'bg-blue-500/20 text-blue-200' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              <code {...props}>{children}</code>
                            </pre>
                          );
                        },
                        a({children, href}) {
                          return (
                            <a 
                              href={href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`underline hover:no-underline ${
                                message.is_user 
                                  ? 'text-blue-200 hover:text-blue-100' 
                                  : 'text-blue-600 hover:text-blue-500'
                              }`}
                            >
                              {children}
                            </a>
                          );
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  <div className={`text-xs mt-1 ${
                    message.is_user ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {new Date(message.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading state when sending */}
            {sending && <ManoLoadingMessage />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Retry button */}
      {retryData?.shouldShow && (
        <div className="bg-yellow-50 border-t border-yellow-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-yellow-800 font-medium">
              🤞 Want to try that again?
            </span>
            <div className="space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRetryData(null)}
              >
                👎 No thanks
              </Button>
              <Button
                size="sm"
                onClick={(e) => sendMessage(e, retryData.message)}
                disabled={sending}
              >
                🔄 Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Ask about ${person.name} or add a note... (supports **markdown**)`}
              disabled={sending}
              className="w-full min-h-[44px] max-h-32 px-3 py-2 border border-gray-300 rounded-md resize-none font-sf focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              style={{
                height: 'auto',
                overflowY: newMessage.split('\n').length > 3 ? 'scroll' : 'hidden'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              autoComplete="off"
              rows={1}
            />
          </div>
          <Button type="submit" disabled={sending || !newMessage.trim()} className="mb-0">
            {sending ? '🤞' : '👍'}
          </Button>
        </form>
        {sending && (
          <div className="mt-2 text-xs text-gray-500 flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span>Mano is thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}