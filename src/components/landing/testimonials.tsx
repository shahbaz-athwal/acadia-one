"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    quote:
      "AcadiaOne made planning my courses so much easier. The professor ratings are super helpful!",
    name: "Sarah M.",
    program: "Computer Science",
  },
  {
    quote:
      "Finally, a tool that actually helps Acadia students. The schedule builder saved me hours.",
    name: "James K.",
    program: "Business Administration",
  },
  {
    quote:
      "I love being able to see what other students think about courses before I register.",
    name: "Emily R.",
    program: "Psychology",
  },
  {
    quote:
      "The discussion forums are great for finding study groups and getting help with assignments.",
    name: "Michael T.",
    program: "Biology",
  },
  {
    quote:
      "This is exactly what I needed for course planning. Way better than the official system.",
    name: "Lisa P.",
    program: "English",
  },
  {
    quote:
      "The notes section helped me find amazing study resources for my exams.",
    name: "David L.",
    program: "History",
  },
];

const firstRow = testimonials.slice(0, 3);
const secondRow = testimonials.slice(3);

function TestimonialCard({ quote, name, program }: (typeof testimonials)[0]) {
  return (
    <Card className="w-80 shrink-0">
      <CardContent className="pt-6">
        <p className="text-sm">&ldquo;{quote}&rdquo;</p>
        <div className="mt-4">
          <p className="font-medium text-sm">{name}</p>
          <p className="text-muted-foreground text-xs">{program}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MarqueeRow({
  items,
  reverse = false,
}: {
  items: typeof testimonials;
  reverse?: boolean;
}) {
  return (
    <div className="mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] flex overflow-hidden">
      <motion.div
        animate={{ x: reverse ? ["0%", "-50%"] : ["-50%", "0%"] }}
        className="flex gap-4"
        transition={{
          x: {
            duration: 30,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          },
        }}
      >
        {[...items, ...items].map((testimonial, i) => (
          <TestimonialCard key={`${testimonial.name}-${i}`} {...testimonial} />
        ))}
      </motion.div>
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <Badge className="mb-4" variant="outline">
            Testimonials
          </Badge>
          <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">
            Loved by Acadia Students
          </h2>
          <p className="mt-4 text-muted-foreground">
            See what the community is saying about AcadiaOne
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <MarqueeRow items={firstRow} />
        <MarqueeRow items={secondRow} reverse />
      </div>
    </section>
  );
}
