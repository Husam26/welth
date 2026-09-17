import Hero from "@/components/Hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { featuresData, howItWorksData, statsData, testimonialsData } from "@/data/landing";
import MarketingHeader from "@/components/marketing-header";
import MarketingFooter from "@/components/marketing-footer";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <MarketingHeader />
      <div className="pt-16">
        <Hero />

        {/* Stats */}
        <section className="border-y border-border bg-muted/40 py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 lg:grid-cols-4">
            {statsData.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-semibold tracking-tight text-foreground nums">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-foreground">
              Everything you need to manage your finances
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuresData.map((feature, index) => (
                <Card key={index} className="transition-colors hover:border-primary/30">
                  <CardContent className="space-y-3">
                    <div className="text-primary">{feature.icon}</div>
                    <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border bg-muted/40 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-foreground">
              How it works
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {howItWorksData.map((step, index) => (
                <div key={index} className="flex flex-col items-center text-center">
                  <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-foreground">
              What our users say
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {testimonialsData.map((testimonial, index) => (
                <Card key={index}>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Image
                        src={testimonial.image}
                        alt={testimonial.name}
                        width={44}
                        height={44}
                        className="rounded-full border border-border"
                      />
                      <div>
                        <p className="font-medium text-foreground">{testimonial.name}</p>
                        <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      “{testimonial.quote}”
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 pb-20">
          <div className="mx-auto max-w-5xl rounded-2xl bg-primary px-6 py-16 text-center text-primary-foreground">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to take control of your finances?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
              Join thousands managing their money smarter with Welth. Start your journey to
              financial clarity today.
            </p>
            <Link href="/dashboard">
              <Button size="lg" variant="secondary" className="mt-8 px-8">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </section>
      </div>
      <MarketingFooter />
    </>
  );
}
