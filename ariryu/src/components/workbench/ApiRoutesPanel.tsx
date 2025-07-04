import React, { useState, useEffect } from 'react';
import { useFileContext } from '../../stores/fileContextStore';
import { useMessageBus, MessagePatterns } from '../../stores/messageBus';
import { useLogStore } from '../../stores/logStore';
import { 
  ApiRoute, 
  getMethodColor, 
  getMethodCssClass, 
  groupRoutesByPath,
  validateRoute 
} from '../../utils/routeParser';

interface ApiRoutesPanelProps {
  className?: string;
}

export function ApiRoutesPanel({ className = '' }: ApiRoutesPanelProps) {
  const { getAllRoutes, getApiFiles, searchRoutes } = useFileContext();
  const { sendMessage } = useMessageBus();
  const { addLog } = useLogStore();
  
  const [routes, setRoutes] = useState<ApiRoute[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [groupedRoutes, setGroupedRoutes] = useState<Record<string, ApiRoute[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, { status: string; response: string; timestamp: number }>>({});
  const [testingRoutes, setTestingRoutes] = useState<Set<string>>(new Set());
  const [serverUrl, setServerUrl] = useState('http://localhost:3001');

  // Update routes when file context changes
  useEffect(() => {
    const allRoutes = getAllRoutes();
    setRoutes(allRoutes);
    setGroupedRoutes(groupRoutesByPath(allRoutes));
    
    // Auto-expand groups if there are only a few
    if (Object.keys(groupRoutesByPath(allRoutes)).length <= 3) {
      setExpandedGroups(new Set(Object.keys(groupRoutesByPath(allRoutes))));
    }
  }, [getAllRoutes]);

  // Filter routes based on search and method
  const filteredRoutes = React.useMemo(() => {
    let filtered = routes;
    
    if (searchQuery) {
      filtered = searchRoutes(searchQuery);
    }
    
    if (selectedMethod !== 'ALL') {
      filtered = filtered.filter(route => route.method === selectedMethod);
    }
    
    return groupRoutesByPath(filtered);
  }, [routes, searchQuery, selectedMethod, searchRoutes]);

  const handleTestRoute = async (route: ApiRoute) => {
    const routeKey = `${route.method}:${route.path}`;
    setTestingRoutes(prev => new Set([...prev, routeKey]));
    
    try {
      addLog({
        level: 'info',
        source: 'API Tester',
        message: `Testing ${route.method} ${route.path}...`
      });

      const startTime = Date.now();
      const response = await fetch(`${serverUrl}${route.path}`, {
        method: route.method,
        headers: {
          'Content-Type': 'application/json',
        },
        // Add basic body for POST/PUT requests
        ...(route.method === 'POST' || route.method === 'PUT' ? {
          body: JSON.stringify({})
        } : {})
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        parsedResponse = responseText;
      }

      const result = {
        status: `${response.status} ${response.statusText}`,
        response: typeof parsedResponse === 'object' 
          ? JSON.stringify(parsedResponse, null, 2) 
          : parsedResponse,
        timestamp: Date.now(),
        responseTime
      };

      setTestResults(prev => ({
        ...prev,
        [routeKey]: result
      }));

      // Send success message to bus
      sendMessage(MessagePatterns.log(
        'API_TESTER',
        `✅ ${route.method} ${route.path} → ${response.status} (${responseTime}ms)`,
        ['api-test', 'success', route.method.toLowerCase()]
      ));

      addLog({
        level: response.ok ? 'info' : 'warn',
        source: 'API Tester',
        message: `${route.method} ${route.path} → ${response.status} ${response.statusText} (${responseTime}ms)`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setTestResults(prev => ({
        ...prev,
        [routeKey]: {
          status: 'Error',
          response: errorMessage,
          timestamp: Date.now()
        }
      }));

      // Send error message to bus
      sendMessage(MessagePatterns.log(
        'API_TESTER',
        `❌ ${route.method} ${route.path} → Error: ${errorMessage}`,
        ['api-test', 'error', route.method.toLowerCase()]
      ));

      addLog({
        level: 'error',
        source: 'API Tester',
        message: `Failed to test ${route.method} ${route.path}: ${errorMessage}`
      });
    } finally {
      setTestingRoutes(prev => {
        const newSet = new Set(prev);
        newSet.delete(routeKey);
        return newSet;
      });
    }
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  const getUniqueMethod = () => {
    const methods = new Set(routes.map(route => route.method));
    return ['ALL', ...Array.from(methods).sort()];
  };

  const handleClearResults = () => {
    setTestResults({});
    addLog({
      level: 'info',
      source: 'API Tester',
      message: 'Test results cleared'
    });
  };

  const routeCount = routes.length;
  const apiFileCount = getApiFiles().length;

  return (
    <div className={`bg-gray-900 text-white rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🌐 API Routes
            <span className="text-sm text-gray-400">
              ({routeCount} routes in {apiFileCount} files)
            </span>
          </h3>
          <button
            onClick={handleClearResults}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="Clear test results"
          >
            🗑️ Clear Results
          </button>
        </div>
        
        {/* Server URL Configuration */}
        <div className="mb-3">
          <label className="block text-xs text-gray-400 mb-1">Server URL:</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            placeholder="http://localhost:3001"
          />
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search routes..."
            className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          />
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          >
            {getUniqueMethod().map(method => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Routes List */}
      <div className="max-h-96 overflow-y-auto">
        {routeCount === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">🔌</div>
            <p className="font-medium mb-1">No API routes detected</p>
            <p className="text-sm">
              Create backend files with Express.js routes or FastAPI endpoints to see them here.
            </p>
          </div>
        ) : Object.keys(filteredRoutes).length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No routes match your search criteria</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {Object.entries(filteredRoutes).map(([groupName, groupRoutes]) => (
              <div key={groupName} className="border border-gray-700 rounded-lg">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="w-full p-3 flex items-center justify-between bg-gray-800 rounded-t-lg hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {expandedGroups.has(groupName) ? '📂' : '📁'}
                    </span>
                    <span className="font-medium">/{groupName}</span>
                    <span className="text-sm text-gray-400">
                      ({groupRoutes.length} routes)
                    </span>
                  </div>
                  <span className="text-gray-400">
                    {expandedGroups.has(groupName) ? '▲' : '▼'}
                  </span>
                </button>

                {/* Group Routes */}
                {expandedGroups.has(groupName) && (
                  <div className="border-t border-gray-700">
                    {groupRoutes.map((route, index) => {
                      const routeKey = `${route.method}:${route.path}`;
                      const testResult = testResults[routeKey];
                      const isTesting = testingRoutes.has(routeKey);
                      const routeValidation = validateRoute(route);

                      return (
                        <div
                          key={`${route.fileName}-${index}`}
                          className="p-3 border-b border-gray-700 last:border-b-0"
                        >
                          {/* Route Info */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span 
                                className={`text-xs px-2 py-1 rounded font-mono font-bold ${getMethodCssClass(route.method)}`}
                              >
                                {getMethodColor(route.method)} {route.method}
                              </span>
                              <code className="text-blue-300 font-mono">{route.path}</code>
                              {!routeValidation.valid && (
                                <span className="text-xs text-red-400" title={routeValidation.issues.join(', ')}>
                                  ⚠️
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleTestRoute(route)}
                              disabled={isTesting}
                              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                                isTesting 
                                  ? 'bg-gray-600 cursor-not-allowed' 
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {isTesting ? '⏳ Testing...' : '🧪 Test'}
                            </button>
                          </div>

                          {/* Route Details */}
                          <div className="text-xs text-gray-400 space-y-1">
                            {route.description && (
                              <div>📝 {route.description}</div>
                            )}
                            {route.parameters && route.parameters.length > 0 && (
                              <div>
                                🔗 Parameters: {route.parameters.map(param => 
                                  <code key={param} className="text-yellow-300 mx-1">:{param}</code>
                                )}
                              </div>
                            )}
                            {route.middleware && route.middleware.length > 0 && (
                              <div>
                                🛡️ Middleware: {route.middleware.join(', ')}
                              </div>
                            )}
                            <div>
                              📁 {route.fileName}
                              {route.lineNumber && `:${route.lineNumber}`}
                            </div>
                          </div>

                          {/* Test Results */}
                          {testResult && (
                            <div className="mt-3 p-2 bg-gray-800 rounded text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`font-medium ${
                                  testResult.status.startsWith('2') ? 'text-green-400' :
                                  testResult.status.startsWith('4') || testResult.status.startsWith('5') ? 'text-red-400' :
                                  testResult.status === 'Error' ? 'text-red-400' :
                                  'text-yellow-400'
                                }`}>
                                  {testResult.status}
                                </span>
                                <span className="text-gray-500">
                                  {new Date(testResult.timestamp).toLocaleTimeString()}
                                  {testResult.responseTime && ` (${testResult.responseTime}ms)`}
                                </span>
                              </div>
                              <pre className="text-gray-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                {testResult.response}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}