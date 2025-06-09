"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function DebugPage() {
  const [results, setResults] = useState<any[]>([]);

  const addResult = (message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [...prev, { timestamp, message, data }]);
    console.log(`[${timestamp}] ${message}`, data);
  };

  const testSupabaseConnection = async () => {
    addResult("🔧 Testing Supabase connection...");
    
    try {
      const supabase = createClient();
      addResult("✅ Supabase client created");
      
      // Test basic connection
      const { data, error } = await supabase.from('people').select('count').limit(1);
      addResult("📊 Database query test", { data, error });
      
      // Check current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      addResult("🔐 Current session", { 
        hasSession: !!sessionData.session,
        user: sessionData.session?.user?.email,
        error: sessionError 
      });
      
      // Check user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      addResult("👤 Current user", { 
        hasUser: !!userData.user,
        email: userData.user?.email,
        error: userError 
      });
      
    } catch (error) {
      addResult("❌ Supabase test failed", error);
    }
  };

  const testEnvironmentVariables = () => {
    addResult("🌍 Environment variables check:");
    addResult("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing");
    addResult("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing");
    addResult("URL value", process.env.NEXT_PUBLIC_SUPABASE_URL);
  };

  const testLogin = async () => {
    addResult("🔑 Testing login with test credentials...");
    
    try {
      const supabase = createClient();
      const testEmail = "test@example.com";
      const testPassword = "testpassword123";
      
      addResult(`Attempting login with: ${testEmail}`);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      
      addResult("Login response", { 
        hasData: !!data,
        hasUser: !!data.user,
        hasSession: !!data.session,
        error: error?.message 
      });
      
    } catch (error) {
      addResult("❌ Login test failed", error);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 font-sf">
      <h1 className="text-2xl font-bold mb-6">🐛 Mano Debug Console</h1>
      
      <div className="space-y-4 mb-6">
        <Button onClick={testEnvironmentVariables}>Check Environment Variables</Button>
        <Button onClick={testSupabaseConnection}>Test Supabase Connection</Button>
        <Button onClick={testLogin} variant="outline">Test Login (will fail but shows errors)</Button>
        <Button onClick={clearResults} variant="ghost">Clear Results</Button>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-y-auto">
        <h3 className="font-bold mb-2">Debug Results:</h3>
        {results.length === 0 ? (
          <p className="text-gray-500">No results yet. Click a test button above.</p>
        ) : (
          <div className="space-y-2 text-sm font-mono">
            {results.map((result, index) => (
              <div key={index} className="border-b border-gray-200 pb-2">
                <div className="text-blue-600">[{result.timestamp}] {result.message}</div>
                {result.data && (
                  <pre className="text-gray-700 text-xs mt-1 overflow-x-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}