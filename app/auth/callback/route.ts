import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { getOrCreateGeneralTopic } from "@/lib/general-topic-server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  if (code) {
    const supabase = await createClient();
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      try {
        // Get the authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('Error getting user after auth:', userError);
          return NextResponse.redirect(`${origin}/auth/error?error=Could not get user information`);
        }

        // Create or get the General topic for this user
        const generalTopic = await getOrCreateGeneralTopic(user.id, supabase);
        
        // Determine redirect URL - prefer General topic over custom redirect
        let finalRedirectPath: string;
        if (redirectTo && !redirectTo.includes('/people/general')) {
          // Allow custom redirects unless they're to the old general route
          finalRedirectPath = redirectTo;
        } else {
          // Default to the General topic
          finalRedirectPath = `/topics/${generalTopic.id}`;
        }

        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";
        
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${finalRedirectPath}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${finalRedirectPath}`);
        } else {
          return NextResponse.redirect(`${origin}${finalRedirectPath}`);
        }
      } catch (topicError) {
        console.error('Error creating General topic:', topicError);
        // Fallback to a safe route if topic creation fails
        return NextResponse.redirect(`${origin}/people`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error?error=Could not authenticate user`);
} 