import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Header } from "@/components/Header";
import { 
  Loader2, 
  FolderOpen, 
  Calendar, 
  Users,
  ChevronRight,
  Plus,
  Trash2
} from "lucide-react";
import type { User, Session } from "@supabase/supabase-js";

interface JobPosition {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status: string;
  candidate_count?: number;
}

const History = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchJobPositions();
    }
  }, [user]);

  const fetchJobPositions = async () => {
    try {
      const { data: jobs, error } = await supabase
        .from("job_positions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const jobsWithCounts = await Promise.all(
        (jobs || []).map(async (job) => {
          const { count } = await supabase
            .from("candidates")
            .select("*", { count: "exact", head: true })
            .eq("job_position_id", job.id);
          
          return { ...job, candidate_count: count || 0 };
        })
      );

      setJobPositions(jobsWithCounts);
    } catch (error: any) {
      console.error("Error fetching job positions:", error);
      toast({
        title: t("error"),
        description: "Error al cargar el historial de análisis.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Delete related data first (cascade)
      const { data: candidates } = await supabase.from("candidates").select("id").eq("job_position_id", jobId);
      if (candidates && candidates.length > 0) {
        await supabase.from("candidate_responses").delete().in("candidate_id", candidates.map(c => c.id));
      }
      await supabase.from("candidates").delete().eq("job_position_id", jobId);
      
      const { data: configs } = await supabase.from("google_sheets_config").select("id").eq("job_position_id", jobId);
      if (configs && configs.length > 0) {
        await supabase.from("column_mappings").delete().in("google_sheets_config_id", configs.map(c => c.id));
      }
      await supabase.from("google_sheets_config").delete().eq("job_position_id", jobId);
      
      const { error } = await supabase.from("job_positions").delete().eq("id", jobId);
      if (error) throw error;

      setJobPositions(prev => prev.filter(j => j.id !== jobId));
      toast({
        title: t("success"),
        description: "Posición eliminada correctamente",
      });
    } catch (error: any) {
      console.error("Error deleting job:", error);
      toast({
        title: t("error"),
        description: "Error al eliminar la posición",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">{t("analysisHistory")}</h1>
            <p className="text-muted-foreground">
              {t("analysisHistoryDesc")}
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard")} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("newAnalysis")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : jobPositions.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{t("noAnalysesYet")}</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {t("noAnalysesDesc")}
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                {t("startFirstAnalysis")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {jobPositions.map((job) => (
              <Card
                key={job.id}
                className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate(`/results/${job.id}`)}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{job.title}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {job.candidate_count} {t("candidates")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={job.status === "active" ? "default" : "secondary"}>
                      {job.status === "active" ? t("active") : t("completed")}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar posición?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará la posición "{job.title}" y todos sus candidatos asociados. Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => handleDeleteJob(job.id, e)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default History;
