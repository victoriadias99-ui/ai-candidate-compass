import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { 
  Loader2, 
  Sheet, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Settings2,
  Trash2
} from "lucide-react";

interface ColumnMapping {
  column_index: number;
  column_name: string;
  mapping_type: string;
  weight: number;
  is_knockout: boolean;
  knockout_value: string;
  knockout_operator: string;
}

interface GoogleSheetsConfigProps {
  jobTitle: string;
  jobDescription: string;
  technicalWeight: number;
  experienceWeight: number;
  softSkillsWeight: number;
  userId: string;
  onConfigured: (configId: string, jobPositionId: string) => void;
  onCancel: () => void;
}

const MAPPING_TYPES = [
  { value: "name", label: "Nombre del candidato", icon: "👤" },
  { value: "email", label: "Email", icon: "📧" },
  { value: "phone", label: "Teléfono", icon: "📱" },
  { value: "technical", label: "Habilidad técnica", icon: "💻" },
  { value: "experience", label: "Experiencia", icon: "📊" },
  { value: "soft_skills", label: "Habilidad blanda", icon: "🤝" },
  { value: "knockout", label: "Criterio eliminatorio", icon: "⚠️" },
  { value: "info", label: "Información adicional", icon: "ℹ️" },
  { value: "ignore", label: "Ignorar", icon: "🚫" },
];

const KNOCKOUT_OPERATORS = [
  { value: "equals", label: "Es igual a" },
  { value: "not_equals", label: "No es igual a" },
  { value: "contains", label: "Contiene" },
  { value: "less_than", label: "Menor que" },
  { value: "greater_than", label: "Mayor que" },
];

