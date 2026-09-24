import request from '@/utils/request'

// 门店概览：今日与近 7 日收款、订单数、待办、积分排行、订单现场、最近消息
export function getDashboard() {
  return request({ url: '/escape/dashboard', method: 'get' })
}
