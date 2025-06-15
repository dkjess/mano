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
  const [people, setPeople] = useState<Person[]>([]);
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
  const typingAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPersonAndMessages();
    fetchAllPeople();
  }, [personId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  useEffect(() => {
    updateSendButton();
  }, [newMessage, stagedFiles]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateSendButton = () => {
    const hasContent = newMessage.trim().length > 0 || stagedFiles.length > 0;
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
      if (hasContent) {
        sendButton.classList.add('visible');
      } else {
        sendButton.classList.remove('visible');
      }
    }
  };

  const fetchPersonAndMessages = async () => {
    try {
      // Handle special case for '1-1' assistant
      if (personId === '1-1') {
        setPerson({
          id: '1-1',
          user_id: '', 
          name: 'General',
          role: 'Management companion',
          relationship_type: 'assistant',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Fetch messages for 1-1 conversation
        const messagesResponse = await fetch(`/api/messages?person_id=1-1`);
        if (!messagesResponse.ok) {
          console.error('Failed to fetch 1-1 messages:', messagesResponse.status);
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

  const fetchAllPeople = async () => {
    try {
      const response = await fetch('/api/people');
      const data = await response.json();
      setPeople(data.people || []);
    } catch (error) {
      console.error('Error fetching people:', error);
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
      if (typingAreaRef.current) {
        typingAreaRef.current.textContent = '';
      }
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
    setProcessingFile(true);
    
    const validFiles = Array.from(files).filter(file => {
      const validTypes = ['.txt', '.md', '.pdf', '.csv', '.docx', '.doc', '.vtt', '.srt', '.sbv', '.ass', '.ssa', '.ttml', '.log', '.json', '.xml'];
      const isValidType = validTypes.some(type => file.name.toLowerCase().endsWith(type));
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });

    if (validFiles.length === 0) {
      alert('Please upload supported file types (txt, md, pdf, csv, docx, vtt, srt, json, xml) under 10MB');
      setProcessingFile(false);
      return;
    }

    try {
      const newStagedFiles: StagedFile[] = [];
      
      for (const file of validFiles) {
        const content = await processFile(file);
        newStagedFiles.push({
          file,
          content,
          id: Math.random().toString(36).substr(2, 9)
        });
      }
      
      setStagedFiles(prev => [...prev, ...newStagedFiles]);
    } catch (error) {
      console.error('Error processing files:', error);
      alert('Error processing files. Please try again.');
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
      case 'txt': case 'md': return '📝';
      case 'pdf': return '📄';
      case 'csv': return '📊';
      case 'docx': case 'doc': return '📝';
      case 'vtt': case 'srt': case 'sbv': case 'ass': case 'ssa': case 'ttml': return '🎬';
      case 'json': case 'xml': return '🔧';
      case 'log': return '📋';
      default: return '📎';
    }
  };

  const getRelationshipEmoji = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return '😊';
      case 'manager': return '👆';
      case 'stakeholder': return '🌟';
      case 'peer': return '👋';
      case 'assistant': return '🤲';
      default: return '🙋';
    }
  };

  const getRelationshipLabel = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return 'Direct Report';
      case 'manager': return 'Manager';
      case 'stakeholder': return 'Stakeholder';
      case 'peer': return 'Peer';
      case 'assistant': return 'Management companion';
      default: return relationshipType;
    }
  };

  const handleTypingInput = (e: React.FormEvent<HTMLDivElement>) => {
    const content = e.currentTarget.textContent || '';
    setNewMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const fakeEvent = {
        preventDefault: () => {},
        target: e.currentTarget
      } as React.FormEvent;
      sendMessage(fakeEvent);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl mb-2">🤲</div>
          <div className="text-gray-600">Loading conversation...</div>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🤷</div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Person not found</h3>
        <Button asChild>
          <Link href="/people">👈 Back to People</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: Charter, 'Georgia', 'Cambria', 'Times New Roman', serif;
          background: #fafafa;
          color: #242424;
          line-height: 1.58;
          letter-spacing: -0.003em;
          font-size: 21px;
          overflow-x: hidden;
        }

        .app-container {
          display: grid;
          grid-template-columns: 300px 1fr;
          min-height: 100vh;
          max-width: 1400px;
          margin: 0 auto;
          background: white;
        }

        /* Sidebar */
        .sidebar {
          background: #f7f7f7;
          padding: 40px 24px;
          border-right: 1px solid #e6e6e6;
          overflow-y: auto;
        }

        .logo {
          font-family: 'Inter', sans-serif;
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 40px;
          color: #1a1a1a;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .people-section {
          margin-bottom: 32px;
        }

        .section-title {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #757575;
          margin-bottom: 16px;
        }

        .person-item {
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 4px;
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }

        .person-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 500;
          color: #1a1a1a;
          flex-shrink: 0;
        }

        .person-item.general .person-avatar {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 18px;
        }

        .person-info {
          flex: 1;
          min-width: 0;
        }

        .person-item:hover {
          background: #f0f0f0;
        }

        .person-item.active {
          background: #f2f2f2;
          border: 1px solid #e0e0e0;
        }

        .person-item.general {
          background: linear-gradient(135deg, #1a73e8, #4285f4);
          color: white;
          margin-bottom: 24px;
        }

        .person-item.general:hover {
          background: linear-gradient(135deg, #1557b0, #3367d6);
        }

        .person-item.general.active {
          background: linear-gradient(135deg, #1557b0, #3367d6);
          border: 1px solid rgba(255,255,255,0.3);
        }

        .person-name {
          font-weight: 500;
          font-size: 15px;
          margin-bottom: 2px;
        }

        .person-role {
          font-size: 13px;
          opacity: 0.7;
        }

        /* Main Content */
        .main-content {
          background: white;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .conversation-header {
          padding: 32px 40px 20px;
          border-bottom: 1px solid #f0f0f0;
          background: white;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .current-person {
          font-size: 42px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
          line-height: 1.2;
        }

        .person-details {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: #757575;
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .role-tag {
          background: #f0f0f0;
          color: #1a1a1a;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }

        .conversation-flow {
          flex: 1;
          padding: 32px 64px 120px;
          overflow-y: auto;
          max-width: 700px;
        }

        .message-group {
          margin-bottom: 48px;
        }

        .message {
          margin-bottom: 24px;
        }

        .message.user {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          font-size: 18px;
          color: #1a1a1a;
          font-weight: 400;
          position: relative;
          line-height: 1.5;
          margin-bottom: 32px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 24px 0 24px 24px;
        }

        .message.user .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #1a73e8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: white;
          font-weight: 500;
          flex-shrink: 0;
        }

        .message.user .user-content {
          flex: 1;
          min-width: 0;
        }

        .user-label {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: #1a73e8;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 8px;
        }

        .message.assistant {
          font-family: Charter, 'Georgia', serif;
          color: #242424;
          font-size: 21px;
          line-height: 1.58;
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding-left: 24px;
        }

        .message.assistant .assistant-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .message.assistant .assistant-content {
          flex: 1;
          min-width: 0;
        }

        .message.assistant p {
          margin-bottom: 24px;
        }

        .message.assistant p:last-child {
          margin-bottom: 0;
        }

        .message.assistant strong {
          font-weight: 700;
          color: #1a1a1a;
        }

        .message.assistant em {
          font-style: italic;
          background: linear-gradient(120deg, rgba(26, 115, 232, 0.1) 0%, rgba(26, 115, 232, 0.05) 100%);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .timestamp {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #9e9e9e;
          margin-top: 16px;
          text-align: right;
        }

        /* Input Area - Medium style */
        .input-area {
          position: fixed;
          bottom: 0;
          left: 300px;
          right: 0;
          background: white;
          border-top: 1px solid #f0f0f0;
          padding: 24px 64px;
          max-width: calc(1400px - 300px);
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }

        .typing-container {
          flex: 1;
          position: relative;
          max-width: 636px;
        }

        .typing-area {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          font-size: 18px;
          line-height: 1.5;
          color: #1a1a1a;
          min-height: 48px;
          max-height: 200px;
          overflow-y: auto;
          outline: none;
          padding: 12px 0;
          border: none;
          resize: none;
          caret-color: #1a73e8;
        }

        .typing-area:empty:before {
          content: "Continue the conversation...";
          color: #9e9e9e;
          pointer-events: none;
          font-style: italic;
        }

        .send-button {
          background: #1a73e8;
          border: none;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 18px;
          opacity: 0;
          transform: scale(0.8);
          pointer-events: none;
          margin-top: 12px;
        }

        .send-button.visible {
          opacity: 1;
          transform: scale(1);
          pointer-events: all;
        }

        .send-button:hover {
          background: #1557b0;
          transform: scale(1.05);
        }

        /* Loading Animation */
        .loader {
          display: none;
          padding: 24px 0;
          padding-left: 48px;
        }

        .loader.active {
          display: block;
        }

        .hand-emojis {
          font-size: 20px;
          display: inline-block;
        }

        .hand-emojis span {
          display: inline-block;
          animation: float 2s ease-in-out infinite;
          margin-right: 8px;
        }

        .hand-emojis span:nth-child(1) { animation-delay: 0s; }
        .hand-emojis span:nth-child(2) { animation-delay: 0.3s; }
        .hand-emojis span:nth-child(3) { animation-delay: 0.6s; }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }

        .fade-in {
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Mobile Responsive */
        @media (max-width: 1024px) {
          .conversation-flow {
            padding: 24px 40px 120px;
          }
          
          .input-area {
            padding: 20px 40px;
          }
          
          .conversation-header {
            padding: 32px 40px 20px;
          }
        }

        @media (max-width: 768px) {
          body {
            font-size: 19px;
          }
          
          .app-container {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
          }
          
          .sidebar {
            background: #f7f7f7;
            padding: 20px;
            border-right: none;
            border-bottom: 1px solid #e6e6e6;
            display: flex;
            overflow-x: auto;
            gap: 16px;
          }
          
          .people-section {
            display: flex;
            gap: 12px;
            margin-bottom: 0;
            flex-shrink: 0;
          }
          
          .section-title {
            display: none;
          }
          
          .person-item {
            flex-shrink: 0;
            white-space: nowrap;
          }
          
          .input-area {
            left: 0;
            max-width: 100%;
            padding: 16px 20px;
          }
          
          .conversation-header {
            padding: 24px 20px 16px;
          }
          
          .current-person {
            font-size: 32px;
          }
          
          .conversation-flow {
            padding: 20px 20px 120px;
          }
          
          .message.user {
            font-size: 16px;
            padding: 16px 20px;
          }
          
          .message.assistant {
            font-size: 19px;
            padding-left: 40px;
          }
          
          .typing-area {
            font-size: 16px;
          }
        }
      `}</style>
      
      <div className="app-container">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="logo">🤲 Mano</div>
          
          <div className="people-section">
            <div className="section-title">Assistant</div>
            <Link 
              href="/people/1-1"
              className={`person-item general ${personId === '1-1' ? 'active' : ''}`}
            >
              <div className="person-avatar">🤲</div>
              <div className="person-info">
                <div className="person-name">General</div>
                <div className="person-role">Management companion</div>
              </div>
            </Link>
          </div>

          <div className="people-section">
            <div className="section-title">Your Team</div>
            {people.map((p) => (
              <Link 
                key={p.id} 
                href={`/people/${p.id}`}
                className={`person-item ${personId === p.id ? 'active' : ''}`}
              >
                <div className="person-avatar">{getRelationshipEmoji(p.relationship_type)}</div>
                <div className="person-info">
                  <div className="person-name">{p.name}</div>
                  <div className="person-role">{p.role || 'No role specified'}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          <div className="conversation-header">
            <h1 className="current-person">{person.name}</h1>
            <div className="person-details">
              <span className="role-tag">{getRelationshipLabel(person.relationship_type)}</span>
              <span>{person.role || 'No role specified'}</span>
              <span>•</span>
              <span>Last talked: {messages.length > 0 ? new Date(messages[messages.length - 1].created_at).toLocaleDateString() : 'Never'}</span>
            </div>
          </div>

          <div className="conversation-flow fade-in">
            {messages.length === 0 && !sending ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">👋</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {personId === '1-1' 
                    ? 'Start a conversation about management' 
                    : `Start a conversation about ${person.name}`
                  }
                </h3>
                <p className="text-gray-600">
                  {personId === '1-1'
                    ? 'Ask me about strategic thinking, team building, communication strategies, and management challenges'
                    : `Ask me anything about managing your relationship with ${person.name}`
                  }
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={message.id} className="message-group">
                  <div className={`message ${message.is_user ? 'user' : 'assistant'}`}>
                    {message.is_user ? (
                      <>
                        <div className="user-avatar">😊</div>
                        <div className="user-content">
                          <div className="user-label">You</div>
                          {message.content}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="assistant-avatar">🤲</div>
                        <div className="assistant-content">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p>{children}</p>,
                              strong: ({ children }) => <strong>{children}</strong>,
                              em: ({ children }) => <em>{children}</em>,
                              code: ({ children, inline }) => (
                                inline ? (
                                  <code className="bg-gray-100 px-1 rounded text-sm">{children}</code>
                                ) : (
                                  <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                                    <code>{children}</code>
                                  </pre>
                                )
                              )
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="timestamp">
                    {new Date(message.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              ))
            )}
            
            {sending && (
              <div className="loader active">
                <div className="hand-emojis">
                  <span>🤲</span>
                  <span>👋</span>
                  <span>🫱</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <div className="typing-container">
              <div 
                className="typing-area" 
                contentEditable="true" 
                ref={typingAreaRef}
                onInput={handleTypingInput}
                onKeyDown={handleKeyDown}
                suppressContentEditableWarning={true}
              />
            </div>
            <button 
              className="send-button" 
              id="sendButton"
              onClick={(e) => sendMessage(e)}
              disabled={sending}
            >
              👋
            </button>
          </div>
        </div>
      </div>
    </>
  );
}