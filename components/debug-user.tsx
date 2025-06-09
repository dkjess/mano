"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function DebugUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log("User data:", user);
      setUser(user);
      setLoading(false);
    };

    getUser();
  }, []);

  if (loading) return <div>Loading user...</div>;

  return (
    <div className="bg-gray-100 p-4 rounded-md text-xs">
      <h3 className="font-bold">Debug User Info:</h3>
      {user ? (
        <pre className="mt-2 whitespace-pre-wrap">
          {JSON.stringify(user, null, 2)}
        </pre>
      ) : (
        <p>No user found</p>
      )}
    </div>
  );
}