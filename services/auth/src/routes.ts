import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import oauthPlugin from '@fastify/oauth2';
import { registerSchema, loginSchema, authResponseSchema, sendApiError } from '@pcp/shared';
import { AuthService } from './service';
import { setupProfileRoutes } from './routes/profile';
import { setupAdminRoutes } from './routes/admin';
import { env } from './env';

export async function setupAuthRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authService = new AuthService(fastify.log);

  // Register Profile and Admin Routes
  await setupProfileRoutes(fastify);
  await setupAdminRoutes(fastify);

  // Register Google OAuth2
  server.register(oauthPlugin, {
    name: 'googleOAuth2',
    credentials: {
      client: {
        id: env.GOOGLE_CLIENT_ID,
        secret: env.GOOGLE_CLIENT_SECRET,
      },
      auth: oauthPlugin.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/oauth/google/start',
    callbackUri: env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email'],
  });

  server.post(
    '/register',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
      schema: {
        body: registerSchema,
        response: {
          201: authResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password, name } = request.body;
      const { user, session } = await authService.register(
        email,
        password,
        name,
        request.ip,
        request.headers['user-agent'],
      );

      reply.setCookie('sessionId', session.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      return reply.code(201).send({ user });
    },
  );

  server.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
      schema: {
        body: loginSchema,
        response: {
          200: authResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const { user, session } = await authService.login(
        email,
        password,
        request.ip,
        request.headers['user-agent'],
      );

      reply.setCookie('sessionId', session.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      return { user };
    },
  );

  server.get(
    '/me',
    {
      schema: {
        response: {
          200: authResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const sessionId = request.cookies.sessionId;
      if (!sessionId) {
        return sendApiError(reply, 401, 'UNAUTHORIZED');
      }

      const user = await authService.validateSession(sessionId);
      if (!user) {
        return sendApiError(reply, 401, 'UNAUTHORIZED', 'Invalid session');
      }

      return { user };
    },
  );

  server.post('/refresh', async (request, reply) => {
    const sessionId = request.cookies.sessionId;
    if (!sessionId) {
      return sendApiError(reply, 401, 'UNAUTHORIZED');
    }

    const newSession = await authService.refreshSession(
      sessionId,
      request.ip,
      request.headers['user-agent'],
    );

    if (!newSession) {
      reply.clearCookie('sessionId', { path: '/' });
      return sendApiError(reply, 401, 'UNAUTHORIZED', 'Invalid or expired session');
    }

    reply.setCookie('sessionId', newSession.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return { success: true };
  });

  server.post('/logout', async (request, reply) => {
    const sessionId = request.cookies.sessionId;
    if (sessionId) {
      await authService.logout(sessionId, request.ip, request.headers['user-agent']);
    }

    reply.clearCookie('sessionId', { path: '/' });
    return { success: true };
  });

  // Google OAuth callback
  server.get('/oauth/google/callback', async function (request, reply) {
    // @ts-ignore
    const { token } = await this.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const userInfo = (await userInfoResponse.json()) as any;

    const { session } = await authService.handleOAuthLogin(
      {
        providerId: 'google',
        providerUserId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
      },
      request.ip,
      request.headers['user-agent'],
    );

    reply.setCookie('sessionId', session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.redirect(`${env.FRONTEND_URL}/dashboard`);
  });
}
