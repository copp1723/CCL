import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar";
import { ChatWidget } from "@/components/chat-widget";
import Dashboard from "@/pages/dashboard-streamlined";
import CampaignsPage from "@/pages/campaigns-unified";
import CampaignDetailPage from "@/pages/campaign-detail";
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
            <Route path="/campaigns" component={CampaignsPage} />
            <Route path="/campaigns/:id" component={CampaignDetailPage} />
            <Route path="/data-ingestion" component={DataIngestion} />
            <Route path="/prompt-testing" component={PromptTesting} />
            <Route path="/prompt-variables" component={PromptVariables} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
      <ChatWidget />
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
