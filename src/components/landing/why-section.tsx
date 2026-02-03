import { BookOpen, Calendar, MessageSquare, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: Star,
    title: "Professor Ratings",
    description:
      "Access detailed ratings and reviews from fellow students to make informed decisions.",
  },
  {
    icon: BookOpen,
    title: "Course Notes",
    description:
      "Share and discover notes, study guides, and resources for your courses.",
  },
  {
    icon: MessageSquare,
    title: "Discussion Forums",
    description:
      "Connect with classmates, ask questions, and collaborate on coursework.",
  },
  {
    icon: Calendar,
    title: "Schedule Builder",
    description:
      "Plan your semester with our visual schedule builder and avoid conflicts.",
  },
];

export function WhySection() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <Badge className="mb-4" variant="outline">
            Features
          </Badge>
          <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">
            Why Use AcadiaOne?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Everything you need for a smoother academic experience
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
