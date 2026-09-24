<template>
  <div class="app-container esc-page audit-page">
    <el-tabs v-model="activeTab" class="esc-tabs" @tab-change="onTabChange">
      <el-tab-pane name="pending">
        <template #label>
          待审核<el-badge v-if="pendingCount > 0" :value="pendingCount" :max="99" class="audit-page__badge" />
        </template>
      </el-tab-pane>
      <el-tab-pane label="审核记录" name="history" />
    </el-tabs>

    <el-form :model="query" inline @submit.prevent>
      <el-form-item label="员工">
        <el-select v-model="query.staffId" placeholder="全部员工" clearable filterable style="width: 140px" @change="search">
          <el-option v-for="s in staff" :key="s.staffId" :label="s.staffName" :value="s.staffId" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="activeTab === 'history'" label="结果">
        <el-select v-model="query.reviewResult" placeholder="全部" clearable style="width: 110px" @change="search">
          <el-option v-for="r in REVIEW_RESULTS" :key="r.value" :label="r.label" :value="r.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="提交日期">
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
        <el-input v-model="query.keyword" placeholder="任务 / 员工姓名" clearable style="width: 160px" @keyup.enter="search" @clear="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <template v-if="activeTab === 'pending'">
          <el-button
            v-if="canReview"
            type="success"
            icon="Select"
            :disabled="!selected.length"
            :loading="batchBusy"
            @click="batchApprove"
          >批量通过{{ selected.length ? `（${selected.length}）` : '' }}</el-button>
          <span class="esc-hint">按提交先后排列，最早提交的在最前；通过后积分立即到账</span>
        </template>
        <span v-else class="esc-hint">最近审核的排在最前；通过后被撤销的积分会显示「已撤销」</span>
      </div>
      <div class="esc-toolbar__right">
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table
      :key="activeTab"
      v-loading="loading"
      :data="rows"
      row-key="entryId"
      class="audit-table"
      @selection-change="(list) => (selected = list)"
    >
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" :description="activeTab === 'pending' ? '没有待审核的任务，都处理完了' : '没有符合条件的审核记录'" />
      </template>
      <el-table-column v-if="activeTab === 'pending' && canReview" type="selection" width="48" align="center" />
      <el-table-column label="提交时间" width="140">
        <template #default="{ row }"><span class="esc-num">{{ timeText(row.occurredAt) }}</span></template>
      </el-table-column>
      <el-table-column label="员工" prop="staffName" width="110" show-overflow-tooltip />
      <el-table-column label="任务" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">{{ row.title }}</template>
      </el-table-column>
      <el-table-column label="分类" width="72" align="center">
        <template #default="{ row }"><el-tag size="small" type="info" effect="plain">{{ row.category || '—' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="积分" width="76" align="right">
        <template #default="{ row }"><span class="esc-num esc-plus">+{{ row.points }}</span></template>
      </el-table-column>

      <template v-if="activeTab === 'pending'">
        <el-table-column label="等待时长" width="100">
          <template #default="{ row }"><span class="esc-muted">{{ waitingText(row.occurredAt) }}</span></template>
        </el-table-column>
        <el-table-column v-if="canReview" label="操作" width="150" align="center" fixed="right">
          <template #default="{ row }">
            <div class="esc-row-actions">
              <el-button link type="success" icon="Check" @click="approve(row)">通过</el-button>
              <el-button link type="danger" icon="Close" @click="reject(row)">驳回</el-button>
            </div>
          </template>
        </el-table-column>
      </template>

      <template v-else>
        <el-table-column label="审核结果" width="96" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="tagTypeOf(REVIEW_RESULTS, row.reviewResult)">{{ row.reviewResultText || labelOf(REVIEW_RESULTS, row.reviewResult) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="驳回原因" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.reviewReason">{{ row.reviewReason }}</span>
            <span v-else class="esc-placeholder">—</span>
          </template>
        </el-table-column>
        <el-table-column label="审核人" width="120">
          <template #default="{ row }">
            {{ row.reviewedBy }}
            <div class="esc-cell-sub">{{ shortTime(row.reviewedAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="积分状态" width="96" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" :type="tagTypeOf(POINT_STATES, row.state)">{{ row.stateText }}</el-tag>
          </template>
        </el-table-column>
      </template>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="query.pageNum"
      v-model:limit="query.pageSize"
      @pagination="getList"
    />

    <!-- 批量处理结果 -->
    <el-dialog v-model="failureOpen" title="部分任务没有通过" width="520px" append-to-body>
      <el-alert type="warning" :closable="false" show-icon class="esc-dialog-tip" :title="failureTitle" />
      <ul class="audit-page__failures">
        <li v-for="(item, i) in failures" :key="i">{{ item }}</li>
      </ul>
      <template #footer>
        <el-button type="primary" @click="failureOpen = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { approveAudit, batchApproveAudit, listAudit, rejectAudit } from '@/api/escape/audit'
import { staffOptions } from '@/api/escape/staff'
import {
  DATE_SHORTCUTS, POINT_STATES, REVIEW_RESULTS, can, labelOf, shortTime, tagTypeOf, timeText, useListPage
} from '../shared'

defineOptions({ name: 'EscAudit' })

const activeTab = ref('pending')
const staff = ref([])
const selected = ref([])
const batchBusy = ref(false)
const pendingCount = ref(0)
const canReview = can('escape:audit:review')

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(
  async (params) => {
    const res = await listAudit(params)
    if (params.status === 'pending' && !params.staffId && !params.keyword && !params.beginDate) {
      pendingCount.value = res.total || 0
    }
    return res
  },
  { status: 'pending', staffId: '', reviewResult: '', keyword: '', dateRange: [] },
  { pageSize: 20 }
)

function onTabChange(tab) {
  selected.value = []
  rows.value = []
  query.status = tab === 'pending' ? 'pending' : 'history'
  if (tab === 'pending') query.reviewResult = ''
  search()
}

function resetFilters() {
  selected.value = []
  reset({ status: activeTab.value === 'pending' ? 'pending' : 'history' })
}

async function refreshPendingCount() {
  try {
    const res = await listAudit({ status: 'pending', pageNum: 1, pageSize: 1 })
    pendingCount.value = res.total || 0
  } catch (e) {
    // 忽略
  }
}

async function afterReview() {
  selected.value = []
  await getList()
  refreshPendingCount()
}

/** 已等待多久（按本机时钟粗略计算，只作提示） */
function waitingText(occurredAt) {
  if (!occurredAt) return ''
  const now = Date.now() + storeOffsetMs.value
  const then = new Date(String(occurredAt).replace(' ', 'T')).getTime()
  const minutes = Math.max(0, Math.floor((now - then) / 60000))
  if (minutes < 1) return '刚刚提交'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时`
  return `${Math.floor(hours / 24)} 天`
}

// 门店时间与本机时间的差（门店在北京时间，本机可能不在同一时区）
const storeOffsetMs = computed(() => {
  try {
    const now = new Date()
    const text = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(now)
    return new Date(text.replace(' ', 'T')).getTime() - now.getTime()
  } catch (e) {
    return 0
  }
})

function approve(row) {
  ElMessageBox.confirm(`通过后 ${row.staffName} 立即获得 ${row.points} 积分。确定通过「${row.title}」吗？`, '审核通过', {
    confirmButtonText: '通过',
    cancelButtonText: '取消',
    type: 'success'
  }).then(async () => {
    try {
      const res = await approveAudit(row.entryId)
      ElMessage.success(res.msg || '审核通过')
    } catch (e) {
      // 提示已由请求工具弹出
    }
    afterReview()
  }).catch(() => {})
}

function reject(row) {
  ElMessageBox.prompt(`驳回后 ${row.staffName} 不会获得这次的积分，门店端会收到提醒。`, `驳回「${row.title}」`, {
    confirmButtonText: '驳回',
    cancelButtonText: '取消',
    type: 'warning',
    inputValue: '未通过检查',
    inputPlaceholder: '驳回原因（选填）',
    inputValidator: (v) => !v || v.trim().length <= 100 || '驳回原因不能超过100字',
    confirmButtonClass: 'el-button--danger'
  }).then(async ({ value }) => {
    try {
      const res = await rejectAudit(row.entryId, (value || '').trim())
      ElMessage.success(res.msg || '已驳回')
    } catch (e) {
      // 提示已由请求工具弹出
    }
    afterReview()
  }).catch(() => {})
}

// 批量通过：逐条处理，失败的列出原因（把编号换成员工和任务名称）
const failureOpen = ref(false)
const failures = ref([])
const failureTitle = ref('')

function batchApprove() {
  const list = [...selected.value]
  if (!list.length) return
  const points = list.reduce((acc, r) => acc + Number(r.points || 0), 0)
  ElMessageBox.confirm(`将通过选中的 ${list.length} 条任务，共发放 ${points} 积分，通过后立即到账。确定吗？`, '批量通过', {
    confirmButtonText: '全部通过',
    cancelButtonText: '取消',
    type: 'success'
  }).then(async () => {
    batchBusy.value = true
    try {
      const res = await batchApproveAudit(list.map((r) => r.entryId))
      const data = res.data || {}
      // 每条没处理的原因形如「周言 · 打扫《纸人回魂》并通过检查：该任务已被审核或已取消，请刷新」
      const readable = (data.failures || []).map(String)
      if (readable.length) {
        failures.value = readable
        failureTitle.value = `已通过 ${data.approved || 0} 条，${readable.length} 条没有处理`
        failureOpen.value = true
      } else {
        ElMessage.success(res.msg || `已通过 ${data.approved || 0} 条`)
      }
    } catch (e) {
      // 提示已由请求工具弹出
    } finally {
      batchBusy.value = false
    }
    afterReview()
  }).catch(() => {})
}

onMounted(() => {
  staffOptions({ role: 'employee' }).then((res) => { staff.value = res.data || [] }).catch(() => {})
  getList()
})
</script>

<style scoped lang="scss">
.audit-page__badge {
  margin-left: 6px;

  :deep(.el-badge__content) {
    position: static;
    transform: none;
  }
}

.audit-page__failures {
  margin: 0;
  padding-left: 18px;
  line-height: 26px;
  color: var(--el-text-color-regular);
}
</style>
