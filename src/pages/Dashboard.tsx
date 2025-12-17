import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { FileUploader } from "@/components/FileUploader";
import { 
  Brain, 
  Loader2, 
  Sparkles, 
  Target, 
  Briefcase, 
  Heart,
  Upload,
  Play
} from "lucide-react";
import type { User, Session } from "@supabase/supabase-js";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Form state
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [technicalWeight, setTechnicalWeight] = useState([60]);
  const [experienceWeight, setExperienceWeight] = useState([25]);
  const [softSkillsWeight, setSoftSkillsWeight] = useState([15]);
  const [files, setFiles] = useState<File[]>([]);

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
      } else {
        checkUserRole(session.user.id);
      }
    });
  }, [navigate]);

  const checkUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (data && data.role === "admin") {
      setIsAdmin(true);
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a job description.",
        variant: "destructive",
      });
      return;
    }

    if (files.length === 0) {
      toast({
        title: "No CVs Uploaded",
        description: "Please upload at least one CV to analyze.",
        variant: "destructive",
      });
      return;
    }

    if (!isAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only administrators can analyze candidates.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      // Create job position
      const { data: jobPosition, error: jobError } = await supabase
        .from("job_positions")
        .insert({
          user_id: user?.id,
          title: jobTitle || "Untitled Position",
          description: jobDescription,
          technical_weight: technicalWeight[0],
          experience_weight: experienceWeight[0],
          soft_skills_weight: softSkillsWeight[0],
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Upload CVs and create candidates
      for (const file of files) {
        const filePath = `${user?.id}/${jobPosition.id}/${Date.now()}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("cvs")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        // Create candidate record
        await supabase.from("candidates").insert({
          job_position_id: jobPosition.id,
          name: file.name.replace(".pdf", ""),
          cv_file_path: filePath,
        });
      }

      // Trigger AI analysis
      const { error: analysisError } = await supabase.functions.invoke("analyze-candidates", {
        body: { jobPositionId: jobPosition.id },
      });

      if (analysisError) throw analysisError;

      toast({
        title: "Analysis Started",
        description: "AI is analyzing your candidates. This may take a few minutes.",
      });

      navigate(`/results/${jobPosition.id}`);
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "An error occurred during analysis.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalWeight = technicalWeight[0] + experienceWeight[0] + softSkillsWeight[0];

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
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">Candidate Analysis</h1>
          <p className="text-muted-foreground">
            Upload CVs and let AI evaluate candidates against your requirements.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Job Description Card */}
          <Card className="lg:col-span-2 border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Briefcase className="h-5 w-5 text-primary" />
                Job Requirements
              </CardTitle>
              <CardDescription>
                Describe the role and requirements. The AI will evaluate candidates against this description.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job-title">Job Title</Label>
                <Input
                  id="job-title"
                  placeholder="e.g., Senior Software Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-description">Job Description & Requirements</Label>
                <Textarea
                  id="job-description"
                  placeholder="Describe the role, responsibilities, required skills, experience level, and any other relevant requirements..."
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
                Evaluation Weights
              </CardTitle>
              <CardDescription>
                Adjust the importance of each evaluation criteria.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    Technical Skills
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
                    Experience
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
                    Soft Skills
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
                Total: {totalWeight}% {totalWeight !== 100 && "(should be 100%)"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* File Upload Card */}
        <Card className="mt-6 border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Upload className="h-5 w-5 text-primary" />
              Upload CVs
            </CardTitle>
            <CardDescription>
              Upload up to 50 PDF files. The AI will extract and analyze candidate information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploader 
              files={files} 
              setFiles={setFiles} 
              maxFiles={50}
              disabled={!isAdmin}
            />
            {!isAdmin && (
              <p className="mt-4 text-sm text-muted-foreground">
                Only administrators can upload and analyze CVs. Contact your admin for access.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Analyze Button */}
        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !isAdmin || files.length === 0 || totalWeight !== 100}
            className="gap-2 px-12 text-lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analyzing Candidates...
              </>
            ) : (
              <>
                <Brain className="h-5 w-5" />
                Analyze Candidates with AI
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
