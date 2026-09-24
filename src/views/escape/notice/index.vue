<template>
  <div class="app-container esc-page notice-page">
    <el-form :model="query" inline @submit.prevent>
      <el-form-item label="类型">
        <el-select v-model="query.category" placeholder="全部" clearable style="width: 130px" @change="search">
          <el-option v-for="t in NOTICE_TYPES" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="接收范围">
        <el-select v-model="query.audience" placeholder="全部" clearable style="width: 150px" @change="search">
          <el-option v-for="a in NOTICE_AUDIENCES" :key="a.value" :label="a.label" :value="a.value" />
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
        <el-input v-model="query.keyword" placeholder="标题 / 内容 / 触发人" clearable style="width: 170px" @keyup.enter="search" @clear="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="reset()">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <el-button type="primary" icon="Promotion" @click="openSend" v-hasPermi="['escape:notice:add']">发送通知</el-button>
        <span class="esc-hint">门店端的所有消息都在这里；点「已读 / 接收」可以看到谁看过</span>
      </div>
      <div class="esc-toolbar__right">
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" row-key="noticeId" class="notice-table">
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" description="没有符合条件的消息" />
      </template>
      <el-table-column label="时间" width="140">
        <template #default="{ row }"><span class="esc-num">{{ timeText(row.createdAt) }}</span></template>
      </el-table-column>
      <el-table-column label="类型" width="104" align="center">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="tagTypeOf(NOTICE_TYPES, row.type)">{{ row.typeText || labelOf(NOTICE_TYPES, row.type, '其他') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="标题" prop="title" width="140" show-overflow-tooltip />
      <el-table-column label="内容" prop="detail" min-width="220" show-overflow-tooltip />
      <el-table-column label="接收范围" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.audienceText || labelOf(NOTICE_AUDIENCES, row.audience) }}</template>
      </el-table-column>
      <el-table-column label="已读 / 接收" width="100" align="center">
        <template #default="{ row }">
          <el-button link type="primary" class="esc-num" @click="openReceipts(row)">{{ row.readCount }} / {{ row.recipientCount }}</el-button>
        </template>
      </el-table-column>
      <el-table-column label="触发人" width="100" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.actorName">{{ row.actorName }}</span>
          <span v-else class="esc-placeholder">系统</span>
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

    <!-- 已读情况 -->
    <el-dialog v-model="receiptOpen" title="接收与已读情况" width="520px" append-to-body class="notice-receipt-dialog">
      <template v-if="receiptNotice">
        <div class="notice-receipt-dialog__head">
          <div class="notice-receipt-dialog__title">{{ receiptNotice.title }}</div>
          <div class="esc-hint">{{ receiptNotice.detail }}</div>
          <div class="notice-receipt-dialog__count">
            共 {{ receipts.length }} 人接收，已读 <strong>{{ readTotal }}</strong> 人，未读 {{ receipts.length - readTotal }} 人
          </div>
        </div>
        <el-table v-loading="receiptLoading" :data="receipts" size="small" border max-height="360">
          <template #empty><span class="esc-muted">没有接收人</span></template>
          <el-table-column label="姓名" prop="staffName" min-width="110" />
          <el-table-column label="身份" width="80" align="center">
            <template #default="{ row }">{{ row.roleText }}</template>
          </el-table-column>
          <el-table-column label="已读时间" min-width="150">
            <template #default="{ row }">
              <span v-if="row.readAt" class="esc-num">{{ timeText(row.readAt) }}</span>
              <el-tag v-else size="small" type="warning" effect="plain">未读</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <template #footer>
        <el-button type="primary" @click="receiptOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 发送通知 -->
    <el-dialog v-model="sendOpen" title="发送门店通知" width="520px" append-to-body :close-on-click-modal="false" class="notice-send-dialog">
      <el-alert type="info" :closable="false" show-icon class="esc-dialog-tip" title="通知会出现在门店端的消息里，发出后不能撤回。" />
      <el-form ref="sendRef" :model="sendForm" :rules="sendRules" label-width="72px" @submit.prevent>
        <el-form-item label="标题" prop="title">
          <el-input v-model="sendForm.title" maxlength="20" show-word-limit placeholder="如：周五消防检查" />
        </el-form-item>
        <el-form-item label="内容" prop="detail">
          <el-input v-model="sendForm.detail" type="textarea" :rows="4" maxlength="200" show-word-limit placeholder="写清楚要大家知道或要做的事" />
        </el-form-item>
        <el-form-item label="发给" prop="scope">
          <el-radio-group v-model="sendForm.scope">
            <el-radio v-for="s in NOTICE_SCOPES" :key="s.value" :value="s.value">{{ s.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sendOpen = false">取消</el-button>
        <el-button type="primary" :loading="sending" @click="submitSend">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getNoticeReceipts, listNotice, sendNotice } from '@/api/escape/notice'
import {
  DATE_SHORTCUTS, NOTICE_AUDIENCES, NOTICE_SCOPES, NOTICE_TYPES, labelOf, tagTypeOf, timeText, useListPage
} from '../shared'

defineOptions({ name: 'EscNotice' })

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(listNotice, {
  category: '',
  audience: '',
  keyword: '',
  dateRange: []
})

// ------------------------------------------------------------------ 已读情况

const receiptOpen = ref(false)
const receiptLoading = ref(false)
const receiptNotice = ref(null)
const receipts = ref([])
const readTotal = computed(() => receipts.value.filter((r) => r.readAt).length)

async function openReceipts(row) {
  receiptNotice.value = row
  receipts.value = []
  receiptOpen.value = true
  receiptLoading.value = true
  try {
    const res = await getNoticeReceipts(row.noticeId)
    receipts.value = res.data || []
  } catch (e) {
    receiptOpen.value = false
  } finally {
    receiptLoading.value = false
  }
}

// ------------------------------------------------------------------ 发送

const sendOpen = ref(false)
const sending = ref(false)
const sendRef = ref(null)
const sendForm = reactive({ title: '', detail: '', scope: 'all' })

const notBlank = (message) => ({
  validator: (_, v, cb) => (String(v || '').trim() ? cb() : cb(new Error(message))),
  trigger: 'blur'
})

const sendRules = {
  title: [notBlank('请填写通知标题')],
  detail: [notBlank('请填写通知内容')],
  scope: [{ required: true, message: '请选择发给谁', trigger: 'change' }]
}

function openSend() {
  Object.assign(sendForm, { title: '', detail: '', scope: 'all' })
  sendOpen.value = true
  setTimeout(() => sendRef.value?.clearValidate(), 0)
}

function submitSend() {
  sendRef.value.validate(async (valid) => {
    if (!valid) return
    sending.value = true
    try {
      const res = await sendNotice({ title: sendForm.title.trim(), detail: sendForm.detail.trim(), scope: sendForm.scope })
      ElMessage.success(res.msg || '通知已发送')
      sendOpen.value = false
      search()
    } catch (e) {
      // 提示已由请求工具弹出
    } finally {
      sending.value = false
    }
  })
}

onMounted(getList)
</script>

<style scoped lang="scss">
.notice-receipt-dialog__head {
  margin-bottom: 12px;
}

.notice-receipt-dialog__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--el-text-color-primary);
}

.notice-receipt-dialog__count {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);

  strong {
    color: var(--el-color-success);
  }
}
</style>
