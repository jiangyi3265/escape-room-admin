// 管理后台界面验收：真实登录表单 → 逐页打开检查 → 真实操作（发通知、主题增删、任务发布与取消、订单代推进与收款……）
//
// 运行前：后端 http://127.0.0.1:8087 已启动；前端开发服务器 http://127.0.0.1:8097 已启动；本机 Redis 可读验证码。
// 运行：node tests/admin-ui.mjs        （HEADED=1 可看浏览器操作过程）
// 可重复运行：测试数据都带时间戳，结束时删除或还原；截图在 tests/screenshots/。
import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 使用全局安装的 Playwright（Windows 上绝对路径要转成 file:// 才能导入）
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'C:/Users/jiangyi/AppData/Roaming/npm/node_modules/playwright/index.mjs'
const { chromium } = await import(pathToFileURL(PLAYWRIGHT).href)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = path.join(ROOT, 'tests', 'screenshots')
const BASE = (process.env.ADMIN_UI_URL || 'http://127.0.0.1:8097').replace(/\/$/, '')
const REDIS_CLI = process.env.REDIS_CLI || 'C:/Program Files/Redis/redis-cli.exe'
const REDIS_DB = process.env.REDIS_DATABASE || '7'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
// 只读账号由后端的接口测试（RuoYi-Vue/tests/admin-api.mjs）建立；没有这个账号时跳过对应检查
const VIEWER = { username: 'viewer', password: process.env.VIEWER_PASSWORD || 'Viewer-2026!' }
const VIEWPORT = { width: 1280, height: 800 }
const STAMP = Date.now().toString()
const SHORT = STAMP.slice(-6)

mkdirSync(SHOTS, { recursive: true })

// ------------------------------------------------------------------ 结果统计

let passed = 0
let failed = 0
let skipped = 0

