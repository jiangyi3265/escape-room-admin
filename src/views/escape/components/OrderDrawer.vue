<template>
  <div class="order-drawer-host">
    <el-drawer
      :model-value="modelValue"
      size="760px"
      append-to-body
      class="order-drawer"
      @update:model-value="(v) => emit('update:modelValue', v)"
      @open="load(true)"
      @closed="detail = null"
    >
      <template #header>
        <div class="order-drawer__head">
          <div class="order-drawer__title">
            <span>订单详情</span>
            <el-tag v-if="detail" :type="statusTag.type" effect="light" round>{{ statusTag.label }}</el-tag>
          </div>
          <div v-if="detail" class="order-drawer__sub">{{ joinText([detail.orderNo, detail.themeName, detail.bookTime]) }}</div>
        </div>
      </template>

      <div v-loading="loading && !detail" class="order-drawer__body">
        <template v-if="detail">
          <div v-if="hasAnyAction" class="order-drawer__actions">
            <el-button v-if="canAdvance" type="primary" :icon="advanceIcon" :loading="busy" @click="advance">{{ advanceText }}</el-button>
            <el-button v-if="canEdit" icon="Edit" @click="editOpen = true">修改订单</el-button>
            <el-button v-if="canCorrect" icon="RefreshLeft" @click="openCorrect">修正节点</el-button>
            <el-button v-if="canCancel" type="warning" plain icon="CircleClose" @click="doCancel">取消订单</el-button>
            <el-button v-if="canRemove" type="danger" plain icon="Delete" @click="doRemove">删除订单</el-button>
          </div>

          <el-alert
            v-if="detail.deleted"
            type="info"
            :closable="false"
            show-icon
            class="order-drawer__state"
            title="这笔订单已删除，只能查看记录"
            :description="joinText([detail.deletedBy && `删除人：${detail.deletedBy}`, detail.deletedAt && `删除时间：${timeText(detail.deletedAt)}`], '　')"
          />
          <el-alert
            v-if="detail.cancelled"
            type="warning"
            :closable="false"
            show-icon
            class="order-drawer__state"
            :title="`订单已取消：${detail.cancelReason || '未填写原因'}`"
            :description="joinText([detail.cancelledBy && `取消人：${detail.cancelledBy}`, detail.cancelledAt && `取消时间：${timeText(detail.cancelledAt)}`], '　')"
          />
          <el-alert
            v-else-if="detail.flowStatus === 'done' && !detail.deleted"
            type="success"
            :closable="false"
            show-icon
            class="order-drawer__state"
            title="订单已完成"
            :description="detail.finishedAt ? `完成时间：${timeText(detail.finishedAt)}` : ''"
          />

          <section class="esc-section">
            <div class="esc-section__title">基本信息</div>
            <el-descriptions :column="2" border size="default" class="order-drawer__desc">
              <el-descriptions-item label="订单编号">{{ detail.orderNo }}</el-descriptions-item>
              <el-descriptions-item label="营业日期">{{ detail.bookDate }}</el-descriptions-item>
              <el-descriptions-item label="主题">{{ detail.themeName }}</el-descriptions-item>
              <el-descriptions-item label="预约时间">{{ detail.bookTime }}</el-descriptions-item>
              <el-descriptions-item label="人数">{{ detail.people }} 人</el-descriptions-item>
              <el-descriptions-item label="客户">
                <span v-if="detail.contact">{{ detail.contact }}</span>
                <span v-else class="esc-placeholder">未填写</span>
              </el-descriptions-item>
              <el-descriptions-item label="创建人">{{ detail.creatorName }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ timeText(detail.createdAt) }}</el-descriptions-item>
              <el-descriptions-item label="当前进度">
                {{ detail.statusText }}
                <span class="esc-muted">（{{ detail.doneCount }}/{{ detail.totalCount }}）</span>
              </el-descriptions-item>
              <el-descriptions-item label="最近操作">{{ joinText([detail.updateBy, timeText(detail.lastActionAt)]) }}</el-descriptions-item>
              <el-descriptions-item label="备注" :span="2">
                <span v-if="detail.note" class="order-drawer__note">{{ detail.note }}</span>
                <span v-else class="esc-placeholder">无</span>
              </el-descriptions-item>
            </el-descriptions>
          </section>

          <section class="esc-section">
            <div class="esc-section__title">
              <span>流程进度</span>
              <span class="esc-section__extra">灰色对勾为已完成，蓝色为当前要做的一步</span>
            </div>
            <el-timeline class="order-flow">
              <el-timeline-item
                v-for="step in detail.timeline"
                :key="step.key"
                :class="stepClass(step)"
                :type="step.current ? 'primary' : undefined"
                :color="step.done ? 'var(--el-text-color-placeholder)' : undefined"
                :icon="step.done ? 'Check' : undefined"
                :hollow="!step.done && !step.current"
                :size="step.done || step.current ? 'large' : 'normal'"
                hide-timestamp
              >
                <div class="order-flow__step">
                  <div class="order-flow__main">
                    <span class="order-flow__label">{{ step.label }}</span>
                    <el-tag v-if="step.current" size="small" type="primary" effect="dark">当前</el-tag>
                    <el-tag v-if="step.choice" size="small" :type="step.current ? 'primary' : 'info'" effect="plain">{{ step.choice }}</el-tag>
                  </div>
                  <div v-if="step.done" class="order-flow__meta">
                    {{ step.operatorName }}<span v-if="step.operatorType === 'admin'">（管理后台）</span> · {{ timeText(step.doneAt) }}
                  </div>
                  <div v-else-if="step.note" class="order-flow__meta">{{ step.note }}</div>
                  <div v-else-if="step.branch && step.current" class="order-flow__meta">需要选择：{{ (step.key === 'photo' ? PHOTO_CHOICES : VIDEO_CHOICES).join(' / ') }}</div>
                </div>
              </el-timeline-item>
            </el-timeline>
          </section>

          <section class="esc-section">
            <div class="esc-section__title">
              <span>节点记录</span>
              <span class="esc-section__extra">共 {{ detail.records.length }} 条，已回退的记录也会保留</span>
            </div>
            <el-table :data="detail.records" size="small" border :row-class-name="recordRowClass">
              <template #empty><span class="esc-muted">还没有完成任何节点</span></template>
              <el-table-column label="节点" min-width="108">
                <template #default="{ row }">
                  {{ row.label }}
                  <div v-if="row.choice" class="esc-cell-sub">{{ row.choice }}</div>
                </template>
              </el-table-column>
              <el-table-column label="操作人" min-width="96">
                <template #default="{ row }">
                  {{ row.operatorName }}
                  <div class="esc-cell-sub">{{ row.operatorTypeText }}</div>
                </template>
              </el-table-column>
              <el-table-column label="完成时间" min-width="130">
                <template #default="{ row }">{{ timeText(row.doneAt) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="84" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.revoked" type="info" size="small">已回退</el-tag>
                  <el-tag v-else type="success" size="small">有效</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="回退说明" min-width="170">
                <template #default="{ row }">
                  <template v-if="row.revoked">
                    <div>{{ row.revokeReason || '未填写原因' }}</div>
                    <div class="esc-cell-sub">{{ joinText([row.revokedBy, timeText(row.revokedAt)]) }}</div>
                  </template>
                  <span v-else class="esc-placeholder">—</span>
                </template>
              </el-table-column>
            </el-table>
          </section>

          <section class="esc-section">
            <div class="esc-section__title">
              <span>收款详情</span>
              <span v-if="receipt" class="esc-section__extra">三项合计 = 微信 + 支付宝 + 现金，线上单独记录</span>
            </div>
            <template v-if="receipt">
              <div class="order-pay" :class="{ 'is-reversed': receipt.status === 'reversed' }">
                <div v-for="c in channels" :key="c.key" class="order-pay__cell">
                  <div class="order-pay__label">{{ c.label }}</div>
                  <div class="order-pay__value esc-num">{{ yuan(receipt[c.key]) }}</div>
                </div>
                <div class="order-pay__cell is-total">
                  <div class="order-pay__label">三项合计</div>
                  <div class="order-pay__value esc-num">{{ yuan(receipt.total) }}</div>
                </div>
                <div class="order-pay__cell">
                  <div class="order-pay__label">线上（不计入合计）</div>
                  <div class="order-pay__value esc-num">{{ yuan(receipt.online) }}</div>
                </div>
              </div>
              <el-descriptions :column="2" border size="small" class="order-drawer__desc">
                <el-descriptions-item label="收款状态">
                  <el-tag :type="receipt.status === 'reversed' ? 'danger' : 'success'" size="small">{{ receipt.statusText }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="收款日期">{{ receipt.receiptDate }}</el-descriptions-item>
                <el-descriptions-item label="登记人">{{ receipt.operatorName }}</el-descriptions-item>
                <el-descriptions-item label="登记时间">{{ timeText(receipt.receivedAt) }}</el-descriptions-item>
                <el-descriptions-item v-if="receipt.adjustedAt" label="最近修改" :span="2">
                  {{ joinText([receipt.adjustedBy, timeText(receipt.adjustedAt)]) }}
                </el-descriptions-item>
                <el-descriptions-item v-if="receipt.status === 'reversed'" label="冲正说明" :span="2">
                  {{ receipt.reverseReason || '已冲正' }}
                  <span class="esc-muted">（{{ joinText([receipt.reversedBy, timeText(receipt.reversedAt)]) }}）</span>
                </el-descriptions-item>
              </el-descriptions>
              <div class="order-drawer__sub-title">修改记录（{{ receipt.revisions.length }}）</div>
              <RevisionTable v-if="receipt.revisions.length" :revisions="receipt.revisions" />
              <div v-else class="esc-muted order-drawer__plain">收款金额没有修改过</div>
            </template>
            <div v-else class="esc-muted order-drawer__plain">还没有登记收款</div>
          </section>

          <section class="esc-section">
            <div class="esc-section__title">剪辑任务</div>
            <el-table v-if="detail.editTasks.length" :data="detail.editTasks" size="small" border>
              <el-table-column label="状态" width="90" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'pending' ? 'warning' : row.status === 'completed' ? 'success' : 'info'">{{ row.statusText }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="生成" min-width="150">
                <template #default="{ row }">{{ joinText([row.createdBy, timeText(row.createdAt)]) }}</template>
              </el-table-column>
              <el-table-column label="剪辑完成" min-width="150">
                <template #default="{ row }">
                  <span v-if="row.completedAt">{{ joinText([row.completedBy, timeText(row.completedAt)]) }}</span>
                  <span v-else class="esc-placeholder">—</span>
                </template>
              </el-table-column>
              <el-table-column label="取消时间" min-width="130">
                <template #default="{ row }">
                  <span v-if="row.cancelledAt">{{ timeText(row.cancelledAt) }}</span>
                  <span v-else class="esc-placeholder">—</span>
                </template>
              </el-table-column>
            </el-table>
            <div v-else class="esc-muted order-drawer__plain">
              {{ detail.videoChoice === '不要视频' ? '客人不要视频，不需要剪辑' : '暂无剪辑任务（选择「要视频」后会自动生成）' }}
            </div>
          </section>

          <section class="esc-section">
            <div class="esc-section__title">
              <span>操作记录</span>
              <span class="esc-section__extra">{{ canSeeReceiptLogs ? '含收款的登记与修改，最近 50 条' : '最近 50 条' }}</span>
            </div>
            <el-table v-if="detail.logs.length" :data="detail.logs" size="small" border>
              <el-table-column label="时间" width="138">
                <template #default="{ row }">{{ timeText(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="操作人" width="110">
                <template #default="{ row }">
                  {{ row.actorName }}
                  <div class="esc-cell-sub">{{ row.actorTypeText }}</div>
                </template>
              </el-table-column>
              <el-table-column label="操作" prop="action" width="110" />
              <el-table-column label="内容" prop="summary" min-width="200" />
            </el-table>
            <div v-else class="esc-muted order-drawer__plain">暂无操作记录</div>
          </section>
        </template>
      </div>
    </el-drawer>

    <OrderFormDialog v-model="editOpen" :order="detail" @saved="afterChange" />

    <!-- 登记收款 -->
    <el-dialog v-model="payOpen" :title="hasActiveReceipt ? '修改收款金额' : '登记收款'" width="520px" append-to-body :close-on-click-modal="false" class="order-pay-dialog">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="esc-dialog-tip"
        :title="hasActiveReceipt ? '这笔订单已登记过收款，保存后会修改原收款金额，并留下修改记录。' : '按实际收到的金额填写，至少填一项；线上金额单独记录，不计入三项合计。'"
      />
      <el-form ref="payFormRef" :model="payForm" label-width="72px" @submit.prevent>
        <div class="order-pay-dialog__grid">
          <el-form-item v-for="c in PAY_CHANNELS" :key="c.key" :label="c.label" :prop="c.key" :rules="amountRules">
            <el-input v-model="payForm[c.key]" placeholder="0.00" maxlength="12" clearable :data-channel="c.key">
              <template #prefix>¥</template>
            </el-input>
          </el-form-item>
        </div>
      </el-form>
      <div class="order-pay-dialog__total">
        <div>
          <span class="esc-muted">三项合计</span>
          <strong class="esc-num" data-pay-total>{{ payPreview.total }}</strong>
        </div>
        <div class="esc-muted">线上（不计入合计）<span class="esc-num">{{ payPreview.online }}</span></div>
      </div>
      <template #footer>
        <el-button @click="payOpen = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitPayment">{{ hasActiveReceipt ? '保存修改' : '确认收款' }}</el-button>
      </template>
    </el-dialog>

    <!-- 拍照 / 视频选择 -->
    <el-dialog v-model="choiceOpen" :title="`记录${choiceStep.label || ''}`" width="460px" append-to-body :close-on-click-modal="false" class="order-choice-dialog">
      <div class="esc-hint order-choice-dialog__hint">{{ choiceStep.key === 'video' ? '选「要视频」会生成剪辑任务，剪辑完毕后订单才算完成；选「不要视频」订单直接完成。' : '记录客人是否需要拍照。' }}</div>
      <el-radio-group v-model="choiceValue" class="order-choice-dialog__options">
        <el-radio v-for="option in choiceOptions" :key="option" :value="option" border size="large">{{ option }}</el-radio>
      </el-radio-group>
      <template #footer>
        <el-button @click="choiceOpen = false">取消</el-button>
        <el-button type="primary" :loading="busy" :disabled="!choiceValue" @click="submitChoice">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修正节点 -->
    <el-dialog v-model="correctOpen" title="修正流程节点" width="520px" append-to-body :close-on-click-modal="false" class="order-correct-dialog">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        class="esc-dialog-tip"
        title="回退后，所选节点和它之后已完成的节点都会作废（记录保留），需要重新完成。"
        description="回退到「收钱」可以重新填写收款金额；回退「视频选择」会取消还没完成的剪辑任务。"
      />
      <el-form ref="correctFormRef" :model="correctForm" :rules="correctRules" label-width="84px" @submit.prevent>
        <el-form-item label="回退到" prop="target">
          <el-select v-model="correctForm.target" placeholder="选择要重新做的节点" style="width: 100%">
            <el-option v-for="step in doneSteps" :key="step.key" :label="step.label" :value="step.key">
              <span>{{ step.label }}</span>
              <span class="order-correct-dialog__opt">{{ joinText([step.operatorName, timeText(step.doneAt)]) }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="修正原因" prop="reason">
          <el-input v-model="correctForm.reason" type="textarea" :rows="3" maxlength="100" show-word-limit placeholder="如：收款金额录错、误点了开始游戏" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="correctOpen = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitCorrect">确认回退</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cancelOrder, completeOrderStep, correctOrder, delOrder, getOrder, recordOrderPayment } from '@/api/escape/order'
import OrderFormDialog from './OrderFormDialog.vue'
import RevisionTable from './RevisionTable.vue'
import {
  FLOW_STATUS, PAY_CHANNELS, PHOTO_CHOICES, VIDEO_CHOICES,
  amountError, can, centsToInput, inputToCents, joinText, labelOf, tagTypeOf, timeText, yuan
} from '../shared'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  orderId: { type: [Number, String], default: null }
})

