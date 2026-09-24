<template>
  <div class="app-container esc-page dashboard">
    <!-- 没有概览权限 -->
    <div v-if="!allowed" class="dashboard__denied">
      <el-result icon="info" title="当前账号没有查看门店概览的权限">
        <template #sub-title>
          <p class="dashboard__denied-text">可以从左侧菜单进入有权限的页面；如需查看门店概览，请联系管理员开通。</p>
        </template>
      </el-result>
    </div>

    <div v-else v-loading="loading && !loadedAt" class="dashboard__body">
      <!-- 顶部 -->
      <div class="dashboard__head">
        <div class="dashboard__title">
          <div class="dashboard__store">{{ data.storeName || '门店概览' }}</div>
          <div class="dashboard__today">
            <el-tag type="primary" effect="dark" round size="small">今日</el-tag>
            <span>{{ data.todayLabel || dayLabel(data.today) }} {{ weekdayText(data.today) }}</span>
          </div>
        </div>
        <div class="dashboard__refresh">
          <span class="esc-hint" :class="{ 'dashboard__refresh-failed': failed }">{{ refreshText }}</span>
          <el-button icon="Refresh" :loading="refreshing" @click="refresh(true)">刷新</el-button>
        </div>
      </div>

      <!-- 今日收款 -->
      <div class="dashboard__kpis" :class="{ 'is-stale': refreshing }">
        <StatTile
          hero
          accent
          label="今日三项合计"
          :value="yuan(today.total)"
          :sub="`微信 + 支付宝 + 现金 · 今日收款 ${today.count || 0} 笔`"
          :to="routeTo('EscReceipt')"
        />
        <StatTile label="微信" swatch="var(--esc-wechat)" :value="yuan(today.wechat)" />
        <StatTile label="支付宝" swatch="var(--esc-alipay)" :value="yuan(today.alipay)" />
        <StatTile label="现金" swatch="var(--esc-cash)" :value="yuan(today.cash)" />
        <StatTile label="线上" :value="yuan(today.online)" sub="单独统计，不计入合计" />
      </div>

      <!-- 待办 -->
      <div class="dashboard__todos">
        <div
          v-for="todo in todos"
          :key="todo.key"
          class="todo-card"
          :class="[`is-${todo.tone}`, { 'is-zero': !todo.count, 'is-link': !!todo.to }]"
          :data-todo="todo.key"
          @click="todo.to && router.push(todo.to)"
        >
          <div class="todo-card__icon">
            <el-icon><component :is="todo.icon" /></el-icon>
          </div>
          <div class="todo-card__main">
            <div class="todo-card__label">{{ todo.label }}</div>
            <div class="todo-card__count"><strong>{{ todo.count }}</strong><span>{{ todo.unit }}</span></div>
          </div>
          <div v-if="todo.to" class="todo-card__go">
            {{ todo.count ? todo.action : '查看' }}<el-icon><ArrowRight /></el-icon>
          </div>
        </div>
      </div>

      <div class="dashboard__row">
        <!-- 近 7 日收款 -->
        <div class="esc-card dashboard__receipts">
          <div class="esc-card__head">
            <div class="esc-card__title">近 7 日收款</div>
            <div class="esc-card__extra">7 日三项合计 <strong class="esc-num">{{ yuan(weekTotal) }}</strong></div>
          </div>
          <DailyReceiptChart :days="days" :height="230" />
          <el-table :data="days" size="small" class="dashboard__days" :row-class-name="dayRowClass">
            <el-table-column label="日期" min-width="96">
              <template #default="{ row, $index }">
                <span>{{ dayLabel(row.date) }}</span>
                <span class="esc-muted dashboard__week">{{ $index === 0 ? '今天' : weekdayText(row.date) }}</span>
              </template>
            </el-table-column>
            <el-table-column v-for="c in channels" :key="c.key" :label="c.label" align="right" min-width="82">
              <template #default="{ row }"><span class="esc-num">{{ yuan(row[c.key]) }}</span></template>
            </el-table-column>
            <el-table-column label="三项合计" align="right" min-width="92">
              <template #default="{ row }"><strong class="esc-num">{{ yuan(row.total) }}</strong></template>
            </el-table-column>
            <el-table-column label="线上" align="right" min-width="82">
              <template #default="{ row }"><span class="esc-num esc-muted">{{ yuan(row.online) }}</span></template>
            </el-table-column>
            <el-table-column label="笔数" align="right" width="60">
              <template #default="{ row }"><span class="esc-num">{{ row.count }}</span></template>
            </el-table-column>
          </el-table>
        </div>

        <div class="dashboard__side">
          <!-- 积分排行 -->
          <div class="esc-card dashboard__ranking">
            <div class="esc-card__head">
              <div class="esc-card__title">员工积分排行</div>
              <div class="esc-card__extra">在职员工 {{ staffCounts.activeEmployees }} 人 · 店长 {{ staffCounts.managers }} 人</div>
            </div>
            <ol v-if="ranking.length" class="rank-list">
              <li v-for="(r, i) in ranking" :key="r.staffId" class="rank-list__item">
                <span class="rank-list__no" :class="`is-top${i + 1}`">{{ i + 1 }}</span>
                <span class="rank-list__name">{{ r.staffName }}</span>
                <span class="rank-list__tasks">完成 {{ r.taskCount }} 次</span>
                <span class="rank-list__points esc-num">{{ r.points }}<small>分</small></span>
              </li>
            </ol>
            <el-empty v-else :image-size="60" description="还没有在职员工" />
            <div v-if="routeTo('EscPoint')" class="dashboard__more">
              <el-button link type="primary" @click="router.push(routeTo('EscPoint'))">查看积分明细<el-icon><ArrowRight /></el-icon></el-button>
            </div>
          </div>

          <!-- 待审核 -->
          <div class="esc-card dashboard__audits">
            <div class="esc-card__head">
              <div class="esc-card__title">等待审核</div>
              <div class="esc-card__extra">最早提交的在前</div>
            </div>
            <ul v-if="pendingAudits.length" class="audit-list">
              <li v-for="a in pendingAudits" :key="a.entryId" class="audit-list__item">
                <div class="audit-list__main">
                  <div class="audit-list__title" :title="a.title">{{ a.title }}</div>
                  <div class="audit-list__meta esc-muted">{{ a.staffName }} · {{ noticeTime(a.occurredAt) }} 提交</div>
                </div>
                <span class="audit-list__points esc-num">+{{ a.points }}</span>
              </li>
            </ul>
            <div v-else class="dashboard__plain esc-muted">没有等待审核的任务</div>
            <div v-if="pendingAudits.length && routeTo('EscAudit')" class="dashboard__more">
              <el-button link type="primary" @click="router.push(routeTo('EscAudit'))">去审核<el-icon><ArrowRight /></el-icon></el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard__row">
        <!-- 订单现场 -->
        <div class="esc-card dashboard__orders">
          <div class="esc-card__head">
            <div class="esc-card__title">订单现场</div>
            <div class="esc-card__extra">
              全部订单：进行中 {{ orderCounts.running }} · 待剪辑 {{ orderCounts.editing }} · 已完成 {{ orderCounts.done }} · 已取消 {{ orderCounts.cancelled }}
            </div>
          </div>
          <div v-if="recentOrders.length" class="live-orders">
            <div
              v-for="o in recentOrders"
              :key="o.orderId"
              class="live-order"
              :class="{ 'is-link': canViewOrder }"
              @click="openOrder(o)"
            >
              <div class="live-order__main">
                <div class="live-order__title">
                  <span class="live-order__theme">{{ o.themeName }}</span>
                  <span class="live-order__time">{{ o.bookTime }}</span>
                  <span class="esc-muted live-order__people">{{ o.people }} 人</span>
                </div>
                <div class="live-order__progress">
                  <el-progress :percentage="o.progress" :stroke-width="6" :show-text="false" :status="progressStatus(o)" />
                </div>
              </div>
              <div class="live-order__side">
                <el-tag size="small" :type="tagTypeOf(FLOW_STATUS, o.flowStatus)" effect="light">{{ o.statusText }}</el-tag>
                <div class="live-order__date esc-muted">{{ o.bookDate === data.today ? '今天' : dayLabel(o.bookDate) }} · {{ o.creatorName }}</div>
              </div>
            </div>
          </div>
          <el-empty v-else :image-size="60" description="近 7 天没有订单动态" />
          <div v-if="routeTo('EscOrder')" class="dashboard__more">
            <el-button link type="primary" @click="router.push(routeTo('EscOrder'))">全部订单<el-icon><ArrowRight /></el-icon></el-button>
          </div>
        </div>

        <!-- 最近消息 -->
        <div class="esc-card dashboard__notices">
          <div class="esc-card__head">
            <div class="esc-card__title">最近消息</div>
            <div class="esc-card__extra">门店端收到的最新动态</div>
          </div>
          <ul v-if="recentNotices.length" class="notice-list">
            <li v-for="n in recentNotices" :key="n.noticeId" class="notice-list__item">
              <div class="notice-list__head">
                <el-tag size="small" effect="plain" :type="tagTypeOf(NOTICE_TYPES, n.type)">{{ n.typeText }}</el-tag>
                <span class="notice-list__title">{{ n.title }}</span>
                <span class="notice-list__time esc-muted">{{ noticeTime(n.createdAt) }}</span>
              </div>
              <div class="notice-list__detail esc-muted" :title="n.detail">{{ n.detail }}</div>
            </li>
          </ul>
          <el-empty v-else :image-size="60" description="还没有消息" />
          <div v-if="routeTo('EscNotice')" class="dashboard__more">
            <el-button link type="primary" @click="router.push(routeTo('EscNotice'))">全部消息<el-icon><ArrowRight /></el-icon></el-button>
          </div>
        </div>
      </div>
    </div>

    <OrderDrawer v-if="allowed && canViewOrder" v-model="drawerOpen" :order-id="drawerOrderId" @changed="refresh(false)" />
  </div>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboard } from '@/api/escape/dashboard'
