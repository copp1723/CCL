import { Car, BarChart3, Bot, MessageCircle, Users, Mail, TrendingUp, Settings, Shield } from "lucide-react";

export function Sidebar() {
  const navigationItems = [
    {
      title: "Overview",
      items: [
        { name: "Dashboard", icon: BarChart3, active: true, badge: null },
        { name: "Agents", icon: Bot, active: false, badge: "5" },
        { name: "Live Chat", icon: MessageCircle, active: false, badge: "12" },
      ]
    },
    {
      title: "Management", 
      items: [
        { name: "Leads", icon: Users, active: false, badge: null },
        { name: "Email Campaigns", icon: Mail, active: false, badge: null },
        { name: "Analytics", icon: TrendingUp, active: false, badge: null },
      ]
    },
    {
      title: "System",
      items: [
        { name: "Settings", icon: Settings, active: false, badge: null },
        { name: "Security", icon: Shield, active: false, badge: null },
      ]
    }
  ];

  return (
    <div className="w-64 bg-slate-800 text-white flex-shrink-0">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Car className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">CCL Agents</h1>
            <p className="text-gray-400 text-xs">v2.1.0</p>
          </div>
        </div>
      </div>
      
      <nav className="mt-8">
        {navigationItems.map((section) => (
          <div key={section.title}>
            <div className="px-6 py-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {section.title}
              </h3>
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.name}
                  href="#"
                  className={`flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors ${
                    item.active ? 'bg-gray-700 text-white border-r-2 border-blue-600' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="ml-3">{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
