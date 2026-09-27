import { expect, test, type Page } from '@playwright/test'

// Deterministic arrivals so tests never depend on the live upstream.
const arrivals = {
  stationId: 'O07',
  fetchedAt: 0,
  arrivals: [
    { line: 'O', direction: 'down', destination: { code: 'O01', stationId: 'O01', name: { zh: '南勢角', en: 'Nanshijiao' } }, status: 'countdown', seconds: 95, label: null, platform: 'OR1' },
    { line: 'O', direction: 'up', destination: { code: 'O21', stationId: 'O21', name: { zh: '迴龍', en: 'Huilong' } }, status: 'arriving', seconds: 0, label: '列車進站', platform: 'OR1' },
    { line: 'O', direction: 'up', destination: { code: 'O54', stationId: 'O54', name: { zh: '蘆洲', en: 'Luzhou' } }, status: 'countdown', seconds: 840, label: null, platform: 'OR2' },
    { line: 'BL', direction: 'up', destination: { code: 'BL23', stationId: 'BR24', name: { zh: '南港展覽館', en: 'Taipei Nangang Exhibition Center' } }, status: 'countdown', seconds: 200, label: null, platform: 'BL1' },
    { line: 'BL', direction: 'down', destination: { code: 'BL01', stationId: 'BL01', name: { zh: '頂埔', en: 'Dingpu' } }, status: 'ended', seconds: null, label: '末班已過', platform: 'BL1' }
  ]
}

async function mockLive(page: Page) {
  await page.route('**/api/mrt/taipei/eta**', route => route.fulfill({ json: arrivals }))
  await page.route('**/api/mrt/taipei/car-load**', route =>
    route.fulfill({ json: { stationId: 'O07', recommendations: [{ line: 'O', direction: 'down', directionId: '1', directionLabel: '往南勢角', carLoads: [3, 2, 1, 1, 2, 4], bestCars: [3, 4] }] } })
  )
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mrt:lang', 'zh'))
  await mockLive(page)
})

test('home shows search, lines and the network map', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByPlaceholder('搜尋車站、站號或英文站名')).toBeVisible()
  await expect(page.getByRole('button', { name: /板南線/ }).first()).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
})

test('search finds a station by name, code and English', async ({ page }) => {
  await page.goto('/')
  const search = page.getByPlaceholder('搜尋車站、站號或英文站名')
  for (const query of ['忠孝新生', 'bl14', 'xinsheng']) {
    await search.fill(query)
    await expect(page.getByRole('button', { name: /忠孝新生/ }).first()).toBeVisible()
  }
  await page.getByRole('button', { name: /忠孝新生/ }).first().click()
  await expect(page).toHaveURL(/\/station\/O07$/)
  await expect(page.getByRole('heading', { name: '忠孝新生' })).toBeVisible()
})

test('station board groups trains by line and direction', async ({ page }) => {
  await page.goto('/station/O07')
  await expect(page.getByText('中和新蘆線').first()).toBeVisible()
  await expect(page.getByText('進站中')).toBeVisible()
  await expect(page.locator('li', { hasText: '蘆洲' }).getByText('14', { exact: true })).toBeVisible()
  await expect(page.getByText('今日營運已結束')).toBeVisible()
  await expect(page.getByText('建議搭乘第 3、4 節')).toBeVisible()
})

test('new Xinyi extension station is reachable by deep link', async ({ page }) => {
  await page.goto('/station/R01/times')
  await expect(page.getByRole('heading', { name: /廣慈\/奉天宮/ })).toBeVisible()
  await expect(page.getByText('新站')).toBeVisible()
  await expect(page.getByText('06:00').first()).toBeVisible()
})

test('fares tab lists destinations with prices', async ({ page }) => {
  await page.goto('/station/R01/fares')
  await expect(page.getByText('台北車站')).toBeVisible()
  await page.getByPlaceholder('篩選目的地').fill('淡水')
  await expect(page.getByRole('button', { name: /淡水/ })).toBeVisible()
})

test('line view shows the Luzhou branch', async ({ page }) => {
  await page.goto('/line/O')
  await expect(page.getByRole('heading', { name: '中和新蘆線' })).toBeVisible()
  await expect(page.getByText('蘆洲支線')).toBeVisible()
})

test('language toggle switches to English', async ({ page }) => {
  await page.goto('/station/O07')
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Zhongxiao Xinsheng' })).toBeVisible()
  await expect(page.getByText('Arriving')).toBeVisible()
})
