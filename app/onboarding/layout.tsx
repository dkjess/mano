export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Override the main layout's ClientLayoutWrapper to provide a clean onboarding experience
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}