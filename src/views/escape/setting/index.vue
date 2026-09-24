<template>
  <div class="app-container esc-page setting-page">
    <div v-loading="loading" class="setting-page__body">
      <div class="esc-card setting-page__card">
        <div class="esc-card__head">
          <div class="esc-card__title">基本设置</div>
        </div>
        <el-form ref="formRef" :model="form" :rules="rules" label-width="84px" class="setting-page__form" @submit.prevent>
          <el-form-item label="门店名称" prop="storeName">
            <el-input v-model="form.storeName" maxlength="30" show-word-limit :disabled="!canEdit" placeholder="如：零零谷 · 九汇城店" />
            <div class="esc-form-help">显示在门店端顶部、消息和本后台的门店概览里；保存后门店端刷新即可看到。</div>
          </el-form-item>
          <el-form-item v-if="canEdit">
            <el-button type="primary" :loading="saving" :disabled="!changed" @click="save">保存</el-button>
            <el-button :disabled="!changed" @click="form.storeName = setting.storeName">还原</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="esc-card setting-page__card">
        <div class="esc-card__head">
          <div class="esc-card__title">门店信息</div>
          <div class="esc-card__extra">以下内容不能在这里修改，如需调整请联系技术支持</div>
        </div>
        <el-descriptions :column="1" border class="setting-page__desc">
          <el-descriptions-item label="门店编码">{{ setting.storeCode || '—' }}</el-descriptions-item>
          <el-descriptions-item label="门店时区">{{ timezoneText }}</el-descriptions-item>
          <el-descriptions-item label="门店当前时间">
            <span class="esc-num">{{ setting.storeTime || '—' }}</span>
            <span class="esc-muted setting-page__note">营业日期、今日积分、每日收款都按门店时间计算</span>
          </el-descriptions-item>
          <el-descriptions-item label="门店端登录有效期">
            {{ setting.loginDays ? `${setting.loginDays} 天` : '—' }}
            <span v-if="setting.loginDays" class="esc-muted setting-page__note">连续 {{ setting.loginDays }} 天没用门店端，就需要重新登录</span>
          </el-descriptions-item>
          <el-descriptions-item label="密码错误锁定规则">
            <template v-if="setting.loginMaxFailures">
              同一手机号连续输错 {{ setting.loginMaxFailures }} 次，锁定 {{ setting.loginLockMinutes }} 分钟
            </template>
            <span v-else>—</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getSetting, updateSetting } from '@/api/escape/setting'
import { can, rememberStoreToday } from '../shared'

defineOptions({ name: 'EscSetting' })

const TIME_ZONES = {
  'Asia/Shanghai': '北京时间',
  'Asia/Chongqing': '北京时间',
  'Asia/Hong_Kong': '香港时间',
  'Asia/Macau': '澳门时间',
  'Asia/Taipei': '台北时间',
  'Asia/Urumqi': '新疆时间'
}

const canEdit = can('escape:setting:edit')
const loading = ref(false)
const saving = ref(false)
const formRef = ref(null)
const setting = reactive({})
const form = reactive({ storeName: '' })

const changed = computed(() => form.storeName.trim() !== (setting.storeName || '') && form.storeName.trim() !== '')

const timezoneText = computed(() => {
  const zone = setting.timezone
  if (!zone) return '—'
  return TIME_ZONES[zone] ? `${TIME_ZONES[zone]}（${zone}）` : zone
})

const rules = {
  storeName: [{
    validator: (_, v, cb) => (String(v || '').trim() ? cb() : cb(new Error('请填写门店名称'))),
    trigger: 'blur'
  }]
}

async function load() {
  loading.value = true
  try {
    const res = await getSetting()
    Object.assign(setting, res.data || {})
    form.storeName = setting.storeName || ''
    rememberStoreToday(setting.storeDate)
  } catch (e) {
    // 提示已由请求工具弹出
  } finally {
    loading.value = false
  }
}

function save() {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    try {
      const res = await updateSetting({ storeName: form.storeName.trim() })
      ElMessage.success(res.msg || '门店设置已保存')
      await load()
    } catch (e) {
      // 提示已由请求工具弹出
    } finally {
      saving.value = false
    }
  })
}

onMounted(load)
</script>

<style scoped lang="scss">
.setting-page__body {
  max-width: 820px;
  min-height: 200px;
}

.setting-page__card {
  margin-bottom: 16px;
}

.setting-page__form {
  max-width: 560px;
}

.setting-page__desc {
  :deep(.el-descriptions__label) {
    width: 160px;
  }
}

.setting-page__note {
  margin-left: 10px;
  font-size: 12px;
}
</style>
