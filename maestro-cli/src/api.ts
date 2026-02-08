import fetch from 'node-fetch';
import { config } from './config.js';

export class APIClient {
  constructor(private baseUrl: string = config.apiUrl) {}

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  private async request<T>(endpoint: string, options?: any): Promise<T> {
    // Ensure baseUrl doesn't have trailing slash and endpoint starts with /
    const base = this.baseUrl.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${base}${path}`;

    const maxRetries = config.retries || 3;
    const retryDelay = config.retryDelay || 1000;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        });

        if (!response.ok) {
          // Read response body as text first (to avoid consuming body multiple times)
          const errorText = await response.text();

          // Try to parse as JSON
          let errorData: any = {};
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { message: errorText || `HTTP ${response.status}` };
          }

          const error: any = new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
          error.response = {
            status: response.status,
            data: errorData,
            config: { url }
          };

          // Don't retry on 4xx errors (client errors)
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }

          // Retry on 5xx errors
          lastError = error;
          if (attempt < maxRetries) {
            const delay = retryDelay * Math.pow(2, attempt);
            if (config.debug) {
              console.error(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw error;
        }

        if (response.status === 204) {
          return {} as T;
        }

        return await response.json() as T;
      } catch (error: any) {
        lastError = error;

        // Retry on network errors
        if (attempt < maxRetries && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || !error.response)) {
          const delay = retryDelay * Math.pow(2, attempt);
          if (config.debug) {
            console.error(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Don't retry on other errors
        throw error;
      }
    }

    // All retries exhausted
    throw lastError;
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  patch<T>(endpoint: string, body: any) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const api = new APIClient();
