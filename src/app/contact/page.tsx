import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { Card } from "@/components/ui/card";
import { SUPPORT_PHONES } from "@/lib/support-phones";

export default function ContactPage() {
  return (
    <div className="bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-4xl font-black">تماس و پشتیبانی</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SUPPORT_PHONES.map((phone) => (
            <Card key={phone}>
              <h2 className="font-bold">تماس و پشتیبانی</h2>
              <a href={`tel:${phone}`} dir="ltr" className="mt-2 inline-block text-lg font-bold text-primary">
                {phone}
              </a>
            </Card>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
