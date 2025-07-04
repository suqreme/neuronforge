import { ApiRoute } from './routeParser';

export interface ApiTestConfig {
  serverUrl: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
}

export interface ApiTestResult {
  success: boolean;
  status: number;
  statusText: string;
  response: any;
  responseTime: number;
  error?: string;
  timestamp: number;
  headers?: Record<string, string>;
  size?: number;
}

export interface ApiTestRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
}

/**
 * Tests an API route with configurable options
 */
export async function testApiRoute(
  route: ApiRoute, 
  config: ApiTestConfig,
  customPayload?: any
): Promise<ApiTestResult> {
  const startTime = Date.now();
  
  try {
    // Build the complete URL
    const url = buildUrl(route, config);
    
    // Prepare headers
    const headers = prepareHeaders(config);
    
    // Prepare request body
    const body = prepareBody(route, customPayload);
    
    // Create request configuration
    const requestConfig: RequestInit = {
      method: route.method,
      headers,
      signal: AbortSignal.timeout(config.timeout || 10000),
      ...(body && { body })
    };

    // Make the request
    const response = await fetch(url, requestConfig);
    const responseTime = Date.now() - startTime;
    
    // Parse response
    const responseData = await parseResponse(response);
    
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      response: responseData,
      responseTime,
      timestamp: Date.now(),
      headers: Object.fromEntries(response.headers.entries()),
      size: response.headers.get('content-length') 
        ? parseInt(response.headers.get('content-length')!) 
        : JSON.stringify(responseData).length
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      success: false,
      status: 0,
      statusText: 'Network Error',
      response: null,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    };
  }
}

/**
 * Tests multiple routes in sequence or parallel
 */
export async function testMultipleRoutes(
  routes: ApiRoute[],
  config: ApiTestConfig,
  options: {
    parallel?: boolean;
    stopOnError?: boolean;
    customPayloads?: Record<string, any>;
  } = {}
): Promise<Record<string, ApiTestResult>> {
  const results: Record<string, ApiTestResult> = {};
  
  if (options.parallel) {
    // Test all routes in parallel
    const promises = routes.map(async (route) => {
      const routeKey = `${route.method}:${route.path}`;
      const customPayload = options.customPayloads?.[routeKey];
      
      try {
        const result = await testApiRoute(route, config, customPayload);
        return { routeKey, result };
      } catch (error) {
        return {
          routeKey,
          result: {
            success: false,
            status: 0,
            statusText: 'Test Error',
            response: null,
            responseTime: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
          } as ApiTestResult
        };
      }
    });
    
    const resolvedResults = await Promise.allSettled(promises);
    resolvedResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results[result.value.routeKey] = result.value.result;
      }
    });
    
  } else {
    // Test routes sequentially
    for (const route of routes) {
      const routeKey = `${route.method}:${route.path}`;
      const customPayload = options.customPayloads?.[routeKey];
      
      try {
        const result = await testApiRoute(route, config, customPayload);
        results[routeKey] = result;
        
        // Stop on error if configured
        if (options.stopOnError && !result.success) {
          break;
        }
        
      } catch (error) {
        results[routeKey] = {
          success: false,
          status: 0,
          statusText: 'Test Error',
          response: null,
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        };
        
        if (options.stopOnError) {
          break;
        }
      }
    }
  }
  
  return results;
}

/**
 * Builds the complete URL for testing
 */
function buildUrl(route: ApiRoute, config: ApiTestConfig): string {
  let path = route.path;
  
  // Replace path parameters with sample values
  if (route.parameters) {
    route.parameters.forEach(param => {
      const sampleValue = getSampleValueForParameter(param);
      path = path.replace(`:${param}`, sampleValue)
                 .replace(`{${param}}`, sampleValue)
                 .replace(`<${param}>`, sampleValue);
    });
  }
  
  return `${config.serverUrl.replace(/\/$/, '')}${path}`;
}

/**
 * Prepares headers for the request
 */
