import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Header } from "@/components/Header";
import { CandidateTable } from "@/components/CandidateTable";
import { 
  Trophy, 
  Loader2, 
  Download, 
  ArrowLeft,
  Users,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { useRole } from "@/hooks/useRole";

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  technical_score: number;
  experience_score: number;
  soft_skills_score: number;
  final_score: number;
  recommendation: "strong_hire" | "consider" | "not_recommended" | null;
  ai_evaluation: string | null;
  analyzed_at: string | null;
  summary?: string | null;
}

interface JobPosition {
  id: string;
  title: string;
  description: string;
  technical_weight: number;
  experience_weight: number;
  soft_skills_weight: number;
  created_at: string;
  status?: string | null;
}

const isAutoKnockout = (c: Candidate) =>
  c.recommendation === "not_recommended" &&
  typeof c.summary === "string" &&
  c.summary.includes("Descalificado automáticamente");

const isCandidateAnalyzed = (c: Candidate) => !!c.analyzed_at || isAutoKnockout(c);

const Results = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user, isAdmin, isLoading: roleLoading } = useRole();
  const [isLoading, setIsLoading] = useState(true);
  const [jobPosition, setJobPosition] = useState<JobPosition | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);

  useEffect(() => {
    if (!roleLoading && !user) {
      navigate("/auth");
    }
  }, [user, roleLoading, navigate]);

  useEffect(() => {
    if (jobId && user) {
      fetchData();

      const interval = setInterval(fetchData, 5000);
      setRefreshInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [jobId, user]);

  // Auto-run analysis batches while there are pending candidates
  useEffect(() => {
    if (!jobId) return;
    if (isLoading) return;
    if (isRunningAnalysis) return;

    const hasPending = candidates.some((c) => !isCandidateAnalyzed(c));
    if (!hasPending) return;

    runAnalysisBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, isLoading, candidates, isRunningAnalysis]);

  const fetchData = async () => {
    if (!jobId) return;

    try {
      const { data: job, error: jobError } = await supabase
        .from("job_positions")
        .select("*")
        .eq("id", jobId)
        .single();

      if (jobError) throw jobError;
      setJobPosition(job);

      // Admins query candidates directly, non-admins use RPC (no PII)
      let candidateData: Candidate[] = [];
      if (isAdmin) {
        const { data, error: candidateError } = await supabase
          .from("candidates")
          .select("*")
          .eq("job_position_id", jobId)
          .order("final_score", { ascending: false });

        if (candidateError) throw candidateError;
        candidateData = (data || []).map(c => ({
          ...c,
          email: c.email,
        }));
      } else {
        // Non-admin: use RPC which excludes PII
        const { data, error: rpcError } = await supabase.rpc("get_candidates_public", {
          _job_position_id: jobId,
        });

        if (rpcError) throw rpcError;
        candidateData = (data || []).map((c: any) => ({
          ...c,
          email: null, // Ensure email is null for non-admins
        }));
      }

      setCandidates(candidateData);

      const allAnalyzed = candidateData.every(isCandidateAnalyzed);
      if (allAnalyzed && refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: t("error"),
        description: "Error al cargar los resultados.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (candidates.length === 0) return;

    // Only admins can see email in export
    const headers = isAdmin 
      ? [t("name"), t("email"), t("finalScore"), t("technical"), t("experience"), t("softSkills"), t("recommendation")]
      : [t("name"), t("finalScore"), t("technical"), t("experience"), t("softSkills"), t("recommendation")];
    
    const rows = candidates.map(c => {
      const baseRow = [
        c.name,
        c.final_score?.toString() || "0",
        c.technical_score?.toString() || "0",
        c.experience_score?.toString() || "0",
        c.soft_skills_score?.toString() || "0",
        c.recommendation || t("pending"),
      ];
      return isAdmin ? [c.name, c.email || "", ...baseRow.slice(1)] : baseRow;
    });

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidatos-${jobPosition?.title || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: t("exportComplete"),
      description: t("exportCompleteDesc"),
    });
  };

  const getRecommendationText = (rec: string | null) => {
    switch (rec) {
      case "strong_hire":
        return t("strongHire");
      case "consider":
        return t("consider");
      case "not_recommended":
        return t("notRecommended");
      default:
        return t("pending");
    }
  };

  const runAnalysisBatch = async () => {
    if (!jobId) return;

    setIsRunningAnalysis(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-candidates", {
        body: { jobPositionId: jobId, limit: 3 },
      });

      if (error) throw error;

      if (data?.done) {
        toast({
          title: t("success"),
          description: "Análisis completado.",
        });
        setIsRunningAnalysis(false);
        return;
      }

      // Continue in small batches
      setTimeout(runAnalysisBatch, 800);
    } catch (e: any) {
      console.error("Batch analysis error:", e);
      toast({
        title: t("analysisError"),
        description: e?.message || t("analysisErrorDesc"),
        variant: "destructive",
      });
      setIsRunningAnalysis(false);
    }
  };

  const analyzedCandidates = candidates.filter(isCandidateAnalyzed);
  const pendingCandidates = candidates.filter((c) => !isCandidateAnalyzed(c));
  const top3 = analyzedCandidates.slice(0, 3);
  const averageScore = analyzedCandidates.length > 0
    ? (analyzedCandidates.reduce((sum, c) => sum + (c.final_score || 0), 0) / analyzedCandidates.length).toFixed(1)
    : "0";

  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">{t("loadingResults")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(isAdmin ? "/dashboard" : "/history")}
              className="mb-2 -ml-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {isAdmin ? t("backToDashboard") : t("backToHistory")}
            </Button>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {jobPosition?.title || t("analysisResults")}
            </h1>
            <p className="text-muted-foreground">
              {candidates.length} {t("candidatesAnalyzed")}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={candidates.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("exportCSV")}
            </Button>
            {pendingCandidates.length > 0 && (
              <Button onClick={runAnalysisBatch} disabled={isRunningAnalysis}>
                {isRunningAnalysis ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("analyzing")}
                  </>
                ) : (
                  t("analyzeWithAI")
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("totalCandidates")}</p>
                  <p className="text-2xl font-bold text-foreground">{candidates.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("averageScore")}</p>
                  <p className="text-2xl font-bold text-foreground">{averageScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Trophy className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("strongHires")}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {analyzedCandidates.filter(c => c.recommendation === "strong_hire").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                  <BarChart3 className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("pendingAnalysis")}</p>
                  <p className="text-2xl font-bold text-foreground">{pendingCandidates.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Candidates */}
        {top3.length > 0 && (
          <Card className="mb-8 border-accent/30 bg-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Trophy className="h-5 w-5 text-accent" />
                {t("topCandidates")}
              </CardTitle>
              <CardDescription>
                {t("topCandidatesDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {top3.map((candidate, index) => (
                  <div
                    key={candidate.id}
                    className="relative rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
                    onClick={() => navigate(`/candidate/${candidate.id}`)}
                  >
                    <div className="absolute -top-2 -left-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                      #{index + 1}
                    </div>
                    <div className="ml-4">
                      <h3 className="font-semibold text-foreground">{candidate.name}</h3>
                      {isAdmin && (
                        <p className="text-sm text-muted-foreground">{candidate.email || t("noEmail")}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-2xl font-bold text-accent">
                          {candidate.final_score?.toFixed(0) || 0}
                        </span>
                        <Badge
                          variant={
                            candidate.recommendation === "strong_hire" ? "default" :
                            candidate.recommendation === "consider" ? "secondary" : "destructive"
                          }
                          className="text-xs"
                        >
                          {getRecommendationText(candidate.recommendation)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Candidates Table */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="font-display">{t("allCandidates")}</CardTitle>
            <CardDescription>
              {t("allCandidatesDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CandidateTable 
              candidates={candidates} 
              onViewCandidate={(id) => navigate(`/candidate/${id}`)}
              isAdmin={isAdmin}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Results;
