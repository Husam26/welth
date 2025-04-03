import Hero from "@/components/Hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { featuresData, howItWorksData, statsData, testimonialsData } from "@/data/landing";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="mt-32">
      <Hero />

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-blue-200">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-12">
            {statsData.map((statsData, index) => (
              <div
                key={index}
                className="text-center p-8 bg-white shadow-lg rounded-lg transition-all hover:shadow-xl hover:scale-102 transform duration-300 ease-in-out"
              >
                <div className="text-4xl font-semibold text-blue-600 mb-3">{statsData.value}</div>
                <div className="text-lg text-gray-700">{statsData.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-14">
            Everything You Need to Manage Your Finances
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {featuresData.map((feature, index) => (
              <Card
                key={index}
                className="p-8 shadow-lg border border-gray-300 rounded-lg hover:shadow-xl transition-all transform hover:scale-105 duration-300 ease-in-out"
              >
                <CardContent className="text-center">
                  <div className="text-5xl text-blue-600 mb-5">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-14">
            How it Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {howItWorksData.map((step, index) => (
              <div
                key={index}
                className="flex flex-col items-center p-8 shadow-lg border border-gray-300 rounded-lg hover:shadow-xl transition-all transform hover:scale-105 duration-300 ease-in-out"
              >
                <div className="text-4xl text-blue-600 mb-5">{step.icon}</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">{step.title}</h3>
                <p className="text-gray-600 text-center">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-semibold text-center text-gray-900 mb-14">
              What Our Users Say
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {testimonialsData.map((testimonial, index) => (
                <Card
                  key={index}
                  className="p-8 shadow-lg border border-gray-200 rounded-lg 
                  bg-white transition-all hover:shadow-xl hover:scale-105 duration-300 ease-in-out"
                >
                  <CardContent className="flex flex-col items-center text-center">
                    <Image
                      src={testimonial.image}
                      alt={testimonial.name}
                      width={60}
                      height={60}
                      className="rounded-full mb-4 border border-gray-300"
                    />
                    <h3 className="text-lg font-semibold text-gray-800">{testimonial.name}</h3>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                    <p className="text-gray-700 mt-4 italic leading-relaxed">
                      "{testimonial.quote}"
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold mb-6 leading-snug">
              Ready to Take Control of Your Finances?
            </h2>
            <p className="text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of users who are already managing their finances smarter with Wealth. 
              Sign up now and start your journey to financial freedom.
            </p>

            <Link href="/">
              <Button
                className="px-8 py-4 text-lg font-semibold rounded-lg bg-white text-blue-600 
                shadow-md hover:bg-blue-500 hover:text-white transition-all duration-300 ease-in-out 
                transform hover:scale-105 hover:shadow-xl relative overflow-hidden"
              >
                <span className="relative z-10">Start Free Trial</span>
                <div className="absolute inset-0 bg-blue-700 opacity-0 transition-all duration-500 ease-in-out 
                group-hover:opacity-100 blur-lg"></div>
              </Button>
            </Link>
          </div>
        </section>
    </div>
  );
}
