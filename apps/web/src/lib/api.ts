import axios from 'axios';

export const apiEndpoints = {
  auth: process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3001/auth',
  workspace: process.env.NEXT_PUBLIC_WORKSPACE_API_URL || 'http://localhost:3002/api',
  agent: process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:3004/api',
  publish: process.env.NEXT_PUBLIC_PUBLISH_API_URL || 'http://localhost:3006/publish',
  browser: process.env.NEXT_PUBLIC_BROWSER_API_URL || 'http://localhost:3007/api',
};

export const authApi = axios.create({
  baseURL: apiEndpoints.auth,
  withCredentials: true,
});

export const workspaceApi = axios.create({
  baseURL: apiEndpoints.workspace,
  withCredentials: true,
});

export const agentApi = axios.create({
  baseURL: apiEndpoints.agent,
  withCredentials: true,
});

export const runtimeApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_RUNTIME_API_URL || 'http://localhost:3003/api',
  withCredentials: true,
});

export const publishApi = axios.create({
  baseURL: apiEndpoints.publish,
  withCredentials: true,
});

export const browserApi = axios.create({
  baseURL: apiEndpoints.browser,
  withCredentials: true,
});

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string | { message?: string }; message?: string }
      | undefined;
    if (typeof data?.error === 'object') {
      return data.error.message || data.message || fallback;
    }

    return data?.message || data?.error || fallback;
  }

  return fallback;
}
