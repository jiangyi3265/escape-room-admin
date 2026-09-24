import request, { download } from '@/utils/request'

// 收款台账（beginDate/endDate 为收款日期；status：active / reversed）
export function listReceipt(query) {
  return request({ url: '/escape/receipt/list', method: 'get', params: query })
}

// 与列表同条件的合计 { receiptCount, activeCount, wechat, alipay, cash, online, total }
export function getReceiptSummary(query) {
  return request({ url: '/escape/receipt/summary', method: 'get', params: query })
}

// 最近 N 天每日汇总（今天在前，1–62 天）
export function getReceiptDaily(days = 7) {
  return request({ url: '/escape/receipt/daily', method: 'get', params: { days } })
}

// 收款详情（含修改记录）
export function getReceipt(receiptId) {
  return request({ url: '/escape/receipt/' + receiptId, method: 'get' })
}

// 导出（与列表同筛选）
export function exportReceipt(query, filename) {
  return download('escape/receipt/export', query, filename)
}
