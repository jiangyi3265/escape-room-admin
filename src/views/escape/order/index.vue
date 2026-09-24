<template>
  <div class="app-container esc-page order-page">
    <el-tabs v-model="activeTab" class="esc-tabs" @tab-change="onTabChange">
      <el-tab-pane v-for="tab in ORDER_TABS" :key="tab.name" :label="tab.label" :name="tab.name" />
    </el-tabs>

    <el-form :model="query" inline class="esc-filter" @submit.prevent>
      <el-form-item label="主题">
        <el-select
          v-model="query.themeName"
          placeholder="全部主题"
          clearable
          filterable
          allow-create
          default-first-option
          style="width: 170px"
          @change="search"
        >
          <el-option v-for="t in filterThemes" :key="t.themeName" :label="t.current ? t.themeName : t.themeName + '（历史名称）'" :value="t.themeName" />
        </el-select>
      </el-form-item>
      <el-form-item label="创建日期">
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
      <el-form-item label="关键字">
        <el-input
          v-model="query.keyword"
          placeholder="订单编号 / 客户 / 备注 / 创建人"
          clearable
          style="width: 230px"
          @keyup.enter="search"
          @clear="search"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <el-button type="primary" icon="Plus" @click="openCreate" v-hasPermi="['escape:order:add']">录入订单</el-button>
        <el-button icon="Download" @click="handleExport" v-hasPermi="['escape:order:export']">导出</el-button>
      </div>
      <div class="esc-toolbar__right">
        <span class="esc-hint">点一行查看详情，并可代为推进流程、登记收款</span>
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      row-key="orderId"
      class="order-table esc-link-cell"
      @row-click="openDetail"
    >
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" :description="emptyText" />
      </template>
      <el-table-column label="订单编号" width="144">
        <template #default="{ row }">
          <el-link type="primary" underline="never" class="esc-num">{{ row.orderNo }}</el-link>
        </template>
      </el-table-column>
      <el-table-column label="营业日期" width="92">
        <template #default="{ row }"><span class="esc-num">{{ row.bookDate }}</span></template>
      </el-table-column>
      <el-table-column label="主题" prop="themeName" min-width="80" show-overflow-tooltip />
      <el-table-column label="预约时间" prop="bookTime" width="76" show-overflow-tooltip />
      <el-table-column label="人数" width="50" align="center">
        <template #default="{ row }">{{ row.people }}</template>
      </el-table-column>
      <el-table-column label="客户" min-width="90" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.contact">{{ row.contact }}</span>
          <span v-else class="esc-placeholder">—</span>
        </template>
      </el-table-column>
      <el-table-column label="进度" width="116">
        <template #default="{ row }">
          <div class="order-progress">
            <el-progress
              :percentage="row.progress"
              :stroke-width="6"
              :show-text="false"
              :status="progressStatus(row)"
            />
            <div class="order-progress__text">
              <el-tag v-if="row.deleted" type="info" size="small">已删除</el-tag>
              <span :class="statusClass(row)">{{ row.statusText }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="收款" width="96" align="right">
        <template #default="{ row }">
          <ReceiptCell :receipt="row.receipt" />
        </template>
      </el-table-column>
      <el-table-column label="创建人" width="92">
        <template #default="{ row }">
          {{ row.creatorName }}
          <div class="esc-cell-sub">{{ shortTime(row.createdAt) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="最近操作" width="96">
        <template #default="{ row }">
          <template v-if="row.deleted">
            <span>{{ row.deletedBy }}</span>
            <div class="esc-cell-sub">删除于 {{ shortTime(row.deletedAt) }}</div>
          </template>
          <template v-else>
            <span>{{ row.updateBy || row.creatorName }}</span>
            <div class="esc-cell-sub">{{ shortTime(row.lastActionAt || row.createdAt) }}</div>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="56" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
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

    <OrderDrawer v-model="drawerOpen" :order-id="drawerOrderId" @changed="getList" />
    <OrderFormDialog v-model="createOpen" @saved="afterCreate" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { exportOrder, listOrder } from '@/api/escape/order'
import { themeOptions, themeFilterNames } from '@/api/escape/theme'
import OrderDrawer from '../components/OrderDrawer.vue'
import OrderFormDialog from '../components/OrderFormDialog.vue'
import ReceiptCell from '../components/ReceiptCell.vue'
import { DATE_SHORTCUTS, ORDER_TABS, cleanParams, exportFileName, shortTime, useListPage } from '../shared'

defineOptions({ name: 'EscOrder' })

const route = useRoute()
const activeTab = ref(ORDER_TABS.some((t) => t.name === route.query.status) ? route.query.status : 'all')

function tabParams(tab) {
  if (tab === 'deleted') return { status: '', deleted: '1' }
  if (tab === 'all') return { status: '', deleted: '' }
  return { status: tab, deleted: '' }
}

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(listOrder, {
  themeName: '',
  keyword: '',
  dateRange: [],
  ...tabParams(activeTab.value)
})

const themes = ref([])
// 筛选下拉：在用主题 + 历史订单里出现过的旧名称
const filterThemes = ref([])
const drawerOpen = ref(false)
const drawerOrderId = ref(null)
const createOpen = ref(false)

const emptyText = computed(() => {
  const filtered = query.themeName || query.keyword || (query.dateRange && query.dateRange.length)
  if (filtered) return '没有符合条件的订单，换个条件试试'
  const tab = ORDER_TABS.find((t) => t.name === activeTab.value)
  return activeTab.value === 'all' ? '还没有订单' : `没有${tab ? tab.label : ''}的订单`
})

function onTabChange(tab) {
  Object.assign(query, tabParams(tab))
  search()
}

function resetFilters() {
  reset(tabParams(activeTab.value))
}

function progressStatus(row) {
  if (row.flowStatus === 'cancelled' || row.deleted) return 'exception'
  if (row.flowStatus === 'done') return 'success'
  if (row.flowStatus === 'editing') return 'warning'
  return undefined
}

function statusClass(row) {
  if (row.flowStatus === 'cancelled') return 'order-progress__status is-cancelled'
  if (row.flowStatus === 'done') return 'order-progress__status is-done'
  return 'order-progress__status'
}

function openDetail(row) {
  drawerOrderId.value = row.orderId
  drawerOpen.value = true
}

function openCreate() {
  createOpen.value = true
}

function afterCreate(order) {
  getList()
  if (order && order.orderId) openDetail(order)
}

function handleExport() {
  exportOrder(cleanParams(query, { paging: false }), exportFileName('订单明细'))
}

async function loadThemes() {
  themeFilterNames().then((res) => { filterThemes.value = res.data || [] }).catch(() => { filterThemes.value = [] })
  try {
    const res = await themeOptions()
    themes.value = res.data || []
  } catch (e) {
    themes.value = []
  }
}

onMounted(() => {
  loadThemes()
  getList()
})
</script>

<style scoped lang="scss">
.order-table {
  :deep(.el-table__row) {
    cursor: pointer;
  }
}

.order-progress {
  padding-right: 4px;

  .order-progress__text {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .order-progress__status {
    color: var(--el-text-color-regular);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .is-cancelled {
    color: var(--el-color-danger);
  }

  .is-done {
    color: var(--el-color-success);
  }
}
</style>
