export interface Branch {
  id: string;
  numId: number;
  name: string;
  address?: string | null;
  city: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
} 