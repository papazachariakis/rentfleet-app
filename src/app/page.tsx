import Image from "next/image";
import Link from "next/link";
import { Car, FileCheck2, CreditCard, ArrowRight } from "lucide-react";
import { buttonClass } from "@/components/ui";

const pillars = [
  {
    title: "Desk + στόλος",
    body: "Κρατήσεις, παραλαβές/επιστροφές, συμβόλαια και οχήματα (αυτοκίνητα, μοτό, σκούτερ, van) σε ένα σύστημα.",
    icon: Car,
  },
  {
    title: "ΑΑΔΕ έτοιμο",
    body: "Ψηφιακό Πελατολόγιο Οχημάτων στο pickup/return και myDATA τιμολόγηση — χωρίς διπλή καταχώρηση.",
    icon: FileCheck2,
  },
  {
    title: "Online booking + Stripe",
    body: "Οι πελάτες κλείνουν online· πληρωμές και εγγυήσεις με τα δικά σου Stripe keys.",
    icon: CreditCard,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative min-h-[100svh] overflow-hidden text-white">
        <Image
          src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=2400&q=80"
          alt="Όχημα σε ελληνικό δρόμο δίπλα στη θάλασσα"
          fill
          priority
          className="animate-kenburns object-cover object-[center_40%]"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, rgba(8,24,48,0.78) 0%, rgba(27,108,168,0.45) 50%, rgba(15,28,46,0.35) 100%)",
          }}
        />

        <header className="page-shell relative z-10 flex max-w-[96rem] items-center justify-between py-5">
          <span className="font-display text-2xl tracking-tight md:text-3xl">
            RentFleet
          </span>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm text-white/80 transition hover:text-white"
            >
              Είσοδος
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-accent transition hover:bg-white/90"
            >
              Ξεκίνα
            </Link>
          </nav>
        </header>

        <div className="page-shell relative z-10 flex max-w-[96rem] flex-col justify-end pb-16 pt-24 md:pb-24 md:pt-36">
          <p className="animate-fade-up text-sm uppercase tracking-[0.2em] text-white/70">
            Για rent-a-car στην Ελλάδα
          </p>
          <h1 className="font-display animate-fade-up mt-4 max-w-3xl text-4xl leading-tight md:text-6xl">
            RentFleet
          </h1>
          <p
            className="animate-fade-up mt-4 max-w-xl text-lg text-white/85 md:text-xl"
            style={{ animationDelay: "120ms" }}
          >
            Desk ops, online κρατήσεις και πλήρης συμμόρφωση με Ψηφιακό
            Πελατολόγιο &amp; myDATA — καλύτερο για την ελληνική αγορά από HQ,
            Coastr και AiRentoSoft.
          </p>
          <div
            className="animate-fade-up mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: "220ms" }}
          >
            <Link
              href="/register"
              className={buttonClass({ className: "px-5 py-3" })}
            >
              Δωρεάν δοκιμή
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg border border-white/30 px-5 py-3 text-sm text-white/90 transition hover:bg-white/10"
            >
              Demo είσοδος
            </Link>
          </div>
        </div>
      </section>

      <section className="page-shell max-w-[96rem] py-16 md:py-24">
        <h2 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
          Τρία σε ένα
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Ό,τι χρειάζεσαι καθημερινά στο γκισέ, στο site και στην ΑΑΔΕ — χωρίς
          Excel και χωρίς διπλοεγγραφές.
        </p>
        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-12">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="animate-fade-up border-t border-border/80 pt-6"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <Icon className="h-6 w-6 text-accent" />
                <h3 className="font-display mt-5 text-xl text-ink">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border/70 bg-surface">
        <div className="page-shell flex max-w-[96rem] flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-lg text-accent">RentFleet</span>
          <div className="flex items-center gap-4 text-sm text-muted">
            <Link href="/login" className="transition hover:text-foreground">
              Είσοδος
            </Link>
            <Link href="/register" className="transition hover:text-foreground">
              Εγγραφή
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
