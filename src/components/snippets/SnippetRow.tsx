import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
  Globe,
  FileText,
  HardDrive,
} from "lucide-react";
import { useSnippetStore } from "@/stores/useSnippetStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import type { Snippet } from "@/types";

interface SnippetRowProps {
  snippet: Snippet;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  grid?: boolean;
}

const sourceLabels: Record<string, { label: string; icon: typeof HardDrive }> = {
  local: { label: "Local", icon: HardDrive },
  google_sheets: { label: "Sheets", icon: FileText },
  github: { label: "GitHub", icon: Globe },
};

export function SnippetRow({ snippet, selected, onSelect, onEdit, grid }: SnippetRowProps) {
  const { toggleFavorite, deleteSnippet } = useSnippetStore();
  const { categories } = useCategoryStore();

  const category = categories.find((c) => c.id === snippet.category_id);
  const sourceInfo = sourceLabels[snippet.source] || sourceLabels.local;
  const SourceIcon = sourceInfo.icon;

  if (grid) {
    return (
      <div
        className={cn(
          "group relative rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:shadow-md hover:border-indigo-500/30",
          selected && "border-indigo-500/50 ring-1 ring-indigo-500/20"
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Checkbox checked={selected} onCheckedChange={() => onSelect()} />
            <code className="text-sm font-mono font-medium text-indigo-400 truncate">
              {snippet.trigger}
            </code>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => toggleFavorite(snippet.id)}
              className={cn(
                "p-1 rounded-md transition-colors",
                snippet.is_favorite
                  ? "text-yellow-400 hover:text-yellow-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Star className={cn("h-3.5 w-3.5", snippet.is_favorite && "fill-current")} />
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 font-mono text-xs">
          {snippet.replace}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {category && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5"
                style={{
                  backgroundColor: `${category.color}15`,
                  color: category.color,
                  borderColor: `${category.color}30`,
                }}
              >
                {category.name}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <SourceIcon className="h-3 w-3" />
              {sourceInfo.label}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300"
                onClick={() => deleteSnippet(snippet.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[32px_0.8fr_1.2fr_110px_90px_110px_72px] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors",
        selected && "bg-indigo-500/5"
      )}
    >
      <Checkbox checked={selected} onCheckedChange={() => onSelect()} />
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(snippet.id);
          }}
          className={cn(
            "flex-shrink-0 transition-colors",
            snippet.is_favorite
              ? "text-yellow-400"
              : "text-muted-foreground/30 hover:text-muted-foreground"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", snippet.is_favorite && "fill-current")} />
        </button>
        <code className="text-sm font-mono font-medium text-indigo-400 truncate">
          {snippet.trigger}
        </code>
      </div>
      <div className="text-sm text-muted-foreground truncate font-mono text-xs">
        {snippet.replace}
      </div>
      <div>
        {category && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-5"
            style={{
              backgroundColor: `${category.color}15`,
              color: category.color,
              borderColor: `${category.color}30`,
            }}
          >
            {category.name}
          </Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <SourceIcon className="h-3 w-3" />
        <span>{sourceInfo.label}</span>
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(snippet.updated_at)}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              className="text-red-400 focus:text-red-300"
              onClick={() => deleteSnippet(snippet.id)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
