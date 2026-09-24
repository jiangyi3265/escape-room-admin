<template>
  <div class="revision-table">
    <el-table :data="revisions" size="small" border>
      <template #empty>
        <span class="esc-muted">没有修改过金额</span>
      </template>
      <el-table-column label="修改时间" min-width="130">
        <template #default="{ row }">{{ timeText(row.adjustedAt) }}</template>
      </el-table-column>
      <el-table-column label="修改人" prop="adjustedBy" min-width="84" show-overflow-tooltip />
      <el-table-column label="修改前：微信" align="right" min-width="96">
        <template #default="{ row }"><span class="esc-num">{{ yuan(row.wechat) }}</span></template>
      </el-table-column>
      <el-table-column label="支付宝" align="right" min-width="90">
        <template #default="{ row }"><span class="esc-num">{{ yuan(row.alipay) }}</span></template>
      </el-table-column>
      <el-table-column label="现金" align="right" min-width="90">
        <template #default="{ row }"><span class="esc-num">{{ yuan(row.cash) }}</span></template>
      </el-table-column>
      <el-table-column label="三项合计" align="right" min-width="96">
        <template #default="{ row }"><strong class="esc-num">{{ yuan(row.total) }}</strong></template>
      </el-table-column>
      <el-table-column label="线上" align="right" min-width="90">
        <template #default="{ row }"><span class="esc-num">{{ yuan(row.online) }}</span></template>
      </el-table-column>
    </el-table>
    <div class="esc-form-help">每一行是那次修改之前的金额；当前金额以收款记录为准。</div>
  </div>
</template>

<script setup>
import { timeText, yuan } from '../shared'

defineProps({
  revisions: { type: Array, default: () => [] }
})
</script>
