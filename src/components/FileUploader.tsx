import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, AlertCircle } from "lucide-react";

interface FileUploaderProps {
  files: File[];
  setFiles: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export const FileUploader = ({ 
  files, 
  setFiles, 
  maxFiles = 500,
  disabled = false 
}: FileUploaderProps) => {
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (disabled) return;

    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(f => f.errors[0]?.message).filter(Boolean);
      toast({
        title: "Invalid Files",
        description: errors[0] || "Some files were rejected. Please upload PDF files only.",
        variant: "destructive",
      });
    }

    const newFiles = [...files, ...acceptedFiles];
    if (newFiles.length > maxFiles) {
      toast({
        title: "Too Many Files",
        description: `Maximum ${maxFiles} files allowed.`,
        variant: "destructive",
      });
      return;
    }

    setFiles(newFiles);
  }, [files, setFiles, maxFiles, disabled, toast]);

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: maxFiles - files.length,
    disabled,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          relative rounded-lg border-2 border-dashed p-8 text-center transition-all
          ${isDragActive ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={`
            flex h-14 w-14 items-center justify-center rounded-full
            ${isDragActive ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}
          `}>
            <Upload className="h-7 w-7" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {isDragActive ? "Drop files here" : "Drag & drop CVs here"}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse • PDF files only • Max {maxFiles} files
            </p>
          </div>
          {!disabled && (
            <Button type="button" variant="outline" size="sm" className="mt-2">
              Browse Files
            </Button>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFiles([])}
              className="text-destructive hover:text-destructive"
            >
              Clear all
            </Button>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {disabled && (
        <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Only administrators can upload CVs for analysis.</span>
        </div>
      )}
    </div>
  );
};
