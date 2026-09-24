import request from '@/utils/request'

// 积分任务（keyword、category、status：0 启用 / 1 停用）
export function listTask(query) {
  return request({ url: '/escape/task/list', method: 'get', params: query })
}

// 新增 { title, points, category, audit, sortOrder }
export function addTask(data) {
  return request({ url: '/escape/task', method: 'post', data })
}

export function updateTask(taskId, data) {
  return request({ url: '/escape/task/' + taskId, method: 'put', data })
}

// 启用 / 停用 { status: '0' / '1' }
export function changeTaskStatus(taskId, status) {
  return request({ url: `/escape/task/${taskId}/status`, method: 'post', data: { status } })
}
