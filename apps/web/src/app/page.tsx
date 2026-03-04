import Link from 'next/link';
import { Mic, BarChart3, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: Mic,
    title: 'Real-time AI Interviews',
    description:
      'Voice-based conversations with an AI interviewer powered by WebRTC. Natural, adaptive questioning tailored to each role.',
  },
  {
    icon: BarChart3,
    title: 'Smart Evaluation',
    description:
      'Automated scoring against customizable rubrics with evidence-backed reasoning from the interview transcript.',
  },
  {
    icon: FileText,
    title: 'Detailed Reports',
    description:
      'Comprehensive PDF reports with strengths, weaknesses, criterion breakdowns, and hiring recommendations.',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="container py-24 md:py-32 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          AI-powered interviews
          <br />
          <span className="text-primary">built for enterprise</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Streamline your technical hiring with intelligent virtual interviews. Consistent,
          unbiased, and scalable candidate assessment powered by AI.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/login">
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="relative overflow-hidden">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="container pb-16">
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            AI-powered evaluation results are advisory only. Final hiring decisions should
            always be made by qualified human recruiters.
          </p>
        </div>
      </section>
    </div>
  );
}
