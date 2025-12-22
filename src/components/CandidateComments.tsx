import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { MessageSquare, Send, Loader2, Trash2, User } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_email?: string;
}

interface CandidateCommentsProps {
  candidateId: string;
  currentUserId: string;
}

export const CandidateComments = ({ candidateId, currentUserId }: CandidateCommentsProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [candidateId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("candidate_comments")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user emails for comments
      const userIds = [...new Set((data || []).map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("user_id", userIds);

      const commentsWithEmails = (data || []).map((comment) => ({
        ...comment,
        user_email: profiles?.find((p) => p.user_id === comment.user_id)?.email || "Usuario",
      }));

      setComments(commentsWithEmails);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("candidate_comments")
        .insert({
          candidate_id: candidateId,
          user_id: currentUserId,
          content: newComment.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Get current user email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", currentUserId)
        .single();

      setComments((prev) => [
        { ...data, user_email: profile?.email || "Usuario" },
        ...prev,
      ]);
      setNewComment("");

      toast({
        title: t("success"),
        description: "Comentario agregado.",
      });
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast({
        title: t("error"),
        description: "Error al agregar comentario.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("candidate_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      setComments((prev) => prev.filter((c) => c.id !== commentId));

      toast({
        title: t("success"),
        description: "Comentario eliminado.",
      });
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast({
        title: t("error"),
        description: "Error al eliminar comentario.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-border/50 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <MessageSquare className="h-5 w-5 text-primary" />
          Comentarios del Equipo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Escribe un comentario sobre este candidato..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          <Button type="submit" disabled={isSubmitting || !newComment.trim()}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Agregar Comentario
          </Button>
        </form>

        {/* Comments List */}
        <div className="space-y-3 pt-4 border-t border-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay comentarios aún. ¡Sé el primero en comentar!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-lg border border-border bg-card p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {comment.user_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {comment.user_id === currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(comment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-foreground">{comment.content}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
