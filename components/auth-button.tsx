"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/client";
import { LogoutButton } from "./logout-button";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="font-sf font-medium-bold">✋ Just a moment…</div>;

  return user ? (
    <div className="flex items-center gap-4 font-sf">
      {user.user_metadata?.avatar_url && (
        <img 
          src={user.user_metadata.avatar_url} 
          alt="Profile"
          className="w-8 h-8 rounded-full"
        />
      )}
      <div className="flex flex-col">
        <span className="text-sm font-medium-bold">
          👋 Hey, {user.user_metadata?.full_name || user.email}!
        </span>
        {user.user_metadata?.full_name && (
          <span className="text-xs text-gray-500 font-sf">{user.email}</span>
        )}
      </div>
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2 font-sf">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">👋 Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">🤲 Join Mano</Link>
      </Button>
    </div>
  );
}