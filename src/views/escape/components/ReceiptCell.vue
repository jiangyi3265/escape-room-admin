<template>
  <div class="receipt-cell">
    <template v-if="receipt">
      <el-tooltip placement="top" :content="breakdown">
        <span class="esc-num receipt-cell__total" :class="{ 'esc-strike': reversed }">{{ yuan(receipt.total) }}</span>
      </el-tooltip>
      <div class="receipt-cell__sub">
        <span v-if="receipt.online > 0" class="esc-num" :class="{ 'esc-strike': reversed }">线上 {{ yuan(receipt.online) }}</span>
        <el-tag v-if="reversed" type="danger" size="small" effect="plain">已冲正</el-tag>
      </div>
    </template>
    <span v-else class="esc-placeholder">未收款</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { yuan } from '../shared'

const props = defineProps({
  // 订单列表里的收款摘要 { wechat, alipay, cash, online, total, status }
  receipt: { type: Object, default: null }
})

const reversed = computed(() => props.receipt && props.receipt.status === 'reversed')

const breakdown = computed(() => {
  const r = props.receipt || {}
  const text = `微信 ${yuan(r.wechat)} · 支付宝 ${yuan(r.alipay)} · 现金 ${yuan(r.cash)}`
  return reversed.value ? `${text}（已冲正，不计入收款合计）` : `${text}，线上另计 ${yuan(r.online)}`
})
</script>

<style scoped>
.receipt-cell {
  line-height: 20px;
}

.receipt-cell__total {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.receipt-cell__total.esc-strike {
  font-weight: normal;
  color: var(--el-text-color-placeholder);
}

.receipt-cell__sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}

.receipt-cell__sub:empty {
  display: none;
}
</style>
