<template>
  <div class="app-container esc-page staff-page">
    <el-form :model="query" inline @submit.prevent>
      <el-form-item label="关键字">
        <el-input v-model="query.keyword" placeholder="姓名 / 手机号" clearable style="width: 170px" @keyup.enter="search" @clear="search" />
      </el-form-item>
      <el-form-item label="身份">
        <el-select v-model="query.role" placeholder="全部" clearable style="width: 110px" @change="search">
          <el-option v-for="r in STAFF_ROLES" :key="r.value" :label="r.label" :value="r.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 110px" @change="search">
          <el-option v-for="s in STAFF_STATUS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="reset()">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <el-button type="primary" icon="Plus" @click="openForm()" v-hasPermi="['escape:staff:add']">添加人员</el-button>
        <span class="esc-hint">员工和店长都用手机号登录门店端；停用或删除后立即退出登录</span>
      </div>
      <div class="esc-toolbar__right">
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" row-key="staffId" class="staff-table" :row-class-name="rowClass">
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" description="没有符合条件的人员" />
      </template>
      <el-table-column label="姓名" min-width="90" show-overflow-tooltip>
        <template #default="{ row }"><span class="staff-table__name">{{ row.staffName }}</span></template>
      </el-table-column>
      <el-table-column label="手机号" width="116">
        <template #default="{ row }"><span class="esc-num">{{ row.phone }}</span></template>
      </el-table-column>
      <el-table-column label="身份" width="68" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="tagTypeOf(STAFF_ROLES, row.role)" effect="plain">{{ row.roleText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="76" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="tagTypeOf(STAFF_STATUS, row.status)">{{ row.statusText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="积分" width="72" align="right">
        <template #default="{ row }">
          <span v-if="row.role === 'manager'" class="esc-placeholder">不参与</span>
          <span v-else class="esc-num staff-table__points">{{ row.points }}</span>
        </template>
      </el-table-column>
      <el-table-column label="完成任务" width="80" align="right">
        <template #default="{ row }">
          <span v-if="row.role === 'manager'" class="esc-placeholder">—</span>
          <span v-else class="esc-num">{{ row.taskCount }} 次</span>
        </template>
      </el-table-column>
      <el-table-column label="最近登录" width="100">
        <template #default="{ row }">
          <span v-if="row.lastLoginAt" class="esc-num">{{ shortTime(row.lastLoginAt) }}</span>
          <span v-else class="esc-placeholder">还没登录过</span>
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="90" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.remark">{{ row.remark }}</span>
          <span v-else class="esc-placeholder">—</span>
        </template>
      </el-table-column>
      <el-table-column v-if="hasRowActions" label="操作" width="300" align="center" fixed="right">
        <template #default="{ row }">
          <div class="esc-row-actions">
            <el-button v-if="perm.edit" link type="primary" icon="Edit" @click="openForm(row)">修改</el-button>
            <el-button v-if="perm.status && row.status === 'active'" link type="warning" icon="SwitchButton" @click="toggleStatus(row)">停用</el-button>
            <el-button v-if="perm.status && row.status !== 'active'" link type="success" icon="Open" @click="toggleStatus(row)">恢复</el-button>
            <el-button v-if="perm.resetPwd" link type="primary" icon="Key" @click="resetPassword(row)">重置密码</el-button>
            <el-button v-if="perm.remove" link type="danger" icon="Delete" @click="remove(row)">删除</el-button>
          </div>
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

    <!-- 添加 / 修改 -->
    <el-dialog v-model="formOpen" :title="form.staffId ? '修改人员资料' : '添加人员'" width="520px" append-to-body :close-on-click-modal="false" class="staff-form-dialog">
      <el-alert
        v-if="form.staffId"
        type="info"
        :closable="false"
        show-icon
        class="esc-dialog-tip"
        title="修改手机号或身份后，对方需要用新的信息重新登录门店端。"
      />
      <el-form ref="formRef" :model="form" :rules="rules" label-width="84px" @submit.prevent>
        <el-form-item label="姓名" prop="staffName">
          <el-input v-model="form.staffName" maxlength="20" show-word-limit placeholder="门店里显示的名字，不能和别人重名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" maxlength="11" placeholder="11 位手机号，用来登录门店端" />
        </el-form-item>
        <el-form-item label="身份" prop="role">
          <el-radio-group v-model="form.role">
            <el-radio v-for="r in STAFF_ROLES" :key="r.value" :value="r.value">{{ r.label }}</el-radio>
          </el-radio-group>
          <div class="esc-form-help staff-form-dialog__help">{{ form.role === 'manager' ? '店长可以审核任务、管理订单和员工，不参与积分' : '员工可以录入订单、完成任务赚积分、抢临时任务' }}</div>
        </el-form-item>
        <el-form-item v-if="!form.staffId" label="初始密码" prop="password">
          <el-input v-model="form.password" maxlength="32" placeholder="选填" autocomplete="new-password" />
          <div class="esc-form-help">留空则自动生成 6 位数字密码</div>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" maxlength="200" show-word-limit placeholder="选填，如：周末兼职" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">{{ form.staffId ? '保存' : '添加' }}</el-button>
      </template>
    </el-dialog>

    <SecretDialog
      v-model="secretOpen"
      :title="secret.title"
      :lines="secret.lines"
      :secret="secret.password"
      :secret-label="secret.label"
    />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { addStaff, changeStaffStatus, delStaff, listStaff, resetStaffPassword, updateStaff } from '@/api/escape/staff'
import SecretDialog from '../components/SecretDialog.vue'
import { STAFF_ROLES, STAFF_STATUS, can, shortTime, tagTypeOf, useListPage } from '../shared'

defineOptions({ name: 'EscStaff' })

const perm = {
  edit: can('escape:staff:edit'),
  status: can('escape:staff:status'),
  resetPwd: can('escape:staff:resetPwd'),
  remove: can('escape:staff:remove')
}
const hasRowActions = perm.edit || perm.status || perm.resetPwd || perm.remove

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(listStaff, {
  keyword: '',
  role: '',
  status: ''
}, { pageSize: 20 })

function rowClass({ row }) {
  return row.status === 'active' ? '' : 'staff-table__inactive'
}

// ------------------------------------------------------------------ 一次性显示密码

const secretOpen = ref(false)
const secret = reactive({ title: '', lines: [], password: '', label: '登录密码' })

function showSecret(title, staff, password, label) {
  Object.assign(secret, {
    title,
    lines: [
      { label: '姓名', value: staff.staffName },
      { label: '登录手机号', value: staff.phone }
    ],
    password,
    label
  })
  secretOpen.value = true
}

// ------------------------------------------------------------------ 添加 / 修改

const formOpen = ref(false)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({ staffId: null, staffName: '', phone: '', role: 'employee', password: '', remark: '' })

const rules = {
  staffName: [{
    validator: (_, v, cb) => (String(v || '').trim() ? cb() : cb(new Error('请填写姓名'))),
    trigger: 'blur'
  }],
  phone: [{
    validator: (_, v, cb) => (/^1\d{10}$/.test(String(v || '').trim()) ? cb() : cb(new Error('请填写 11 位手机号'))),
    trigger: 'blur'
  }],
  role: [{ required: true, message: '请选择身份', trigger: 'change' }],
  password: [{
    validator: (_, v, cb) => {
      const text = String(v || '')
      if (!text) return cb()
      if (text.length < 6) return cb(new Error('密码至少 6 位'))
      if (text.trim() !== text) return cb(new Error('密码首尾不能有空格'))
      return cb()
    },
    trigger: 'blur'
  }]
}

function openForm(row) {
  Object.assign(form, row
    ? { staffId: row.staffId, staffName: row.staffName, phone: row.phone, role: row.role, password: '', remark: row.remark || '' }
    : { staffId: null, staffName: '', phone: '', role: 'employee', password: '', remark: '' })
  formOpen.value = true
  setTimeout(() => formRef.value?.clearValidate(), 0)
}

function submitForm() {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    const data = {
      staffName: form.staffName.trim(),
      phone: form.phone.trim(),
      role: form.role,
      remark: form.remark.trim()
    }
    try {
      if (form.staffId) {
        const res = await updateStaff(form.staffId, data)
        ElMessage.success(res.msg || '资料已保存')
        formOpen.value = false
      } else {
        const res = await addStaff({ ...data, password: form.password })
        formOpen.value = false
        ElMessage.success(res.msg || '账号已开通')
        showSecret('账号已开通', res.data, res.data.initialPassword, '初始密码')
      }
      getList()
    } catch (e) {
      // 提示已由请求工具弹出
    } finally {
      saving.value = false
    }
  })
}

// ------------------------------------------------------------------ 停用 / 恢复 / 重置密码 / 删除

function toggleStatus(row) {
  const disabling = row.status === 'active'
  const message = disabling
    ? `停用后 ${row.staffName} 的账号立即退出且不能登录，积分和记录保留，之后可以恢复。确定停用吗？`
    : `恢复后 ${row.staffName} 可以重新登录门店端。确定恢复吗？`
  ElMessageBox.confirm(message, disabling ? '停用账号' : '恢复账号', {
    confirmButtonText: disabling ? '确定停用' : '确定恢复',
    cancelButtonText: '取消',
    type: disabling ? 'warning' : 'info'
  }).then(async () => {
    try {
      const res = await changeStaffStatus(row.staffId, disabling ? 'inactive' : 'active')
      ElMessage.success(res.msg || '已保存')
    } catch (e) {
      // 提示已由请求工具弹出
    }
    getList()
  }).catch(() => {})
}

function resetPassword(row) {
  ElMessageBox.confirm(
    `重置后 ${row.staffName} 的原密码失效、已登录的设备会退出，新密码只显示一次。确定重置吗？`,
    '重置登录密码',
    { confirmButtonText: '确定重置', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    try {
      const res = await resetStaffPassword(row.staffId)
      showSecret('密码已重置', row, res.data && res.data.password, '新密码')
    } catch (e) {
      // 提示已由请求工具弹出
    }
  }).catch(() => {})
}

function remove(row) {
  const extra = row.role === 'manager' ? '' : '，积分不再计入团队，待审核的任务会被取消'
  ElMessageBox.confirm(
    `删除后 ${row.staffName} 立即退出且不能再登录${extra}，删除后不能恢复。确定删除吗？`,
    '删除人员',
    { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
  ).then(async () => {
    try {
      const res = await delStaff(row.staffId)
      ElMessage.success(res.msg || '已删除')
    } catch (e) {
      // 提示已由请求工具弹出
    }
    getList()
  }).catch(() => {})
}

onMounted(getList)
</script>

<style scoped lang="scss">
.staff-table__name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.staff-table__points {
  font-weight: 600;
}

:deep(.staff-table__inactive td.el-table__cell) {
  color: var(--el-text-color-placeholder);
}

.staff-form-dialog__help {
  width: 100%;
}
</style>
