import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Home,
  Mail,
  Database,
  Settings,
  Bot,
  BarChart3,
  FileText,
  Webhook
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
    description: "Agent status and metrics overview"
  },
  {
    title: "Email Campaigns",
    href: "/email-campaigns",
    icon: Mail,
    description: "Manage re-engagement email campaigns"
  }
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-gray-50 dark:bg-gray-900">
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">CCL Agent Monitor</h1>
            <p className="text-xs text-gray-500">Complete Car Loans</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          const Icon = item.icon;

          return (

              <Link key={item.href} href={item.href} className={cn(
                  "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                )}>
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                <span>{item.title}</span>
              </Link>

          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center space-x-3">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <div className="text-sm">
            <div className="font-medium text-gray-900 dark:text-white">System Status</div>
            <div className="text-xs text-gray-500">All agents operational</div>
          </div>
        </div>
      </div>
    </div>
  );
}