export const GoogleSheetsConfig = ({ 
  jobTitle, 
  jobDescription, 
  technicalWeight, 
  experienceWeight, 
  softSkillsWeight, 
  userId,
  onConfigured, 
  onCancel 
}: GoogleSheetsConfigProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [sheetId, setSheetId] = useState("");
  const [sheetName, setSheetName] = useState("Form Responses 1");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [step, setStep] = useState<"connect" | "configure">("connect");

  const extractSheetId = (input: string): string => {
    // Extract ID from full URL or return as-is
    const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return urlMatch ? urlMatch[1] : input;
  };

  const fetchSheetData = async () => {
    if (!sheetId) {
      toast({
        title: t("error"),
        description: "Por favor ingresa el ID o URL del Google Sheet",
        variant: "destructive",
      });
      return;
    }

    setIsFetching(true);
    try {
      const extractedId = extractSheetId(sheetId);
      setSheetId(extractedId);

      const { data, error } = await supabase.functions.invoke("fetch-google-sheets", {
        body: { sheetId: extractedId, sheetName },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setHeaders(data.headers || []);
      setPreviewRows(data.rows?.slice(0, 3) || []);
      setTotalRows(data.totalRows || 0);

      // Initialize mappings with auto-detection
      const autoMappings: ColumnMapping[] = (data.headers || []).map((header: string, index: number) => {
        const lowerHeader = header.toLowerCase();
        let mappingType = "info";
        
        if (lowerHeader.includes("nombre") || lowerHeader.includes("name")) {
          mappingType = "name";
        } else if (lowerHeader.includes("email") || lowerHeader.includes("correo")) {
          mappingType = "email";
        } else if (lowerHeader.includes("teléfono") || lowerHeader.includes("telefono") || lowerHeader.includes("phone") || lowerHeader.includes("celular")) {
          mappingType = "phone";
        } else if (lowerHeader.includes("marca temporal") || lowerHeader.includes("timestamp")) {
          mappingType = "ignore";
        }

        return {
          column_index: index,
          column_name: header,
          mapping_type: mappingType,
          weight: 0,
          is_knockout: false,
          knockout_value: "",
          knockout_operator: "equals",
        };
      });

      setMappings(autoMappings);
      setStep("configure");

      toast({
        title: t("success"),
        description: `Se encontraron ${data.totalRows} candidatos y ${data.headers.length} columnas`,
      });
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast({
        title: t("error"),
        description: error.message || "Error al conectar con Google Sheets",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const updateMapping = (index: number, updates: Partial<ColumnMapping>) => {
    setMappings(prev => prev.map((m, i) => 
      i === index ? { ...m, ...updates } : m
    ));
  };

  const handleSaveConfig = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: t("error"),
        description: "Debes completar la descripción del puesto primero",
        variant: "destructive",
      });
      return;
    }

    // Validate that at least name is mapped
    const nameMapping = mappings.find(m => m.mapping_type === "name");
    if (!nameMapping) {
      toast({
        title: t("error"),
        description: "Debes mapear al menos una columna como 'Nombre del candidato'",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // First create the job position
      const { data: jobPosition, error: jobError } = await supabase
        .from("job_positions")
        .insert({
          user_id: userId,
          title: jobTitle || "Posición sin título",
          description: jobDescription,
          technical_weight: technicalWeight,
          experience_weight: experienceWeight,
          soft_skills_weight: softSkillsWeight,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Create Google Sheets config
      const { data: config, error: configError } = await supabase
        .from("google_sheets_config")
        .insert({
          job_position_id: jobPosition.id,
          sheet_id: extractSheetId(sheetId),
          sheet_name: sheetName,
        })
        .select()
        .single();

      if (configError) throw configError;

      // Insert column mappings
      const { error: mappingsError } = await supabase
        .from("column_mappings")
        .insert(
          mappings.map(m => ({
            google_sheets_config_id: config.id,
            column_index: m.column_index,
            column_name: m.column_name,
            mapping_type: m.mapping_type,
            weight: m.weight,
            is_knockout: m.is_knockout,
            knockout_value: m.knockout_value,
            knockout_operator: m.knockout_operator,
          }))
        );

      if (mappingsError) throw mappingsError;

      toast({
        title: t("success"),
        description: "Configuración guardada correctamente",
      });

      onConfigured(config.id, jobPosition.id);
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: t("error"),
        description: error.message || "Error al guardar la configuración",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "connect") {
    return (
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Sheet className="h-5 w-5 text-primary" />
            Conectar Google Sheets
          </CardTitle>
          <CardDescription>
            Conecta tu Google Sheet con las respuestas del formulario de candidatos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheet-id">ID o URL del Google Sheet</Label>
            <Input
              id="sheet-id"
              placeholder="https://docs.google.com/spreadsheets/d/abc123... o solo el ID"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Asegúrate de compartir el Sheet con la cuenta de servicio configurada
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sheet-name">Nombre de la pestaña</Label>
            <Input
              id="sheet-name"
              placeholder="Form Responses 1"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={fetchSheetData}
              disabled={isFetching || !sheetId}
              className="flex-1"
            >
              {isFetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Conectar y Previsualizar
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Settings2 className="h-5 w-5 text-primary" />
          Configurar Mapeo de Columnas
        </CardTitle>
        <CardDescription>
          {totalRows} candidatos encontrados. Configura cómo evaluar cada pregunta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview */}
        {previewRows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {headers.map((header, i) => (
                    <th key={i} className="p-2 text-left font-medium">
                      {header.substring(0, 30)}{header.length > 30 ? "..." : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 2).map((row, ri) => (
                  <tr key={ri} className="border-t border-border">
                    {row.map((cell, ci) => (
                      <td key={ci} className="p-2 text-muted-foreground">
                        {cell?.substring(0, 25)}{cell?.length > 25 ? "..." : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mappings */}
        <div className="space-y-4">
          <h4 className="font-medium">Configuración de columnas</h4>
          
          {mappings.map((mapping, index) => (
            <div key={index} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">{mapping.column_name}</p>
                  {previewRows[0]?.[index] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ejemplo: {previewRows[0][index]?.substring(0, 50)}
                    </p>
                  )}
                </div>
                
                <Select
                  value={mapping.mapping_type}
                  onValueChange={(value) => updateMapping(index, { mapping_type: value })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAPPING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Weight slider for evaluation types */}
              {["technical", "experience", "soft_skills"].includes(mapping.mapping_type) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Peso de evaluación</Label>
                    <span className="text-xs font-medium">{mapping.weight}%</span>
                  </div>
                  <Slider
                    value={[mapping.weight]}
                    onValueChange={(value) => updateMapping(index, { weight: value[0] })}
                    max={100}
                    step={5}
                  />
                </div>
              )}

              {/* Knockout configuration */}
              {mapping.mapping_type === "knockout" && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mapping.is_knockout}
                      onCheckedChange={(checked) => updateMapping(index, { is_knockout: checked })}
                    />
                    <Label className="text-xs">Activar regla eliminatoria</Label>
                  </div>
                  
                  {mapping.is_knockout && (
                    <div className="flex gap-2">
                      <Select
                        value={mapping.knockout_operator}
                        onValueChange={(value) => updateMapping(index, { knockout_operator: value })}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KNOCKOUT_OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Valor (ej: No, 0, etc.)"
                        value={mapping.knockout_value}
                        onChange={(e) => updateMapping(index, { knockout_value: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSaveConfig}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Guardar y Continuar
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => setStep("connect")}>
            Volver
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};