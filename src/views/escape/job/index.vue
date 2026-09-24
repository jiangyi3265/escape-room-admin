<template>
  <div class="app-container esc-page job-page">
    <el-form :model="query" inline @submit.prevent>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 110px" @change="search">
          <el-option v-for="s in JOB_STATUS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="紧急程度">
        <el-select v-model="query.urgency" placeholder="全部" clearable style="width: 110px" @change="search">
          <el-option v-for="u in URGENCY" :key="u.value" :label="u.label" :value="u.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="发布日期">
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
        <el-input v-model="query.keyword" placeholder="标题 / 说明" clearable style="width: 160px" @keyup.enter="search" @clear="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="reset()">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <el-button type="primary" icon="Plus" @click="openPublish" v-hasPermi="['escape:job:add']">发布任务</el-button>
        <span class="esc-hint">员工在门店端抢单，先到先得；还没人抢的任务可以取消</span>
      </div>
      <div class="esc-toolbar__right">
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" row-key="jobId" class="job-table">
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" description="没有符合条件的临时任务" />
      </template>
      <el-table-column label="标题" min-width="140" show-overflow-tooltip>
        <template #default="{ row }"><span class="job-table__title">{{ row.title }}</span></template>
      </el-table-column>
      <el-table-column label="说明" prop="description" min-width="150" show-overflow-tooltip />
      <el-table-column label="截止" width="100" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.deadline">{{ row.deadline }}</span>
          <span v-else class="esc-placeholder">不限</span>
        </template>
      </el-table-column>
      <el-table-column label="紧急程度" width="84" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="tagTypeOf(URGENCY, row.urgency)" :effect="row.urgency === 'urgent' ? 'dark' : 'light'">{{ row.urgencyText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="可抢员工" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="{ 'esc-muted': !row.restricted }">{{ row.allowedText }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="72" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="tagTypeOf(JOB_STATUS, row.status)">{{ row.statusText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发布" width="100">
        <template #default="{ row }">
          {{ row.publishedBy }}
          <div class="esc-cell-sub">{{ shortTime(row.publishedAt) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="抢到 / 取消" width="104">
        <template #default="{ row }">
          <template v-if="row.claimedName">
            <span class="job-table__claimed">{{ row.claimedName }}</span>
            <div class="esc-cell-sub">{{ shortTime(row.claimedAt) }}</div>
          </template>
          <template v-else-if="row.status === 'cancelled'">
            <span>{{ row.cancelledBy || '—' }}</span>
            <div class="esc-cell-sub">{{ shortTime(row.cancelledAt) }}</div>
          </template>
          <span v-else class="esc-placeholder">等待员工抢单</span>
        </template>
      </el-table-column>
      <el-table-column v-if="canCancel" label="操作" width="84" align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'open'" link type="danger" icon="CircleClose" @click="cancel(row)">取消</el-button>
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

    <!-- 发布任务 -->
    <el-dialog v-model="publishOpen" title="发布临时任务" width="560px" append-to-body :close-on-click-modal="false" class="job-publish-dialog">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px" @submit.prevent>
        <el-form-item label="任务标题" prop="title">
          <el-input v-model="form.title" maxlength="30" show-word-limit placeholder="如：搬运新道具" />
        </el-form-item>
        <el-form-item label="任务说明" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="120" show-word-limit placeholder="写清楚要做什么、在哪里做" />
        </el-form-item>
        <el-form-item label="截止时间" prop="deadline">
          <el-input v-model="form.deadline" maxlength="30" show-word-limit placeholder="如：今天 21:30 前（选填）" />
        </el-form-item>
        <el-form-item label="紧急程度" prop="urgency">
          <el-radio-group v-model="form.urgency">
            <el-radio-button v-for="u in URGENCY" :key="u.value" :value="u.value">{{ u.label }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="限定员工" prop="restricted">
          <el-switch v-model="form.restricted" inline-prompt active-text="限定" inactive-text="全店" />
          <span class="esc-hint job-publish-dialog__tip">{{ form.restricted ? '只有选中的员工能看到并抢这条任务' : '全店员工都能看到并抢这条任务' }}</span>
        </el-form-item>
        <el-form-item v-if="form.restricted" label="可抢员工" prop="allowedStaffIds">
          <el-select v-model="form.allowedStaffIds" multiple filterable placeholder="选择可以抢这条任务的员工" style="width: 100%">
            <el-option v-for="s in employees" :key="s.staffId" :label="s.staffName" :value="s.staffId" />
          </el-select>
          <div v-if="!employees.length" class="esc-form-help">目前没有在职员工</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="publishOpen = false">取消</el-button>
        <el-button type="primary" :loading="publishing" @click="submitPublish">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { addJob, cancelJob, listJob } from '@/api/escape/job'
import { staffOptions } from '@/api/escape/staff'
import { DATE_SHORTCUTS, JOB_STATUS, URGENCY, can, newRequestId, shortTime, tagTypeOf, useListPage } from '../shared'

defineOptions({ name: 'EscJob' })

const canCancel = can('escape:job:cancel')
const route = useRoute()
// 从门店概览「待抢任务」进来时只看待抢的
const initialStatus = JOB_STATUS.some((s) => s.value === route.query.status) ? route.query.status : ''

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(listJob, {
  status: '',
  urgency: '',
  keyword: '',
  dateRange: []
})
query.status = initialStatus

function cancel(row) {
  ElMessageBox.confirm(`取消后员工不能再抢这条任务。确定取消「${row.title}」吗？`, '取消任务', {
    confirmButtonText: '确定取消',
    cancelButtonText: '先不取消',
    type: 'warning'
  }).then(async () => {
    try {
      const res = await cancelJob(row.jobId)
      ElMessage.success(res.msg || '任务已取消')
    } catch (e) {
      // 提示已由请求工具弹出（例如刚被员工抢到）
    }
    getList()
  }).catch(() => {})
}

// ------------------------------------------------------------------ 发布

const publishOpen = ref(false)
const publishing = ref(false)
const formRef = ref(null)
const employees = ref([])
let requestId = ''

const form = reactive({ title: '', description: '', deadline: '', urgency: 'normal', restricted: false, allowedStaffIds: [] })

const notBlank = (label) => ({
  validator: (_, v, cb) => (String(v || '').trim() ? cb() : cb(new Error(`请填写${label}`))),
  trigger: 'blur'
})

const rules = {
  title: [notBlank('任务标题')],
  description: [notBlank('任务说明')],
  urgency: [{ required: true, message: '请选择紧急程度', trigger: 'change' }],
  allowedStaffIds: [{
    validator: (_, v, cb) => (!form.restricted || (v && v.length) ? cb() : cb(new Error('请至少选择一名员工'))),
    trigger: 'change'
  }]
}

async function openPublish() {
  Object.assign(form, { title: '', description: '', deadline: '', urgency: 'normal', restricted: false, allowedStaffIds: [] })
  requestId = newRequestId()
  publishOpen.value = true
  setTimeout(() => formRef.value?.clearValidate(), 0)
  try {
    const res = await staffOptions({ role: 'employee', status: 'active' })
    employees.value = res.data || []
  } catch (e) {
    employees.value = []
  }
}

function submitPublish() {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    publishing.value = true
    try {
      const res = await addJob({
        title: form.title.trim(),
        description: form.description.trim(),
        deadline: form.deadline.trim(),
        urgency: form.urgency,
        restricted: form.restricted,
        allowedStaffIds: form.restricted ? form.allowedStaffIds : [],
        requestId
      })
      ElMessage.success(res.msg || '发布成功')
      publishOpen.value = false
      getList()
    } catch (e) {
      // 提示已由请求工具弹出
    } finally {
      publishing.value = false
    }
  })
}

onMounted(getList)
</script>

<style scoped lang="scss">
.job-table__title {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.job-table__claimed {
  color: var(--el-color-success);
}

.job-publish-dialog__tip {
  margin-left: 12px;
}
</style>
