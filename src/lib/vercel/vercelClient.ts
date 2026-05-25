import { getVercelApiToken, getVercelTeamId } from './vercelEnv';

export class VercelClient {
  public token: string;
  public teamId?: string;
  private baseUrl: string = 'https://api.vercel.com';

  constructor() {
    this.token = getVercelApiToken();

    if (!this.token) {
      throw new Error(
        'SITE_AGENT_VERCEL_TOKEN is required to deploy customer sites via the Vercel API'
      );
    }

    this.teamId = getVercelTeamId();
  }

  private buildUrl(endpoint: string): string {
    const url = `${this.baseUrl}${endpoint}`;
    if (this.teamId) {
      const separator = endpoint.includes('?') ? '&' : '?';
      return `${url}${separator}teamId=${this.teamId}`;
    }
    return url;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.buildUrl(endpoint);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Vercel API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }
}