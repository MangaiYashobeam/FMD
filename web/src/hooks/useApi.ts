import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

interface UseApiOptions<T> {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (overrideBody?: any) => Promise<T | null>;
  reset: () => void;
}

/**
 * Custom hook for API calls with loading/error states
 */
export function useApi<T = any>({
  url,
  method = 'GET',
  body,
  immediate = false,
  onSuccess,
  onError,
}: UseApiOptions<T>): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (overrideBody?: any): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        let response;
        const requestBody = overrideBody ?? body;

        switch (method) {
          case 'POST':
            response = await api.post(url, requestBody);
            break;
          case 'PUT':
            response = await api.put(url, requestBody);
            break;
          case 'DELETE':
            response = await api.delete(url);
            break;
          default:
            response = await api.get(url);
        }

        const result = response.data?.data ?? response.data;
        setData(result);
        onSuccess?.(result);
        return result;
      } catch (err: any) {
        const error = new Error(err.response?.data?.message || err.message);
        setError(error);
        onError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [url, method, body, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (immediate && method === 'GET') {
      execute();
    }
  }, [immediate, method, execute]);

  return { data, loading, error, execute, reset };
}

/**
 * Simplified hook for GET requests that load immediately
 */
export function useFetch<T = any>(url: string, dependencies: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(url);
      setData(response.data?.data ?? response.data);
    } catch (err: any) {
      setError(new Error(err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...dependencies]);

  return { data, loading, error, refetch };
}
