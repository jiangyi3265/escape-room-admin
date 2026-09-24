<template>
  <div class="app-container esc-page receipt-page">
    <el-tabs v-model="activeTab" class="esc-tabs">
      <el-tab-pane label="收款明细" name="list" />
      <el-tab-pane label="每日汇总" name="daily" />
    </el-tabs>

    <!-- 收款明细 -->
    <div v-show="activeTab === 'list'" class="receipt-page__list">
      <el-form :model="query" inline @submit.prevent>
        <el-form-item label="收款日期">
          <el-date-picker
            v-model="query.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :shortcuts="DATE_SHORTCUTS"
            @change="search"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 110px" @change="search">
            <el-option v-for="s in RECEIPT_STATUS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="主题">
          <el-select
            v-model="query.themeName"
            placeholder="全部主题"
            clearable
            filterable
            allow-create
            default-first-option
            style="width: 150px"
            @change="search"
          >
            <el-option v-for="t in filterThemes" :key="t.themeName" :label="t.current ? t.themeName : t.themeName + '（历史名称）'" :value="t.themeName" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="query.keyword" placeholder="订单编号 / 主题 / 登记人" clearable style="width: 190px" @keyup.enter="search" @clear="search" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="search">查询</el-button>
          <el-button icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <div class="esc-stat-grid receipt-page__stats" :class="{ 'is-stale': summaryLoading }">
        <StatTile label="微信" swatch="var(--esc-wechat)" :value="yuan(summary.wechat)" />
        <StatTile label="支付宝" swatch="var(--esc-alipay)" :value="yuan(summary.alipay)" />
        <StatTile label="现金" swatch="var(--esc-cash)" :value="yuan(summary.cash)" />
        <StatTile label="三项合计" accent :value="yuan(summary.total)" sub="微信 + 支付宝 + 现金" />
        <StatTile label="线上" :value="yuan(summary.online)" sub="单独统计，不计入合计" />
        <StatTile label="收款笔数" :value="`${summary.receiptCount} 笔`" :sub="countSub" />
      </div>

      <div class="esc-toolbar">
        <div class="esc-toolbar__left">
          <el-button icon="Download" @click="handleExport" v-hasPermi="['escape:receipt:export']">导出</el-button>
          <span class="esc-hint">{{ rangeText }}；已冲正的收款不计入上面的金额</span>
        </div>
        <div class="esc-toolbar__right">
          <el-tooltip content="刷新" placement="top">
            <el-button circle icon="Refresh" @click="refreshList" />
          </el-tooltip>
        </div>
      </div>

      <el-table v-loading="loading" :data="rows" row-key="receiptId" class="receipt-table">
        <template #empty>
          <el-empty v-if="loaded" :image-size="80" description="这段时间没有符合条件的收款" />
        </template>
        <el-table-column label="收款日期" width="92">
          <template #default="{ row }"><span class="esc-num">{{ row.receiptDate }}</span></template>
        </el-table-column>
        <el-table-column label="订单编号" width="136">
          <template #default="{ row }">
            <el-link v-if="canViewOrder" type="primary" underline="never" class="esc-num" @click="openOrder(row)">{{ row.orderNo }}</el-link>
            <span v-else class="esc-num">{{ row.orderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="主题" prop="themeName" min-width="70" show-overflow-tooltip />
        <el-table-column label="微信" align="right" min-width="74">
          <template #default="{ row }"><span class="esc-num" :class="{ 'esc-strike': isReversed(row) }">{{ yuan(row.wechat) }}</span></template>
        </el-table-column>
        <el-table-column label="支付宝" align="right" min-width="74">
          <template #default="{ row }"><span class="esc-num" :class="{ 'esc-strike': isReversed(row) }">{{ yuan(row.alipay) }}</span></template>
        </el-table-column>
        <el-table-column label="现金" align="right" min-width="74">
          <template #default="{ row }"><span class="esc-num" :class="{ 'esc-strike': isReversed(row) }">{{ yuan(row.cash) }}</span></template>
        </el-table-column>
        <el-table-column label="三项合计" align="right" min-width="84">
          <template #default="{ row }"><strong class="esc-num" :class="{ 'esc-strike': isReversed(row) }">{{ yuan(row.total) }}</strong></template>
        </el-table-column>
        <el-table-column label="线上" align="right" min-width="72">
          <template #default="{ row }"><span class="esc-num" :class="{ 'esc-strike': isReversed(row) }">{{ yuan(row.online) }}</span></template>
        </el-table-column>
        <el-table-column label="登记人" prop="operatorName" width="92" show-overflow-tooltip />
        <el-table-column label="收款时间" width="96">
          <template #default="{ row }"><span class="esc-num">{{ shortTime(row.receivedAt) }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="72" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="isReversed(row)" placement="top" :content="reverseTip(row)">
              <el-tag type="danger" size="small" class="receipt-table__tag">已冲正</el-tag>
            </el-tooltip>
            <el-tag v-else type="success" size="small">有效</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="修改记录" width="78" align="center">
          <template #default="{ row }">
            <el-button v-if="row.revisions && row.revisions.length" link type="primary" @click="openRevisions(row)">{{ row.revisions.length }} 次</el-button>
            <span v-else class="esc-placeholder">无</span>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        :total="total"
        v-model:page="query.pageNum"
        v-model:limit="query.pageSize"
        @pagination="getList"
      />
    </div>

    <!-- 每日汇总 -->
    <div v-if="activeTab === 'daily'" class="receipt-page__daily">
      <div class="esc-toolbar">
        <div class="esc-toolbar__left">
          <el-radio-group v-model="dailyDays" @change="loadDaily">
            <el-radio-button :value="7">近 7 天</el-radio-button>
            <el-radio-button :value="30">近 30 天</el-radio-button>
          </el-radio-group>
          <span class="esc-hint">按收款日期统计，三项合计 = 微信 + 支付宝 + 现金；已冲正的不计入</span>
        </div>
        <div class="esc-toolbar__right">
          <el-tooltip content="刷新" placement="top">
            <el-button circle icon="Refresh" @click="loadDaily" />
          </el-tooltip>
        </div>
      </div>

      <div class="esc-card receipt-page__chart" v-loading="dailyLoading && !daily.length">
        <div class="esc-card__head">
          <div class="esc-card__title">每日三项合计</div>
          <div class="esc-card__extra">合计 {{ yuan(dailyTotals.total) }} · 线上另计 {{ yuan(dailyTotals.online) }}</div>
        </div>
        <DailyReceiptChart :days="daily" :height="300" />
      </div>

      <el-table :data="daily" class="receipt-daily-table" show-summary :summary-method="dailySummary" v-loading="dailyLoading && !daily.length">
        <el-table-column label="日期" min-width="130">
          <template #default="{ row, $index }">
            <span class="esc-num">{{ row.date }}</span>
            <span class="esc-muted receipt-daily-table__week">{{ weekdayText(row.date) }}</span>
            <el-tag v-if="$index === 0" size="small" type="primary" effect="plain">今天</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="微信" align="right" min-width="100">
          <template #default="{ row }"><span class="esc-num">{{ yuan(row.wechat) }}</span></template>
        </el-table-column>
        <el-table-column label="支付宝" align="right" min-width="100">
          <template #default="{ row }"><span class="esc-num">{{ yuan(row.alipay) }}</span></template>
        </el-table-column>
        <el-table-column label="现金" align="right" min-width="100">
          <template #default="{ row }"><span class="esc-num">{{ yuan(row.cash) }}</span></template>
        </el-table-column>
        <el-table-column label="三项合计" align="right" min-width="110">
          <template #default="{ row }"><strong class="esc-num">{{ yuan(row.total) }}</strong></template>
        </el-table-column>
        <el-table-column label="线上（不计入合计）" align="right" min-width="130">
          <template #default="{ row }"><span class="esc-num">{{ yuan(row.online) }}</span></template>
        </el-table-column>
        <el-table-column label="笔数" align="right" width="90">
          <template #default="{ row }"><span class="esc-num">{{ row.count }} 笔</span></template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 修改记录 -->
    <el-dialog v-model="revisionOpen" title="收款修改记录" width="720px" append-to-body class="receipt-revision-dialog">
      <template v-if="revisionRow">
        <el-descriptions :column="3" border size="small" class="receipt-revision-dialog__now">
          <el-descriptions-item label="订单编号">{{ revisionRow.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="主题">{{ revisionRow.themeName }}</el-descriptions-item>
          <el-descriptions-item label="收款日期">{{ revisionRow.receiptDate }}</el-descriptions-item>
          <el-descriptions-item label="当前三项合计"><strong class="esc-num">{{ yuan(revisionRow.total) }}</strong></el-descriptions-item>
          <el-descriptions-item label="当前线上"><span class="esc-num">{{ yuan(revisionRow.online) }}</span></el-descriptions-item>
          <el-descriptions-item label="最近修改">{{ joinText([revisionRow.adjustedBy, timeText(revisionRow.adjustedAt)]) || '—' }}</el-descriptions-item>
        </el-descriptions>
        <RevisionTable :revisions="revisionRow.revisions" />
      </template>
      <template #footer>
        <el-button type="primary" @click="revisionOpen = false">知道了</el-button>
      </template>
    </el-dialog>

    <OrderDrawer v-model="drawerOpen" :order-id="drawerOrderId" @changed="refreshList" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { exportReceipt, getReceiptDaily, getReceiptSummary, listReceipt } from '@/api/escape/receipt'
import { themeFilterNames } from '@/api/escape/theme'
import DailyReceiptChart from '../components/DailyReceiptChart.vue'
import OrderDrawer from '../components/OrderDrawer.vue'
import RevisionTable from '../components/RevisionTable.vue'
import StatTile from '../components/StatTile.vue'
import {
  DATE_SHORTCUTS, RECEIPT_STATUS, addDays, can, cleanParams, exportFileName, joinText,
  rememberStoreToday, shortTime, storeToday, timeText, useListPage, weekdayText, yuan
} from '../shared'

defineOptions({ name: 'EscReceipt' })

const activeTab = ref('list')
// 筛选下拉：在用主题 + 历史订单里出现过的旧名称
const filterThemes = ref([])
const canViewOrder = can('escape:order:list')

// ------------------------------------------------------------------ 合计

const emptySummary = { receiptCount: 0, activeCount: 0, wechat: 0, alipay: 0, cash: 0, online: 0, total: 0 }
const summary = reactive({ ...emptySummary })
const summaryLoading = ref(false)
let summaryKey = ''
let summarySeq = 0

async function loadSummary(params, force = false) {
  const key = JSON.stringify(params)
  if (!force && key === summaryKey) return
  summaryKey = key
  const mine = ++summarySeq
  summaryLoading.value = true
  try {
    const res = await getReceiptSummary(params)
    if (mine === summarySeq) Object.assign(summary, emptySummary, res.data || {})
  } catch (e) {
    summaryKey = ''
  } finally {
    if (mine === summarySeq) summaryLoading.value = false
  }
}

const countSub = computed(() => {
  const reversed = Math.max(0, summary.receiptCount - summary.activeCount)
  return `有效 ${summary.activeCount} 笔 · 已冲正 ${reversed} 笔`
})

// ------------------------------------------------------------------ 列表

let defaultRange = []

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(
  (params) => {
    const filters = { ...params }
    delete filters.pageNum
    delete filters.pageSize
    loadSummary(filters)
    return listReceipt(params)
  },
  { dateRange: [], status: '', themeName: '', keyword: '' }
)

const rangeText = computed(() => {
  const r = query.dateRange
  if (!r || r.length !== 2) return '全部日期'
  return r[0] === r[1] ? `${r[0]} 当天` : `${r[0]} 至 ${r[1]}`
})

function resetFilters() {
  reset({ dateRange: [...defaultRange] })
}

function refreshList() {
  summaryKey = ''
  getList()
}

function handleExport() {
  exportReceipt(cleanParams(query, { paging: false }), exportFileName('收款台账'))
}

const isReversed = (row) => row.status === 'reversed'

function reverseTip(row) {
  return joinText([row.reverseReason || '已冲正', row.reversedBy, timeText(row.reversedAt)], ' · ') + '（不计入收款合计）'
}

// 修改记录
const revisionOpen = ref(false)
const revisionRow = ref(null)

function openRevisions(row) {
  revisionRow.value = row
  revisionOpen.value = true
}

// 订单详情
const drawerOpen = ref(false)
const drawerOrderId = ref(null)

function openOrder(row) {
  drawerOrderId.value = row.orderId
  drawerOpen.value = true
}

// ------------------------------------------------------------------ 每日汇总

const dailyDays = ref(7)
const daily = ref([])
const dailyLoading = ref(false)
let dailySeq = 0

async function loadDaily() {
  const mine = ++dailySeq
  dailyLoading.value = true
  try {
    const res = await getReceiptDaily(dailyDays.value)
    if (mine !== dailySeq) return
    daily.value = res.data || []
    if (daily.value.length) rememberStoreToday(daily.value[0].date)
  } catch (e) {
    // 提示已由请求工具弹出
  } finally {
    if (mine === dailySeq) dailyLoading.value = false
  }
}

const dailyTotals = computed(() => daily.value.reduce(
  (acc, d) => ({ total: acc.total + Number(d.total || 0), online: acc.online + Number(d.online || 0) }),
  { total: 0, online: 0 }
))

function dailySummary({ columns, data }) {
  const keys = [null, 'wechat', 'alipay', 'cash', 'total', 'online', 'count']
  return columns.map((_, index) => {
    if (index === 0) return `合计（${data.length} 天）`
    const key = keys[index]
    if (!key) return ''
    const sum = data.reduce((acc, d) => acc + Number(d[key] || 0), 0)
    return key === 'count' ? `${sum} 笔` : yuan(sum)
  })
}

// 每次切到「每日汇总」都重新读取，避免停留太久看到旧数据
watch(activeTab, (tab) => {
  if (tab === 'daily') loadDaily()
})

// ------------------------------------------------------------------ 初始化：默认看门店日期的近 7 天

onMounted(async () => {
  themeFilterNames().then((res) => { filterThemes.value = res.data || [] }).catch(() => { filterThemes.value = [] })
  let today = ''
  try {
    const res = await getReceiptDaily(7)
    daily.value = res.data || []
    today = daily.value.length ? daily.value[0].date : ''
  } catch (e) {
    today = ''
  }
  if (today) rememberStoreToday(today)
  const end = today || storeToday()
  defaultRange = [addDays(end, -6), end]
  query.dateRange = [...defaultRange]
  getList()
})
</script>

<style scoped lang="scss">
.receipt-page__stats {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  transition: opacity 0.2s;

  &.is-stale {
    opacity: 0.6;
  }
}

.receipt-table__tag {
  cursor: help;
}

.receipt-page__chart {
  margin-bottom: 16px;
}

.receipt-daily-table__week {
  margin: 0 6px;
  font-size: 12px;
}

:deep(.receipt-daily-table .el-table__footer-wrapper td.el-table__cell) {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.receipt-revision-dialog__now {
  margin-bottom: 14px;
}

@media (max-width: 1200px) {
  .receipt-page__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
