import { test, expect } from '@playwright/test'

test('loads home and shows title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Taipei MRT/i)
  await expect(page.getByText('台北捷運 Taipei MRT')).toBeVisible()
  await expect(page.getByPlaceholder('搜尋「忠孝新生」或「R10」')).toBeVisible()
})

