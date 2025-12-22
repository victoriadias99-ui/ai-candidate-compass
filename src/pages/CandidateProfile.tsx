import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Header } from "@/components/Header";
import { CandidateComments } from "@/components/CandidateComments";
import { 
  ArrowLeft,
  Download,
  Loader2,
  User,
  Mail,
  Phone,
  Sparkles,
  Briefcase,
  Heart,
  CheckCircle2,
  XCircle,
  FileText
} from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cv_file_path: string;
  technical_score: number;
  experience_score: number;
  soft_skills_score: number;
  final_score: number;
  recommendation: "strong_hire" | "consider" | "not_recommended" | null;
  ai_evaluation: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  summary: string | null;
  analyzed_at: string | null;
}

const CandidateProfile = () => {
  const navigate = useNavigate();
  const { candidateId } = useParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user, isLoading: roleLoading } = useRole();
  const [isLoading, setIsLoading] = useState(true);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [jobPositionId, setJobPositionId] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !user) {
      navigate("/auth");
    }
  }, [user, roleLoading, navigate]);

  useEffect(() => {
    if (candidateId && user) {
      fetchCandidate();
    }
  }, [candidateId, user]);

  const fetchCandidate = async () => {
    if (!candidateId) return;

    try {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, job_position_id")
        .eq("id", candidateId)
        .single();

      if (error) throw error;
      setCandidate(data);
      setJobPositionId(data.job_position_id);
    } catch (error: any) {
      console.error("Error fetching candidate:", error);
      toast({
        title: t("error"),
        description: "Error al cargar el perfil del candidato.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCV = async () => {
    if (!candidate?.cv_file_path) return;

    try {
      const { data, error } = await supabase.storage
        .from("cvs")
        .download(candidate.cv_file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${candidate.name}-CV.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading CV:", error);
      toast({
        title: t("downloadFailed"),
        description: t("downloadFailedDesc"),
        variant: "destructive",
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getRecommendationBadge = (recommendation: string | null) => {
    switch (recommendation) {
      case "strong_hire":
        return <Badge className="bg-success text-success-foreground">{t("strongHire")}</Badge>;
      case "consider":
        return <Badge className="bg-warning text-warning-foreground">{t("consider")}</Badge>;
      case "not_recommended":
        return <Badge variant="destructive">{t("notRecommended")}</Badge>;
      default:
        return <Badge variant="secondary">{t("pendingAnalysis")}</Badge>;
    }
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">{t("loadingProfile")}</p>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">{t("candidateNotFound")}</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
            {t("goBack")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => jobPositionId ? navigate(`/results/${jobPositionId}`) : navigate(-1)}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToResults")}
          </Button>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground">
                  {candidate.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {candidate.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {candidate.email}
                    </span>
                  )}
                  {candidate.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {candidate.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getRecommendationBadge(candidate.recommendation)}
              <Button variant="outline" onClick={downloadCV}>
                <Download className="mr-2 h-4 w-4" />
                {t("downloadCV")}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Scores Card */}
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="font-display">{t("evaluationScores")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Final Score */}
              <div className="text-center p-6 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">{t("finalScore")}</p>
                <p className={`text-5xl font-bold ${getScoreColor(candidate.final_score || 0)}`}>
                  {candidate.final_score?.toFixed(0) || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t("outOf100")}</p>
              </div>

              {/* Individual Scores */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-accent" />
                      {t("technicalSkills")}
                    </span>
                    <span className={`font-semibold ${getScoreColor(candidate.technical_score || 0)}`}>
                      {candidate.technical_score || 0}
                    </span>
                  </div>
                  <Progress value={candidate.technical_score || 0} className="h-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Briefcase className="h-4 w-4 text-accent" />
                      {t("experience")}
                    </span>
                    <span className={`font-semibold ${getScoreColor(candidate.experience_score || 0)}`}>
                      {candidate.experience_score || 0}
                    </span>
                  </div>
                  <Progress value={candidate.experience_score || 0} className="h-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Heart className="h-4 w-4 text-accent" />
                      {t("softSkills")}
                    </span>
                    <span className={`font-semibold ${getScoreColor(candidate.soft_skills_score || 0)}`}>
                      {candidate.soft_skills_score || 0}
                    </span>
                  </div>
                  <Progress value={candidate.soft_skills_score || 0} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Evaluation Card */}
          <Card className="lg:col-span-2 border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <FileText className="h-5 w-5 text-primary" />
                {t("aiEvaluationSummary")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {candidate.summary ? (
                <p className="text-foreground leading-relaxed">{candidate.summary}</p>
              ) : (
                <p className="text-muted-foreground italic">
                  {t("analysisInProgress")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Strengths and Weaknesses */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card className="border-success/30 bg-success/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-success">
                <CheckCircle2 className="h-5 w-5" />
                {t("strengths")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {candidate.strengths && candidate.strengths.length > 0 ? (
                <ul className="space-y-2">
                  {candidate.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-success flex-shrink-0" />
                      <span className="text-foreground">{strength}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground italic">{t("pendingAnalysisText")}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-destructive">
                <XCircle className="h-5 w-5" />
                {t("areasForImprovement")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {candidate.weaknesses && candidate.weaknesses.length > 0 ? (
                <ul className="space-y-2">
                  {candidate.weaknesses.map((weakness, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />
                      <span className="text-foreground">{weakness}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground italic">{t("pendingAnalysisText")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed AI Evaluation */}
        {candidate.ai_evaluation && (
          <Card className="mt-6 border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="font-display">{t("detailedAIAnalysis")}</CardTitle>
              <CardDescription>
                {t("detailedAnalysisDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="whitespace-pre-wrap">{candidate.ai_evaluation}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default CandidateProfile;