const emit = defineEmits(['update:modelValue', 'changed'])

const detail = ref(null)
const loading = ref(false)
const busy = ref(false)
const editOpen = ref(false)
let loadSeq = 0

const channels = PAY_CHANNELS.filter((c) => c.key !== 'online')

async function load(fresh = false) {
  if (!props.orderId) return
  const mine = ++loadSeq
  if (fresh && detail.value && detail.value.orderId !== Number(props.orderId)) detail.value = null
  loading.value = true
  try {
    const res = await getOrder(props.orderId)
    // 订单详情里已合并了这张订单收款的登记与修改记录
    if (mine === loadSeq) detail.value = res.data
  } catch (e) {
    if (mine === loadSeq && !detail.value) emit('update:modelValue', false)
  } finally {
    if (mine === loadSeq) loading.value = false
  }
}

watch(() => props.orderId, () => {
  if (props.modelValue) load(true)
})

async function afterChange() {
  await load()
  emit('changed')
}

// ------------------------------------------------------------------ 状态

const receipt = computed(() => detail.value && detail.value.receiptDetail)
const hasActiveReceipt = computed(() => !!receipt.value && receipt.value.status === 'active')
const isClosed = computed(() => !detail.value || detail.value.deleted || detail.value.cancelled)
const nextStep = computed(() => detail.value && detail.value.nextStep)
const nextTimelineStep = computed(() => (detail.value ? detail.value.timeline.find((s) => s.current) : null))
const doneSteps = computed(() => (detail.value ? detail.value.timeline.filter((s) => s.done) : []))

