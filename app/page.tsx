import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-mano-bg flex items-center justify-center p-6 font-sf">
      <div className="text-center max-w-4xl">
        {/* Debug info */}
        <div className="bg-gray-100 p-4 rounded-lg mb-8 text-left text-sm">
          <h3 className="font-bold mb-2">🐛 Debug Info:</h3>
          <div><strong>User exists:</strong> {user ? "✅ Yes" : "❌ No"}</div>
          {user && (
            <>
              <div><strong>Email:</strong> {user.email}</div>
              <div><strong>Full name:</strong> {user.user_metadata?.full_name || "Not set"}</div>
              <div><strong>Avatar URL:</strong> {user.user_metadata?.avatar_url ? "✅ Set" : "❌ Not set"}</div>
              <div><strong>User ID:</strong> {user.id}</div>
              <div><strong>Created:</strong> {user.created_at}</div>
            </>
          )}
          {error && <div><strong>Error:</strong> {error.message}</div>}
          <div><strong>Should redirect to /people:</strong> {user ? "✅ Yes" : "❌ No"}</div>
        </div>

        <div className="text-8xl mb-8">👋</div>
        
        <h1 className="text-5xl md:text-6xl font-medium-bold text-gray-900 mb-6 leading-tight">
          Hello, I'm Mano
        </h1>
        
        <p className="text-2xl md:text-3xl text-gray-700 mb-12 leading-relaxed">
          Your helping hand in managing your people
        </p>
        
        {user ? (
          <div className="space-y-4">
            <div className="text-lg text-green-600 font-medium">
              ✅ You're logged in! Normally you'd be redirected to /people
            </div>
            <Button asChild size="lg" className="text-lg px-8 py-4 font-medium-bold">
              <Link href="/people">👥 Go to People (Manual)</Link>
            </Button>
            <div>
              <Button asChild size="sm" variant="outline">
                <Link href="/auth/login">🔄 Try Login Again</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-4 font-medium-bold">
              <Link href="/auth/login">👋 Sign In</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 py-4 font-medium-bold">
              <Link href="/auth/sign-up">🤲 Sign Up</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}