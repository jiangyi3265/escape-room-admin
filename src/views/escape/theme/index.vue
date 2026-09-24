<template>
  <div class="app-container esc-page theme-page">
    <el-tabs v-model="activeTab" class="esc-tabs" @tab-change="onTabChange">
      <el-tab-pane label="在用主题" name="live" />
      <el-tab-pane label="已删除" name="deleted" />
    </el-tabs>

    <el-form :model="query" inline @submit.prevent>
      <el-form-item label="主题名称">
        <el-input v-model="query.keyword" placeholder="输入名称查找" clearable style="width: 180px" @keyup.enter="search" @clear="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <el-button type="primary" icon="Plus" @click="openForm()" v-hasPermi="['escape:theme:add']">新增主题</el-button>
        <span class="esc-hint">{{ activeTab === 'live' ? '排序数字越小，门店端越靠前；录入订单和登记维修时从这里选主题' : '删除的主题不再出现在门店端，历史订单和维修记录保留原名称' }}</span>
      </div>
      <div class="esc-toolbar__right">
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table :key="activeTab" v-loading="loading" :data="rows" row-key="themeId" class="theme-table">
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" :description="activeTab === 'live' ? '还没有主题，先新增一个吧' : '没有已删除的主题'" />
      </template>
      <el-table-column label="排序" prop="sortOrder" width="80" align="center" />
      <el-table-column label="主题名称" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="activeTab === 'live' ? 'theme-table__name' : 'esc-muted'">{{ row.themeName }}</span>
        </template>
      </el-table-column>
      <template v-if="activeTab === 'live'">
        <el-table-column label="最近修改人" prop="updateBy" width="140" show-overflow-tooltip />
        <el-table-column label="修改时间" width="160">
          <template #default="{ row }"><span class="esc-num">{{ timeText(row.updateTime) }}</span></template>
        </el-table-column>
        <el-table-column v-if="perm.edit || perm.remove" label="操作" width="150" align="center" fixed="right">
          <template #default="{ row }">
            <div class="esc-row-actions">
              <el-button v-if="perm.edit" link type="primary" icon="Edit" @click="openForm(row)">修改</el-button>
              <el-button v-if="perm.remove" link type="danger" icon="Delete" @click="remove(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </template>
      <template v-else>
        <el-table-column label="删除人" prop="deletedBy" width="140" show-overflow-tooltip />
        <el-table-column label="删除时间" width="160">
          <template #default="{ row }"><span class="esc-num">{{ timeText(row.deletedAt) }}</span></template>
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

    <el-dialog v-model="formOpen" :title="form.themeId ? '修改主题' : '新增主题'" width="460px" append-to-body :close-on-click-modal="false" class="theme-form-dialog">
      <el-alert
        v-if="form.themeId"
        type="info"
        :closable="false"
        show-icon
        class="esc-dialog-tip"
        title="改名后，门店端显示新名称；已有订单和维修记录保留当时的名称。"
      />
      <el-form ref="formRef" :model="form" :rules="rules" label-width="84px" @submit.prevent>
        <el-form-item label="主题名称" prop="themeName">
          <el-input v-model="form.themeName" maxlength="30" show-word-limit placeholder="如：港诡实录" />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" :step="1" step-strictly controls-position="right" placeholder="留空排最后" style="width: 160px" />
          <div class="esc-form-help">数字越小越靠前；新增时留空会排在最后</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { addTheme, delTheme, listTheme, updateTheme } from '@/api/escape/theme'
import { can, timeText, useListPage } from '../shared'

defineOptions({ name: 'EscTheme' })

const perm = { edit: can('escape:theme:edit'), remove: can('escape:theme:remove') }
const activeTab = ref('live')

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(listTheme, {
  status: '',
  keyword: ''
}, { pageSize: 20 })

function onTabChange(tab) {
  rows.value = []
  query.status = tab === 'deleted' ? 'deleted' : ''
  search()
}

function resetFilters() {
  reset({ status: activeTab.value === 'deleted' ? 'deleted' : '' })
}

const formOpen = ref(false)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({ themeId: null, themeName: '', sortOrder: undefined })

const rules = {
  themeName: [{
    validator: (_, v, cb) => (String(v || '').trim() ? cb() : cb(new Error('请填写主题名称'))),
    trigger: 'blur'
  }]
}

function openForm(row) {
  Object.assign(form, row
    ? { themeId: row.themeId, themeName: row.themeName, sortOrder: row.sortOrder ?? undefined }
    : { themeId: null, themeName: '', sortOrder: undefined })
  formOpen.value = true
  setTimeout(() => formRef.value?.clearValidate(), 0)
}

function submitForm() {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    const data = { themeName: form.themeName.trim(), sortOrder: form.sortOrder ?? null }
    try {
      const res = form.themeId ? await updateTheme(form.themeId, data) : await addTheme(data)
      ElMessage.success(res.msg || '已保存')
      formOpen.value = false
      getList()
    } catch (e) {
      // 提示已由请求工具弹出
    } finally {
      saving.value = false
    }
  })
}

function remove(row) {
  ElMessageBox.confirm(
    `删除后门店端不再显示「${row.themeName}」，录入订单时也不能再选；历史订单和维修记录保留原名称。确定删除吗？`,
    '删除主题',
    { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
  ).then(async () => {
    try {
      const res = await delTheme(row.themeId)
      ElMessage.success(res.msg || '主题已删除')
    } catch (e) {
      // 提示已由请求工具弹出
    }
    getList()
  }).catch(() => {})
}

onMounted(getList)
</script>

<style scoped>
.theme-table__name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}
</style>
