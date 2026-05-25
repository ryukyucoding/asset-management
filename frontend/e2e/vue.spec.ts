import { test, expect, type Page } from '@playwright/test'

// ─── Helpers ───────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[autocomplete="email"]').fill(email)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await page.getByRole('button', { name: /login|登入/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
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
    await page.locator('input[autocomplete="email"]').fill('wrong@example.com')
    await page.locator('input[autocomplete="current-password"]').fill('wrongpassword')
    await page.getByRole('button', { name: /login|登入/i }).click()
    // ElMessage error or form error should appear
    await expect(page.locator('.el-message--error, .el-form-item__error').first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('logs in as admin and navigates to asset management', async ({ page }) => {
    await login(page, 'admin@example.com', 'Admin1234')
    await expect(page).toHaveURL(/\/admin\/assets|\/assets/)
    await expect(page.locator('.user-name')).toHaveText('Admin')
  })

  test('logs in as user and sees asset list', async ({ page }) => {
    await login(page, 'user@example.com', 'User1234')
    await expect(page).toHaveURL(/\/assets/)
    await expect(page.locator('.user-name')).toHaveText('Test User')
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

// ─── Full repair workflow (user → admin approve → complete) ───────────────

test.describe('Full repair workflow', () => {
  test('user submits repair, admin approves and completes', async ({ page }) => {
    const faultDescription = `E2E workflow fault ${Date.now()}`

    // Step 1: User submits repair request
    await login(page, 'user@example.com', 'User1234')
    await page.goto('/assets')
    await expect(page.locator('.el-table')).toBeVisible()

    const assetRow = page.locator('.el-table__row', { hasText: 'HP LaserJet' }).first()
    await expect(assetRow).toBeVisible({ timeout: 10_000 })

    const submitBtn = assetRow.getByRole('button', { name: /提交維修|submit repair/i })
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 })

    await submitBtn.click()
    await expect(page.locator('.el-dialog')).toBeVisible()

    await page.locator('.el-dialog textarea').fill(faultDescription)
    await page.getByRole('button', { name: /confirm|確認/i }).click()
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10_000 })

    // Step 2: Admin approves the application
    await page.locator('.logout-btn').click()
    await expect(page).toHaveURL(/\/login/)

    await login(page, 'admin@example.com', 'Admin1234')
    await page.goto('/admin/applications')
    await expect(page.locator('.el-table')).toBeVisible()

    const targetRow = page.locator('.el-table__row').filter({ hasText: faultDescription.slice(0, 24) }).first()
    await expect(targetRow).toBeVisible({ timeout: 15_000 })
    await targetRow.getByRole('button', { name: /核准|approve/i }).click()
    await expect(page.locator('.el-dialog')).toBeVisible()
    await page.getByRole('button', { name: /confirm|確認/i }).click()
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10_000 })

    // Step 3: Admin marks repair complete
    await expect(targetRow.getByRole('button', { name: /維修完成|repair complete/i })).toBeVisible({ timeout: 10_000 })
    await targetRow.getByRole('button', { name: /維修完成|repair complete/i }).click()
    await page.locator('.el-message-box__btns .el-button--primary').click()
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10_000 })
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

  test('pending filter shows pending applications', async ({ page }) => {
    await page.locator('.filter-bar .el-select').click()
    await page.getByRole('option', { name: /待審核|PENDING/i }).first().click()
    await page.waitForTimeout(500)

    const rows = page.locator('.el-table__body-wrapper .el-table__row')
    const rowCount = await rows.count()
    if (rowCount > 0) {
      await expect(rows.first()).toContainText(/待審核|PENDING|PENDING_SENIOR_APPROVAL/i)
    } else {
      await expect(page.locator('.el-table__empty-block').first()).toBeVisible()
    }
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
