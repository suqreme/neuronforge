import WorkbenchLayout from './components/workbench/WorkbenchLayout';
import { ToastProvider } from './components/ui/Toast';
import ToastInitializer from './components/ui/ToastInitializer';
// import './utils/testLLMIntegration'; // Import test for console access
import './index.css';

function App() {
  return (
    <ToastProvider>
      <ToastInitializer />
      <div className="App">
        <WorkbenchLayout />
      </div>
    </ToastProvider>
  );
}

export default App;