import DailyReceiptChart from '@/views/escape/components/DailyReceiptChart.vue'
import OrderDrawer from '@/views/escape/components/OrderDrawer.vue'
import StatTile from '@/views/escape/components/StatTile.vue'
import {
  FLOW_STATUS, NOTICE_TYPES, PAY_CHANNELS, can, clockText, dayLabel, rememberStoreToday, shortTime, tagTypeOf, weekdayText, yuan
} from '@/views/escape/shared'

defineOptions({ name: 'Index' })

const REFRESH_MS = 30 * 1000
const MAX_BACKOFF_MS = 5 * 60 * 1000

const router = useRouter()
const allowed = can('escape:dashboard:view')
const canViewOrder = can('escape:order:list')
const channels = PAY_CHANNELS.filter((c) => c.key !== 'online')

const data = ref({})
const loading = ref(false)
const refreshing = ref(false)
const failed = ref(false)
const loadedAt = ref(0)
const now = ref(Date.now())

const today = computed(() => (data.value.receipts && data.value.receipts.today) || {})
const days = computed(() => (data.value.receipts && data.value.receipts.days) || [])
const weekTotal = computed(() => days.value.reduce((acc, d) => acc + Number(d.total || 0), 0))
const ranking = computed(() => data.value.ranking || [])
const pendingAudits = computed(() => data.value.pendingAuditList || [])
const recentOrders = computed(() => data.value.recentOrders || [])
const recentNotices = computed(() => data.value.recentNotices || [])
const staffCounts = computed(() => data.value.staff || { activeEmployees: 0, managers: 0 })
const orderCounts = computed(() => data.value.orders || { running: 0, editing: 0, done: 0, cancelled: 0 })

