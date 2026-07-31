import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import Home from "@/pages/home";
import TournamentPage from "@/pages/tournament";
import ProTeamsPage from "@/pages/pro-teams";
import ScrimsPage from "@/pages/scrims";
import MapsPage from "@/pages/maps";
import TeamPage from "@/pages/team";
import CustomTeamPage from "@/pages/custom-team";
import MatchPanelPage from "@/pages/match-panel";
import MatcherinoPage from "@/pages/matcherino";
import { LanguageProvider } from "@/lib/i18n";
import { GamePanelProvider } from "@/context/GamePanelContext";
import { GlobalNav } from "@/components/GlobalNav";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pro-teams" component={ProTeamsPage} />
      <Route path="/teams/:code" component={TeamPage} />
      <Route path="/custom-team" component={CustomTeamPage} />
      <Route path="/scrims" component={ScrimsPage} />
      <Route path="/maps" component={MapsPage} />
      <Route path="/tournaments/:id" component={TournamentPage} />
      <Route path="/match" component={MatchPanelPage} />
      <Route path="/matcherino" component={MatcherinoPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <LanguageProvider>
      <GamePanelProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={((import.meta as any).env?.BASE_URL ?? "/").replace(/\/$/, "")}>
              <GlobalNav />
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </GamePanelProvider>
    </LanguageProvider>
  );
}

export default App;
