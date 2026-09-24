// 门店管理页面共用：金额与时间格式、选项与文字对照、列表查询、权限判断
import { reactive, ref } from 'vue'
import auth from '@/plugins/auth'
import './escape.scss'

// ------------------------------------------------------------------ 权限

/** 当前账号是否有某项按钮权限（用于会随数据显示/隐藏的按钮；固定按钮直接用 v-hasPermi） */
export function can(permission) {
  return auth.hasPermi(permission)
}

// ------------------------------------------------------------------ 金额（后端一律为「分」的整数）

const MAX_CENTS = 100000000 // 单个渠道上限 100 万元
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/

/** 12345 → ¥123.45（千分位；sign=true 时正数带 +） */
export function yuan(cents, { sign = false } = {}) {
  const value = Number(cents)
  const safe = Number.isFinite(value) ? Math.round(value) : 0
  const abs = Math.abs(safe)
  const text = Math.floor(abs / 100).toLocaleString('en-US') + '.' + String(abs % 100).padStart(2, '0')
  const prefix = safe < 0 ? '-' : sign && safe > 0 ? '+' : ''
  return `${prefix}¥${text}`
}

/** 12345 → 123.45（填入输入框用，0 返回空） */
export function centsToInput(cents) {
  const value = Math.round(Number(cents) || 0)
  if (value <= 0) return ''
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`
}

/** 输入框里的元 → 分；空为 0；格式不对返回 NaN */
export function inputToCents(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return 0
  if (!AMOUNT_RE.test(raw) || raw.length > 16) return NaN
  const [whole, fraction = ''] = raw.split('.')
  return Number(whole) * 100 + Number((fraction + '00').slice(0, 2))
}

/** 校验单个渠道金额，返回错误提示（没问题返回空） */
export function amountError(text) {
  const cents = inputToCents(text)
  if (Number.isNaN(cents)) return '请填写金额数字，最多两位小数'
  if (cents > MAX_CENTS) return '单个渠道金额不能超过100万元'
  return ''
}

/** 收款渠道：顺序即展示顺序；online 不计入三项合计 */
export const PAY_CHANNELS = [
  { key: 'wechat', label: '微信' },
  { key: 'alipay', label: '支付宝' },
  { key: 'cash', label: '现金' },
  { key: 'online', label: '线上' }
]

// ------------------------------------------------------------------ 日期与时间（后端给的是门店当地时间文字）

const pad = (n) => String(n).padStart(2, '0')

/** 2026-09-17 10:47:45 → 2026-09-17 10:47 */
export function timeText(text) {
  return text ? String(text).slice(0, 16) : ''
}

/** 2026-09-17 10:47:45 → 09-17 10:47（表格里放不下完整时间时用） */
export function shortTime(text) {
  return text ? String(text).slice(5, 16) : ''
}

/** 2026-09-17 10:47:45 → 10:47 */
export function clockText(text) {
  return text ? String(text).slice(11, 16) : ''
}

/** 2026-09-17 → 9月17日 */
export function dayLabel(date) {
  if (!date) return ''
  const [, m, d] = String(date).split('-')
  return `${Number(m)}月${Number(d)}日`
}

/** 2026-09-17 → 周四 */
export function weekdayText(date) {
  if (!date) return ''
  const [y, m, d] = String(date).split('-').map(Number)
  return '周' + '日一二三四五六'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** 日期文字加减天数：addDays('2026-09-17', -6) → 2026-09-11 */
export function addDays(date, days) {
  const [y, m, d] = String(date).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// 门店在国内，默认按北京时间算「今天」；收款页、概览拿到后端给的门店日期后，短时间内以它为准
const STORE_TIME_ZONE = 'Asia/Shanghai'
const HINT_TTL = 10 * 60 * 1000
let storeDateHint = null

/** 记住后端给出的门店日期（门店时区与本机不同时以它为准） */
export function rememberStoreToday(date) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    storeDateHint = { date, at: Date.now() }
  }
}

/** 门店今天的日期 YYYY-MM-DD */
export function storeToday() {
  if (storeDateHint && Date.now() - storeDateHint.at < HINT_TTL) {
    return storeDateHint.date
  }
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch (e) {
    const now = new Date()
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }
}

/** 日期范围选择器的快捷选项 */
export const DATE_SHORTCUTS = [
  { text: '今天', value: () => { const t = storeToday(); return [t, t] } },
  { text: '昨天', value: () => { const y = addDays(storeToday(), -1); return [y, y] } },
  { text: '近 7 天', value: () => { const t = storeToday(); return [addDays(t, -6), t] } },
  { text: '近 30 天', value: () => { const t = storeToday(); return [addDays(t, -29), t] } },
  { text: '本月', value: () => { const t = storeToday(); return [t.slice(0, 8) + '01', t] } }
]

/** 导出文件名：订单明细_20260917_1047.xlsx */
export function exportFileName(title) {
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${title}_${stamp}.xlsx`
}

