import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import oauthPlugin from '@fastify/oauth2';
import { registerSchema, loginSchema, authResponseSchema } from '@pcp/shared';
import { AuthService } from './service';
import { setupProfileRoutes } from './routes/profile';
import { setupAdminRoutes } from './routes/admin';

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
        id: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
        secret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
      },
      auth: oauthPlugin.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/oauth/google/start',
    callbackUri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/oauth/google/callback',
    scope: ['profile', 'email'],
  });

  server.post(
    '/register',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
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
        request.headers['user-agent']
      );
      
      reply.setCookie('sessionId', session.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
      
      return reply.code(201).send({ user });
    }
  );

  server.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
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
        request.headers['user-agent']
      );
      
      reply.setCookie('sessionId', session.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
      
      return { user };
    }
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
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }
      
      const user = await authService.validateSession(sessionId);
      if (!user) {
        return reply.code(401).send({ error: 'Invalid session' } as any);
      }
      
      return { user };
    }
  );

  server.post(
    '/refresh',
    async (request, reply) => {
      const sessionId = request.cookies.sessionId;
      if (!sessionId) {
        return reply.code(401).send({ error: 'Unauthorized' } as any);
      }
      
      const newSession = await authService.refreshSession(
        sessionId,
        request.ip,
        request.headers['user-agent']
      );

      if (!newSession) {
        reply.clearCookie('sessionId', { path: '/' });
        return reply.code(401).send({ error: 'Invalid or expired session' } as any);
      }
      
      reply.setCookie('sessionId', newSession.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
      
      return { success: true };
    }
  );

  server.post(
    '/logout',
    async (request, reply) => {
      const sessionId = request.cookies.sessionId;
      if (sessionId) {
        await authService.logout(
          sessionId,
          request.ip,
          request.headers['user-agent']
        );
      }
      
      reply.clearCookie('sessionId', { path: '/' });
      return { success: true };
    }
  );

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

    const userInfo = await userInfoResponse.json() as any;

    const { session } = await authService.handleOAuthLogin({
      providerId: 'google',
      providerUserId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
    }, request.ip, request.headers['user-agent']);

    reply.setCookie('sessionId', session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return reply.redirect(`${frontendUrl}/dashboard`);
  });
}