function prepareHeaders(config: ApiTestConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...config.headers
  };
  
  // Add authentication headers
  if (config.authentication) {
    switch (config.authentication.type) {
      case 'bearer':
        if (config.authentication.token) {
          headers['Authorization'] = `Bearer ${config.authentication.token}`;
        }
        break;
        
      case 'basic':
        if (config.authentication.username && config.authentication.password) {
          const credentials = btoa(`${config.authentication.username}:${config.authentication.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
        
      case 'api-key':
        if (config.authentication.apiKey && config.authentication.apiKeyHeader) {
          headers[config.authentication.apiKeyHeader] = config.authentication.apiKey;
        }
        break;
    }
  }
  
  return headers;
}

/**
 * Prepares the request body
 */
function prepareBody(route: ApiRoute, customPayload?: any): string | undefined {
  if (route.method === 'GET' || route.method === 'DELETE') {
    return undefined;
  }
  
  if (customPayload) {
    return JSON.stringify(customPayload);
  }
  
  // Generate a sample payload based on route
  const samplePayload = generateSamplePayload(route);
  return JSON.stringify(samplePayload);
}

/**
 * Parses the response based on content type
 */
async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }
  
  if (contentType.includes('text/')) {
    return await response.text();
  }
  
  // For other content types, try to parse as text
  try {
    return await response.text();
  } catch {
    return '[Binary data]';
  }
}

/**
 * Generates sample values for path parameters
 */
function getSampleValueForParameter(param: string): string {
  switch (param.toLowerCase()) {
    case 'id':
    case 'userid':
    case 'user_id':
      return '123';
    case 'slug':
      return 'sample-slug';
    case 'name':
      return 'test-name';
    case 'category':
      return 'general';
    case 'status':
      return 'active';
    case 'type':
      return 'default';
    default:
      return 'test-value';
  }
}

/**
 * Generates a sample payload for POST/PUT requests
 */
function generateSamplePayload(route: ApiRoute): any {
  const path = route.path.toLowerCase();
  
  // User-related endpoints
  if (path.includes('user')) {
    return {
      name: 'Test User',
      email: 'test@example.com',
      ...getAdditionalUserFields(path)
    };
  }
  
  // Auth endpoints
  if (path.includes('auth') || path.includes('login')) {
    return {
      email: 'test@example.com',
      password: 'testpassword123'
    };
  }
  
  // Product endpoints
  if (path.includes('product')) {
    return {
      name: 'Test Product',
      description: 'A test product',
      price: 99.99,
      category: 'test'
    };
  }
  
  // Generic payload
  return {
    name: 'Test Item',
    description: 'A test item for API testing',
    status: 'active'
  };
}

/**
 * Gets additional fields based on user endpoint type
 */
function getAdditionalUserFields(path: string): any {
  if (path.includes('register') || path.includes('signup')) {
    return {
      password: 'testpassword123',
      confirmPassword: 'testpassword123'
    };
  }
  
  if (path.includes('profile')) {
    return {
      bio: 'Test user bio',
      avatar: 'https://example.com/avatar.jpg'
    };
  }
  
  return {};
}

/**
 * Formats test results for display
 */
export function formatTestResult(result: ApiTestResult): string {
  const status = result.success ? '✅' : '❌';
  const statusCode = result.status || 'ERR';
  const time = result.responseTime;
  
  let summary = `${status} ${statusCode} (${time}ms)`;
  
  if (result.error) {
    summary += ` - ${result.error}`;
  }
  
  return summary;
}

/**
 * Generates a test report from multiple results
 */
export function generateTestReport(results: Record<string, ApiTestResult>): {
  summary: string;
  details: string;
  stats: {
    total: number;
    passed: number;
    failed: number;
    averageResponseTime: number;
  };
} {
  const entries = Object.entries(results);
  const total = entries.length;
  const passed = entries.filter(([, result]) => result.success).length;
  const failed = total - passed;
  const averageResponseTime = entries.reduce((sum, [, result]) => sum + result.responseTime, 0) / total;
  
  const summary = `${passed}/${total} tests passed (${Math.round((passed/total) * 100)}%)`;
  
  const details = entries.map(([routeKey, result]) => {
    const [method, path] = routeKey.split(':');
    return `${formatTestResult(result)} ${method} ${path}`;
  }).join('\n');
  
  return {
    summary,
    details,
    stats: {
      total,
      passed,
      failed,
      averageResponseTime: Math.round(averageResponseTime)
    }
  };
}