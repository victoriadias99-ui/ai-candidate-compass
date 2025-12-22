import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ArrowRight, Brain, Users, FileText, BarChart3, Shield, Zap, Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, isAdmin, isLoading: roleLoading } = useRole();

  useEffect(() => {
    if (!roleLoading && user) {
      // Redirect based on role: admins to dashboard, users to history
      if (isAdmin) {
        navigate("/dashboard");
      } else {
        navigate("/history");
      }
    }
  }, [user, isAdmin, roleLoading, navigate]);

  const features = [
    {
      icon: Brain,
      title: t("feature1Title"),
      description: t("feature1Desc"),
    },
    {
      icon: FileText,
      title: "Procesamiento Masivo de CVs",
      description: "Sube hasta 50 CVs a la vez. Nuestra IA extrae y analiza toda la información relevante automáticamente.",
    },
    {
      icon: BarChart3,
      title: t("feature3Title"),
      description: t("feature3Desc"),
    },
    {
      icon: Users,
      title: "Colaboración en Equipo",
      description: "Roles de administrador y usuario permiten colaboración segura en tu equipo de RRHH.",
    },
    {
      icon: Shield,
      title: "Evaluación Objetiva",
      description: "Elimina sesgos con evaluaciones consistentes impulsadas por IA para cada candidato.",
    },
    {
      icon: Zap,
      title: "Resultados Instantáneos",
      description: "Obtén evaluaciones completas en segundos, no en horas. Acelera tu proceso de contratación.",
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
            <LanguageSelector />
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              {t("signIn")}
            </Button>
            <Button onClick={() => navigate("/auth")} className="gap-2">
              {t("getStarted")} <ArrowRight className="h-4 w-4" />
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
              {t("landingTitle")}
            </div>
            <h1 className="mb-6 font-display text-5xl font-bold leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl">
              {t("landingSubtitle")}
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Sube CVs, define tus criterios y deja que nuestra IA evalúe, puntúe y clasifique candidatos automáticamente. Toma decisiones de contratación basadas en datos en minutos, no en semanas.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/auth")} className="gap-2 px-8 text-lg">
                {t("getStarted")} <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="px-8 text-lg">
                Ver Demo
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
              {t("features")}
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {t("featuresSubtitle")}
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
                ¿Listo para Transformar tu Proceso de Contratación?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-primary-foreground/80">
                Únete a los equipos de RRHH líderes que usan IA para encontrar los mejores candidatos de forma más rápida y precisa.
              </p>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate("/auth")}
                className="gap-2 px-8 text-lg"
              >
                {t("getStarted")} <ArrowRight className="h-5 w-5" />
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
              © 2024 TalentAI. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
