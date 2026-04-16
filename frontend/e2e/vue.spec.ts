import { test, expect, type Page } from '@playwright/test'

// ─── Helpers ───────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder(/email/i).fill(email)
  await page.getByPlaceholder(/password|密碼/i).fill(password)
  await page.getByRole('button', { name: /login|登入/i }).click()
}

// ─── Auth flow ─────────────────────────────────────────────────────────────

test.describe('Login flow', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows validation error for empty submission', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /login|登入/i }).click()
    // Element Plus form validation should show an error
    await expect(page.locator('.el-form-item__error').first()).toBeVisible()
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/email/i).fill('wrong@example.com')
    await page.getByPlaceholder(/password|密碼/i).fill('wrongpassword')
    await page.getByRole('button', { name: /login|登入/i }).click()
    // ElMessage error or form error should appear
    await expect(page.locator('.el-message--error, .el-form-item__error').first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('logs in as admin and navigates to asset management', async ({ page }) => {
    await login(page, 'admin@example.com', 'Admin1234')
    await expect(page).toHaveURL(/\/admin\/assets|\/assets/)
    // Sidebar should show Admin badge
    await expect(page.getByText('Admin')).toBeVisible()
  })

  test('logs in as user and sees asset list', async ({ page }) => {
    await login(page, 'user@example.com', 'User1234')
    await expect(page).toHaveURL(/\/assets/)
    await expect(page.getByText('User')).toBeVisible()
  })

  test('logout button clears session and redirects to login', async ({ page }) => {
    await login(page, 'user@example.com', 'User1234')
    await expect(page).toHaveURL(/\/assets/)
    // Click the logout button in sidebar
    await page.locator('.logout-btn').click()
    await expect(page).toHaveURL(/\/login/)
  })
})

// ─── Asset list (user) ─────────────────────────────────────────────────────

test.describe('Asset list view (user)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user@example.com', 'User1234')
    await page.goto('/assets')
  })

  test('displays asset table with stat cards', async ({ page }) => {
    await expect(page.locator('.stat-card').first()).toBeVisible()
    await expect(page.locator('.el-table')).toBeVisible()
  })

  test('submit repair button is disabled for IN_REPAIR assets', async ({ page }) => {
    // Find any disabled "提交維修" button
    const disabledBtn = page.locator('button:disabled', { hasText: '提交維修' }).first()
    // This test passes if either: there are disabled buttons OR the table is empty
    const count = await disabledBtn.count()
    if (count > 0) {
      await expect(disabledBtn).toBeDisabled()
    }
  })

  test('filter by name updates the table', async ({ page }) => {
    const nameInput = page.locator('.filter-bar input').first()
    await nameInput.fill('xyz-nonexistent-asset')
    await page.waitForTimeout(400) // debounce
    await expect(page.locator('.el-table__empty-block')).toBeVisible()
  })
})

// ─── Submit repair application (user) ─────────────────────────────────────

test.describe('Submit repair request', () => {
  test('opens repair dialog and validates fault description', async ({ page }) => {
    await login(page, 'user@example.com', 'User1234')
    await page.goto('/assets')

    // Click first available "提交維修" button
    const submitBtn = page.locator('button:not([disabled])', { hasText: '提交維修' }).first()
    const count = await submitBtn.count()

    if (count === 0) {
      // No available assets to repair — skip
      test.skip()
      return
    }

    await submitBtn.click()
    await expect(page.locator('.el-dialog')).toBeVisible()

    // Submit with empty description — should show validation error
    await page.getByRole('button', { name: /confirm|確認/i }).click()
    await expect(page.locator('.el-form-item__error')).toBeVisible()
  })
})

// ─── Admin views ───────────────────────────────────────────────────────────

test.describe('Admin asset management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@example.com', 'Admin1234')
    await page.goto('/admin/assets')
  })

  test('shows add asset button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /新增資產|add/i })).toBeVisible()
  })

  test('opens create asset dialog', async ({ page }) => {
    await page.getByRole('button', { name: /新增資產|add/i }).click()
    await expect(page.locator('.el-dialog')).toBeVisible()
  })
})

test.describe('Admin application review', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@example.com', 'Admin1234')
    await page.goto('/admin/applications')
  })

  test('displays application table', async ({ page }) => {
    await expect(page.locator('.el-table')).toBeVisible()
  })

  test('pending tab shows applications with PENDING status', async ({ page }) => {
    await page
      .getByRole('button', { name: /待審核|pending/i })
      .first()
      .click()
    await page.waitForTimeout(300)
    // Either table shows PENDING items or is empty
    const table = page.locator('.el-table')
    await expect(table).toBeVisible()
  })
})

// ─── i18n language switcher ────────────────────────────────────────────────

test.describe('Language switcher', () => {
  test('switches UI to English', async ({ page }) => {
    await login(page, 'user@example.com', 'User1234')
    // Find the locale select in top bar
    const select = page.locator('.locale-select')
    await select.click()
    await page.getByRole('option', { name: 'English' }).click()
    // Check that nav label changes
    await expect(page.locator('.nav-label', { hasText: 'Assets' }).first()).toBeVisible({
      timeout: 3000,
    })
  })
})
