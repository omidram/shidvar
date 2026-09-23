import { PublicHeader } from "@/components/layout/public-header";

export default function VerifyAccountPage() {
  return (
    <div>
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold">Verify account</h1>
        <p className="mt-3 text-sm text-muted">Development accounts are pre-verified. Production enrollment will send a hashed email or SMS challenge.</p>
      </main>
    </div>
  );
}
