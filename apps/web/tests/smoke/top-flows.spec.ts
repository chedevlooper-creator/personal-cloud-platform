import { expect, test, type Page } from '@playwright/test';

const user = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  email: 'demo@example.com',
  name: 'Demo User',
};

const workspace = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Sandbox workspace',
  storageUsed: 1024,
  storageLimit: 1024 * 1024,
  updatedAt: new Date('2026-05-08T00:00:00.000Z').toISOString(),
};

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('login opens workspace list and workspace shell', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(user.email);
  await page.getByLabel('Parola').fill('password123');
  await page.getByRole('button', { name: 'Giriş yap' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/workspaces');
  await expect(page.getByText('Sandbox workspace')).toBeVisible();
  await page.getByRole('link', { name: /Open/i }).click();

  await expect(page).toHaveURL(new RegExp(`/workspace/${workspace.id}`));
  await expect(page.getByText(/Çalışma alanı:/)).toBeVisible();
});

test('chat flow sends a message and renders tool approval context', async ({ page }) => {
  await page.goto('/chats');
  const main = page.locator('#main-content');
  await expect(main.getByText('Sohbetler')).toBeVisible();
  const chatInput = page.getByLabel('Chat message input').first();
  const sendButton = page.getByRole('button', { name: 'Mesaj gönder' }).first();

  await expect(chatInput).toBeEnabled();
  await chatInput.fill('Run tests');
  await sendButton.click();

  await expect(main.getByText('Sohbetler')).toBeVisible();
  await page.goto('/chats');
  await expect(main.getByText('Tool approval')).toBeVisible();
});

test('hosting flow validates env vars and exposes deploy controls', async ({ page }) => {
  await page.goto('/hosting');
  const main = page.locator('#main-content');
  await expect(main.getByRole('heading', { name: 'Hosting' })).toBeVisible();
  const createButton = main.getByRole('button', { name: 'Servis oluştur' }).first();
  await expect(createButton).toBeEnabled();
  await createButton.click();

  await page.getByLabel('Servis adı').fill('Demo Site');
  await page.getByLabel('Ortam değişkenleri').fill('BAD LINE');
  await expect(page.getByText('KEY=VALUE formatı bekleniyor')).toBeVisible();

  await page.getByLabel('Ortam değişkenleri').fill('PUBLIC_FLAG=enabled');
  await expect(main.getByRole('button', { name: 'Oluştur', exact: true })).toBeEnabled();
  await expect(page.getByText('Demo API')).toBeVisible();
});

async function mockApi(page: Page): Promise<void> {
  await page.route('**/v1/me', async (route) => route.fulfill({ json: { user } }));
  await page.route('**/v1/login', async (route) => route.fulfill({ json: { user } }));
  await page.route('**/v1/workspaces', async (route) =>
    route.fulfill({ json: { workspaces: [workspace], page: 1, limit: 20 } }),
  );
  await page.route(`**/v1/workspaces/${workspace.id}/files**`, async (route) =>
    route.fulfill({ json: { files: [] } }),
  );
  await page.route('**/v1/agent/conversations', async (route) =>
    route.fulfill({
      json: {
        conversations: [
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            workspaceId: workspace.id,
            title: 'Tool approval',
            createdAt: new Date('2026-05-08T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-05-08T00:00:00.000Z').toISOString(),
          },
        ],
      },
    }),
  );
  await page.route('**/v1/agent/tasks', async (route) =>
    route.fulfill({
      status: 201,
      json: {
        id: '550e8400-e29b-41d4-a716-446655440004',
        conversationId: '550e8400-e29b-41d4-a716-446655440003',
      },
    }),
  );
  await page.route('**/v1/hosted-services**', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: [
          {
            id: '550e8400-e29b-41d4-a716-446655440005',
            workspaceId: workspace.id,
            name: 'Demo API',
            slug: 'demo-api',
            status: 'stopped',
            kind: 'static',
            rootPath: '/',
            updatedAt: new Date('2026-05-08T00:00:00.000Z').toISOString(),
            publicUrl: null,
            autoRestart: true,
            crashCount: 0,
          },
        ],
      });
    }

    return route.fulfill({ status: 201, json: {} });
  });
}
