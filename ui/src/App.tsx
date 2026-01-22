import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { DashboardView } from './components/dashboard/DashboardView';
import { QueueView } from './components/queue';
import { WorkflowView } from './components/workflow';
import { ContextView } from './components/context';
import { HistoryView } from './components/history';
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
        return <QueueView />;
      case 'workflow':
        return <WorkflowView />;
      case 'context':
        return <ContextView />;
      case 'history':
        return <HistoryView />;
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
