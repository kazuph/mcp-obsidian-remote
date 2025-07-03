import axios, { AxiosInstance, AxiosResponse } from "axios";
import https from "https";

export interface ObsidianConfig {
  baseUrl: string;
  apiKey: string;
  rejectUnauthorized?: boolean;
}

export interface VaultFile {
  name: string;
  path: string;
  isFolder: boolean;
  children?: VaultFile[];
}

export interface NoteData {
  content: string;
  frontmatter: Record<string, any>;
  path: string;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
  tags: string[];
}

export class ObsidianApiClient {
  private client: AxiosInstance;
  private config: ObsidianConfig;

  constructor(config: ObsidianConfig) {
    this.config = config;
    
    // Create axios instance with custom configuration
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      // Handle self-signed certificates
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.rejectUnauthorized ?? true,
      }),
      timeout: 10000, // 10 second timeout
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Server responded with error status
          const message = error.response.data?.message || error.response.statusText;
          throw new Error(`API Error (${error.response.status}): ${message}`);
        } else if (error.request) {
          // Request was made but no response received
          throw new Error(`Network Error: No response from server at ${config.baseUrl}`);
        } else {
          // Something else happened
          throw new Error(`Request Error: ${error.message}`);
        }
      }
    );
  }

  /**
   * Test connection to the Obsidian API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/');
      return response.data.ok === 'OK';
    } catch (error) {
      return false;
    }
  }

  /**
   * List files in the vault
   */
  async getVaultFiles(path: string = ""): Promise<VaultFile[]> {
    const encodedPath = encodeURIComponent(path);
    const response: AxiosResponse<VaultFile[]> = await this.client.get(`/vault/${encodedPath}`);
    return response.data;
  }

  /**
   * Read content from a file
   */
  async readFile(path: string, asJson: boolean = false): Promise<string | NoteData> {
    const encodedPath = encodeURIComponent(path);
    const headers = asJson ? { 'Accept': 'application/vnd.olrapi.note+json' } : {};
    
    const response = await this.client.get(`/vault/${encodedPath}`, { headers });
    return response.data;
  }

  /**
   * Write content to a file
   */
  async writeFile(path: string, content: string): Promise<void> {
    const encodedPath = encodeURIComponent(path);
    await this.client.put(`/vault/${encodedPath}`, content, {
      headers: { 'Content-Type': 'text/markdown' }
    });
  }

  /**
   * Append content to a file
   */
  async appendFile(path: string, content: string): Promise<void> {
    const encodedPath = encodeURIComponent(path);
    await this.client.post(`/vault/${encodedPath}`, content, {
      headers: { 'Content-Type': 'text/markdown' }
    });
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    const encodedPath = encodeURIComponent(path);
    await this.client.delete(`/vault/${encodedPath}`);
  }

  /**
   * Get the currently active file
   */
  async getActiveFile(): Promise<string | NoteData> {
    const response = await this.client.get('/active/');
    return response.data;
  }

  /**
   * Update content in the active file using PATCH operations
   */
  async patchActiveFile(operation: 'append' | 'prepend' | 'replace', targetType: 'heading' | 'block' | 'frontmatter', target: string, content: string): Promise<void> {
    await this.client.patch('/active/', content, {
      headers: {
        'Operation': operation,
        'Target-Type': targetType,
        'Target': encodeURIComponent(target),
        'Content-Type': 'text/markdown'
      }
    });
  }

  /**
   * Open a file in Obsidian
   */
  async openFile(path: string, newLeaf: boolean = false): Promise<void> {
    const encodedPath = encodeURIComponent(path);
    const params = newLeaf ? '?newLeaf=true' : '';
    await this.client.post(`/open/${encodedPath}${params}`);
  }

  /**
   * Search for files (basic implementation)
   * Note: This is a simple client-side search since the original API doesn't have a search endpoint
   */
  async searchFiles(query: string): Promise<VaultFile[]> {
    const allFiles = await this.getVaultFiles();
    return this.filterFilesByQuery(allFiles, query.toLowerCase());
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<any> {
    const response = await this.client.get('/');
    return response.data;
  }

  /**
   * List available commands
   */
  async listCommands(): Promise<any> {
    const response = await this.client.get('/commands/');
    return response.data;
  }

  /**
   * Execute a command
   */
  async executeCommand(commandId: string): Promise<void> {
    await this.client.post(`/commands/${encodeURIComponent(commandId)}/`);
  }

  /**
   * Get periodic note (daily, weekly, etc.)
   */
  async getPeriodicNote(period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'): Promise<string | NoteData> {
    const response = await this.client.get(`/periodic/${period}/`);
    return response.data;
  }

  /**
   * Append to periodic note
   */
  async appendToPeriodicNote(period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly', content: string): Promise<void> {
    await this.client.post(`/periodic/${period}/`, content, {
      headers: { 'Content-Type': 'text/markdown' }
    });
  }

  private filterFilesByQuery(files: VaultFile[], query: string): VaultFile[] {
    const results: VaultFile[] = [];
    
    for (const file of files) {
      if (file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query)) {
        results.push(file);
      }
      
      if (file.children) {
        const childResults = this.filterFilesByQuery(file.children, query);
        results.push(...childResults);
      }
    }
    
    return results;
  }
}