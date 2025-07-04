export interface ApiRoute {
  method: string;
  path: string;
  description?: string;
  parameters?: string[];
  middleware?: string[];
  fileName: string;
  lineNumber?: number;
}

/**
 * Extracts API routes from Express.js/Node.js backend code
 */
export function extractApiRoutesFromCode(code: string, fileName: string): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const lines = code.split('\n');

  // Common Express.js route patterns
  const routePatterns = [
    // router.get('/path', handler)
    /router\.(get|post|put|delete|patch)\s*\(\s*['"`](.*?)['"`]/g,
    // app.get('/path', handler)
    /app\.(get|post|put|delete|patch)\s*\(\s*['"`](.*?)['"`]/g,
    // Express.js with middleware: router.get('/path', middleware, handler)
    /router\.(get|post|put|delete|patch)\s*\(\s*['"`](.*?)['"`]\s*,.*?\)/g,
    /app\.(get|post|put|delete|patch)\s*\(\s*['"`](.*?)['"`]\s*,.*?\)/g,
  ];

  lines.forEach((line, index) => {
    routePatterns.forEach(pattern => {
      pattern.lastIndex = 0; // Reset regex state
      const matches = [...line.matchAll(pattern)];
      
      matches.forEach(match => {
        const method = match[1].toUpperCase();
        const path = match[2];
        
        // Extract description from comments
        const description = extractRouteDescription(lines, index);
        
        // Extract parameters from path
        const parameters = extractPathParameters(path);
        
        // Extract middleware (basic detection)
        const middleware = extractMiddleware(line);

        routes.push({
          method,
          path,
          description,
          parameters,
          middleware,
          fileName,
          lineNumber: index + 1
        });
      });
    });
  });

  return routes;
}

/**
 * Extracts FastAPI/Python route patterns
 */
export function extractPythonApiRoutes(code: string, fileName: string): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const lines = code.split('\n');

  // FastAPI route patterns
  const routePatterns = [
    // @app.get("/path")
    /@app\.(get|post|put|delete|patch)\s*\(\s*['"`](.*?)['"`]/g,
    // @router.get("/path")
    /@router\.(get|post|put|delete|patch)\s*\(\s*['"`](.*?)['"`]/g,
  ];

  lines.forEach((line, index) => {
    routePatterns.forEach(pattern => {
      pattern.lastIndex = 0;
      const matches = [...line.matchAll(pattern)];
      
      matches.forEach(match => {
        const method = match[1].toUpperCase();
        const path = match[2];
        
        const description = extractRouteDescription(lines, index);
        const parameters = extractPathParameters(path);

        routes.push({
          method,
          path,
          description,
          parameters,
          middleware: [],
          fileName,
          lineNumber: index + 1
        });
      });
    });
  });

  return routes;
}

/**
 * Extracts route description from comments above the route
 */
function extractRouteDescription(lines: string[], routeLineIndex: number): string | undefined {
  // Look for comments in the 3 lines above the route
  for (let i = Math.max(0, routeLineIndex - 3); i < routeLineIndex; i++) {
    const line = lines[i].trim();
    
    // JavaScript/TypeScript comments
    if (line.startsWith('//')) {
      return line.substring(2).trim();
    }
    
    // Multi-line comments
    if (line.includes('/*') && line.includes('*/')) {
      const match = line.match(/\/\*(.*?)\*\//);
      if (match) return match[1].trim();
    }
    
    // Python comments
    if (line.startsWith('#')) {
      return line.substring(1).trim();
    }
    
    // Docstrings
    if (line.includes('"""') || line.includes("'''")) {
      return line.replace(/['"]/g, '').trim();
    }
  }
  
  return undefined;
}

/**
 * Extracts path parameters like :id, {id}, <id>
 */
function extractPathParameters(path: string): string[] {
  const parameters: string[] = [];
  
  // Express.js style :param
  const expressParams = path.match(/:(\w+)/g);
  if (expressParams) {
    parameters.push(...expressParams.map(p => p.substring(1)));
  }
  
  // FastAPI style {param}
  const fastApiParams = path.match(/\{(\w+)\}/g);
  if (fastApiParams) {
    parameters.push(...fastApiParams.map(p => p.slice(1, -1)));
  }
  
  // Flask style <param>
  const flaskParams = path.match(/<(\w+)>/g);
  if (flaskParams) {
    parameters.push(...flaskParams.map(p => p.slice(1, -1)));
  }
  
  return parameters;
}

/**
 * Extracts middleware from route definition (basic detection)
 */
function extractMiddleware(line: string): string[] {
  const middleware: string[] = [];
  
  // Look for common middleware patterns
  if (line.includes('auth')) middleware.push('auth');
  if (line.includes('authenticate')) middleware.push('authenticate');
  if (line.includes('authorize')) middleware.push('authorize');
  if (line.includes('validate')) middleware.push('validate');
  if (line.includes('cors')) middleware.push('cors');
  if (line.includes('rateLimit')) middleware.push('rateLimit');
  
  return middleware;
}

/**
 * Gets all routes from a file based on its extension
 */
export function extractRoutesFromFile(filePath: string, content: string): ApiRoute[] {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return extractApiRoutesFromCode(content, filePath);
    
    case 'py':
      return extractPythonApiRoutes(content, filePath);
    
    default:
      return [];
  }
}

/**
 * Formats route for display
 */
export function formatRoute(route: ApiRoute): string {
  const methodColor = getMethodColor(route.method);
  return `${methodColor} ${route.method} ${route.path}`;
}

/**
 * Gets color coding for HTTP methods
 */
export function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return '🟢';
    case 'POST': return '🔵'; 
    case 'PUT': return '🟡';
    case 'PATCH': return '🟠';
    case 'DELETE': return '🔴';
    default: return '⚪';
  }
}

/**
 * Gets CSS class for method styling
 */
export function getMethodCssClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return 'text-green-400 bg-green-900/20';
    case 'POST': return 'text-blue-400 bg-blue-900/20';
    case 'PUT': return 'text-yellow-400 bg-yellow-900/20';
    case 'PATCH': return 'text-orange-400 bg-orange-900/20';
    case 'DELETE': return 'text-red-400 bg-red-900/20';
    default: return 'text-gray-400 bg-gray-900/20';
  }
}

/**
 * Determines if a file likely contains API routes
 */
export function isApiFile(filePath: string): boolean {
  const path = filePath.toLowerCase();
  
  return (
    path.includes('route') ||
    path.includes('api') ||
    path.includes('endpoint') ||
    path.includes('controller') ||
    path.includes('handler') ||
    path.includes('server') ||
    path.includes('app.') ||
    path.includes('main.')
  );
}

/**
 * Groups routes by their base path
 */
export function groupRoutesByPath(routes: ApiRoute[]): Record<string, ApiRoute[]> {
  const groups: Record<string, ApiRoute[]> = {};
  
  routes.forEach(route => {
    const basePath = route.path.split('/')[1] || 'root';
    if (!groups[basePath]) {
      groups[basePath] = [];
    }
    groups[basePath].push(route);
  });
  
  return groups;
}

/**
 * Validates if a route path is well-formed
 */
export function validateRoute(route: ApiRoute): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check path format
  if (!route.path.startsWith('/')) {
    issues.push('Path should start with "/"');
  }
  
  // Check for duplicate slashes
  if (route.path.includes('//')) {
    issues.push('Path contains duplicate slashes');
  }
  
  // Check method validity
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  if (!validMethods.includes(route.method.toUpperCase())) {
    issues.push(`Invalid HTTP method: ${route.method}`);
  }
  
  // Check for missing parameters documentation
  if (route.parameters && route.parameters.length > 0 && !route.description) {
    issues.push('Route with parameters should have documentation');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}