export interface DashboardWidgetProps {
  id: string;
  title: string;
  data: unknown;
  isLoading: boolean;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
  status: number;
}