// ------------------------------------------------------------------ 选项与文字对照

export const ORDER_TABS = [
  { name: 'all', label: '全部' },
  { name: 'running', label: '进行中' },
  { name: 'editing', label: '待剪辑' },
  { name: 'done', label: '已完成' },
  { name: 'cancelled', label: '已取消' },
  { name: 'deleted', label: '已删除' }
]

export const FLOW_STATUS = [
  { value: 'waiting', label: '待开始', type: 'info' },
  { value: 'active', label: '进行中', type: 'primary' },
  { value: 'editing', label: '待剪辑', type: 'warning' },
  { value: 'done', label: '已完成', type: 'success' },
  { value: 'cancelled', label: '已取消', type: 'danger' }
]

export const PHOTO_CHOICES = ['要拍照', '不要拍照']
export const VIDEO_CHOICES = ['要视频', '不要视频']

export const RECEIPT_STATUS = [
  { value: 'active', label: '有效', type: 'success' },
  { value: 'reversed', label: '已冲正', type: 'danger' }
]

export const POINT_SOURCES = [
  { value: 'task', label: '积分任务', type: 'primary' },
  { value: 'audit', label: '审核任务', type: 'warning' },
  { value: 'manual', label: '店长调整', type: 'info' },
  { value: 'reversal', label: '撤销冲减', type: 'danger' }
]

export const POINT_STATES = [
  { value: 'pending', label: '待审核', type: 'warning' },
  { value: 'credited', label: '已到账', type: 'success' },
  { value: 'rejected', label: '已驳回', type: 'danger' },
  { value: 'revoked', label: '已撤销', type: 'info' },
  { value: 'cancelled', label: '人员删除已取消', type: 'info' }
]

export const REVIEW_RESULTS = [
  { value: 'approved', label: '已通过', type: 'success' },
  { value: 'rejected', label: '已驳回', type: 'danger' }
]

export const JOB_STATUS = [
  { value: 'open', label: '待抢', type: 'warning' },
  { value: 'ended', label: '已抢到', type: 'success' },
  { value: 'cancelled', label: '已取消', type: 'info' }
]

export const URGENCY = [
  { value: 'low', label: '普通', type: 'info' },
  { value: 'normal', label: '尽快', type: 'warning' },
  { value: 'urgent', label: '紧急', type: 'danger' }
]

export const TASK_CATEGORIES = ['接待', '服务', '维护', '打扫', '整理', '视频', '出勤']

export const TASK_STATUS = [
  { value: '0', label: '启用中', type: 'success' },
  { value: '1', label: '已停用', type: 'info' }
]

export const STAFF_ROLES = [
  { value: 'employee', label: '员工', type: 'info' },
  { value: 'manager', label: '店长', type: 'warning' }
]

export const STAFF_STATUS = [
  { value: 'active', label: '在职', type: 'success' },
  { value: 'inactive', label: '已停用', type: 'info' }
]

export const REPAIR_STATUS = [
  { value: 'pending', label: '待维修', type: 'danger' },
  { value: 'completed', label: '已修好', type: 'success' }
]

