import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export const useUser = () => {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const res = await authApi.get('/me');
        return res.data.user as AuthUser;
      } catch {
        return null;
      }
    },
    retry: false,
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await authApi.post('/login', credentials);
      return res.data.user as AuthUser;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['user'], user);
      router.push('/dashboard');
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (payload: { email: string; password: string; name?: string }) => {
      const res = await authApi.post('/register', payload);
      return res.data.user as AuthUser;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['user'], user);
      router.push('/dashboard');
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      await authApi.post('/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(['user'], null);
      router.push('/login');
    },
  });
};
