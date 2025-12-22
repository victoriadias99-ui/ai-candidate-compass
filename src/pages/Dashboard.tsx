import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Header } from "@/components/Header";
import { FileUploader } from "@/components/FileUploader";
import { GoogleSheetsConfig } from "@/components/GoogleSheetsConfig";
import { 
  Brain, 
  Loader2, 
  Sparkles, 
  Target, 
  Briefcase, 
  Heart,
  Upload,
  Sheet,
  Lock
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user, isAdmin, isLoading: roleLoading, isActive } = useRole();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Form state
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [technicalWeight, setTechnicalWeight] = useState([60]);
  const [experienceWeight, setExperienceWeight] = useState([25]);
  const [softSkillsWeight, setSoftSkillsWeight] = useState([15]);
  const [files, setFiles] = useState<File[]>([]);
  const [dataSource, setDataSource] = useState<"cv" | "sheets">("sheets");
  const [sheetsConfigId, setSheetsConfigId] = useState<string | null>(null);
  const [jobPositionId, setJobPositionId] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !user) {
      navigate("/auth");
    }
    // Redirect non-admins to history - they can't access dashboard
    if (!roleLoading && user && !isAdmin) {
      navigate("/history");
    }
  }, [user, roleLoading, isAdmin, navigate]);

  // Check if user is active
  useEffect(() => {
    if (!roleLoading && user && !isActive) {
      toast({
        title: "Cuenta desactivada",
        description: "Tu cuenta ha sido desactivada. Contacta al administrador.",
        variant: "destructive",
      });
      supabase.auth.signOut();
      navigate("/auth");
    }
  }, [isActive, roleLoading, user, navigate, toast]);

  const createJobPosition = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: t("fillAllFields"),
        description: t("jobDescriptionPlaceholder"),
        variant: "destructive",
      });
      return null;
    }

    const { data: jobPosition, error: jobError } = await supabase
      .from("job_positions")
      .insert({
        user_id: user?.id,
        title: jobTitle || "Posición sin título",
        description: jobDescription,
        technical_weight: technicalWeight[0],
        experience_weight: experienceWeight[0],
        soft_skills_weight: softSkillsWeight[0],
      })
      .select()
      .single();

    if (jobError) throw jobError;
    setJobPositionId(jobPosition.id);
    return jobPosition;
  };

  const handleSheetsConfigured = async (configId: string, createdJobPositionId: string) => {
    setSheetsConfigId(configId);
    setJobPositionId(createdJobPositionId);

    toast({
      title: t("success"),
      description: "Google Sheets configurado. Sincronizando candidatos...",
    });

    // Sync candidates from Google Sheets (optimized to avoid timeouts)
    setIsAnalyzing(true);
    try {
      const { error: syncError } = await supabase.functions.invoke("sync-google-sheets", {
        body: { jobPositionId: createdJobPositionId, configId },
      });

      if (syncError) throw syncError;

      toast({
        title: t("analysisStarted"),
        description: "Sincronización completa. Iniciando análisis por lotes...",
      });

      // Navigate to results: Results page will continue analysis in small batches.
      navigate(`/results/${createdJobPositionId}`);
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: t("analysisError"),
        description: error.message || t("analysisErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: t("fillAllFields"),
        description: t("jobDescriptionPlaceholder"),
        variant: "destructive",
      });
      return;
    }

    if (dataSource === "cv" && files.length === 0) {
      toast({
        title: t("uploadAtLeastOne"),
        description: t("uploadCVsDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!isAdmin) {
      toast({
        title: t("error"),
        description: "Solo los administradores pueden analizar candidatos.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const jobPosition = await createJobPosition();
      if (!jobPosition) return;

      if (dataSource === "sheets") {
        // For sheets, we need to configure first
        setJobPositionId(jobPosition.id);
        setIsAnalyzing(false);
        return;
      }

      // CV-based analysis
      for (const file of files) {
        const filePath = `${user?.id}/${jobPosition.id}/${Date.now()}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("cvs")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        await supabase.from("candidates").insert({
          job_position_id: jobPosition.id,
          name: file.name.replace(".pdf", ""),
          cv_file_path: filePath,
        });
      }

      // Analysis is handled in Results page in small batches to avoid request timeouts
      toast({
        title: t("analysisStarted"),
        description: t("analysisStartedDesc"),
      });

      navigate(`/results/${jobPosition.id}`);
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: t("analysisError"),
        description: t("analysisErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalWeight = technicalWeight[0] + experienceWeight[0] + softSkillsWeight[0];

  if (roleLoading || !user || !isAdmin) {
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
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">{t("newAnalysis")}</h1>
          <p className="text-muted-foreground">
            {t("uploadCVsDesc")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Job Description Card */}
          <Card className="lg:col-span-2 border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Briefcase className="h-5 w-5 text-primary" />
                {t("jobDescription")}
              </CardTitle>
              <CardDescription>
                Describe el rol y los requisitos. La IA evaluará a los candidatos según esta descripción.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job-title">{t("jobTitle")}</Label>
                <Input
                  id="job-title"
                  placeholder={t("jobTitlePlaceholder")}
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-description">{t("jobDescription")}</Label>
                <Textarea
                  id="job-description"
                  placeholder={t("jobDescriptionPlaceholder")}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[200px] resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Weights Card */}
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Target className="h-5 w-5 text-primary" />
                {t("evaluationWeights")}
              </CardTitle>
              <CardDescription>
                Ajusta la importancia de cada criterio de evaluación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    {t("technicalSkills")}
                  </Label>
                  <span className="text-sm font-medium text-foreground">{technicalWeight[0]}%</span>
                </div>
                <Slider
                  value={technicalWeight}
                  onValueChange={setTechnicalWeight}
                  max={100}
                  step={5}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-accent" />
                    {t("experience")}
                  </Label>
                  <span className="text-sm font-medium text-foreground">{experienceWeight[0]}%</span>
                </div>
                <Slider
                  value={experienceWeight}
                  onValueChange={setExperienceWeight}
                  max={100}
                  step={5}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-accent" />
                    {t("softSkills")}
                  </Label>
                  <span className="text-sm font-medium text-foreground">{softSkillsWeight[0]}%</span>
                </div>
                <Slider
                  value={softSkillsWeight}
                  onValueChange={setSoftSkillsWeight}
                  max={100}
                  step={5}
                  className="cursor-pointer"
                />
              </div>

              <div className={`rounded-lg p-3 text-center text-sm font-medium ${
                totalWeight === 100 
                  ? "bg-success/10 text-success" 
                  : "bg-destructive/10 text-destructive"
              }`}>
                Total: {totalWeight}% {totalWeight !== 100 && "(debe ser 100%)"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Source Selection */}
        <Card className="mt-6 border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="font-display">Fuente de Datos de Candidatos</CardTitle>
            <CardDescription>
              Selecciona de dónde provienen los datos de candidatos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={dataSource} onValueChange={(v) => setDataSource(v as "cv" | "sheets")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sheets" className="gap-2">
                  <Sheet className="h-4 w-4" />
                  Google Sheets (Primario)
                </TabsTrigger>
                <TabsTrigger value="cv" className="gap-2">
                  <Upload className="h-4 w-4" />
                  CVs PDF (Secundario)
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="sheets" className="mt-4">
                <GoogleSheetsConfig
                  jobTitle={jobTitle}
                  jobDescription={jobDescription}
                  technicalWeight={technicalWeight[0]}
                  experienceWeight={experienceWeight[0]}
                  softSkillsWeight={softSkillsWeight[0]}
                  userId={user?.id || ""}
                  onConfigured={handleSheetsConfigured}
                  onCancel={() => setDataSource("cv")}
                />
              </TabsContent>
              
              <TabsContent value="cv" className="mt-4">
                <FileUploader 
                  files={files} 
                  setFiles={setFiles} 
                  maxFiles={500}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Analyze Button */}
        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            onClick={handleAnalyze}
            disabled={isAnalyzing || (dataSource === "cv" && files.length === 0) || totalWeight !== 100}
            className="gap-2 px-12 text-lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("analyzing")}
              </>
            ) : (
              <>
                <Brain className="h-5 w-5" />
                {t("analyzeWithAI")}
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