const statusTag = computed(() => {
  const d = detail.value
  if (!d) return { label: '', type: 'info' }
  if (d.deleted) return { label: '已删除', type: 'info' }
  return { label: labelOf(FLOW_STATUS, d.flowStatus, d.flowStatusText), type: tagTypeOf(FLOW_STATUS, d.flowStatus) }
})

const canAdvance = computed(() => can('escape:order:edit') && !isClosed.value && !!nextTimelineStep.value)
const canEdit = computed(() => can('escape:order:edit') && !isClosed.value)
const canCorrect = computed(() => can('escape:order:correct') && !isClosed.value && doneSteps.value.length > 0)
const canCancel = computed(() => can('escape:order:cancel') && !isClosed.value)
const canRemove = computed(() => can('escape:order:remove') && detail.value && !detail.value.deleted)
const hasAnyAction = computed(() => canAdvance.value || canEdit.value || canCorrect.value || canCancel.value || canRemove.value)

const advanceText = computed(() => {
  const step = nextTimelineStep.value
  if (!step) return ''
  const special = { start: '开始订单', payment: hasActiveReceipt.value ? '重新确认收款' : '登记收款', photo: '记录拍照选择', video: '记录视频选择', edit: '确认剪辑完毕' }
  return special[step.key] || `完成「${step.label}」`
})

