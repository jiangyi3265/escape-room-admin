<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '修改订单' : '录入订单'"
    width="560px"
    append-to-body
    :close-on-click-modal="false"
    class="order-form-dialog"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="init"
  >
    <el-alert
      v-if="isEdit"
      type="info"
      :closable="false"
      show-icon
      class="esc-dialog-tip"
      :title="`订单 ${order.orderNo}：修改后门店端会收到提醒，流程进度和收款不受影响。`"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="88px" @submit.prevent>
      <el-form-item label="主题" prop="themeKey">
        <el-select v-model="form.themeKey" placeholder="请选择主题" filterable style="width: 100%" :loading="themesLoading">
          <el-option v-if="keepOption" :key="KEEP" :label="keepOption" :value="KEEP" />
          <el-option v-for="t in themes" :key="t.themeId" :label="t.themeName" :value="t.themeId" />
        </el-select>
      </el-form-item>
      <el-form-item label="预约时间" prop="time">
        <el-input v-model="form.time" maxlength="20" show-word-limit placeholder="如：周六 15:00、20:30" />
      </el-form-item>
      <el-form-item label="人数" prop="people">
        <el-input-number v-model="form.people" :min="1" :max="99" :step="1" step-strictly controls-position="right" style="width: 160px" />
        <span class="order-form-dialog__unit">人</span>
      </el-form-item>
      <el-form-item label="客户" prop="contact">
        <el-input v-model="form.contact" maxlength="50" show-word-limit placeholder="客户姓名或联系方式（选填）" />
      </el-form-item>
      <el-form-item label="备注" prop="note">
        <el-input v-model="form.note" type="textarea" :rows="3" maxlength="100" show-word-limit placeholder="选填，如：公司团建、有人怕黑" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">{{ isEdit ? '保存修改' : '录入订单' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { addOrder, updateOrder } from '@/api/escape/order'
import { themeOptions } from '@/api/escape/theme'
import { newRequestId } from '../shared'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // 为空表示录入新订单
  order: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'saved'])

const KEEP = '__keep__'
const formRef = ref(null)
const themes = ref([])
const themesLoading = ref(false)
const saving = ref(false)
const keepOption = ref('')
let requestId = ''

const isEdit = computed(() => !!props.order)

const form = reactive({ themeKey: null, time: '', people: 2, contact: '', note: '' })

const rules = {
  themeKey: [{ required: true, message: '请选择主题', trigger: 'change' }],
  time: [
    { required: true, message: '请填写预约时间', trigger: 'blur' },
    { validator: (_, v, cb) => (String(v || '').trim() ? cb() : cb(new Error('请填写预约时间'))), trigger: 'blur' }
  ],
  people: [{ required: true, message: '请填写人数（1 到 99）', trigger: 'change' }]
}

async function loadThemes() {
  themesLoading.value = true
  try {
    const res = await themeOptions()
    themes.value = res.data || []
  } catch (e) {
    themes.value = []
  } finally {
    themesLoading.value = false
  }
}

async function init() {
  requestId = newRequestId()
  keepOption.value = ''
  formRef.value?.clearValidate()
  const o = props.order
  Object.assign(form, {
    themeKey: null,
    time: o ? o.bookTime || '' : '',
    people: o ? Number(o.people) || 1 : 2,
    contact: o ? o.contact || '' : '',
    note: o ? o.note || '' : ''
  })
  await loadThemes()
  if (o) {
    const byId = themes.value.find((t) => o.themeId && t.themeId === o.themeId)
    const byName = themes.value.find((t) => t.themeName === o.themeName)
    if (byId || byName) {
      form.themeKey = (byId || byName).themeId
    } else {
      // 原主题已删除或改名：保留原名称，也可以换成在用主题
      keepOption.value = `${o.themeName}（保持原主题）`
      form.themeKey = KEEP
    }
  }
}

function payload() {
  const data = {
    time: form.time.trim(),
    people: form.people,
    contact: form.contact.trim(),
    note: form.note.trim()
  }
  if (form.themeKey === KEEP) {
    data.theme = props.order.themeName
  } else {
    data.themeId = form.themeKey
  }
  return data
}

function submit() {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    try {
      let res
      if (isEdit.value) {
        res = await updateOrder(props.order.orderId, payload())
      } else {
        res = await addOrder({ ...payload(), requestId })
      }
      ElMessage.success(res.msg || '已保存')
      emit('update:modelValue', false)
      emit('saved', res.data)
    } catch (e) {
      // 提示已由请求工具弹出
    } finally {
      saving.value = false
    }
  })
}
</script>

<style scoped>
.order-form-dialog__unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}
</style>
