<template>
  <div class="app-container esc-page task-page">
    <el-form :model="query" inline @submit.prevent>
      <el-form-item label="分类">
        <el-select v-model="query.category" placeholder="全部" clearable style="width: 110px" @change="search">
          <el-option v-for="c in TASK_CATEGORIES" :key="c" :label="c" :value="c" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 110px" @change="search">
          <el-option v-for="s in TASK_STATUS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字">
        <el-input v-model="query.keyword" placeholder="任务名称" clearable style="width: 180px" @keyup.enter="search" @clear="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="reset()">重置</el-button>
      </el-form-item>
    </el-form>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="task-page__tip"
      title="这里设置员工在门店端能完成的积分任务。修改积分或到账方式只影响之后提交的任务，已经提交或已到账的积分不会变。"
    />

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <el-button type="primary" icon="Plus" @click="openForm()" v-hasPermi="['escape:task:add']">新增任务</el-button>
        <span class="esc-hint">停用后门店端不再显示该任务，已有记录不受影响</span>
      </div>
      <div class="esc-toolbar__right">
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" row-key="taskId" class="task-table">
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" description="没有符合条件的积分任务" />
      </template>
      <el-table-column label="排序" prop="sortOrder" width="70" align="center" />
      <el-table-column label="任务名称" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="{ 'esc-muted': row.status !== '0' }">{{ row.title }}</span>
        </template>
      </el-table-column>
      <el-table-column label="分类" width="80" align="center">
        <template #default="{ row }"><el-tag size="small" type="info" effect="plain">{{ row.category }}</el-tag></template>
      </el-table-column>
      <el-table-column label="每次积分" width="90" align="right">
        <template #default="{ row }"><span class="esc-num task-table__points">{{ row.points }} 分</span></template>
      </el-table-column>
      <el-table-column label="到账方式" width="116" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.audit" size="small" type="warning">需店长审核</el-tag>
          <el-tag v-else size="small" type="success">点击即到账</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120" align="center">
        <template #default="{ row }">
          <el-switch
            v-if="canEdit"
            :model-value="row.status"
            active-value="0"
            inactive-value="1"
            inline-prompt
            active-text="启用"
            inactive-text="停用"
            :loading="row._switching"
            :before-change="() => toggleStatus(row)"
          />
          <el-tag v-else size="small" :type="tagTypeOf(TASK_STATUS, row.status)">{{ row.statusText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最近修改" width="130">
        <template #default="{ row }">
          {{ row.updateBy }}
          <div class="esc-cell-sub">{{ shortTime(row.updateTime) }}</div>
        </template>
      </el-table-column>
      <el-table-column v-if="canEdit" label="操作" width="80" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" icon="Edit" @click="openForm(row)">修改</el-button>
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

    <el-dialog v-model="formOpen" :title="form.taskId ? '修改积分任务' : '新增积分任务'" width="540px" append-to-body :close-on-click-modal="false" class="task-form-dialog">
      <el-alert v-if="form.taskId" type="warning" :closable="false" show-icon class="esc-dialog-tip" title="修改只影响之后提交的任务，已提交或已到账的积分不变。" />
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px" @submit.prevent>
        <el-form-item label="任务名称" prop="title">
          <el-input v-model="form.title" type="textarea" :rows="2" maxlength="100" show-word-limit placeholder="如：游戏结束整理场内物品" />
        </el-form-item>
        <el-form-item label="每次积分" prop="points">
          <el-input-number v-model="form.points" :min="0" :max="1000000" :step="1" step-strictly controls-position="right" style="width: 160px" />
          <span class="task-form-dialog__unit">分</span>
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-radio-group v-model="form.category">
            <el-radio-button v-for="c in TASK_CATEGORIES" :key="c" :value="c">{{ c }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="到账方式" prop="audit">
          <el-switch v-model="form.audit" inline-prompt active-text="需审核" inactive-text="直接到账" />
          <span class="esc-hint task-form-dialog__tip">{{ form.audit ? '员工提交后，店长审核通过才到账' : '员工点击完成后立即到账' }}</span>
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" :step="1" step-strictly controls-position="right" placeholder="留空排最后" style="width: 160px" />
          <span class="esc-hint task-form-dialog__tip">数字越小越靠前</span>
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
import { ElMessage } from 'element-plus'
import { addTask, changeTaskStatus, listTask, updateTask } from '@/api/escape/task'
import { TASK_CATEGORIES, TASK_STATUS, can, shortTime, tagTypeOf, useListPage } from '../shared'

defineOptions({ name: 'EscTask' })

const canEdit = can('escape:task:edit')

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(listTask, {
  category: '',
  status: '',
  keyword: ''
}, { pageSize: 20 })

async function toggleStatus(row) {
  const next = row.status === '0' ? '1' : '0'
  row._switching = true
  try {
    const res = await changeTaskStatus(row.taskId, next)
    Object.assign(row, res.data || { status: next })
    ElMessage.success(res.msg || (next === '0' ? '已启用' : '已停用'))
  } catch (e) {
    // 提示已由请求工具弹出
  } finally {
    row._switching = false
  }
  // 由接口结果决定开关位置，不让组件自己切换
  return false
}

// ------------------------------------------------------------------ 新增 / 修改

const formOpen = ref(false)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({ taskId: null, title: '', points: 1, category: '服务', audit: false, sortOrder: undefined })

const rules = {
  title: [{
    validator: (_, v, cb) => (String(v || '').trim() ? cb() : cb(new Error('请填写任务名称'))),
    trigger: 'blur'
  }],
  points: [{
    validator: (_, v, cb) => (Number.isInteger(v) && v >= 0 && v <= 1000000 ? cb() : cb(new Error('积分请填写 0 到 1000000 的整数'))),
    trigger: 'change'
  }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

function openForm(row) {
  Object.assign(form, row
    ? { taskId: row.taskId, title: row.title, points: row.points, category: row.category, audit: !!row.audit, sortOrder: row.sortOrder ?? undefined }
    : { taskId: null, title: '', points: 1, category: '服务', audit: false, sortOrder: undefined })
  formOpen.value = true
  setTimeout(() => formRef.value?.clearValidate(), 0)
}

function submitForm() {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    const data = {
      title: form.title.trim(),
      points: form.points,
      category: form.category,
      audit: form.audit,
      sortOrder: form.sortOrder ?? null
    }
    try {
      const res = form.taskId ? await updateTask(form.taskId, data) : await addTask(data)
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

onMounted(getList)
</script>

<style scoped lang="scss">
.task-page__tip {
  margin-bottom: 12px;
}

.task-table__points {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.task-form-dialog__unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

.task-form-dialog__tip {
  margin-left: 12px;
}
</style>
