<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="440px"
    append-to-body
    :close-on-click-modal="false"
    class="secret-dialog"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-alert type="warning" :closable="false" show-icon class="esc-dialog-tip" title="请当面告知，关闭后不再显示" />
    <el-descriptions :column="1" border>
      <el-descriptions-item v-for="item in lines" :key="item.label" :label="item.label" label-class-name="secret-dialog__label">
        {{ item.value }}
      </el-descriptions-item>
      <el-descriptions-item :label="secretLabel" label-class-name="secret-dialog__label">
        <span class="esc-secret" data-secret>{{ secret }}</span>
      </el-descriptions-item>
    </el-descriptions>
    <div class="esc-form-help secret-dialog__note">{{ note }}</div>
    <template #footer>
      <el-button icon="DocumentCopy" @click="copy">复制账号和密码</el-button>
      <el-button type="primary" @click="emit('update:modelValue', false)">我已告知，关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '登录信息' },
  // [{ label, value }]
  lines: { type: Array, default: () => [] },
  secretLabel: { type: String, default: '登录密码' },
  secret: { type: String, default: '' },
  note: { type: String, default: '对方用手机号和这个密码登录门店端，登录后可在「我的」中修改密码。' }
})

const emit = defineEmits(['update:modelValue'])

function fallbackCopy(text) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch (e) {
    ok = false
  }
  area.remove()
  return ok
}

async function copy() {
  const text = [...props.lines.map((item) => `${item.label}：${item.value}`), `${props.secretLabel}：${props.secret}`].join('\n')
  let ok = false
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      ok = true
    }
  } catch (e) {
    ok = false
  }
  if (!ok) ok = fallbackCopy(text)
  if (ok) {
    ElMessage.success('已复制，可以粘贴发给对方')
  } else {
    ElMessage.warning('没能自动复制，请手动记下密码')
  }
}
</script>

<style>
.secret-dialog .secret-dialog__label {
  width: 96px;
}

.secret-dialog .secret-dialog__note {
  margin-top: 10px;
}
</style>
