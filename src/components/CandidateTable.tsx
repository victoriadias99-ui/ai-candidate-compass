import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Search, Loader2 } from "lucide-react";

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
}

interface CandidateTableProps {
  candidates: Candidate[];
  onViewCandidate: (id: string) => void;
}

type SortField = "final_score" | "technical_score" | "experience_score" | "soft_skills_score" | "name";
type SortOrder = "asc" | "desc";

export const CandidateTable = ({ candidates, onViewCandidate }: CandidateTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRecommendation, setFilterRecommendation] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("final_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredCandidates = candidates
    .filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilter = filterRecommendation === "all" || c.recommendation === filterRecommendation;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal?.toLowerCase() || "";
      }
      
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success font-semibold";
    if (score >= 60) return "text-warning font-medium";
    return "text-destructive";
  };

  const getRecommendationBadge = (recommendation: string | null, analyzed: boolean) => {
    if (!analyzed) {
      return (
        <Badge variant="outline" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing
        </Badge>
      );
    }

    switch (recommendation) {
      case "strong_hire":
        return <Badge className="bg-success text-success-foreground">Strong Hire</Badge>;
      case "consider":
        return <Badge className="bg-warning text-warning-foreground">Consider</Badge>;
      case "not_recommended":
        return <Badge variant="destructive">Not Recommended</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterRecommendation} onValueChange={setFilterRecommendation}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter by recommendation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Recommendations</SelectItem>
            <SelectItem value="strong_hire">Strong Hire</SelectItem>
            <SelectItem value="consider">Consider</SelectItem>
            <SelectItem value="not_recommended">Not Recommended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("name")}
                  className="-ml-3 font-semibold"
                >
                  Candidate
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("final_score")}
                  className="font-semibold"
                >
                  Final Score
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center hidden md:table-cell">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("technical_score")}
                  className="font-semibold"
                >
                  Technical
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center hidden md:table-cell">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("experience_score")}
                  className="font-semibold"
                >
                  Experience
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center hidden lg:table-cell">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("soft_skills_score")}
                  className="font-semibold"
                >
                  Soft Skills
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">Recommendation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCandidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No candidates found.
                </TableCell>
              </TableRow>
            ) : (
              filteredCandidates.map((candidate) => (
                <TableRow
                  key={candidate.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onViewCandidate(candidate.id)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{candidate.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {candidate.email || "No email"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-lg ${getScoreColor(candidate.final_score || 0)}`}>
                      {candidate.final_score?.toFixed(0) || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    <span className={getScoreColor(candidate.technical_score || 0)}>
                      {candidate.technical_score || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    <span className={getScoreColor(candidate.experience_score || 0)}>
                      {candidate.experience_score || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center hidden lg:table-cell">
                    <span className={getScoreColor(candidate.soft_skills_score || 0)}>
                      {candidate.soft_skills_score || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getRecommendationBadge(candidate.recommendation, !!candidate.analyzed_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredCandidates.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredCandidates.length} of {candidates.length} candidates
        </p>
      )}
    </div>
  );
};