const advanceIcon = computed(() => {
  const key = nextStep.value
  if (key === 'payment') return 'Money'
  if (key === 'photo') return 'Camera'
  if (key === 'video') return 'VideoCamera'
  return 'Select'
})

function stepClass(step) {
  return step.done ? 'is-done' : step.current ? 'is-current' : 'is-pending'
}

function recordRowClass({ row }) {
  return row.revoked ? 'is-revoked' : ''
}

// ------------------------------------------------------------------ 推进节点

function advance() {
  const step = nextTimelineStep.value
  if (!step) return
  if (step.key === 'payment') return openPayment()
  if (step.branch) return openChoice(step)
  const message = step.key === 'start'
    ? `确定开始这笔订单（代为「点击主题名称」）吗？`
    : `确定代为完成「${step.label}」吗？`
  ElMessageBox.confirm(`${message}完成后门店端会同步看到，记录里会标明是管理后台操作。`, advanceText.value, {
    confirmButtonText: '确定完成',
    cancelButtonText: '取消',
    type: 'info'
  }).then(async () => {
    busy.value = true
    try {
      const res = await completeOrderStep(detail.value.orderId, step.key)
      ElMessage.success(res.msg || '已完成')
      await afterChange()
    } catch (e) {
      await load()
    } finally {
      busy.value = false
    }
  }).catch(() => {})
}