/** 按菜单里的页面名称跳转（没有该页面权限时返回空，不显示入口） */
function routeTo(name, query) {
  if (!router.hasRoute(name)) return ''
  return query ? { name, query } : { name }
}

const todos = computed(() => [
  { key: 'audit', label: '待审核', unit: '条', count: data.value.pendingAudits || 0, icon: 'Stamp', tone: 'warning', action: '去审核', to: routeTo('EscAudit') },
  { key: 'job', label: '待抢任务', unit: '个', count: data.value.openJobs || 0, icon: 'Lightning', tone: 'danger', action: '查看任务', to: routeTo('EscJob', { status: 'open' }) },
  { key: 'repair', label: '待维修', unit: '项', count: data.value.pendingRepairs || 0, icon: 'Tools', tone: 'primary', action: '去处理', to: routeTo('EscRepair') },
  { key: 'order', label: '进行中订单', unit: '单', count: orderCounts.value.running || 0, icon: 'Tickets', tone: 'success', action: '查看订单', to: routeTo('EscOrder', { status: 'running' }) }
])

const refreshText = computed(() => {
  if (failed.value) return '刷新没有成功，稍后会自动重试'
  if (!loadedAt.value) return '正在读取门店数据…'
  const seconds = Math.max(0, Math.round((now.value - loadedAt.value) / 1000))
  const when = seconds < 5 ? '刚刚更新' : seconds < 60 ? `${seconds} 秒前更新` : `${Math.floor(seconds / 60)} 分钟前更新`
  return `${when} · 每 30 秒自动刷新`
})

