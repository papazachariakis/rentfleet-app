export default function Home() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">FleetPilot</h1>
        <p className="text-muted-foreground">Car rental management platform</p>
        <a href="/auth/sign-in" className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90">
          Σύνδεση
        </a>
      </div>
    </main>
  );
}
