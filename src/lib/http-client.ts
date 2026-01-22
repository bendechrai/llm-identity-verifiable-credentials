/**
 * HTTP Client
 *
 * Typed HTTP client for service-to-service communication.
 */

export interface HttpClientOptions {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface HttpError extends Error {
  status: number;
  statusText: string;
  body?: unknown;
}

/**
 * Create an HTTP error with status information.
 */
function createHttpError(status: number, statusText: string, body?: unknown): HttpError {
  const error = new Error(`HTTP ${status}: ${statusText}`) as HttpError;
  error.status = status;
  error.statusText = statusText;
  error.body = body;
  return error;
}

/**
 * HTTP client for making typed requests.
 */
export class HttpClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultHeaders: Record<string, string>;

  constructor(options: HttpClientOptions) {
    // Remove trailing slash from baseUrl
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.defaultTimeout = options.timeout || 30000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  /**
   * Make a typed fetch request.
   */
  async fetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const timeout = options.timeout || this.defaultTimeout;

    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Try to parse JSON response
      let body: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      if (!response.ok) {
        throw createHttpError(response.status, response.statusText, body);
      }

      return body as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw createHttpError(408, 'Request Timeout');
      }

      throw error;
    }
  }

  /**
   * GET request.
   */
  async get<T>(path: string, options?: Omit<FetchOptions, 'method' | 'body'>): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'GET' });
  }

  /**
   * POST request.
   */
  async post<T>(path: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'POST', body });
  }

  /**
   * PUT request.
   */
  async put<T>(path: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE request.
   */
  async delete<T>(path: string, options?: Omit<FetchOptions, 'method' | 'body'>): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * Set authorization header for subsequent requests.
   */
  setAuthorization(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear authorization header.
   */
  clearAuthorization(): void {
    delete this.defaultHeaders['Authorization'];
  }
}

/**
 * Create an HTTP client for a service.
 */
export function createHttpClient(baseUrl: string, options?: Omit<HttpClientOptions, 'baseUrl'>): HttpClient {
  return new HttpClient({ baseUrl, ...options });
}
