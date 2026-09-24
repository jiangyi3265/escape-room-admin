import request from '@/utils/request'

// 人员列表（keyword、role、status）
export function listStaff(query) {
  return request({ url: '/escape/staff/list', method: 'get', params: query })
}

// 选人下拉 [{ staffId, staffName, role, status, points }]（同样支持 role、status）
export function staffOptions(query) {
  return request({ url: '/escape/staff/options', method: 'get', params: query })
}

export function getStaff(staffId) {
  return request({ url: '/escape/staff/' + staffId, method: 'get' })
}

// 添加人员 { staffName, phone, role, password?, remark } → 含 initialPassword（只返回这一次）
export function addStaff(data) {
  return request({ url: '/escape/staff', method: 'post', data })
}

// 修改资料 { staffName, phone, role, remark }
export function updateStaff(staffId, data) {
  return request({ url: '/escape/staff/' + staffId, method: 'put', data })
}

// 停用 / 恢复 { status: inactive / active }
export function changeStaffStatus(staffId, status) {
  return request({ url: `/escape/staff/${staffId}/status`, method: 'post', data: { status } })
}

// 重置登录密码 → { password }
export function resetStaffPassword(staffId) {
  return request({ url: `/escape/staff/${staffId}/reset-password`, method: 'post', data: {} })
}

export function delStaff(staffId) {
  return request({ url: '/escape/staff/' + staffId, method: 'delete' })
}
