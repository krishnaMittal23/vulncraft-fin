export type Repository = {
  id: number;
  name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  lastUpdated: string; // ISO date string
  url: string;
  private: boolean;
};

export type LanguageColor = {
  [language: string]: string; // Maps a language to its hex color
};

export type User = {
  _id: string;
  githubId: string;
  username: string;
  avatar: string;
  email: string;
};