async function check(label, fn) {
  try {
    const note = await fn()
    if (note && note.skip) {
      skipped++
      console.log(`SKIP ${label}（${note.skip}）`)
      return
    }
    passed++
    console.log(`PASS ${label}`)
  } catch (error) {
    failed++
    console.log(`FAIL ${label}\n     ${String(error && error.message ? error.message : error).split('\n').join('\n     ')}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// ------------------------------------------------------------------ 页面工具

// 操作员不应看到的技术用语
const TECH_WORDS = [
  /字段/, /\bID\b/, /接口/, /参数/, /token/i, /状态码/, /JSON/i, /\bnull\b/, /\bundefined\b/, /\bNaN\b/,
  /权限字符/, /系统内部/, /\[object Object\]/, /Exception/, /Invalid Date/
]

function redis(...args) {
  return execFileSync(REDIS_CLI, ['-n', REDIS_DB, ...args], { encoding: 'utf8' }).trim()
}

const visible = (locator) => locator.filter({ visible: true })
const dialogOf = (page, cls) => visible(page.locator(`.el-dialog${cls}`)).first()
const drawerOf = (page) => visible(page.locator('.el-drawer.order-drawer')).first()
const rowsOf = (scope) => scope.locator('.el-table__body-wrapper tr.el-table__row')

function toCents(text) {
  const clean = String(text).replace(/[¥,\s]/g, '')
  const value = Math.round(Number(clean) * 100)
  if (!Number.isFinite(value)) throw new Error(`金额看不懂：${text}`)
  return value
}

function track(page) {
  const log = { errors: [], warnings: [] }
  page.on('console', (msg) => {
    const text = msg.text()
    if (msg.type() === 'error') log.errors.push(text)
    else if (msg.type() === 'warning' && /\[Vue warn\]|ElementPlus/i.test(text)) log.warnings.push(text)
  })
  page.on('pageerror', (error) => log.errors.push(`页面脚本出错：${error.message}`))
  return log
}

async function newSession(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })
  context.setDefaultTimeout(20000)
  const page = await context.newPage()
  const log = track(page)
  return { context, page, log }
}

async function login(page, username, password) {
  const captchaResponse = page.waitForResponse((r) => r.url().includes('/captchaImage'))
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  const captcha = await (await captchaResponse).json()
  let code = ''
  if (captcha.captchaEnabled !== false) {
    code = redis('get', `captcha_codes:${captcha.uuid}`).replace(/^"|"$/g, '')
    assert(code, '没有从 Redis 读到验证码')
  }
  await page.getByPlaceholder('账号', { exact: true }).fill(username)
  await page.getByPlaceholder('密码', { exact: true }).fill(password)
  if (code) await page.getByPlaceholder('验证码', { exact: true }).fill(code)
  await page.getByRole('button', { name: /登\s*录/ }).click()
  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 })
  } catch (e) {
    const tips = await visible(page.locator('.el-message, .el-notification')).allInnerTexts()
    throw new Error(`登录没有成功：${tips.join(' / ') || '页面停在登录页'}`)
  }
  await page.waitForSelector('.sidebar-container', { timeout: 20000 })
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForFunction(
    () => ![...document.querySelectorAll('.el-loading-mask')].some((m) => m.offsetParent !== null),
    null,
    { timeout: 20000 }
  )
  await page.waitForTimeout(350)
}

async function openPage(page, log, url) {
  log.errors.length = 0
  log.warnings.length = 0
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.app-main', { timeout: 20000 })
  await settle(page)
}

async function expectTexts(page, texts, scope = '.app-main') {
  const text = await page.locator(scope).first().innerText()
  const missing = texts.filter((t) => !text.includes(t))
  assert(!missing.length, `页面上没找到：${missing.join('、')}`)
}

async function expectNoTechWords(page) {
  const text = await page.evaluate(() => document.body.innerText)
  const hits = []
  for (const re of TECH_WORDS) {
    const m = re.exec(text)
    if (m) hits.push(`「${m[0]}」…${text.slice(Math.max(0, m.index - 15), m.index + 15).replace(/\s+/g, ' ')}…`)
  }
  assert(!hits.length, `界面出现技术用语：${hits.join('；')}`)
}

function expectCleanConsole(log) {
  const problems = [...log.errors, ...log.warnings]
  assert(!problems.length, `控制台有 ${problems.length} 条错误或警告：\n${problems.slice(0, 5).map((p) => p.slice(0, 300)).join('\n')}`)
}

async function expectNoErrorPopup(page) {
  const texts = await visible(page.locator('.el-notification--error, .el-message--error, .el-notification .el-notification__icon.el-notification--error')).allInnerTexts()
  const titles = await visible(page.locator('.el-notification')).allInnerTexts()
  const all = [...texts, ...titles].map((t) => t.trim()).filter(Boolean)
  assert(!all.length, `出现错误提示：${all.join(' / ')}`)
}

async function expectSuccess(page, text) {
  await visible(page.locator('.el-message--success')).filter({ hasText: text }).first().waitFor({ timeout: 15000 })
}

async function confirmBox(page, buttonName, fill) {
  const box = visible(page.locator('.el-message-box')).last()
  await box.waitFor()
  if (fill !== undefined) await box.locator('input').fill(fill)
  await box.getByRole('button', { name: buttonName, exact: true }).click()
  await box.waitFor({ state: 'hidden' })
}

async function pickOption(page, select, optionText) {
  await select.click()
  const option = visible(page.locator('.el-select-dropdown__item')).filter({ hasText: optionText }).first()
  await option.waitFor()
  await option.click()
}

/** 整页截图：内容区可滚动，先把视口拉到内容高度再截 */
async function shot(page, name, { full = true } = {}) {
  const size = page.viewportSize()
  let target = size.height
  if (full) {
    const height = await page.evaluate(() => {
      const main = document.querySelector('.app-main')
      if (!main) return document.body.scrollHeight
      return Math.ceil(main.getBoundingClientRect().top + main.scrollHeight)
    })
    target = Math.min(Math.max(size.height, height), 5000)
  }
  if (target !== size.height) {
    await page.setViewportSize({ width: size.width, height: target })
    await page.waitForTimeout(400)
  }
  // 弹窗、抽屉、标签都有 0.3 秒左右的出现动画，等动画结束再截
  await page.waitForTimeout(full ? 300 : 700)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
  if (target !== size.height) {
    await page.setViewportSize(size)
    await page.waitForTimeout(150)
  }
}

async function tableRowCount(page) {
  return rowsOf(page.locator('.app-main')).count()
}

async function searchKeyword(page, placeholder, value) {
  const input = page.locator('.app-main').getByPlaceholder(placeholder, { exact: true })
  await input.fill(value)
  await input.press('Enter')
  await settle(page)
}

async function readDashboardTotal(page, log) {
  await openPage(page, log, '/index')
  await page.waitForFunction(() => /更新/.test(document.querySelector('.dashboard__refresh')?.innerText || ''), null, { timeout: 20000 })
  return toCents(await page.locator('[data-stat="今日三项合计"]').innerText())
}

// ------------------------------------------------------------------ 逐页检查

const PAGES = [
  {
    key: '01-dashboard', title: '门店概览', url: '/index', ready: '[data-stat="今日三项合计"]',
    texts: ['今日三项合计', '微信', '支付宝', '现金', '线上', '待审核', '待抢任务', '待维修', '进行中订单', '近 7 日收款', '员工积分排行', '订单现场', '最近消息', '每 30 秒自动刷新']
  },
  {
    key: '02-order', title: '订单管理', url: '/store-order/order', table: true,
    texts: ['全部', '进行中', '待剪辑', '已完成', '已取消', '已删除', '订单编号', '营业日期', '主题', '预约时间', '人数', '客户', '进度', '收款', '创建人', '最近操作', '录入订单', '导出']
  },
  {
    key: '03-receipt', title: '收款台账', url: '/store-order/receipt', table: true,
    texts: ['收款明细', '每日汇总', '微信', '支付宝', '现金', '三项合计', '线上', '收款笔数', '收款日期', '订单编号', '登记人', '收款时间', '状态', '修改记录', '导出']
  },
  {
    key: '04-audit', title: '打扫审核', url: '/store-points/audit', table: true,
    texts: ['待审核', '审核记录', '提交时间', '员工', '任务', '积分', '批量通过']
  },
  {
    key: '05-point', title: '积分明细', url: '/store-points/point', table: true,
    texts: ['时间', '员工', '事项', '积分', '来源', '状态', '经办 / 审核人', '调整积分', '导出']
  },
  {
    key: '06-job', title: '临时任务', url: '/store-points/job', table: true,
    texts: ['标题', '说明', '截止', '紧急程度', '可抢员工', '状态', '发布', '抢到 / 取消', '发布任务']
  },
  {
    key: '07-task', title: '积分任务设置', url: '/store-points/task', table: true,
    texts: ['排序', '任务名称', '分类', '每次积分', '到账方式', '状态', '新增任务', '只影响之后提交的任务']
  },
  {
    key: '08-staff', title: '员工管理', url: '/store-manage/staff', table: true,
    texts: ['姓名', '手机号', '身份', '状态', '积分', '完成任务', '最近登录', '备注', '添加人员', '重置密码']
  },
  {
    key: '09-theme', title: '主题管理', url: '/store-manage/theme', table: true,
    texts: ['在用主题', '已删除', '排序', '主题名称', '最近修改人', '修改时间', '新增主题']
  },
  {
    key: '10-repair', title: '维修登记', url: '/store-manage/repair', table: true,
    texts: ['待维修', '已修好', '全部', '主题', '问题', '登记人', '修理人', '状态', '登记维修']
  },
  {
    key: '11-notice', title: '门店消息', url: '/store-manage/notice', table: true,
    texts: ['时间', '类型', '标题', '内容', '接收范围', '已读 / 接收', '触发人', '发送通知']
  },
  {
    key: '12-oplog', title: '操作记录', url: '/store-manage/oplog', table: true,
    texts: ['时间', '来源', '操作人', '对象', '操作', '内容']
  },
  {
    key: '13-setting', title: '门店设置', url: '/store-manage/setting', ready: '.setting-page input',
    texts: ['门店名称', '门店编码', '门店时区', '门店当前时间', '门店端登录有效期', '密码错误锁定规则']
  }
]

// ------------------------------------------------------------------ 开始

const browser = await chromium.launch({ channel: 'msedge', headless: process.env.HEADED !== '1' })
const admin = await newSession(browser)
const { page, log } = admin

await check('管理员通过登录页登录（验证码取自 Redis）', async () => {
  await login(page, 'admin', ADMIN_PASSWORD)
  assert(/\/index$/.test(new URL(page.url()).pathname), `登录后应进入门店概览，实际是 ${page.url()}`)
  const title = await page.title()
  assert(title.includes('密室逃脱管理后台') || title.includes('门店概览'), `网页标题不对：${title}`)
})

for (const p of PAGES) {
  await check(`页面「${p.title}」正常显示（${p.url}）`, async () => {
    await openPage(page, log, p.url)
    if (p.ready) await page.locator(p.ready).first().waitFor()
    if (p.table) {
      await page.locator('.app-main .el-table').first().waitFor()
      assert((await tableRowCount(page)) > 0, '表格没有数据')
    }
    await expectTexts(page, p.texts)
    await expectNoTechWords(page)
    await expectNoErrorPopup(page)
    expectCleanConsole(log)
    await shot(page, p.key)
  })
}

await check('门店概览：图表、排行、订单现场、消息都有内容，待办卡片能跳转', async () => {
  await openPage(page, log, '/index')
  await page.locator('.dashboard .daily-chart canvas').first().waitFor()
  assert((await page.locator('.rank-list__item').count()) > 0, '积分排行是空的')
  assert((await page.locator('.live-order').count()) > 0, '订单现场是空的')
  assert((await page.locator('.notice-list__item').count()) > 0, '最近消息是空的')
  // 页面内跳转有切换动画，等目标页面真正出现再检查
  await page.locator('[data-todo="audit"]').click()
  await page.waitForURL(/\/store-points\/audit/)
  await page.locator('.audit-page .el-table').waitFor()
  await settle(page)
  await expectTexts(page, ['提交时间'], '.audit-page')
  await openPage(page, log, '/index')
  await page.locator('[data-todo="order"]').click()
  await page.waitForURL(/\/store-order\/order\?status=running/)
  await page.locator('.order-page .el-table').waitFor()
  await settle(page)
  const active = await page.locator('.app-main .el-tabs__item.is-active').innerText()
  assert(active.includes('进行中'), `从待办进入订单页应停在「进行中」，实际是「${active}」`)
  expectCleanConsole(log)
})

await check('订单详情抽屉：流程进度、节点记录、收款、剪辑任务、操作记录', async () => {
  await openPage(page, log, '/store-order/order?status=editing')
  await rowsOf(page.locator('.app-main')).first().click()
  const drawer = drawerOf(page)
  await drawer.waitFor()
  await drawer.locator('.order-flow').waitFor()
  await settle(page)
  const text = await drawer.innerText()
  for (const t of ['基本信息', '流程进度', '节点记录', '收款详情', '剪辑任务', '操作记录', '当前', '剪辑完毕']) {
    assert(text.includes(t), `抽屉里缺少「${t}」`)
  }
  assert((await drawer.locator('.order-flow .is-done').count()) > 0, '没有显示已完成的节点')
  assert((await drawer.locator('.order-flow .is-current').count()) === 1, '当前节点应该正好一个')
  await expectNoTechWords(page)
  await shot(page, '02b-order-drawer', { full: false })
  await drawer.locator('.el-drawer__body').evaluate((el) => { el.scrollTop = el.scrollHeight })
  await shot(page, '02b2-order-drawer-bottom', { full: false })
  await page.keyboard.press('Escape')
  await drawer.waitFor({ state: 'hidden' })
  expectCleanConsole(log)
})

await check('收款台账：默认近 7 天、每日汇总图表与 7/30 天切换', async () => {
  await openPage(page, log, '/store-order/receipt')
  const range = await page.locator('.app-main .el-date-editor input').evaluateAll((els) => els.map((e) => e.value))
  assert(range.length === 2 && range[0] && range[1], '收款日期没有默认范围')
  const days = (Date.parse(range[1]) - Date.parse(range[0])) / 86400000
  assert(days === 6, `默认应为近 7 天，实际 ${range.join(' 至 ')}`)
  await page.locator('.app-main .el-tabs__item', { hasText: '每日汇总' }).click()
  await page.locator('.receipt-page__daily .daily-chart canvas').first().waitFor()
  await settle(page)
  assert((await rowsOf(page.locator('.receipt-daily-table')).count()) === 7, '每日汇总应有 7 行')
  await expectTexts(page, ['合计（7 天）', '线上（不计入合计）'])
  await shot(page, '03b-receipt-daily')
  await page.locator('.receipt-page__daily').getByText('近 30 天', { exact: true }).click()
  await settle(page)
  assert((await rowsOf(page.locator('.receipt-daily-table')).count()) === 30, '切到近 30 天后应有 30 行')
  expectCleanConsole(log)
})

await check('导出：订单、收款台账、积分明细都能生成表格文件', async () => {
  const targets = [
    ['/store-order/order?status=done', '订单明细'],
    ['/store-order/receipt', '收款台账'],
    ['/store-points/point', '积分明细']
  ]
  for (const [url, prefix] of targets) {
    await openPage(page, log, url)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('.app-main .esc-toolbar').getByRole('button', { name: '导出', exact: true }).click()
    ])
    const file = download.suggestedFilename()
    assert(file.startsWith(prefix) && file.endsWith('.xlsx'), `导出的文件名不对：${file}`)
    const saved = await download.path()
    assert(saved && statSync(saved).size > 1000, `${prefix} 导出的文件是空的`)
    await download.delete()
    await settle(page)
    await expectNoErrorPopup(page)
  }
  expectCleanConsole(log)
})

// ------------------------------------------------------------------ 真实操作

await check('门店消息：发送全店通知，并查看已读情况', async () => {
  await openPage(page, log, '/store-manage/notice')
  const title = `界面测试通知${SHORT}`
  await page.getByRole('button', { name: '发送通知' }).click()
  const dialog = dialogOf(page, '.notice-send-dialog')
  await dialog.waitFor()
  await dialog.getByPlaceholder('如：周五消防检查').fill(title)
  await dialog.locator('textarea').fill('界面自动测试发送的通知，请忽略。')
  await dialog.getByRole('button', { name: '发送', exact: true }).click()
  await expectSuccess(page, '已发送给')
  await dialog.waitFor({ state: 'hidden' })
  await settle(page)
  const row = rowsOf(page.locator('.app-main')).filter({ hasText: title }).first()
  await row.waitFor()
  await row.locator('.el-button').click()
  const receipts = dialogOf(page, '.notice-receipt-dialog')
  await receipts.waitFor()
  await settle(page)
  const text = await receipts.innerText()
  assert(/共 \d+ 人接收/.test(text), '已读情况里没有接收人数')
  assert((await rowsOf(receipts).count()) > 0, '已读情况里没有接收人')
  await shot(page, '11b-notice-receipts', { full: false })
  await receipts.getByRole('button', { name: '关闭', exact: true }).click()
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

await check('主题管理：新增主题后删除，删除后在「已删除」里能看到', async () => {
  await openPage(page, log, '/store-manage/theme')
  const name = `界面测试主题${STAMP}`
  await page.getByRole('button', { name: '新增主题' }).click()
  const dialog = dialogOf(page, '.theme-form-dialog')
  await dialog.waitFor()
  await dialog.getByPlaceholder('如：港诡实录').fill(name)
  await shot(page, '09b-theme-form', { full: false })
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expectSuccess(page, '主题已添加')
  await dialog.waitFor({ state: 'hidden' })
  await searchKeyword(page, '输入名称查找', name)
  const row = rowsOf(page.locator('.app-main')).filter({ hasText: name }).first()
  await row.waitFor()
  await row.getByRole('button', { name: '删除' }).click()
  await confirmBox(page, '确定删除')
  await expectSuccess(page, '主题已删除')
  await settle(page)
  assert((await rowsOf(page.locator('.app-main')).filter({ hasText: name }).count()) === 0, '删除后在用列表里还有这个主题')
  await page.locator('.app-main .el-tabs__item', { hasText: '已删除' }).click()
  await settle(page)
  const deleted = rowsOf(page.locator('.app-main')).filter({ hasText: name }).first()
  await deleted.waitFor()
  assert((await deleted.innerText()).includes('门店管理员'), '已删除列表里没有显示删除人')
  await shot(page, '09c-theme-deleted')
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

await check('出错时提示看得懂：主题重名时弹出「主题名称已存在」', async () => {
  await openPage(page, log, '/store-manage/theme')
  await page.getByRole('button', { name: '新增主题' }).click()
  const dialog = dialogOf(page, '.theme-form-dialog')
  await dialog.waitFor()
  await dialog.getByPlaceholder('如：港诡实录').fill('港诡实录')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await visible(page.locator('.el-notification')).filter({ hasText: '主题名称已存在' }).first().waitFor()
  await expectNoTechWords(page)
  assert(await dialog.isVisible(), '保存失败时弹窗应保留，方便修改')
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  expectCleanConsole(log)
})

await check('临时任务：发布限定员工的紧急任务，再取消', async () => {
  await openPage(page, log, '/store-points/job')
  const title = `界面测试任务${SHORT}`
  await page.getByRole('button', { name: '发布任务' }).click()
  const dialog = dialogOf(page, '.job-publish-dialog')
  await dialog.waitFor()
  await dialog.getByPlaceholder('如：搬运新道具').fill(title)
  await dialog.locator('textarea').fill('界面自动测试发布的任务，请忽略。')
  await dialog.getByPlaceholder('如：今天 21:30 前（选填）').fill('今天 23:00 前')
  await dialog.locator('.el-radio-button', { hasText: '紧急' }).click()
  await dialog.locator('.el-switch').click()
  await pickOption(page, dialog.locator('.el-select').first(), '林澈')
  await dialog.locator('.el-dialog__title').click()
  await shot(page, '06b-job-publish', { full: false })
  await dialog.getByRole('button', { name: '发布', exact: true }).click()
  await expectSuccess(page, '发布成功')
  await dialog.waitFor({ state: 'hidden' })
  await settle(page)
  const row = rowsOf(page.locator('.app-main')).filter({ hasText: title }).first()
  await row.waitFor()
  const rowText = await row.innerText()
  assert(rowText.includes('林澈') && rowText.includes('紧急') && rowText.includes('待抢'), `新任务显示不对：${rowText}`)
  await row.getByRole('button', { name: '取消' }).click()
  await confirmBox(page, '确定取消')
  await expectSuccess(page, '任务已取消')
  await settle(page)
  const after = await rowsOf(page.locator('.app-main')).filter({ hasText: title }).first().innerText()
  assert(after.includes('已取消'), `取消后状态不对：${after}`)
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

// 订单：录入 → 开始 → 开场复位 → 登记收款 → 概览合计变化 → 修正回收钱改金额 → 走完流程 → 删除（收款冲正）
/** 直接调后台接口准备数据（用当前登录的管理员身份） */
async function api(method, url, data) {
  const token = (await page.context().cookies()).find((c) => c.name === 'Admin-Token')?.value
  const res = await page.request.fetch(`${BASE}/dev-api${url}`, { method, headers: { Authorization: `Bearer ${token}` }, data })
  const body = await res.json()
  assert(body.code === 200, `${method} ${url} 没有成功：${body.msg}`)
  return body
}

await check('订单筛选：主题改名后旧名称仍可选（标明「历史名称」），选中后只列出旧名称的订单', async () => {
  const oldName = `筛选旧名${SHORT}`
  const newName = `筛选新名${SHORT}`
  const contact = `筛选测试${SHORT}`
  const theme = (await api('POST', '/escape/theme', { themeName: oldName })).data
  const order = (await api('POST', '/escape/order', { themeId: theme.themeId, time: '周日 10:00', people: 2, contact })).data
  try {
    await api('PUT', `/escape/theme/${theme.themeId}`, { themeName: newName })
    await openPage(page, log, '/store-order/order')
    const select = page.locator('.app-main .esc-filter .el-form-item', { hasText: '主题' }).locator('.el-select').first()
    await select.click()
    const options = visible(page.locator('.el-select-dropdown__item'))
    await options.filter({ hasText: `${oldName}（历史名称）` }).first().waitFor()
    const labels = await options.allInnerTexts()
    assert(labels.includes(newName), '在用的新名称没有出现在筛选里')
    assert(!labels.includes(`${newName}（历史名称）`), '在用的主题不应标成历史名称')
    assert(labels.indexOf(newName) < labels.indexOf(`${oldName}（历史名称）`), '在用主题应排在历史名称前面')
    await options.filter({ hasText: `${oldName}（历史名称）` }).first().scrollIntoViewIfNeeded()
    await shot(page, '02i-order-theme-filter', { full: false })
    await options.filter({ hasText: `${oldName}（历史名称）` }).first().click()
    await settle(page)
    const rows = rowsOf(page.locator('.app-main'))
    assert((await rows.count()) === 1, `按旧名称筛选应只有 1 条订单，实际 ${await rows.count()} 条`)
    assert((await rows.first().innerText()).includes(contact), '筛出来的不是这张订单')
    await expectNoErrorPopup(page)
    expectCleanConsole(log)
  } finally {
    await api('DELETE', `/escape/order/${order.orderId}`)
    await api('DELETE', `/escape/theme/${theme.themeId}`)
  }
})

const orderContact = `界面测试客户${SHORT}`
let baselineTotal = null
let orderNo = ''

async function openOrderByContact(contact, tab) {
  await openPage(page, log, `/store-order/order${tab ? `?status=${tab}` : ''}`)
  await searchKeyword(page, '订单编号 / 客户 / 备注 / 创建人', contact)
  const row = rowsOf(page.locator('.app-main')).filter({ hasText: contact }).first()
  await row.waitFor()
  await row.click()
  const drawer = drawerOf(page)
  await drawer.waitFor()
  await drawer.getByText(contact).first().waitFor()
  await settle(page)
  return drawer
}

async function advanceStep(drawer, buttonName, successText) {
  await drawer.getByRole('button', { name: buttonName, exact: true }).click()
  await confirmBox(page, '确定完成')
  await expectSuccess(page, successText)
  await settle(page)
}

async function chooseStep(drawer, buttonName, choice, successText) {
  await drawer.getByRole('button', { name: buttonName, exact: true }).click()
  const dialog = dialogOf(page, '.order-choice-dialog')
  await dialog.waitFor()
  await dialog.getByText(choice, { exact: true }).click()
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expectSuccess(page, successText)
  await dialog.waitFor({ state: 'hidden' })
  await settle(page)
}

await check('订单：录入订单后在抽屉里开始、开场复位、登记收款，门店概览合计随之增加', async () => {
  baselineTotal = await readDashboardTotal(page, log)
  await openPage(page, log, '/store-order/order')
  await page.locator('.esc-toolbar').getByRole('button', { name: '录入订单' }).click()
  const form = dialogOf(page, '.order-form-dialog')
  await form.waitFor()
  await pickOption(page, form.locator('.el-select').first(), /^港诡实录$/)
  await form.getByPlaceholder('如：周六 15:00、20:30').fill('20:30')
  await form.locator('.el-input-number input').fill('4')
  await form.locator('.el-input-number input').press('Tab')
  await form.getByPlaceholder('客户姓名或联系方式（选填）').fill(orderContact)
  await form.locator('textarea').fill('界面自动测试订单')
  await shot(page, '02c-order-form', { full: false })
  await form.getByRole('button', { name: '录入订单', exact: true }).click()
  await expectSuccess(page, '订单已录入')
  const drawer = drawerOf(page)
  await drawer.waitFor()
  await drawer.getByText(orderContact).first().waitFor()
  await settle(page)
  orderNo = (await drawer.locator('.order-drawer__sub').innerText()).split('·')[0].trim()
  assert(/^ER\d{6}-[A-Z0-9]{5}$/.test(orderNo), `订单编号格式不对：${orderNo}`)

  await advanceStep(drawer, '开始订单', '已完成「点击主题名称」')
  await advanceStep(drawer, '完成「开场复位」', '已完成「开场复位」')
  await drawer.getByRole('button', { name: '登记收款', exact: true }).click()
  const pay = dialogOf(page, '.order-pay-dialog')
  await pay.waitFor()
  // 先试错：什么都不填、金额写错
  await pay.getByRole('button', { name: '确认收款', exact: true }).click()
  await visible(page.locator('.el-message--warning')).filter({ hasText: '请至少填写一项大于 0 的收款金额' }).first().waitFor()
  await pay.locator('input[data-channel="wechat"]').fill('12.345')
  await pay.locator('input[data-channel="wechat"]').blur()
  await pay.getByText('请填写金额数字，最多两位小数').waitFor()
  await pay.locator('input[data-channel="wechat"]').fill('123.45')
  await pay.locator('input[data-channel="cash"]').fill('50')
  await pay.locator('input[data-channel="online"]').fill('30')
  const preview = await pay.locator('[data-pay-total]').innerText()
  assert(preview === '¥173.45', `实时合计应为 ¥173.45，实际 ${preview}`)
  await expectNoTechWords(page)
  await shot(page, '02d-order-payment', { full: false })
  await pay.getByRole('button', { name: '确认收款', exact: true }).click()
  await expectSuccess(page, '收款已登记')
  await pay.waitFor({ state: 'hidden' })
  await settle(page)
  const payText = await drawer.locator('.order-pay').innerText()
  assert(payText.includes('¥173.45') && payText.includes('¥30.00'), `抽屉里的收款金额不对：${payText}`)
  const current = await drawer.locator('.order-flow .is-current').innerText()
  assert(current.includes('开始带场建群'), `收款后当前节点应为「开始带场建群」，实际：${current}`)
  const logs = await drawer.locator('.esc-section').filter({ hasText: '操作记录' }).last().innerText()
  assert(logs.includes('登记收款') && logs.includes('创建订单'), `抽屉的操作记录里应有创建订单和登记收款：${logs.slice(0, 200)}`)
  await expectNoErrorPopup(page)
  expectCleanConsole(log)

  const after = await readDashboardTotal(page, log)
  assert(after - baselineTotal === 17345, `门店概览今日合计应增加 ¥173.45，实际从 ${baselineTotal / 100} 变为 ${after / 100}`)
  await shot(page, '01b-dashboard-after-payment')
})

await check('订单：修正回到「收钱」改金额（留修改记录），再走完拍照、视频、剪辑', async () => {
  assert(orderNo, '上一步没有建好订单')
  const drawer = await openOrderByContact(orderContact)
  await drawer.getByRole('button', { name: '修正节点', exact: true }).click()
  const correct = dialogOf(page, '.order-correct-dialog')
  await correct.waitFor()
  await pickOption(page, correct.locator('.el-select').first(), '收钱')
  await correct.locator('textarea').fill('界面测试：金额录错')
  await shot(page, '02e-order-correct', { full: false })
  await correct.getByRole('button', { name: '确认回退', exact: true }).click()
  await expectSuccess(page, '已退回收钱')
  await correct.waitFor({ state: 'hidden' })
  await settle(page)
  assert((await drawer.innerText()).includes('已回退'), '节点记录里没有显示已回退的记录')

  await drawer.getByRole('button', { name: '重新确认收款', exact: true }).click()
  const pay = dialogOf(page, '.order-pay-dialog')
  await pay.waitFor()
  assert((await pay.locator('.el-dialog__title').innerText()).includes('修改收款金额'), '再次收款时标题应为「修改收款金额」')
  const prefilled = await pay.locator('input[data-channel="wechat"]').inputValue()
  assert(prefilled === '123.45', `应带出原来的微信金额，实际：${prefilled}`)
  await pay.locator('input[data-channel="wechat"]').fill('150')
  assert((await pay.locator('[data-pay-total]').innerText()) === '¥200.00', '修改后的实时合计不对')
  await pay.getByRole('button', { name: '保存修改', exact: true }).click()
  await expectSuccess(page, '收款金额已修改')
  await pay.waitFor({ state: 'hidden' })
  await settle(page)
  assert((await drawer.innerText()).includes('修改记录（1）'), '收款详情里没有修改记录')
  const logs = await drawer.locator('.esc-section').filter({ hasText: '操作记录' }).last().innerText()
  assert(logs.includes('修正流程节点') && logs.includes('修改收款金额'), '操作记录里应有修正节点和修改收款金额')

  await advanceStep(drawer, '完成「开始带场建群」', '已完成「开始带场建群」')
  await advanceStep(drawer, '完成「开始入场」', '已完成「开始入场」')
  await advanceStep(drawer, '完成「开始游戏」', '已完成「开始游戏」')
  await advanceStep(drawer, '完成「游戏结束」', '已完成「游戏结束」')
  await advanceStep(drawer, '完成「收场复位」', '已完成「收场复位」')
  await chooseStep(drawer, '记录拍照选择', '要拍照', '已完成「拍照选择」')
  await drawer.getByRole('button', { name: '记录视频选择', exact: true }).click()
  await shot(page, '02f-order-video-choice', { full: false })
  await page.keyboard.press('Escape')
  await dialogOf(page, '.order-choice-dialog').waitFor({ state: 'hidden' })
  await chooseStep(drawer, '记录视频选择', '要视频', '已完成「视频选择」')
  const editing = await drawer.innerText()
  assert(editing.includes('待剪辑'), '选「要视频」后应出现待剪辑任务')
  await advanceStep(drawer, '确认剪辑完毕', '已完成「剪辑完毕」')
  await drawer.getByText('订单已完成', { exact: true }).waitFor()
  await shot(page, '02g-order-done', { full: false })
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

await check('收款台账：能查到这笔收款，修改记录可以打开', async () => {
  assert(orderNo, '前面没有建好订单')
  await openPage(page, log, '/store-order/receipt')
  await searchKeyword(page, '订单编号 / 主题 / 登记人', orderNo)
  const row = rowsOf(page.locator('.receipt-page__list')).filter({ hasText: orderNo }).first()
  await row.waitFor()
  const text = await row.innerText()
  assert(text.includes('¥200.00') && text.includes('有效'), `收款行显示不对：${text}`)
  const stat = await page.locator('.receipt-page__stats').innerText()
  assert(stat.includes('¥200.00'), '按订单编号筛选后合计卡片应为 ¥200.00')
  await row.getByRole('button', { name: '1 次' }).click()
  const dialog = dialogOf(page, '.receipt-revision-dialog')
  await dialog.waitFor()
  const revision = await dialog.innerText()
  assert(revision.includes('¥173.45') && revision.includes('¥123.45'), `修改记录里应能看到修改前的金额：${revision}`)
  await shot(page, '03c-receipt-revisions', { full: false })
  await dialog.getByRole('button', { name: '知道了' }).click()
  await row.getByText(orderNo).click()
  const drawer = drawerOf(page)
  await drawer.waitFor()
  await drawer.getByText('订单已完成', { exact: true }).waitFor()
  await page.keyboard.press('Escape')
  expectCleanConsole(log)
})

await check('订单：删除后收款自动冲正，概览合计回到原值，「已删除」里能查到', async () => {
  const before = await readDashboardTotal(page, log)
  assert(before - baselineTotal === 20000, `修改金额后概览应比开始时多 ¥200.00，实际多 ${(before - baselineTotal) / 100}`)
  const drawer = await openOrderByContact(orderContact)
  await drawer.getByRole('button', { name: '删除订单', exact: true }).click()
  const box = visible(page.locator('.el-message-box')).last()
  await box.waitFor()
  assert((await box.innerText()).includes('冲正'), '删除确认里应提示收款会冲正')
  await confirmBox(page, '确定删除')
  await expectSuccess(page, '订单已删除，收款已冲正')
  await settle(page)
  await drawer.getByText('这笔订单已删除，只能查看记录').waitFor()
  assert((await drawer.locator('.order-drawer__actions').count()) === 0, '已删除的订单不应再显示操作按钮')
  const after = await readDashboardTotal(page, log)
  assert(after === baselineTotal, `删除后概览合计应回到 ${baselineTotal / 100}，实际 ${after / 100}`)
  await openOrderByContact(orderContact, 'deleted')
  const active = await page.locator('.app-main .el-tabs__item.is-active').innerText()
  assert(active.includes('已删除'), '应停在「已删除」页签')
  await page.keyboard.press('Escape')
  expectCleanConsole(log)
})

await check('订单：修改订单内容，再取消订单（填写原因）', async () => {
  const contact = `界面测试取消${SHORT}`
  await openPage(page, log, '/store-order/order')
  await page.locator('.esc-toolbar').getByRole('button', { name: '录入订单' }).click()
  const form = dialogOf(page, '.order-form-dialog')
  await form.waitFor()
  await pickOption(page, form.locator('.el-select').first(), /^开学悸$/)
  await form.getByPlaceholder('如：周六 15:00、20:30').fill('21:00')
  await form.getByPlaceholder('客户姓名或联系方式（选填）').fill(contact)
  await form.getByRole('button', { name: '录入订单', exact: true }).click()
  await expectSuccess(page, '订单已录入')
  const drawer = drawerOf(page)
  await drawer.waitFor()
  await drawer.getByText(contact).first().waitFor()
  await settle(page)
  await drawer.getByRole('button', { name: '修改订单', exact: true }).click()
  const edit = dialogOf(page, '.order-form-dialog')
  await edit.waitFor()
  assert((await edit.locator('.el-dialog__title').innerText()) === '修改订单', '修改时标题应为「修改订单」')
  await page.waitForTimeout(300)
  await edit.locator('.el-input-number input').fill('6')
  await edit.locator('.el-input-number input').press('Tab')
  await edit.getByRole('button', { name: '保存修改', exact: true }).click()
  await expectSuccess(page, '修改已保存')
  await edit.waitFor({ state: 'hidden' })
  await settle(page)
  await drawer.getByText('6 人', { exact: true }).waitFor()
  await drawer.getByRole('button', { name: '取消订单', exact: true }).click()
  await confirmBox(page, '确定取消订单', '界面测试：客户改期')
  await expectSuccess(page, '订单已取消')
  await settle(page)
  await drawer.getByText('订单已取消：界面测试：客户改期').waitFor()
  assert((await drawer.getByRole('button', { name: '修改订单' }).count()) === 0, '已取消的订单不应再显示「修改订单」')
  await shot(page, '02h-order-cancelled', { full: false })
  // 清理：已取消的测试订单移到「已删除」，不占订单列表和概览
  await drawer.getByRole('button', { name: '删除订单', exact: true }).click()
  await confirmBox(page, '确定删除')
  await expectSuccess(page, '订单已删除')
  await settle(page)
  await page.keyboard.press('Escape')
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

await check('积分明细：给林澈加 1 分再撤销（总积分不变）', async () => {
  await openPage(page, log, '/store-points/point')
  await page.getByRole('button', { name: '调整积分' }).click()
  const dialog = dialogOf(page, '.point-adjust-dialog')
  await dialog.waitFor()
  await pickOption(page, dialog.locator('.el-select').first(), '林澈')
  await dialog.locator('.el-input-number input').fill('1')
  await dialog.locator('.el-input-number input').press('Tab')
  await dialog.getByPlaceholder('如：周末加班、违反店规（选填）').fill('界面测试')
  await shot(page, '05b-point-adjust', { full: false })
  await dialog.getByRole('button', { name: '确定调整', exact: true }).click()
  await expectSuccess(page, '林澈 +1 分')
  await dialog.waitFor({ state: 'hidden' })
  await settle(page)
  const row = rowsOf(page.locator('.app-main')).filter({ hasText: '店长手动调整积分（界面测试）' }).first()
  await row.waitFor()
  await row.getByRole('button', { name: '撤销' }).click()
  const box = visible(page.locator('.el-message-box')).last()
  await box.waitFor()
  assert((await box.innerText()).includes('总积分会减少 1 分'), '撤销确认里应说明总积分会减少')
  await confirmBox(page, '确定撤销')
  await expectSuccess(page, '已撤销')
  await settle(page)
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

await check('员工管理：添加员工（显示一次性密码）、重置密码、停用、恢复、删除', async () => {
  await openPage(page, log, '/store-manage/staff')
  const name = `测试员${SHORT}`
  const phone = `139${STAMP.slice(-8)}`
  await page.getByRole('button', { name: '添加人员' }).click()
  const form = dialogOf(page, '.staff-form-dialog')
  await form.waitFor()
  await form.getByPlaceholder('门店里显示的名字，不能和别人重名').fill(name)
  await form.getByPlaceholder('11 位手机号，用来登录门店端').fill(phone)
  await form.getByPlaceholder('选填，如：周末兼职').fill('界面测试')
  await shot(page, '08b-staff-form', { full: false })
  await form.getByRole('button', { name: '添加', exact: true }).click()
  await expectSuccess(page, '账号已开通')
  const secret = dialogOf(page, '.secret-dialog')
  await secret.waitFor()
  const password = await secret.locator('[data-secret]').innerText()
  assert(/^\d{6}$/.test(password.trim()), `初始密码应为 6 位数字：${password}`)
  assert((await secret.innerText()).includes('请当面告知，关闭后不再显示'), '一次性密码弹窗缺少提醒')
  assert((await secret.innerText()).includes(phone), '一次性密码弹窗里没有手机号')
  await expectNoTechWords(page)
  await shot(page, '08c-staff-secret', { full: false })
  await secret.getByRole('button', { name: '我已告知，关闭' }).click()
  await secret.waitFor({ state: 'hidden' })

  await searchKeyword(page, '姓名 / 手机号', name)
  const row = () => rowsOf(page.locator('.app-main')).filter({ hasText: name }).first()
  await row().waitFor()
  await row().getByRole('button', { name: '重置密码' }).click()
  await confirmBox(page, '确定重置')
  const again = dialogOf(page, '.secret-dialog')
  await again.waitFor()
  const next = await again.locator('[data-secret]').innerText()
  assert(/^\d{6}$/.test(next.trim()), `新密码应为 6 位数字：${next}`)
  await again.getByRole('button', { name: '我已告知，关闭' }).click()
  await again.waitFor({ state: 'hidden' })

  await row().getByRole('button', { name: '停用' }).click()
  await confirmBox(page, '确定停用')
  await expectSuccess(page, '账号已停用')
  await settle(page)
  assert((await row().innerText()).includes('已停用'), '停用后状态没变')
  await row().getByRole('button', { name: '恢复' }).click()
  await confirmBox(page, '确定恢复')
  await expectSuccess(page, '账号已恢复')
  await settle(page)
  await row().getByRole('button', { name: '删除' }).click()
  const box = visible(page.locator('.el-message-box')).last()
  await box.waitFor()
  assert((await box.innerText()).includes('积分不再计入团队'), '删除确认里应说明积分不再计入团队')
  await confirmBox(page, '确定删除')
  await expectSuccess(page, `${name} 已删除`)
  await settle(page)
  assert((await rowsOf(page.locator('.app-main')).filter({ hasText: name }).count()) === 0, '删除后列表里还有这个人')
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

await check('积分任务设置：停用再启用一个任务，打开修改弹窗', async () => {
  await openPage(page, log, '/store-points/task')
  await searchKeyword(page, '任务名称', '主动充对讲机')
  const row = rowsOf(page.locator('.app-main')).first()
  await row.waitFor()
  await row.locator('.el-switch').click()
  await expectSuccess(page, '已停用')
  await page.waitForTimeout(300)
  assert((await row.locator('.el-switch').getAttribute('class')).includes('is-checked') === false, '停用后开关应处于关闭')
  await row.locator('.el-switch').click()
  await expectSuccess(page, '已启用')
  await page.waitForTimeout(300)
  assert((await row.locator('.el-switch').getAttribute('class')).includes('is-checked'), '启用后开关应处于打开')
  await row.getByRole('button', { name: '修改' }).click()
  const dialog = dialogOf(page, '.task-form-dialog')
  await dialog.waitFor()
  assert((await dialog.innerText()).includes('修改只影响之后提交的任务'), '修改弹窗缺少提示')
  await shot(page, '07b-task-form', { full: false })
  await dialog.getByRole('button', { name: '取消' }).click()
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

await check('维修登记：登记一条维修再确认修好', async () => {
  await openPage(page, log, '/store-manage/repair')
  const problem = `界面测试：${SHORT} 号门锁松动`
  await page.getByRole('button', { name: '登记维修' }).click()
  const dialog = dialogOf(page, '.repair-form-dialog')
  await dialog.waitFor()
  await pickOption(page, dialog.locator('.el-select').first(), /^旅店惊魂$/)
  await dialog.locator('textarea').fill(problem)
  await shot(page, '10b-repair-form', { full: false })
  await dialog.getByRole('button', { name: '登记', exact: true }).click()
  await expectSuccess(page, '已登记待维修')
  await dialog.waitFor({ state: 'hidden' })
  await settle(page)
  const row = rowsOf(page.locator('.app-main')).filter({ hasText: problem }).first()
  await row.waitFor()
  await row.getByRole('button', { name: '确认修好' }).click()
  await confirmBox(page, '已修好')
  await expectSuccess(page, '已确认修好')
  await settle(page)
  assert((await rowsOf(page.locator('.app-main')).filter({ hasText: problem }).count()) === 0, '修好后不应留在「待维修」里')
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

await check('打扫审核：批量通过需先勾选，驳回可填原因（本次不提交），审核记录可按结果筛选', async () => {
  await openPage(page, log, '/store-points/audit')
  const batch = page.getByRole('button', { name: /批量通过/ })
  assert(await batch.isDisabled(), '没有勾选时「批量通过」应不可点')
  const rows = rowsOf(page.locator('.app-main'))
  if (await rows.count()) {
    await rows.first().getByRole('button', { name: '驳回' }).click()
    const box = visible(page.locator('.el-message-box')).last()
    await box.waitFor()
    assert((await box.locator('input').inputValue()) === '未通过检查', '驳回原因默认应为「未通过检查」')
    await shot(page, '04b-audit-reject', { full: false })
    await confirmBox(page, '取消')
    await rows.first().locator('.el-checkbox').click()
    assert(!(await batch.isDisabled()), '勾选后「批量通过」应可点')
  }
  await page.locator('.app-main .el-tabs__item', { hasText: '审核记录' }).click()
  await settle(page)
  await expectTexts(page, ['审核结果', '驳回原因', '审核人', '积分状态'])
  await pickOption(page, page.locator('.app-main .el-form .el-select').nth(1), '已驳回')
  await settle(page)
  const texts = await rowsOf(page.locator('.app-main')).allInnerTexts()
  assert(texts.every((t) => t.includes('已驳回')), '按「已驳回」筛选后出现了其它结果')
  await shot(page, '04c-audit-history')
  expectCleanConsole(log)
})

await check('门店设置：修改门店名称后还原', async () => {
  await openPage(page, log, '/store-manage/setting')
  const input = page.locator('.setting-page input').first()
  const original = await input.inputValue()
  assert(original, '没有读到门店名称')
  await input.fill('零零谷 · 界面测试')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expectSuccess(page, '门店设置已保存')
  await settle(page)
  await input.fill(original)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expectSuccess(page, '门店设置已保存')
  await settle(page)
  assert((await input.inputValue()) === original, '门店名称没有还原')
  await expectNoErrorPopup(page)
  expectCleanConsole(log)
})

await check('本轮操作都写进了操作记录（按来源 + 关键字筛选）', async () => {
  await openPage(page, log, '/store-manage/oplog')
  await pickOption(page, page.locator('.app-main .el-form .el-select').first(), '管理后台')
  await settle(page)
  await searchKeyword(page, '操作人 / 操作 / 内容', SHORT)
  const text = await page.locator('.app-main .el-table').innerText()
  const missing = ['发送门店通知', '发布临时任务', '取消临时任务', '登记维修', '重置登录密码', '删除账号'].filter((a) => !text.includes(a))
  assert(!missing.length, `操作记录里没找到：${missing.join('、')}`)
  const sources = await rowsOf(page.locator('.app-main')).allInnerTexts()
  assert(sources.length && sources.every((t) => t.includes('管理后台')), '按来源筛选后混进了其它来源')
  await expectNoTechWords(page)
  await shot(page, '12b-oplog-filtered')
  expectCleanConsole(log)
})

await admin.context.close()

// ------------------------------------------------------------------ 门店运营账号：只有三个业务目录

await check('门店运营账号登录后，侧边栏正好是三个业务目录', async () => {
  const s = await newSession(browser)
  try {
    await login(s.page, 'operator', ADMIN_PASSWORD)
    await settle(s.page)
    // 只看最外层菜单（子菜单也是 ul.el-menu，要排除）
    const titles = await s.page.evaluate(() => {
      const root = document.querySelector('.sidebar-container ul.el-menu')
      return Array.from(root ? root.children : [])
        .map((d) => d.querySelector(':scope > .el-sub-menu > .el-sub-menu__title .menu-title, :scope > a .menu-title'))
        .filter(Boolean)
        .map((el) => el.textContent.trim())
    })
    assert(JSON.stringify(titles) === JSON.stringify(['订单与收款', '积分与任务', '门店管理']), `侧边栏目录是：${titles.join('、')}`)
    await s.page.locator('[data-stat="今日三项合计"]').waitFor()
    await s.page.locator('.sidebar-container .el-sub-menu__title', { hasText: '门店管理' }).click()
    await s.page.waitForTimeout(500)
    const pages = await s.page.locator('.sidebar-container .el-sub-menu.is-opened .el-menu-item').allInnerTexts()
    assert(pages.map((p) => p.trim()).join('、') === '员工管理、主题管理、维修登记、门店消息、操作记录、门店设置', `门店管理下的页面是：${pages.join('、')}`)
    await expectNoTechWords(s.page)
    expectCleanConsole(s.log)
    await shot(s.page, '20-operator', { full: false })
  } finally {
    await s.context.close()
  }
})

// ------------------------------------------------------------------ 没有概览权限的账号：友好提示

await check('没有概览权限的账号：首页显示友好提示，没有报错', async () => {
  const s = await newSession(browser)
  try {
    try {
      await login(s.page, VIEWER.username, VIEWER.password)
    } catch (e) {
      return { skip: `只读账号登录不了：${e.message}` }
    }
    await settle(s.page)
    await s.page.getByText('当前账号没有查看门店概览的权限').waitFor()
    await expectNoErrorPopup(s.page)
    await expectNoTechWords(s.page)
    expectCleanConsole(s.log)
    await shot(s.page, '21-viewer-dashboard', { full: false })
    await openPage(s.page, s.log, '/store-order/order')
    assert((await s.page.getByRole('button', { name: '录入订单' }).count()) === 0, '没有录入权限时不应显示「录入订单」')
    await rowsOf(s.page.locator('.app-main')).first().click()
    const drawer = drawerOf(s.page)
    await drawer.waitFor()
    await settle(s.page)
    assert((await drawer.locator('.order-drawer__actions').count()) === 0, '只读账号不应看到订单操作按钮')
    await expectNoErrorPopup(s.page)
    expectCleanConsole(s.log)
  } finally {
    await s.context.close()
  }
})

await browser.close()

console.log(`\n管理后台界面验收：${passed} 通过，${failed} 失败${skipped ? `，${skipped} 跳过` : ''}；截图在 ${SHOTS}`)
if (failed) process.exitCode = 1
