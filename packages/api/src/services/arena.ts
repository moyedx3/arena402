const ARENA_API_BASE = "https://api.are.na/v2";

export interface ArenaChannel {
  id: number;
  title: string;
  slug: string;
  status: string;
  user_id: number;
  class: string;
  base_class: string;
  user: ArenaUser;
  length: number;
  contents?: ArenaBlock[];
  [key: string]: unknown;
}

export interface ArenaBlock {
  id: number;
  title: string | null;
  content: string | null;
  content_html: string | null;
  description: string | null;
  description_html: string | null;
  source: { url: string } | null;
  image: {
    filename: string;
    content_type: string;
    updated_at: string;
    thumb: { url: string };
    display: { url: string };
    original: { url: string };
  } | null;
  attachment: unknown | null;
  embed: unknown | null;
  class: string;
  base_class: string;
  user: ArenaUser;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ArenaUser {
  id: number;
  slug: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string;
  avatar_image: { display: string } | null;
  channel_count: number;
  following_count: number;
  profile_id: number;
  follower_count: number;
  class: string;
  initials: string;
  [key: string]: unknown;
}

export interface ArenaChannelContents {
  length: number;
  total_pages: number;
  current_page: number;
  per: number;
  channel_title: string;
  base_class: string;
  class: string;
  contents: ArenaBlock[];
}

export class ArenaClient {
  private accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${ARENA_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw new ArenaApiError(
        `Are.na API error: ${response.status} ${response.statusText}`,
        response.status,
        error
      );
    }

    return response.json() as Promise<T>;
  }

  async getChannel(slug: string): Promise<ArenaChannel> {
    return this.fetch<ArenaChannel>(`/channels/${slug}`);
  }

  async getChannelContents(
    slug: string,
    options?: { page?: number; per?: number }
  ): Promise<ArenaChannelContents> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.per) params.set("per", String(options.per));

    const query = params.toString();
    const endpoint = `/channels/${slug}/contents${query ? `?${query}` : ""}`;
    return this.fetch<ArenaChannelContents>(endpoint);
  }

  async getBlock(id: number): Promise<ArenaBlock> {
    return this.fetch<ArenaBlock>(`/blocks/${id}`);
  }

  async getMe(): Promise<ArenaUser> {
    if (!this.accessToken) {
      throw new ArenaApiError("Access token required for /me endpoint", 401);
    }
    return this.fetch<ArenaUser>("/me");
  }
}

export class ArenaApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = "ArenaApiError";
  }
}

// Default client for public API access
export const arenaClient = new ArenaClient();
