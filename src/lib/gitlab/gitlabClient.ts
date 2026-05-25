export class GitLabClient {
  private token: string;
  private baseUrl: string;

  constructor() {
    this.token = process.env.GITLAB_TOKEN || '';
    this.baseUrl = process.env.GITLAB_BASE_URL || 'https://gitlab.com/api/v4';

    if (!this.token) {
      throw new Error('GITLAB_TOKEN is required');
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
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
      throw new Error(`GitLab API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }
}