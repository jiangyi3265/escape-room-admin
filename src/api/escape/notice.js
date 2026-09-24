import request from '@/utils/request'

// 门店消息（audience、category 消息类型、keyword、日期）
export function listNotice(query) {
  return request({ url: '/escape/notice/list', method: 'get', params: query })
}

// 接收人与已读时间
export function getNoticeReceipts(noticeId) {
  return request({ url: `/escape/notice/${noticeId}/receipts`, method: 'get' })
}

// 发送门店通知 { title(≤20), detail(≤200), scope: all / managers }
export function sendNotice(data) {
  return request({ url: '/escape/notice', method: 'post', data })
}
