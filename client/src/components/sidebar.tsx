export function Sidebar() {
  return (
    <div className="w-64 bg-slate-800 text-white flex-shrink-0">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <i className="fas fa-car text-white text-sm"></i>
          </div>
          <div>
            <h1 className="text-lg font-semibold">CCL Agents</h1>
            <p className="text-gray-400 text-xs">v2.1.0</p>
          </div>
        </div>
      </div>
      
      <nav className="mt-8">
        <div className="px-6 py-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Overview
          </h3>
        </div>
        
        <a 
          href="#" 
          className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors bg-gray-700 text-white border-r-2 border-blue-600"
        >
          <i className="fas fa-tachometer-alt w-5"></i>
          <span className="ml-3">Dashboard</span>
        </a>
        
        <a 
          href="#" 
          className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <i className="fas fa-robot w-5"></i>
          <span className="ml-3">Agents</span>
          <span className="ml-auto bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">
            5
          </span>
        </a>
        
        <a 
          href="#" 
          className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <i className="fas fa-comments w-5"></i>
          <span className="ml-3">Live Chat</span>
          <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
            12
          </span>
        </a>
        
        <div className="px-6 py-2 mt-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Management
          </h3>
        </div>
        
        <a 
          href="#" 
          className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <i className="fas fa-users w-5"></i>
          <span className="ml-3">Leads</span>
        </a>
        
        <a 
          href="#" 
          className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <i className="fas fa-envelope w-5"></i>
          <span className="ml-3">Email Campaigns</span>
        </a>
        
        <a 
          href="#" 
          className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <i className="fas fa-chart-line w-5"></i>
          <span className="ml-3">Analytics</span>
        </a>
        
        <div className="px-6 py-2 mt-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            System
          </h3>
        </div>
        
        <a 
          href="#" 
          className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <i className="fas fa-cog w-5"></i>
          <span className="ml-3">Settings</span>
        </a>
        
        <a 
          href="#" 
          className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <i className="fas fa-shield-alt w-5"></i>
          <span className="ml-3">Security</span>
        </a>
      </nav>
    </div>
  );
}
