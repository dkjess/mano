"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    setDebugInfo("Starting login...");

    try {
      console.log("Attempting login with email:", email);
      setDebugInfo("Calling Supabase auth...");
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log("Auth response:", { data, error });
      setDebugInfo(`Auth response: ${JSON.stringify({ data: !!data, error: error?.message })}`);
      
      if (error) {
        console.error("Auth error:", error);
        throw error;
      }
      
      console.log("Login successful, redirecting...");
      setDebugInfo("Login successful! Redirecting...");
      router.push("/");
    } catch (error: unknown) {
      console.error("Login error:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      setError(errorMessage);
      setDebugInfo(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    setIsGoogleLoading(true);
    setError(null);
  
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly',
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsGoogleLoading(false);
    }
  };

  // Debug: Check current auth state
  const checkAuthState = async () => {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    console.log("Current user:", user);
    console.log("Current session error:", error);
    setDebugInfo(`Current user: ${user ? user.email : 'None'}`);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Debug Info */}
          {debugInfo && (
            <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
              <strong>Debug:</strong> {debugInfo}
            </div>
          )}
          
          <div className="mb-4">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={checkAuthState}
              className="text-xs"
            >
              Check Auth State
            </Button>
          </div>

          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              {/* Google OAuth Button */}
              <Button 
                type="button"
                variant="outline" 
                className="w-full font-medium-bold" 
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading || isLoading}
              >
                {isGoogleLoading ? "🤞 Signing you in..." : "👋 Continue with Google"}
              </Button>
              
              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="font-sf"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-sf"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full font-medium-bold" disabled={isLoading || isGoogleLoading}>
                {isLoading ? "🔍 Logging in..." : "👌 Login"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}