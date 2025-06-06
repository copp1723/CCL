import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar";
import Dashboard from "@/pages/dashboard-streamlined";
import EmailCampaigns from "@/pages/email-campaigns";
import DataIngestion from "@/pages/data-ingestion";
import PromptTesting from "@/pages/prompt-testing-clean";
import PromptVariables from "@/pages/prompt-variables";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-6 py-8">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/email-campaigns" component={EmailCampaigns} />
          <Route path="/data-ingestion" component={DataIngestion} />
            <Route path="/prompt-testing" component={PromptTesting} />
            <Route path="/prompt-variables" component={PromptVariables} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;