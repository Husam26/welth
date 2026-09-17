'use client'

import Image from "next/image"
import { motion, useScroll, useTransform } from "framer-motion"
import { Button } from "./ui/button"
import Link from "next/link"
import { useRef } from "react"

const Hero = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const scale = useTransform(scrollYProgress, [0, 1], [1.0, 1.08]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.85]);

  return (
    <section className="px-4 pb-20 pt-16">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          AI-powered personal finance
        </span>

        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
          Manage your finances
          <br className="hidden sm:block" /> with <span className="text-primary">intelligence</span>
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground">
          Track, analyze and optimize your spending with AI receipt scanning, smart budgets,
          anomaly detection and a financial digital twin.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard">
            <Button size="lg" className="px-8">Get Started</Button>
          </Link>
          <Link href="#features">
            <Button size="lg" variant="outline" className="px-8">Learn More</Button>
          </Link>
        </div>
      </div>

      <motion.div ref={ref} style={{ scale, opacity }} className="mx-auto mt-14 max-w-5xl">
        <Image
          src="/hero.webp"
          alt="Welth dashboard preview"
          width={2000}
          height={620}
          className="mx-auto rounded-xl border border-border shadow-2xl shadow-primary/5"
          priority
        />
      </motion.div>
    </section>
  )
}

export default Hero
