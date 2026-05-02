import { test, expect } from '@playwright/test';

// Unified E2E Test Suite for Chat Application

test.describe('Auth: Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login form and SSO button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    // Mock the network response
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: 'Incorrect username or password' }),
      });
    });

    await page.getByLabel('Username').fill('wronguser');
    await page.getByLabel('Password').fill('wrongpass');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Incorrect username or password')).toBeVisible();
  });
});

test.describe('Auth: Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders register form and password strength meter', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    
    // Type password to see strength meter
    await page.getByLabel('Password').fill('weak');
    await expect(page.getByText('Weak')).toBeVisible();
    
    await page.getByLabel('Password').fill('StrongPass123!');
    await expect(page.getByText('Strong')).toBeVisible();
  });
});

test.describe('Chat: Main Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ id: 1, username: 'testuser', email: 'test@example.com' })
      });
    });
    // Mock chats
    await page.route('**/api/chats/', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('chat_token', 'fake.jwt.token');
    });
    await page.goto('/chat');
  });

  test('sidebar renders with mute toggle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Chats', exact: true })).toBeVisible();
    await expect(page.getByText('Logged in as testuser')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle sound' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ New Chat' })).toBeVisible();
  });

  test('main window shows empty state initially', async ({ page }) => {
    await expect(page.getByText('Select a conversation')).toBeVisible();
    // Input is disabled if no chat selected
    await expect(page.getByPlaceholder('Select a chat to start messaging')).toBeDisabled();
  });
});

test.describe('Chat: New Chat Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth & chats
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify({ id: 1, username: 'testuser' }) });
    });
    await page.route('**/api/chats/', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('chat_token', 'fake'));
    await page.goto('/chat');
  });

  test('opens layout, toggles group mode, cancels', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Chat' }).click();
    await expect(page.getByRole('heading', { name: 'New Chat' })).toBeVisible();
    
    // Toggle to group
    await page.getByLabel('Create as Group Chat').check();
    await expect(page.getByLabel('Group Name')).toBeVisible();
    await expect(page.getByPlaceholder('Search users to add...')).toBeVisible();

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'New Chat' })).not.toBeVisible();
  });
});