// 拍照 / 视频
const choiceOpen = ref(false)
const choiceStep = ref({})
const choiceValue = ref('')
const choiceOptions = computed(() => (choiceStep.value.key === 'video' ? VIDEO_CHOICES : PHOTO_CHOICES))

function openChoice(step) {
  choiceStep.value = step
  choiceValue.value = ''
  choiceOpen.value = true
}

async function submitChoice() {
  if (!choiceValue.value) return
  busy.value = true
  try {
    const res = await completeOrderStep(detail.value.orderId, choiceStep.value.key, choiceValue.value)
    ElMessage.success(res.msg || '已记录')
    choiceOpen.value = false
    await afterChange()
  } catch (e) {
    await load()
  } finally {
    busy.value = false
  }
}

// 收钱
const payOpen = ref(false)
const payFormRef = ref(null)
const payForm = reactive({ wechat: '', alipay: '', cash: '', online: '' })

const amountRules = [{
  validator: (_, value, callback) => {
    const error = amountError(value)
    return error ? callback(new Error(error)) : callback()
  },
  trigger: 'blur'
}]

const payPreview = computed(() => {
  const cents = (key) => {
    const v = inputToCents(payForm[key])
    return Number.isNaN(v) ? 0 : v
  }
  return {
    total: yuan(cents('wechat') + cents('alipay') + cents('cash')),
    online: yuan(cents('online'))
  }
})

