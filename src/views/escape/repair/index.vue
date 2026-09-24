<template>
  <div class="app-container esc-page repair-page">
    <el-tabs v-model="activeTab" class="esc-tabs" @tab-change="onTabChange">
      <el-tab-pane label="待维修" name="pending" />
      <el-tab-pane label="已修好" name="completed" />
      <el-tab-pane label="全部" name="all" />
    </el-tabs>

    <el-form :model="query" inline @submit.prevent>
      <el-form-item label="主题">
        <el-select
          v-model="query.themeName"
          placeholder="全部主题"
          clearable
          filterable
          allow-create
          default-first-option
          style="width: 160px"
          @change="search"
        >
          <el-option v-for="t in filterThemes" :key="t.themeName" :label="t.current ? t.themeName : t.themeName + '（历史名称）'" :value="t.themeName" />
        </el-select>
      </el-form-item>
      <el-form-item label="登记日期">
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
        <el-input v-model="query.keyword" placeholder="问题 / 登记人 / 修理人" clearable style="width: 180px" @keyup.enter="search" @clear="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <el-button type="primary" icon="Plus" @click="openForm" v-hasPermi="['escape:repair:add']">登记维修</el-button>
        <span class="esc-hint">登记后门店端会看到待维修提醒；修好后点「确认修好」</span>
      </div>
      <div class="esc-toolbar__right">
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" row-key="repairId" class="repair-table">
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" :description="emptyText" />
      </template>
      <el-table-column label="主题" prop="themeName" width="130" show-overflow-tooltip />
      <el-table-column label="问题" min-width="240">
        <template #default="{ row }"><div class="repair-table__problem">{{ row.problem }}</div></template>
      </el-table-column>
      <el-table-column label="登记人" width="130">
        <template #default="{ row }">
          {{ row.createdBy }}
          <div class="esc-cell-sub">{{ shortTime(row.createdAt) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="修理人" width="130">
        <template #default="{ row }">
          <template v-if="row.completedBy">
            {{ row.completedBy }}
            <div class="esc-cell-sub">{{ shortTime(row.completedAt) }}</div>
          </template>
          <span v-else class="esc-placeholder">还没修好</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="tagTypeOf(REPAIR_STATUS, row.status)">{{ row.statusText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="canComplete" label="操作" width="110" align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'pending'" link type="success" icon="CircleCheck" @click="complete(row)">确认修好</el-button>
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

    <el-dialog v-model="formOpen" title="登记维修" width="520px" append-to-body :close-on-click-modal="false" class="repair-form-dialog">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="72px" @submit.prevent>
        <el-form-item label="主题" prop="themeId">
          <el-select v-model="form.themeId" placeholder="选择出问题的主题" filterable style="width: 100%">
            <el-option v-for="t in themes" :key="t.themeId" :label="t.themeName" :value="t.themeId" />
          </el-select>
        </el-form-item>
        <el-form-item label="问题" prop="problem">
          <el-input
            v-model="form.problem"
            type="textarea"
            :rows="5"
            maxlength="500"
            show-word-limit
            placeholder="写清楚哪里坏了、有什么现象，如：第二间房气泵不启动"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">登记</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, h, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { addRepair, completeRepair, listRepair } from '@/api/escape/repair'
import { themeOptions, themeFilterNames } from '@/api/escape/theme'
import { DATE_SHORTCUTS, REPAIR_STATUS, can, shortTime, tagTypeOf, useListPage } from '../shared'

defineOptions({ name: 'EscRepair' })

const canComplete = can('escape:repair:complete')
const activeTab = ref('pending')
const themes = ref([])
// 筛选下拉：在用主题 + 历史订单里出现过的旧名称
const filterThemes = ref([])

const statusOf = (tab) => (tab === 'all' ? '' : tab)

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(listRepair, {
  status: 'pending',
  themeName: '',
  keyword: '',
  dateRange: []
})

const emptyText = computed(() => {
  if (query.themeName || query.keyword || (query.dateRange && query.dateRange.length)) return '没有符合条件的维修记录'
  if (activeTab.value === 'pending') return '没有待维修的问题，设备状态良好'
  return '还没有维修记录'
})

function onTabChange(tab) {
  query.status = statusOf(tab)
  search()
}

function resetFilters() {
  reset({ status: statusOf(activeTab.value) })
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

function complete(row) {
  const message = h('div', [
    h('p', { style: 'margin:0 0 6px' }, `确认「${row.themeName}」的这个问题已经修好了吗？`),
    h('p', { style: 'margin:0;color:var(--el-text-color-secondary);white-space:pre-wrap' }, row.problem)
  ])
  ElMessageBox.confirm(message, '确认修好', {
    confirmButtonText: '已修好',
    cancelButtonText: '取消',
    type: 'success'
  }).then(async () => {
    try {
      const res = await completeRepair(row.repairId)
      ElMessage.success(res.msg || '已确认修好')
    } catch (e) {
      // 提示已由请求工具弹出
    }
    getList()
  }).catch(() => {})
}

// ------------------------------------------------------------------ 登记

const formOpen = ref(false)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({ themeId: null, problem: '' })

const rules = {
  themeId: [{ required: true, message: '请选择主题', trigger: 'change' }],
  problem: [{
    validator: (_, v, cb) => (String(v || '').trim() ? cb() : cb(new Error('请写一下出了什么问题'))),
    trigger: 'blur'
  }]
}

function openForm() {
  Object.assign(form, { themeId: null, problem: '' })
  loadThemes()
  formOpen.value = true
  setTimeout(() => formRef.value?.clearValidate(), 0)
}

function submitForm() {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    try {
      const res = await addRepair({ themeId: form.themeId, problem: form.problem.trim() })
      ElMessage.success(res.msg || '已登记待维修')
      formOpen.value = false
      if (activeTab.value === 'completed') {
        activeTab.value = 'pending'
        query.status = 'pending'
      }
      search()
    } catch (e) {
      // 提示已由请求工具弹出
    } finally {
      saving.value = false
    }
  })
}

onMounted(() => {
  loadThemes()
  getList()
})
</script>

<style scoped>
.repair-table__problem {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-primary);
}
</style>