function progressStatus(o) {
  if (o.flowStatus === 'cancelled') return 'exception'
  if (o.flowStatus === 'done') return 'success'
  if (o.flowStatus === 'editing') return 'warning'
  return undefined
}

function dayRowClass({ rowIndex }) {
  return rowIndex === 0 ? 'dashboard__days-today' : ''
}

function noticeTime(text) {
  if (!text) return ''
  return String(text).slice(0, 10) === data.value.today ? clockText(text) : shortTime(text)
}

// ------------------------------------------------------------------ 订单详情

const drawerOpen = ref(false)
const drawerOrderId = ref(null)

function openOrder(o) {
  if (!canViewOrder) return
  drawerOrderId.value = o.orderId
  drawerOpen.value = true
}

// ------------------------------------------------------------------ 读取与自动刷新

let timer = null
let ticker = null
let active = true
let backoff = REFRESH_MS
let seq = 0

async function refresh(manual = false) {
  if (!allowed) return
  const mine = ++seq
  if (!loadedAt.value) loading.value = true
  refreshing.value = true
  try {
    const res = await getDashboard()
    if (mine !== seq) return
    data.value = res.data || {}
    rememberStoreToday(data.value.today)
    loadedAt.value = Date.now()
    now.value = loadedAt.value
    failed.value = false
    backoff = REFRESH_MS
  } catch (e) {
    if (mine !== seq) return
    failed.value = true
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  } finally {
    if (mine === seq) {
      loading.value = false
      refreshing.value = false
    }
  }
  if (manual) schedule()
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

function schedule() {
  clearTimer()
  if (!allowed || !active || document.hidden) return
  timer = setTimeout(async () => {
    timer = null
    await refresh(false)
    schedule()
  }, failed.value ? backoff : REFRESH_MS)
}

function isStale() {
  return !loadedAt.value || Date.now() - loadedAt.value >= REFRESH_MS
}

function onVisibilityChange() {
  if (document.hidden) {
    clearTimer()
    return
  }
  if (!active) return
  if (isStale()) refresh(true)
  else schedule()
}

onMounted(() => {
  if (!allowed) return
  document.addEventListener('visibilitychange', onVisibilityChange)
  ticker = setInterval(() => { now.value = Date.now() }, 5000)
  refresh(true)
})

// 页面被缓存时：切走暂停，切回来如果数据旧了就马上刷新
onActivated(() => {
  if (!allowed || active) return
  active = true
  if (isStale()) refresh(true)
  else schedule()
})

onDeactivated(() => {
  active = false
  clearTimer()
})

onBeforeUnmount(() => {
  active = false
  clearTimer()
  if (ticker) clearInterval(ticker)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped lang="scss">
.dashboard {
  min-height: calc(100vh - 84px);
  background: var(--el-bg-color-page);
}

.dashboard__denied {
  padding-top: 60px;
}

.dashboard__denied-text {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.dashboard__body {
  min-height: 300px;
}

.dashboard__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.dashboard__store {
  font-size: 22px;
  line-height: 30px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dashboard__today {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.dashboard__refresh {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.dashboard__refresh-failed {
  color: var(--el-color-danger);
}

.dashboard__kpis {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
  transition: opacity 0.2s;

  &.is-stale {
    opacity: 0.85;
  }

  :deep(.stat-tile:not(.is-hero)) {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

.dashboard__todos {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.todo-card {
  --todo-color: var(--el-color-primary);
  --todo-bg: var(--el-color-primary-light-9);
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-overlay);
  box-sizing: border-box;

  &.is-warning {
    --todo-color: var(--el-color-warning);
    --todo-bg: var(--el-color-warning-light-9);
  }

  &.is-danger {
    --todo-color: var(--el-color-danger);
    --todo-bg: var(--el-color-danger-light-9);
  }

  &.is-success {
    --todo-color: var(--el-color-success);
    --todo-bg: var(--el-color-success-light-9);
  }

  &.is-link {
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:hover {
      border-color: var(--todo-color);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }
  }

  &.is-zero {
    --todo-color: var(--el-text-color-placeholder);
    --todo-bg: var(--el-fill-color-light);

    .todo-card__count strong {
      color: var(--el-text-color-secondary);
    }
  }
}

.todo-card__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  font-size: 20px;
  color: var(--todo-color);
  background: var(--todo-bg);
}

.todo-card__main {
  flex: 1;
  min-width: 0;
}

.todo-card__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.todo-card__count {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);

  strong {
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.todo-card__go {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  color: var(--todo-color);
  white-space: nowrap;
}

.dashboard__row {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.dashboard__days {
  margin-top: 8px;

  :deep(.dashboard__days-today td.el-table__cell) {
    background: var(--el-color-primary-light-9);
  }
}

.dashboard__week {
  margin-left: 6px;
  font-size: 12px;
}

.dashboard__more {
  margin-top: 10px;
  text-align: right;
}

.dashboard__plain {
  padding: 8px 0 4px;
  font-size: 13px;
}

.dashboard__side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;

  .dashboard__audits {
    flex: 1;
  }
}

.audit-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.audit-list__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);

  &:last-child {
    border-bottom: none;
  }
}

.audit-list__main {
  flex: 1;
  min-width: 0;
}

.audit-list__title {
  font-size: 14px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.audit-list__meta {
  margin-top: 2px;
  font-size: 12px;
}

.audit-list__points {
  flex: none;
  font-weight: 600;
  color: var(--el-color-success);
}

.rank-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rank-list__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 2px;
  border-bottom: 1px solid var(--el-border-color-extra-light);

  &:last-child {
    border-bottom: none;
  }
}

.rank-list__no {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 12px;
  line-height: 22px;
  text-align: center;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);

  &.is-top1 {
    color: #fff;
    background: #d4a017;
  }

  &.is-top2 {
    color: #fff;
    background: #9aa4b1;
  }

  &.is-top3 {
    color: #fff;
    background: #b87333;
  }
}

.rank-list__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--el-text-color-primary);
}

.rank-list__tasks {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.rank-list__points {
  min-width: 56px;
  text-align: right;
  font-weight: 600;
  color: var(--el-text-color-primary);

  small {
    margin-left: 2px;
    font-size: 12px;
    font-weight: normal;
    color: var(--el-text-color-secondary);
  }
}

.live-orders {
  display: flex;
  flex-direction: column;
}

.live-order {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 8px;
  margin: 0 -8px;
  border-radius: 6px;
  border-bottom: 1px solid var(--el-border-color-extra-light);

  &:last-child {
    border-bottom: none;
  }

  &.is-link {
    cursor: pointer;

    &:hover {
      background: var(--el-fill-color-light);
    }
  }
}

.live-order__main {
  flex: 1;
  min-width: 0;
}

.live-order__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.live-order__theme {
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.live-order__time {
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.live-order__people {
  font-size: 12px;
  white-space: nowrap;
}

.live-order__progress {
  margin-top: 6px;
  max-width: 360px;
}

.live-order__side {
  flex: none;
  width: 150px;
  text-align: right;
}

.live-order__date {
  margin-top: 4px;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notice-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.notice-list__item {
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);

  &:last-child {
    border-bottom: none;
  }
}

.notice-list__head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.notice-list__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.notice-list__time {
  flex: none;
  font-size: 12px;
}

.notice-list__detail {
  margin-top: 3px;
  font-size: 12px;
  line-height: 18px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@media (max-width: 1200px) {
  .dashboard__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    :deep(.stat-tile.is-hero) {
      grid-column: span 2;
    }
  }

  .dashboard__todos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
