export type Prompt = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  pinned?: boolean;
  pinOrder?: number;
};

export type EnvironmentConfig = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
};

