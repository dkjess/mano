import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If user is already logged in, redirect to people page
  if (user) {
    redirect('/people');
  }

  return (
    <div className="min-h-screen bg-mano-bg flex items-center justify-center p-6 font-sf">
      <div className="text-center max-w-2xl">
        <div className="text-8xl mb-8">👋</div>
        
        <h1 className="text-5xl md:text-6xl font-medium-bold text-gray-900 mb-6 leading-tight">
          Hello, I'm Mano
        </h1>
        
        <p className="text-2xl md:text-3xl text-gray-700 mb-12 leading-relaxed">
          Your helping hand in managing your people
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="text-lg px-8 py-4 font-medium-bold">
            <Link href="/auth/login">👋 Sign In</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg px-8 py-4 font-medium-bold">
            <Link href="/auth/sign-up">🤲 Sign Up</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}