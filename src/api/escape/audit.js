import request from '@/utils/request'

// 打扫审核：status=pending 为待审核（最早提交在前），其它为审核记录（可加 reviewResult）
export function listAudit(query) {
  return request({ url: '/escape/audit/list', method: 'get', params: query })
}

// 审核通过（积分立即到账）
export function approveAudit(entryId) {
  return request({ url: `/escape/audit/${entryId}/approve`, method: 'post', data: {} })
}

// 驳回
export function rejectAudit(entryId, reason) {
  return request({ url: `/escape/audit/${entryId}/reject`, method: 'post', data: { reason } })
}

// 批量通过 → { approved, failures[] }
export function batchApproveAudit(entryIds) {
  return request({ url: '/escape/audit/batch-approve', method: 'post', data: { entryIds } })
}
