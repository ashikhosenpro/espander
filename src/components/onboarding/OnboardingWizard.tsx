import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
  detectEspanso,
  importFromGSheet,
  openBrowser,
  testGithubConnection,
  validateGSheetUrl,
} from "@/lib/tauri";
import type { EspansoInfo } from "@/types";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Github,
  Globe,
  Laptop,
  Terminal,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "welcome" | "sync-method" | "github" | "gsheet" | "espanso" | "complete";
type SyncMethod = "github" | "gsheet" | "local" | null;
type GithubConnectionResult = { success: boolean; message: string; default_branch?: string };

export function OnboardingWizard() {
  const { updateSettings } = useSettingsStore();
  const [step, setStep] = useState<Step>("welcome");
  const [syncMethod, setSyncMethod] = useState<SyncMethod>(null);
  const [gsheetUrl, setGsheetUrl] = useState("");
  const [gsheetValid, setGsheetValid] = useState<boolean | null>(null);
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubResult, setGithubResult] = useState<GithubConnectionResult | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [isTestingGithub, setIsTestingGithub] = useState(false);
  const [isConnectingGithub, setIsConnectingGithub] = useState(false);
  const [espansoInfo, setEspansoInfo] = useState<EspansoInfo | null>(null);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    if (step === "espanso") {
      detectEspanso().then((info) => {
        setEspansoInfo(info);
        setDetecting(false);
      });
    }
  }, [step]);

  const handleValidateUrl = async () => {
    const valid = await validateGSheetUrl(gsheetUrl);
    setGsheetValid(valid);
  };

  const handleTestGithub = async (): Promise<GithubConnectionResult> => {
    setIsTestingGithub(true);
    setGithubResult(null);
    try {
      const result = await testGithubConnection(githubRepoUrl, githubToken);
      setGithubResult(result);
      return result;
    } catch (err) {
      const result: GithubConnectionResult = {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      };
      setGithubResult(result);
      return result;
    } finally {
      setIsTestingGithub(false);
    }
  };

  const handleConnectGithub = async () => {
    setIsConnectingGithub(true);
    setGithubConnected(false);
    try {
      const result = await handleTestGithub();
      if (result.success) {
        await updateSettings({
          github_repo_url: githubRepoUrl,
          github_token: githubToken,
          github_branch: result.default_branch || "main",
          sync_provider: "github",
        });
        setGithubConnected(true);
      }
    } finally {
      setIsConnectingGithub(false);
    }
  };

  const handleFinish = async () => {
    const updates: Record<string, unknown> = {
      first_launch_complete: true,
      sync_provider: syncMethod === "github" && !githubConnected ? "local" : syncMethod || "local",
    };
    if (syncMethod === "gsheet" && gsheetUrl) {
      updates.gsheet_csv_url = gsheetUrl;
    }
    if (syncMethod === "github" && githubConnected) {
      updates.github_repo_url = githubRepoUrl;
      updates.github_token = githubToken;
      updates.github_branch = githubResult?.default_branch || "main";
    }
    if (espansoInfo?.found) {
      updates.espanso_path = espansoInfo.path;
      updates.espanso_config_dir = espansoInfo.config_dir;
      updates.espanso_auto_detected = true;
    }
    await updateSettings(updates as any);
    if (syncMethod === "gsheet" && gsheetUrl) {
      importFromGSheet(gsheetUrl).catch(() => {});
    }
  };

  const canContinue = () => {
    switch (step) {
      case "sync-method":
        return syncMethod !== null;
      case "gsheet":
        return gsheetValid === true;
      case "github":
        return githubConnected;
      default:
        return true;
    }
  };

  const next = () => {
    const order: Step[] = ["welcome", "sync-method", "github", "gsheet", "espanso", "complete"];
    const idx = order.indexOf(step);
    if (syncMethod === "local" && step === "sync-method") {
      setStep("espanso");
    } else if (syncMethod === "github" && step === "sync-method") {
      setStep("github");
    } else if (syncMethod === "gsheet" && step === "sync-method") {
      setStep("gsheet");
    } else if (step === "github" || step === "gsheet") {
      setStep("espanso");
    } else if (idx < order.length - 1) {
      setStep(order[idx + 1]);
    }
  };

  const back = () => {
    const order: Step[] = ["welcome", "sync-method", "github", "gsheet", "espanso", "complete"];
    const idx = order.indexOf(step);
    if (idx > 0) {
      if (step === "github" || step === "gsheet") setStep("sync-method");
      else setStep(order[idx - 1]);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-lg mx-auto p-8">
        {step === "welcome" && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-2xl bg-indigo-500 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Welcome to Espander</h1>
              <p className="text-muted-foreground">
                Your visual companion for Espanso. Manage snippets, sync across devices, never edit YAML again.
              </p>
            </div>
            <Button onClick={next} size="lg" className="gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "sync-method" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Choose Sync Method</h2>
              <p className="text-sm text-muted-foreground">
                How would you like to sync your snippets?
              </p>
            </div>
            <div className="space-y-3">
              {[
                { id: "github" as const, icon: Github, title: "GitHub", desc: "Sync across devices via private GitHub repo", recommended: true },
                { id: "gsheet" as const, icon: Globe, title: "Google Sheets", desc: "Import snippets from a published Google Sheet", recommended: false },
                { id: "local" as const, icon: Laptop, title: "Local Only", desc: "Use Espander locally without cloud sync", recommended: false },
              ].map((method) => {
                const Icon = method.icon;
                const selected = syncMethod === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => setSyncMethod(method.id)}
                    className={cn(
                      "w-full flex items-start gap-4 rounded-xl border p-4 text-left transition-all",
                      selected
                        ? "border-indigo-500 bg-indigo-500/5"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <div className={cn(
                      "rounded-lg p-2.5 transition-colors",
                      selected ? "bg-indigo-500/10 text-indigo-400" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{method.title}</span>
                        {method.recommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{method.desc}</p>
                    </div>
                    {selected && <Check className="h-5 w-5 text-indigo-400 mt-1" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={back} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={next} disabled={!canContinue()} className="flex-1 gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "github" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="rounded-full bg-muted p-3">
                  <Github className="h-8 w-8" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">Connect GitHub</h2>
              <p className="text-sm text-muted-foreground">
                Enter your repository URL and personal access token.
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="onboarding-github-url">GitHub repository URL</Label>
                <Input
                  id="onboarding-github-url"
                  placeholder="https://github.com/owner/repo"
                  value={githubRepoUrl}
                  onChange={(e) => {
                    setGithubRepoUrl(e.target.value);
                    setGithubConnected(false);
                    setGithubResult(null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-github-token">Personal access token</Label>
                <Input
                  id="onboarding-github-token"
                  type="password"
                  placeholder="github_pat_..."
                  value={githubToken}
                  onChange={(e) => {
                    setGithubToken(e.target.value);
                    setGithubConnected(false);
                    setGithubResult(null);
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestGithub}
                  disabled={!githubRepoUrl || !githubToken || isTestingGithub || isConnectingGithub}
                  className="flex-1"
                >
                  {isTestingGithub ? "Testing..." : "Test"}
                </Button>
                <Button
                  onClick={handleConnectGithub}
                  disabled={!githubRepoUrl || !githubToken || isTestingGithub || isConnectingGithub}
                  className="flex-1"
                >
                  {isConnectingGithub ? "Connecting..." : "Connect"}
                </Button>
              </div>
              {githubResult && (
                <div className={cn(
                  "rounded-lg border p-3 text-xs",
                  githubResult.success
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                    : "border-red-500/20 bg-red-500/5 text-red-400"
                )}>
                  <div className="font-medium">{githubResult.success ? "Connection ready" : "Connection failed"}</div>
                  <div className="mt-1 opacity-90">{githubResult.message}</div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={back} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button variant="ghost" onClick={() => setStep("espanso")} className="flex-1">
                Skip
              </Button>
              <Button onClick={next} disabled={!canContinue()} className="flex-1 gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "gsheet" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Google Sheets</h2>
              <p className="text-sm text-muted-foreground">
                Paste your published CSV URL to import snippets.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gsheet-url">Published CSV URL</Label>
              <Input
                id="gsheet-url"
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                value={gsheetUrl}
                onChange={(e) => {
                  setGsheetUrl(e.target.value);
                  setGsheetValid(null);
                }}
              />
            </div>
            {gsheetValid === true && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> Valid URL
              </p>
            )}
            {gsheetValid === false && (
              <p className="text-xs text-red-400">Invalid URL. Must be a published Google Sheets CSV URL.</p>
            )}
            <Button
              variant="outline"
              onClick={handleValidateUrl}
              disabled={!gsheetUrl}
              className="w-full"
            >
              Validate URL
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={back} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={next} disabled={!canContinue()} className="flex-1 gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "espanso" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="rounded-full bg-muted p-3">
                  <Terminal className="h-8 w-8" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">Espanso Detection</h2>
              <p className="text-sm text-muted-foreground">
                Let us find your Espanso installation.
              </p>
            </div>

            {detecting ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Detecting Espanso...</span>
              </div>
            ) : espansoInfo?.found ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Espanso Found</span>
                </div>
                <p className="text-xs text-muted-foreground">Path: {espansoInfo.path}</p>
                <p className="text-xs text-muted-foreground">Config: {espansoInfo.config_dir}</p>
                {espansoInfo.version && (
                  <p className="text-xs text-muted-foreground">Version: {espansoInfo.version}</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-sm text-red-400">Espanso not found automatically.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can configure the path later in Settings.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={() => openBrowser("https://espanso.org/install/")}
                >
                  Install Espanso <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={back} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep("complete")} className="flex-1 gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">You're All Set!</h1>
              <p className="text-muted-foreground">
                {syncMethod === "github"
                  ? "Connected to GitHub. Your snippets will sync automatically."
                  : syncMethod === "gsheet"
                    ? "Google Sheets configured. Import your snippets anytime."
                    : "Running locally. You can set up sync anytime in Settings."}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sync Method</span>
                <span className="capitalize font-medium">{syncMethod || "Local"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Espanso</span>
                <span className={espansoInfo?.found ? "text-emerald-400" : "text-muted-foreground"}>
                  {espansoInfo?.found ? "Detected" : "Not configured"}
                </span>
              </div>
            </div>
            <Button onClick={handleFinish} size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Start Using Espander
            </Button>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mt-8">
          {(["welcome", "sync-method", "espanso", "complete"] as const).map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                step === s
                  ? "w-8 bg-indigo-500"
                  : ["sync-method", "github", "gsheet"].includes(s) &&
                      ["sync-method", "github", "gsheet"].includes(step)
                    ? "w-8 bg-indigo-500/50"
                    : "w-2 bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
