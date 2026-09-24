import request, { download } from '@/utils/request'

// 订单列表（status：running / editing / done / cancelled；deleted=1 查看已删除）
export function listOrder(query) {
  return request({ url: '/escape/order/list', method: 'get', params: query })
}

// 流程节点名称
export function listOrderSteps() {
  return request({ url: '/escape/order/steps', method: 'get' })
}

// 订单详情：流程进度、节点记录、收款详情、剪辑任务、操作记录
export function getOrder(orderId) {
  return request({ url: '/escape/order/' + orderId, method: 'get' })
}

// 录入订单 { themeId, time, people, contact, note, requestId }
export function addOrder(data) {
  return request({ url: '/escape/order', method: 'post', data })
}

// 修改订单内容 { themeId 或 theme, time, people, contact, note }
export function updateOrder(orderId, data) {
  return request({ url: '/escape/order/' + orderId, method: 'put', data })
}

// 代为完成当前节点（拍照、视频节点需要 choice）
export function completeOrderStep(orderId, stepKey, choice) {
  return request({
    url: `/escape/order/${orderId}/steps/${stepKey}`,
    method: 'post',
    data: choice ? { choice } : {}
  })
}

// 代为登记收款 { wechat, alipay, cash, online }，金额为「元」的文字，最多两位小数
export function recordOrderPayment(orderId, amounts) {
  return request({ url: `/escape/order/${orderId}/payment`, method: 'post', data: amounts })
}

// 修正流程节点：回退到 target，之后的记录作废但保留
export function correctOrder(orderId, target, reason) {
  return request({ url: `/escape/order/${orderId}/correct`, method: 'post', data: { target, reason } })
}

// 取消订单（已收款自动冲正）
export function cancelOrder(orderId, reason) {
  return request({ url: `/escape/order/${orderId}/cancel`, method: 'post', data: { reason } })
}

// 删除订单（保留记录，已收款自动冲正）
export function delOrder(orderId) {
  return request({ url: '/escape/order/' + orderId, method: 'delete' })
}

// 导出（与列表同筛选）
export function exportOrder(query, filename) {
  return download('escape/order/export', query, filename)
}
