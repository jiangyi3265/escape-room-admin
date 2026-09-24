import request from '@/utils/request'

// 维修登记（status：pending / completed；themeName、keyword、日期）
export function listRepair(query) {
  return request({ url: '/escape/repair/list', method: 'get', params: query })
}

// 登记维修 { themeId, problem }
export function addRepair(data) {
  return request({ url: '/escape/repair', method: 'post', data })
}

// 确认修好
export function completeRepair(repairId) {
  return request({ url: `/escape/repair/${repairId}/complete`, method: 'post', data: {} })
}
