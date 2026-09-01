const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Attach stored JWT Bearer token if available
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('vaultx_access_token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // Include HTTP-only cookies
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: any) {
    console.error(`[API Network Error] Failed to connect to ${url}:`, err);
    throw new Error(err?.message || `Network error: Could not connect to backend at ${API_BASE_URL}`);
  }

  if (response.status === 204) {
    return null;
  }

  let data: any;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    let errorMessage = `API request failed with status ${response.status}`;
    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        errorMessage = data.detail
          .map((item: any) => item.msg || (typeof item === 'string' ? item : JSON.stringify(item)))
          .join(', ');
      } else if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (typeof data.detail === 'object') {
        errorMessage = JSON.stringify(data.detail);
      }
    } else if (data?.message) {
      errorMessage = data.message;
    }
    throw new Error(errorMessage);
  }

  return data;
}
