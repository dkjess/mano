"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Person, Message } from '@/types/database';

interface StagedFile {
  file: File;
  content: string;
  id: string;
}

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
  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [processingFile, setProcessingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPersonAndMessages();
  }, [personId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchPersonAndMessages = async () => {
    try {
      // Handle special case for 'general' assistant
      if (personId === 'general') {
        setPerson({
          id: 'general',
          user_id: '', // Not needed for general
          name: 'General',
          role: 'Management Assistant',
          relationship_type: 'assistant',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Fetch messages for general conversation
        const messagesResponse = await fetch(`/api/messages?person_id=general`);
        if (!messagesResponse.ok) {
          console.error('Failed to fetch general messages:', messagesResponse.status);
          setMessages([]);
        } else {
          const messagesData = await messagesResponse.json();
          setMessages(messagesData.messages || []);
        }
      } else {
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
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent, retryMessage?: string) => {
    e.preventDefault();
    const messageText = retryMessage || newMessage.trim();
    
    // Don't send if no message and no files
    if (!messageText && stagedFiles.length === 0) return;
    
    if (sending) return;

    setSending(true);
    if (!retryMessage) {
      setNewMessage('');
    }
    setRetryData(null);

    try {
      // Combine message with file contents
      let combinedMessage = messageText;
      
      if (stagedFiles.length > 0) {
        const fileContents = stagedFiles.map(staged => 
          `📎 **${staged.file.name}** (${(staged.file.size / 1024).toFixed(1)}KB)\n\n${staged.content}`
        ).join('\n\n---\n\n');
        
        combinedMessage = messageText 
          ? `${messageText}\n\n${fileContents}`
          : fileContents;
      }

      // Use streaming endpoint for better user experience
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId,
          message: combinedMessage
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body reader available');
      }

      let userMessage: Message | null = null;
      let assistantMessage: Message | null = null;
      let streamingContent = '';
      let shouldRetry = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'start':
                    // Create user message and placeholder assistant message
                    userMessage = {
                      id: data.userMessageId,
                      person_id: personId,
                      content: combinedMessage,
                      is_user: true,
                      created_at: new Date().toISOString()
                    };
                    
                    assistantMessage = {
                      id: 'streaming',
                      person_id: personId,
                      content: '',
                      is_user: false,
                      created_at: new Date().toISOString()
                    };
                    
                    setMessages(prev => [...prev, userMessage!, assistantMessage!]);
                    break;
                    
                  case 'delta':
                    // Update streaming content
                    streamingContent += data.text;
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === 'streaming' 
                          ? { ...msg, content: streamingContent }
                          : msg
                      )
                    );
                    break;
                    
                  case 'complete':
                    // Replace streaming message with final message
                    const finalMessage: Message = {
                      id: data.assistantMessageId,
                      person_id: personId,
                      content: data.fullResponse,
                      is_user: false,
                      created_at: new Date().toISOString()
                    };
                    
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === 'streaming' ? finalMessage : msg
                      )
                    );
                    break;
                    
                  case 'error':
                    // Handle error case
                    const errorMessage: Message = {
                      id: data.assistantMessageId,
                      person_id: personId,
                      content: data.error,
                      is_user: false,
                      created_at: new Date().toISOString()
                    };
                    
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === 'streaming' ? errorMessage : msg
                      )
                    );
                    
                    shouldRetry = data.shouldRetry;
                    break;
                }
              } catch (parseError) {
                console.error('Error parsing streaming data:', parseError);
              }
            }
          }
        }
        
        // Clear staged files after successful send
        setStagedFiles([]);
        
        if (shouldRetry) {
          setRetryData({
            message: combinedMessage,
            shouldShow: true
          });
        }
        
      } finally {
        reader.releaseLock();
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      
             // Fallback to non-streaming API
       try {
         let fallbackMessage = messageText;
         if (stagedFiles.length > 0) {
           const fileContents = stagedFiles.map(staged => 
             `📎 **${staged.file.name}** (${(staged.file.size / 1024).toFixed(1)}KB)\n\n${staged.content}`
           ).join('\n\n---\n\n');
           
           fallbackMessage = messageText 
             ? `${messageText}\n\n${fileContents}`
             : fileContents;
         }
         
         const fallbackResponse = await fetch('/api/chat', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             person_id: personId,
             message: fallbackMessage
           })
         });

         const data = await fallbackResponse.json();
         
         if (fallbackResponse.ok) {
           setMessages(prev => [...prev, data.userMessage, data.assistantMessage]);
           setStagedFiles([]);
           
           if (data.shouldRetry) {
             setRetryData({
               message: fallbackMessage,
               shouldShow: true
             });
           }
         }
       } catch (fallbackError) {
         console.error('Fallback API also failed:', fallbackError);
       }
    } finally {
      setSending(false);
    }
  };

  const processFile = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase();
    
    // Text-based formats we can read directly
    if (file.type === 'text/plain' || 
        fileName.endsWith('.txt') || 
        fileName.endsWith('.md') || 
        fileName.endsWith('.vtt') ||
        fileName.endsWith('.srt') ||
        fileName.endsWith('.sbv') ||
        fileName.endsWith('.ass') ||
        fileName.endsWith('.ssa') ||
        fileName.endsWith('.ttml') ||
        fileName.endsWith('.csv')) {
      return await file.text();
    }
    
    // For other formats, return a placeholder
    return `[File: ${file.name} - Content will be processed when sent]`;
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    
    const file = files[0];
    
    // Extended list of supported transcript and document formats
    const allowedTypes = [
      'text/plain', 
      'text/csv', 
      'text/markdown',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];
    
    const allowedExtensions = [
      '.txt', '.md', '.pdf', '.csv', '.docx', '.doc',
      // Transcript formats
      '.vtt', '.srt', '.sbv', '.ass', '.ssa', '.ttml',
      // Other text formats
      '.log', '.json', '.xml'
    ];
    
    const isValidType = allowedTypes.includes(file.type) || 
                       allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType) {
      alert('📄 Please upload a supported file format (.txt, .vtt, .srt, .md, .pdf, .csv, .docx, etc.)');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('📏 File too large. Please keep files under 10MB.');
      return;
    }

    setProcessingFile(true);
    
    try {
      const content = await processFile(file);
      const staged: StagedFile = {
        file,
        content,
        id: Date.now().toString()
      };
      
      setStagedFiles(prev => [...prev, staged]);
      
    } catch (error) {
      console.error('Error processing file:', error);
      alert('❌ Error processing file. Please try again.');
    } finally {
      setProcessingFile(false);
    }
  };

  const removeFile = (fileId: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'vtt':
      case 'srt':
      case 'sbv':
      case 'ass':
      case 'ssa':
      case 'ttml':
        return '🎬';
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'csv':
        return '📊';
      case 'md':
        return '📋';
      case 'json':
        return '🔧';
      case 'xml':
        return '🏷️';
      default:
        return '📎';
    }
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, []);

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
      case 'assistant': return '🧠';
      default: return '🙋';
    }
  };

  const getRelationshipLabel = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return 'Direct Report';
      case 'manager': return 'Manager';
      case 'stakeholder': return 'Stakeholder';
      case 'peer': return 'Peer';
      case 'assistant': return 'Management Assistant';
      default: return relationshipType;
    }
  };

  const ManoLoadingMessage = () => (
    <div className="flex justify-start">
      <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900">
        <div className="text-sm font-medium mb-1">
          🤚 Mano
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <span className="text-sm text-gray-500">gathering context & thinking...</span>
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
    <div 
      className="max-w-4xl mx-auto h-screen flex flex-col font-sf relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500/20 border-4 border-dashed border-blue-500 z-50 flex items-center justify-center">
          <div className="text-center bg-white p-8 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">📎</div>
            <h3 className="text-xl font-medium-bold text-gray-900 mb-2">
              Drop your file here
            </h3>
            <p className="text-gray-600">
              Upload meeting transcripts, notes, or documents about {person.name}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Supports: .txt, .vtt, .srt, .md, .pdf, .csv, .docx, .json (max 10MB)
            </p>
          </div>
        </div>
      )}

      {/* Processing file overlay */}
      {processingFile && (
        <div className="absolute inset-0 bg-black/20 z-40 flex items-center justify-center">
          <div className="text-center bg-white p-6 rounded-lg shadow-lg">
            <div className="text-2xl mb-2">📄</div>
            <div className="text-gray-600 font-medium-bold">Processing file...</div>
          </div>
        </div>
      )}

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
              {personId === 'general' 
                ? 'Always available' 
                : `Last contact: ${messages.length > 0 ? new Date(messages[messages.length - 1].created_at).toLocaleDateString() : 'Never'}`
              }
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
              <div className="font-medium mb-1">Files & Structure:</div>
              <div>📎 Drag files to stage them</div>
              <div>🎬 .vtt, .srt transcripts</div>
              <div>- list item, ```code block```</div>
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
            <label className="inline-block">
              <Button size="sm" variant="outline" asChild>
                <span>📎 Upload</span>
              </Button>
              <input
                type="file"
                className="hidden"
                accept=".txt,.md,.pdf,.csv,.docx,.doc,.vtt,.srt,.sbv,.ass,.ssa,.ttml,.log,.json,.xml"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              />
            </label>
          </div>
        </div>
      )}

      {/* Staged Files */}
      {stagedFiles.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 p-3">
          <div className="text-sm font-medium text-amber-900 mb-2">📎 Files ready to send:</div>
          <div className="flex flex-wrap gap-2">
            {stagedFiles.map((staged) => (
              <div key={staged.id} className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg shadow-sm">
                <span className="text-lg">{getFileIcon(staged.file.name)}</span>
                <span className="text-sm font-medium text-gray-700">
                  {staged.file.name}
                </span>
                <span className="text-xs text-gray-500">
                  ({(staged.file.size / 1024).toFixed(1)}KB)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFile(staged.id)}
                  className="h-5 w-5 p-0 text-gray-400 hover:text-red-500"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !sending ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">👋</div>
            <h3 className="text-lg font-medium-bold text-gray-900 mb-2">
              {personId === 'general' 
                ? 'Start a conversation about management' 
                : `Start a conversation about ${person.name}`
              }
            </h3>
            <p className="text-gray-600">
              {personId === 'general'
                ? 'Ask me about strategic thinking, team building, communication strategies, and general management challenges'
                : `Ask me anything about managing your relationship with ${person.name}`
              }
            </p>
            <p className="text-sm text-gray-500 mt-2">
              💡 Tip: {personId === 'general' ? 'Ask about hiring, stakeholder management, or process improvements' : 'Drag & drop transcripts, use **markdown**, and add context'}
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
                      ? 'bg-stone-100 text-gray-900'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {message.is_user ? 'You' : '🤚 Mano'}
                  </div>
                  <div className={`prose prose-sm max-w-none`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({children, ...props}) {
                          const { inline, ...restProps } = props as any;
                          return inline ? (
                            <code
                              className={`px-1 py-0.5 rounded text-sm font-medium ${
                                message.is_user 
                                  ? 'bg-stone-200 text-stone-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                              {...restProps}
                            >
                              {children}
                            </code>
                          ) : (
                            <pre className={`p-2 rounded text-sm overflow-x-auto ${
                              message.is_user 
                                ? 'bg-stone-200 text-stone-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              <code {...restProps}>{children}</code>
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
                                  ? 'text-stone-700 hover:text-stone-600' 
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
                    message.is_user ? 'text-stone-500' : 'text-gray-500'
                  }`}>
                    {new Date(message.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))}
            
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
              placeholder={personId === 'general' 
                ? `Ask about management strategies${stagedFiles.length > 0 ? ` (${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''} ready)` : ''} ...`
                : `Ask about ${person.name}${stagedFiles.length > 0 ? ` (${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''} ready)` : ' or drop files'} ...`
              }
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
          <Button 
            type="submit" 
            disabled={sending || (!newMessage.trim() && stagedFiles.length === 0)} 
            className="mb-0"
          >
            {sending ? '🤞' : stagedFiles.length > 0 ? '📎' : '👍'}
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