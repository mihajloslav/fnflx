export interface Lecture {
  id: string;
  name: string;
  session_name?: string;
  date: string;
  time: string;
  type: 'P' | 'V';
  telegram_url?: string;
  youtube_url?: string;
  created_at?: string;
}

export interface User {
  id: string;
  email: string;
  github_username?: string;
  first_name?: string;
  last_name?: string;
  index_year?: string;
  index_number?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  user_id: string;
  email: string;
  telegram_username?: string;
  added?: boolean;
  invite_link?: string;
  created_at: string;
  updated_at: string;
}
