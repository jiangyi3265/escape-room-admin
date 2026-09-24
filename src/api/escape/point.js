import request, { download } from '@/utils/request'

// 积分明细（staffId、source、state、category、keyword、日期）
export function listPoint(query) {
  return request({ url: '/escape/point/list', method: 'get', params: query })
}

// 撤销一笔已到账的积分
export function revokePoint(entryId) {
  return request({ url: `/escape/point/${entryId}/revoke`, method: 'post', data: {} })
}

// 调整积分 { staffId, points, reason }
export function adjustPoint(data) {
  return request({ url: '/escape/point/adjust', method: 'post', data })
}

// 导出（与列表同筛选）
export function exportPoint(query, filename) {
  return download('escape/point/export', query, filename)
}
