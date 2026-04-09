import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import CustomersPage from "./pages/Customers";
import OrdersPage from "./pages/Orders";
import OrderDetailPage from "./pages/OrderDetail";
import UsersPage from "./pages/Users";
import LoginPage from "./pages/Login";
import AuditLogsPage from "./pages/AuditLogs";
import ExchangeRatePage from "./pages/ExchangeRate";
import ProfitReportPage from "./pages/ProfitReport";

function Router() {
  return (
    <Switch>
      {/* Login page is outside DashboardLayout */}
      <Route path="/login" component={LoginPage} />
      {/* All other routes are inside DashboardLayout */}
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/customers" component={CustomersPage} />
            <Route path="/orders" component={OrdersPage} />
            <Route path="/orders/:id" component={OrderDetailPage} />
            <Route path="/users" component={UsersPage} />
            <Route path="/audit-logs" component={AuditLogsPage} />
            <Route path="/exchange-rate" component={ExchangeRatePage} />
            <Route path="/profit-report" component={ProfitReportPage} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
