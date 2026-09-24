import request from '@/utils/request'

// 操作记录（actorType：staff / admin / system；targetType、keyword、日期）
export function listOplog(query) {
  return request({ url: '/escape/oplog/list', method: 'get', params: query })
}