export const NOTICE_TYPES = [
  { value: 'order', label: '订单进度', type: 'primary' },
  { value: 'info', label: '门店动态', type: 'info' },
  { value: 'audit', label: '审核与管理', type: 'warning' },
  { value: 'job', label: '临时任务', type: 'danger' },
  { value: 'success', label: '完成与到账', type: 'success' }
]

export const NOTICE_AUDIENCES = [
  { value: 'all', label: '全店' },
  { value: 'managers', label: '店长' },
  { value: 'targeted', label: '店长及相关员工' }
]

export const NOTICE_SCOPES = [
  { value: 'all', label: '全店' },
  { value: 'managers', label: '仅店长' }
]

export const ACTOR_TYPES = [
  { value: 'staff', label: '门店端', type: 'primary' },
  { value: 'admin', label: '管理后台', type: 'warning' },
  { value: 'system', label: '系统', type: 'info' }
]

export const TARGET_TYPES = [
  { value: 'order', label: '订单' },
  { value: 'receipt', label: '收款' },
  { value: 'point', label: '积分' },
  { value: 'job', label: '临时任务' },
  { value: 'staff', label: '人员' },
  { value: 'theme', label: '主题' },
  { value: 'task', label: '积分任务' },
  { value: 'repair', label: '维修' },
  { value: 'notice', label: '消息' },
  { value: 'setting', label: '门店设置' },
  { value: 'account', label: '账号' }
]

/** 选项里的文字，找不到时返回 fallback */
export function labelOf(options, value, fallback = '') {
  const found = options.find((item) => item.value === value)
  return found ? found.label : fallback
}

/** 选项对应的标签颜色 */
export function tagTypeOf(options, value, fallback = 'info') {
  const found = options.find((item) => item.value === value)
  return (found && found.type) || fallback
}

/** 把几段文字用分隔符连起来，空的跳过 */
export function joinText(parts, separator = ' · ') {
  return parts.filter((part) => part !== null && part !== undefined && String(part).trim() !== '').join(separator)
}

/** 防重复提交的请求编号（录入订单、发布任务用） */
export function newRequestId() {
  return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// ------------------------------------------------------------------ 列表查询

/** 去掉空条件；dateRange 换成 beginDate / endDate */
export function cleanParams(query, { paging = true } = {}) {
  const params = {}
  for (const [key, value] of Object.entries(query)) {
    if (key === 'dateRange') {
      if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
        params.beginDate = value[0]
        params.endDate = value[1]
      }
      continue
    }
    if (!paging && (key === 'pageNum' || key === 'pageSize')) continue
    if (value === '' || value === null || value === undefined) continue
    params[key] = typeof value === 'string' ? value.trim() : value
  }
  return params
}

/**
 * 列表页通用逻辑：分页、查询、重置。
 * fetcher(params) 返回若依列表结构 { rows, total }。
 */
export function useListPage(fetcher, defaults = {}, { pageSize = 10 } = {}) {
  const initial = () => JSON.parse(JSON.stringify(defaults))
  const loading = ref(false)
  const rows = ref([])
  const total = ref(0)
  const loaded = ref(false)
  const query = reactive({ pageNum: 1, pageSize, ...initial() })
  let seq = 0

  async function getList() {
    const mine = ++seq
    loading.value = true
    try {
      const res = await fetcher(cleanParams(query))
      if (mine !== seq) return
      rows.value = res.rows || []
      total.value = res.total || 0
      loaded.value = true
      // 删除或处理掉最后一页的数据后，自动回到有数据的一页
      if (!rows.value.length && total.value > 0 && query.pageNum > 1) {
        query.pageNum = Math.max(1, Math.ceil(total.value / query.pageSize))
        await getList()
      }
    } catch (e) {
      // 错误提示已由请求工具统一弹出
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  function search() {
    query.pageNum = 1
    return getList()
  }

  function reset(extra = {}) {
    const size = query.pageSize
    for (const key of Object.keys(query)) delete query[key]
    Object.assign(query, { pageNum: 1, pageSize: size }, initial(), extra)
    return getList()
  }

  return { loading, loaded, rows, total, query, getList, search, reset }
}
