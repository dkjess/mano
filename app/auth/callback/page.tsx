"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = createClient();
      
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          router.push('/auth/login');
          return;
        }
        
        if (data.session) {
          // Successfully authenticated
          router.push('/people');
        } else {
          // No session
          router.push('/auth/login');
        }
      } catch (error) {
        console.error('Callback handling error:', error);
        router.push('/auth/login');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-2xl mb-2">🤚</div>
        <div className="text-gray-600">Completing sign in...</div>
      </div>
    </div>
  );
}