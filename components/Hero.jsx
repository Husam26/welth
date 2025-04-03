'use client'

import Image from "next/image"
import { motion, useScroll, useTransform } from "framer-motion"
import { Button } from "./ui/button"
import Link from "next/link"
import { useRef } from "react"

const Hero = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref });

  // Scale effect: Image will slightly zoom in on scroll
  const scale = useTransform(scrollYProgress, [0, 1], [1.0, 1.1]); // Zoom effect
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.8]); // Fades out slightly

  // To make the transition smoother, we add a spring animation or easing
  const smoothScale = useTransform(scale, (value) => value, {
    ease: "easeOut", // Add a smooth easing curve
    duration: 0.6, // Customize duration for a smoother effect
  });

  const smoothOpacity = useTransform(opacity, (value) => value, {
    ease: "easeOut", // Smoother easing for opacity as well
    duration: 0.6, // Match the transition duration with the scale
  });

  return (
    <div className="pb-20 px-3 py-5 bg-white text-white">
      <div className="max-w-5xl mx-auto text-center flex flex-col items-center justify-center space-y-8 relative">
        
        {/* Heading Section */}
        <div className="space-y-3">
          <h1 className="text-6xl font-extrabold leading-tight bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 text-transparent bg-clip-text">
            Manage Your Finances
            <br /> with Intelligence
          </h1>
          <p className="text-xl max-w-3xl mx-auto bg-gradient-to-r from-gray-700 via-gray-900 to-black text-transparent bg-clip-text">
            An AI-powered financial management platform that helps you track, analyze, and optimize your spending with real-time insights.
          </p>
        </div>

        {/* Button Section */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link href="/">
            <Button size="lg" className="px-10 text-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90 transition duration-300">
              Get Started
            </Button>
          </Link>
          <Link href="/learn-more">
            <Button size="lg" variant="outline" className="px-10 text-lg border border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white transition duration-300">
              Learn More
            </Button>
          </Link>
        </div>

        {/* Image Section with Scroll Animation */}
        <motion.div
          ref={ref}
          style={{
            scale: smoothScale,
            opacity: smoothOpacity,
          }}
          className="mt-12"
        >
          <Image
            src="/hero.webp"
            alt="Financial Management Banner"
            width={2000}
            height={620}
            className="rounded-lg shadow-lg border mx-auto"
          />
        </motion.div>

      </div>
    </div>
  )
}

export default Hero
