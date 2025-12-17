import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Users, FileText, BarChart3, Shield, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Analysis",
      description: "Advanced AI evaluates candidates against your specific requirements with precision scoring.",
    },
    {
      icon: FileText,
      title: "Bulk CV Processing",
      description: "Upload up to 50 CVs at once. Our AI extracts and analyzes all relevant information automatically.",
    },
    {
      icon: BarChart3,
      title: "Smart Rankings",
      description: "Get instant rankings with Top 3 and Top 5 shortlists based on weighted criteria you define.",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Admin and user roles enable secure collaboration across your HR team.",
    },
    {
      icon: Shield,
      title: "Objective Evaluation",
      description: "Eliminate bias with consistent AI-driven assessments for every candidate.",
    },
    {
      icon: Zap,
      title: "Instant Results",
      description: "Get comprehensive evaluations in seconds, not hours. Accelerate your hiring process.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">TalentAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")} className="gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(185_75%_38%/0.1),transparent_50%)]" />
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
              <Zap className="h-4 w-4" />
              AI-Powered Recruitment Platform
            </div>
            <h1 className="mb-6 font-display text-5xl font-bold leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl">
              Hire Smarter with{" "}
              <span className="gradient-text">AI-Driven</span>{" "}
              Candidate Analysis
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Upload CVs, define your criteria, and let our AI evaluate, score, and rank candidates 
              automatically. Make data-driven hiring decisions in minutes, not weeks.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/auth")} className="gap-2 px-8 text-lg">
                Start Analyzing <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="px-8 text-lg">
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
              Everything You Need for Modern Recruitment
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Our platform combines cutting-edge AI with intuitive design to streamline your entire hiring process.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-accent/30"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-accent/10 group-hover:text-accent">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-2xl bg-primary p-12 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(185_75%_38%/0.2),transparent_70%)]" />
            <div className="relative z-10">
              <h2 className="mb-4 font-display text-3xl font-bold text-primary-foreground md:text-4xl">
                Ready to Transform Your Hiring?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-primary-foreground/80">
                Join leading HR teams using AI to find the best candidates faster and more accurately.
              </p>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate("/auth")}
                className="gap-2 px-8 text-lg"
              >
                Get Started Free <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold text-foreground">TalentAI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 TalentAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