function openPayment() {
  const r = hasActiveReceipt.value ? receipt.value : null
  for (const c of PAY_CHANNELS) {
    payForm[c.key] = r ? centsToInput(r[c.key]) : ''
  }
  payOpen.value = true
  setTimeout(() => payFormRef.value?.clearValidate(), 0)
}

function submitPayment() {
  payFormRef.value.validate(async (valid) => {
    if (!valid) return
    const values = PAY_CHANNELS.map((c) => inputToCents(payForm[c.key]))
    if (!values.some((v) => v > 0)) {
      ElMessage.warning('请至少填写一项大于 0 的收款金额')
      return
    }
    busy.value = true
    try {
      const data = {}
      for (const c of PAY_CHANNELS) data[c.key] = String(payForm[c.key] || '').trim()
      const res = await recordOrderPayment(detail.value.orderId, data)
      ElMessage.success(`${res.msg || '收款已登记'}，三项合计 ${yuan(res.data && res.data.total)}`)
      payOpen.value = false
      await afterChange()
    } catch (e) {
      await load()
    } finally {
      busy.value = false
    }
  })
}

// ------------------------------------------------------------------ 修正 / 取消 / 删除

const correctOpen = ref(false)
const correctFormRef = ref(null)
const correctForm = reactive({ target: '', reason: '' })
const correctRules = {
  target: [{ required: true, message: '请选择要回退到的节点', trigger: 'change' }],
  reason: [
    { required: true, message: '请填写修正原因', trigger: 'blur' },
    { validator: (_, v, cb) => (String(v || '').trim() ? cb() : cb(new Error('请填写修正原因'))), trigger: 'blur' }
  ]
}

function openCorrect() {
  correctForm.target = ''
  correctForm.reason = ''
  correctOpen.value = true
  setTimeout(() => correctFormRef.value?.clearValidate(), 0)
}

function submitCorrect() {
  correctFormRef.value.validate(async (valid) => {
    if (!valid) return
    busy.value = true
    try {
      const res = await correctOrder(detail.value.orderId, correctForm.target, correctForm.reason.trim())
      ElMessage.success(res.msg || '节点已回退')
      correctOpen.value = false
      await afterChange()
    } catch (e) {
      await load()
    } finally {
      busy.value = false
    }
  })
}

function moneyWarning(action) {
  if (!hasActiveReceipt.value) return ''
  const r = receipt.value
  const online = r.online > 0 ? `（另有线上 ${yuan(r.online)}）` : ''
  return `这笔订单已收款 ${yuan(r.total)}${online}，${action}后收款会自动冲正，不再计入收款合计。`
}

