<template>
  <div class="app-container esc-page point-page">
    <el-form :model="query" inline @submit.prevent>
      <el-form-item label="员工">
        <el-select v-model="query.staffId" placeholder="全部员工" clearable filterable style="width: 140px" @change="search">
          <el-option v-for="s in staff" :key="s.staffId" :label="staffLabel(s)" :value="s.staffId" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源">
        <el-select v-model="query.source" placeholder="全部" clearable style="width: 120px" @change="search">
          <el-option v-for="s in POINT_SOURCES" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.state" placeholder="全部" clearable style="width: 140px" @change="search">
          <el-option v-for="s in POINT_STATES" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="日期">
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
        <el-input v-model="query.keyword" placeholder="事项 / 员工姓名" clearable style="width: 150px" @keyup.enter="search" @clear="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="reset()">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <el-button type="primary" icon="Edit" @click="openAdjust" v-hasPermi="['escape:point:adjust']">调整积分</el-button>
        <el-button icon="Download" @click="handleExport" v-hasPermi="['escape:point:export']">导出</el-button>
        <span class="esc-hint">撤销只对已到账的加分有效，撤销后员工总积分会相应减少</span>
      </div>
      <div class="esc-toolbar__right">
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" row-key="entryId" class="point-table">
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" description="没有符合条件的积分记录" />
      </template>
      <el-table-column label="时间" width="140">
        <template #default="{ row }"><span class="esc-num">{{ timeText(row.occurredAt) }}</span></template>
      </el-table-column>
      <el-table-column label="员工" prop="staffName" width="110" show-overflow-tooltip />
      <el-table-column label="事项" min-width="220">
        <template #default="{ row }">
          <div class="point-table__title">
            <el-tag v-if="row.category" size="small" type="info" effect="plain">{{ row.category }}</el-tag>
            <el-tooltip :content="row.title" placement="top" :show-after="400">
              <span class="point-table__text">{{ row.title }}</span>
            </el-tooltip>
          </div>
          <div v-if="row.reviewReason" class="esc-cell-sub">驳回原因：{{ row.reviewReason }}</div>
        </template>
      </el-table-column>
      <el-table-column label="积分" width="80" align="right">
        <template #default="{ row }">
          <span class="esc-num" :class="pointClass(row)">{{ pointText(row.points) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="96" align="center">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="tagTypeOf(POINT_SOURCES, row.source)">{{ row.sourceText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="tagTypeOf(POINT_STATES, row.state)">{{ row.stateText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="经办 / 审核人" width="130">
        <template #default="{ row }">
          <template v-if="handler(row).name">
            {{ handler(row).name }}
            <div class="esc-cell-sub">{{ handler(row).text }}</div>
          </template>
          <span v-else class="esc-placeholder">{{ handler(row).text }}</span>
        </template>
      </el-table-column>
      <el-table-column v-if="canRevoke" label="操作" width="80" align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.revocable" link type="danger" icon="RefreshLeft" @click="revoke(row)">撤销</el-button>
          <span v-else class="esc-placeholder">—</span>
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

    <!-- 调整积分 -->
    <el-dialog v-model="adjustOpen" title="调整积分" width="480px" append-to-body :close-on-click-modal="false" class="point-adjust-dialog">
      <el-alert type="info" :closable="false" show-icon class="esc-dialog-tip" title="加分填正数，扣分填负数；扣分后最低为 0 分，员工会收到提醒。" />
      <el-form ref="adjustRef" :model="adjustForm" :rules="adjustRules" label-width="80px" @submit.prevent>
        <el-form-item label="员工" prop="staffId">
          <el-select v-model="adjustForm.staffId" placeholder="选择员工" filterable style="width: 100%">
            <el-option v-for="s in activeStaff" :key="s.staffId" :label="s.staffName" :value="s.staffId">
              <span>{{ s.staffName }}</span>
              <span class="point-adjust-dialog__opt">当前 {{ s.points }} 分</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="增减积分" prop="points">
          <el-input-number v-model="adjustForm.points" :min="-100000" :max="100000" :step="1" step-strictly placeholder="如 5 或 -5" style="width: 180px" />
          <span v-if="adjustPreview" class="point-adjust-dialog__preview">{{ adjustPreview }}</span>
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input v-model="adjustForm.reason" maxlength="60" show-word-limit placeholder="如：周末加班、违反店规（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustOpen = false">取消</el-button>
        <el-button type="primary" :loading="adjustBusy" @click="submitAdjust">确定调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adjustPoint, exportPoint, listPoint, revokePoint } from '@/api/escape/point'
import { staffOptions } from '@/api/escape/staff'
import {
  DATE_SHORTCUTS, POINT_SOURCES, POINT_STATES, can, cleanParams, exportFileName, shortTime, tagTypeOf, timeText, useListPage
} from '../shared'

defineOptions({ name: 'EscPoint' })

const canRevoke = can('escape:point:revoke')
const staff = ref([])
const activeStaff = computed(() => staff.value.filter((s) => s.status === 'active'))

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(listPoint, {
  staffId: '',
  source: '',
  state: '',
  keyword: '',
  dateRange: []
})

function staffLabel(s) {
  return s.status === 'active' ? s.staffName : `${s.staffName}（已停用）`
}

function pointText(points) {
  const n = Number(points) || 0
  return n > 0 ? `+${n}` : String(n)
}

function pointClass(row) {
  const n = Number(row.points) || 0
  // 撤销冲减那一行本身就是生效的扣分；其它不是「已到账」的记录不计入总积分，显示成灰色
  if (row.source === 'reversal') return n < 0 ? 'esc-minus' : ''
  if (row.state !== 'credited') return 'esc-muted'
  return n > 0 ? 'esc-plus' : n < 0 ? 'esc-minus' : ''
}

/** 经办 / 审核人：审核人 → 撤销人 → 经办人 */
function handler(row) {
  if (row.revokedBy) return { name: row.revokedBy, text: `撤销于 ${shortTime(row.revokedAt)}` }
  if (row.reviewedBy) return { name: row.reviewedBy, text: `${row.reviewResultText || '审核'} ${shortTime(row.reviewedAt)}` }
  if (row.operatorName) return { name: row.operatorName, text: row.source === 'manual' ? '手动调整' : '经办' }
  return { name: '', text: row.state === 'pending' ? '等待店长审核' : '员工自己完成' }
}

function handleExport() {
  exportPoint(cleanParams(query, { paging: false }), exportFileName('积分明细'))
}

async function loadStaff() {
  try {
    const res = await staffOptions({ role: 'employee' })
    staff.value = res.data || []
  } catch (e) {
    staff.value = []
  }
}

function revoke(row) {
  ElMessageBox.confirm(
    `撤销后 ${row.staffName} 的总积分会减少 ${row.points} 分，员工会收到提醒，撤销后不能恢复。确定撤销「${row.title}」吗？`,
    '撤销积分',
    { confirmButtonText: '确定撤销', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
  ).then(async () => {
    try {
      const res = await revokePoint(row.entryId)
      const balance = res.data && res.data.balance
      ElMessage.success(`${res.msg || '已撤销'}${balance !== undefined && balance !== null ? `，${row.staffName} 现在 ${balance} 分` : ''}`)
      loadStaff()
    } catch (e) {
      // 提示已由请求工具弹出
    }
    getList()
  }).catch(() => {})
}

// ------------------------------------------------------------------ 调整积分

const adjustOpen = ref(false)
const adjustBusy = ref(false)
const adjustRef = ref(null)
const adjustForm = reactive({ staffId: null, points: undefined, reason: '' })
const adjustRules = {
  staffId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  points: [{
    validator: (_, value, callback) => {
      if (value === undefined || value === null || value === '') return callback(new Error('请填写要增减的积分'))
      if (!Number.isInteger(value) || value === 0) return callback(new Error('请填写不为 0 的整数'))
      return callback()
    },
    trigger: 'change'
  }]
}

const adjustPreview = computed(() => {
  const s = staff.value.find((item) => item.staffId === adjustForm.staffId)
  const delta = Number(adjustForm.points)
  if (!s || !Number.isInteger(delta) || delta === 0) return ''
  const after = Math.max(0, Number(s.points || 0) + delta)
  return `${s.points} → ${after} 分`
})

function openAdjust() {
  Object.assign(adjustForm, { staffId: query.staffId || null, points: undefined, reason: '' })
  loadStaff()
  adjustOpen.value = true
  setTimeout(() => adjustRef.value?.clearValidate(), 0)
}

function submitAdjust() {
  adjustRef.value.validate(async (valid) => {
    if (!valid) return
    adjustBusy.value = true
    try {
      const res = await adjustPoint({ staffId: adjustForm.staffId, points: adjustForm.points, reason: adjustForm.reason.trim() })
      ElMessage.success(res.msg || '积分已调整')
      adjustOpen.value = false
      loadStaff()
      getList()
    } catch (e) {
      // 提示已由请求工具弹出
    } finally {
      adjustBusy.value = false
    }
  })
}

onMounted(() => {
  loadStaff()
  getList()
})
</script>

<style scoped lang="scss">
.point-table__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.point-table__text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.point-adjust-dialog__opt {
  float: right;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.point-adjust-dialog__preview {
  margin-left: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
