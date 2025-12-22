import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, Sparkles, Briefcase, Heart } from "lucide-react";

interface JobPosition {
  id: string;
  title: string;
  description: string;
  technical_weight: number;
  experience_weight: number;
  soft_skills_weight: number;
  status: string | null;
}

interface EditJobDialogProps {
  job: JobPosition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedJob: JobPosition, recalculate: boolean) => void;
}

export const EditJobDialog = ({
  job,
  open,
  onOpenChange,
  onSave,
}: EditJobDialogProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [technicalWeight, setTechnicalWeight] = useState([60]);
  const [experienceWeight, setExperienceWeight] = useState([25]);
  const [softSkillsWeight, setSoftSkillsWeight] = useState([15]);
  const [status, setStatus] = useState<string>("active");
  const [recalculateScores, setRecalculateScores] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (job) {
      setTitle(job.title);
      setDescription(job.description);
      setTechnicalWeight([job.technical_weight]);
      setExperienceWeight([job.experience_weight]);
      setSoftSkillsWeight([job.soft_skills_weight]);
      setStatus(job.status || "active");
      setRecalculateScores(false);
    }
  }, [job]);

  const totalWeight = technicalWeight[0] + experienceWeight[0] + softSkillsWeight[0];

  const handleSave = async () => {
    if (!job) return;
    if (!title.trim() || !description.trim()) {
      toast({
        title: t("error"),
        description: "El título y la descripción son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    if (totalWeight !== 100) {
      toast({
        title: t("error"),
        description: "Los pesos deben sumar 100%.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("job_positions")
        .update({
          title: title.trim(),
          description: description.trim(),
          technical_weight: technicalWeight[0],
          experience_weight: experienceWeight[0],
          soft_skills_weight: softSkillsWeight[0],
          status,
        })
        .eq("id", job.id);

      if (error) throw error;

      const updatedJob: JobPosition = {
        ...job,
        title: title.trim(),
        description: description.trim(),
        technical_weight: technicalWeight[0],
        experience_weight: experienceWeight[0],
        soft_skills_weight: softSkillsWeight[0],
        status,
      };

      toast({
        title: t("success"),
        description: "Posición actualizada correctamente.",
      });

      onSave(updatedJob, recalculateScores);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating job:", error);
      toast({
        title: t("error"),
        description: "Error al actualizar la posición.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Editar Posición</DialogTitle>
          <DialogDescription>
            Modifica los detalles de la posición. Los cambios se guardarán inmediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="job-title">Título del Puesto</Label>
            <Input
              id="job-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Desarrollador Senior React"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="job-description">Descripción</Label>
            <Textarea
              id="job-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe los requisitos y responsabilidades del puesto..."
              className="min-h-[150px] resize-none"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Abierta</SelectItem>
                <SelectItem value="closed">Cerrada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Weights */}
          <div className="space-y-4">
            <Label>Pesos de Evaluación</Label>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-accent" />
                  Habilidades Técnicas
                </span>
                <span className="text-sm font-medium">{technicalWeight[0]}%</span>
              </div>
              <Slider
                value={technicalWeight}
                onValueChange={setTechnicalWeight}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-accent" />
                  Experiencia
                </span>
                <span className="text-sm font-medium">{experienceWeight[0]}%</span>
              </div>
              <Slider
                value={experienceWeight}
                onValueChange={setExperienceWeight}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Heart className="h-4 w-4 text-accent" />
                  Habilidades Blandas
                </span>
                <span className="text-sm font-medium">{softSkillsWeight[0]}%</span>
              </div>
              <Slider
                value={softSkillsWeight}
                onValueChange={setSoftSkillsWeight}
                max={100}
                step={5}
              />
            </div>

            <div
              className={`rounded-lg p-3 text-center text-sm font-medium ${
                totalWeight === 100
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              Total: {totalWeight}% {totalWeight !== 100 && "(debe ser 100%)"}
            </div>
          </div>

          {/* Recalculate Option */}
          <div className="flex items-center space-x-2 rounded-lg border border-border p-4">
            <Checkbox
              id="recalculate"
              checked={recalculateScores}
              onCheckedChange={(checked) => setRecalculateScores(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="recalculate"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Recalcular puntuaciones
              </label>
              <p className="text-sm text-muted-foreground">
                Volver a analizar todos los candidatos con los nuevos criterios.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