function doCancel() {
  const d = detail.value
  const warning = moneyWarning('取消')
  ElMessageBox.prompt(
    `${warning || '取消后门店端不能再继续这笔订单。'}可以填写取消原因（选填）。`,
    `取消订单 ${d.orderNo}`,
    {
      confirmButtonText: '确定取消订单',
      cancelButtonText: '先不取消',
      type: 'warning',
      inputPlaceholder: '如：客户改期',
      inputValidator: (v) => !v || v.trim().length <= 100 || '取消原因不能超过100字'
    }
  ).then(async ({ value }) => {
    busy.value = true
    try {
      const res = await cancelOrder(d.orderId, (value || '').trim())
      ElMessage.success(res.msg || '订单已取消')
      await afterChange()
    } catch (e) {
      await load()
    } finally {
      busy.value = false
    }
  }).catch(() => {})
}

function doRemove() {
  const d = detail.value
  const warning = moneyWarning('删除')
  ElMessageBox.confirm(
    `删除后订单会移到「已删除」里，记录仍然保留。${warning}确定删除订单 ${d.orderNo} 吗？`,
    '删除订单',
    { confirmButtonText: '确定删除', cancelButtonText: '先不删除', type: 'warning', confirmButtonClass: 'el-button--danger' }
  ).then(async () => {
    busy.value = true
    try {
      const res = await delOrder(d.orderId)
      ElMessage.success(res.msg || '订单已删除')
      await afterChange()
    } catch (e) {
      await load()
    } finally {
      busy.value = false
    }
  }).catch(() => {})
}
</script>

<style lang="scss">
.order-drawer {
  .el-drawer__header {
    margin-bottom: 0;
    padding: 16px 20px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .el-drawer__body {
    padding: 16px 20px 24px;
  }
}

.order-drawer__head {
  min-width: 0;
}

.order-drawer__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.order-drawer__sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.order-drawer__body {
  min-height: 200px;
}

.order-drawer__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
  padding: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);

  .el-button + .el-button {
    margin-left: 0;
  }
}

.order-drawer__state {
  margin-bottom: 14px;
}

.order-drawer__desc {
  .el-descriptions__label {
    width: 96px;
    white-space: nowrap;
  }
}

.order-drawer__note {
  white-space: pre-wrap;
}

.order-drawer__sub-title {
  margin: 14px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.order-drawer__plain {
  font-size: 13px;
  padding: 4px 0;
}

.order-flow {
  padding: 4px 0 0 4px;

  .el-timeline-item {
    padding-bottom: 14px;
  }

  .el-timeline-item__wrapper {
    top: -2px;
  }

  .order-flow__step {
    padding: 2px 0;
  }

  .order-flow__main {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .order-flow__label {
    font-size: 14px;
    color: var(--el-text-color-primary);
  }

  .order-flow__meta {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .is-done .order-flow__label {
    color: var(--el-text-color-regular);
  }

  .is-current .order-flow__step {
    margin: -4px 0 0 -6px;
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--el-color-primary-light-9);
  }

  .is-current .order-flow__label {
    font-weight: 600;
    color: var(--el-color-primary);
  }

  .is-pending .order-flow__label {
    color: var(--el-text-color-placeholder);
  }
}

.el-table .is-revoked td.el-table__cell {
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
}

.order-pay {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;

  .order-pay__cell {
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
  }

  .order-pay__cell.is-total {
    background: var(--el-color-primary-light-9);
  }

  .order-pay__label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .order-pay__value {
    margin-top: 4px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &.is-reversed .order-pay__value {
    text-decoration: line-through;
    color: var(--el-text-color-placeholder);
  }
}

.order-pay-dialog {
  .order-pay-dialog__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 16px;
  }

  .order-pay-dialog__total {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 6px;
    background: var(--el-fill-color-light);

    strong {
      margin-left: 8px;
      font-size: 22px;
      color: var(--el-text-color-primary);
    }
  }
}

.order-choice-dialog {
  .order-choice-dialog__hint {
    margin-bottom: 16px;
  }

  .order-choice-dialog__options {
    display: flex;
    gap: 12px;

    .el-radio {
      flex: 1;
      margin-right: 0;
      justify-content: center;
    }
  }
}

.order-correct-dialog__opt {
  float: right;
  margin-left: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
