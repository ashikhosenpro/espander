import { useEffect } from "react";
import { ExternalLink, Puzzle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openBrowser } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useGlobalTextStore } from "@/stores/useGlobalTextStore";
import { useToolsStore } from "@/stores/useToolsStore";

export function MoreToolsPage() {
  const { tools, isFetching, fetchTools } = useToolsStore();
  const { texts, fetchTexts } = useGlobalTextStore();

  useEffect(() => {
    fetchTools();
    fetchTexts();
  }, [fetchTools, fetchTexts]);

  return (
    <div className="min-h-full p-5">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-normal">{texts.more_tools_title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {texts.more_tools_subtitle}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={fetchTools}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {tools.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool) => (
              <article
                key={tool.id}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
              >
                {tool.image_url ? (
                  <div className="aspect-[16/9] border-b border-border bg-muted/30">
                    <img
                      src={tool.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[16/9] items-center justify-center border-b border-border bg-muted/30 text-muted-foreground">
                    <Puzzle className="h-8 w-8" />
                  </div>
                )}

                <div className="space-y-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-sm font-semibold tracking-normal text-foreground">
                        {tool.name}
                      </h2>
                      {tool.version && (
                        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          v{tool.version}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {tool.short_description}
                    </p>
                  </div>

                  {tool.button_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full gap-1.5 text-xs"
                      onClick={() => openBrowser(tool.button_url)}
                    >
                      {tool.button_label || "Open"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <Puzzle className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">No tools available</p>
            <p className="mt-1 text-xs text-muted-foreground">
              New tools will appear here automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
