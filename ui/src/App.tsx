import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { DashboardView } from './components/dashboard/DashboardView';
import { CommandInputOverlay } from './components/overlays/CommandInputOverlay';
import { useUIStore } from './stores/ui-store';

function App() {
  const { activeView } = useUIStore();

  // Render different views based on activeView
  const renderMainContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'queue':
        return (
          <div className="flex-1 flex items-center justify-center text-text-tertiary">
            Queue View (Coming Soon)
          </div>
        );
      case 'workflow':
        return (
          <div className="flex-1 flex items-center justify-center text-text-tertiary">
            Workflow View (Coming Soon)
          </div>
        );
      case 'context':
        return (
          <div className="flex-1 flex items-center justify-center text-text-tertiary">
            Context View (Coming Soon)
          </div>
        );
      case 'history':
        return (
          <div className="flex-1 flex items-center justify-center text-text-tertiary">
            History View (Coming Soon)
          </div>
        );
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-surface-0">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        {renderMainContent()}
      </div>
      <StatusBar />
      <CommandInputOverlay />
    </div>
  );
}

export default App;
