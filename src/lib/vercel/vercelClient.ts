export class VercelClient {
  public token: string;
  public teamId?: string;
  private baseUrl: string = 'https://api.vercel.com';

  constructor() {
    this.token = process.env.VERCEL_TOKEN || '';

    if (!this.token) {
      throw new Error('VERCEL_TOKEN is required');
    }

    this.teamId = process.env.VERCEL_TEAM_ID;
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