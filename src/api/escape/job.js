import request from '@/utils/request'

// 临时任务（status：open / ended / cancelled；urgency：low / normal / urgent）
export function listJob(query) {
  return request({ url: '/escape/job/list', method: 'get', params: query })
}

export function getJob(jobId) {
  return request({ url: '/escape/job/' + jobId, method: 'get' })
}

// 发布 { title, description, deadline, urgency, restricted, allowedStaffIds, requestId }
export function addJob(data) {
  return request({ url: '/escape/job', method: 'post', data })
}

// 取消待抢任务
export function cancelJob(jobId) {
  return request({ url: `/escape/job/${jobId}/cancel`, method: 'post', data: {} })
}
