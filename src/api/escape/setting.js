import request from '@/utils/request'

// 门店设置：名称、编码、时区、门店当前时间、登录有效天数、锁定规则
export function getSetting() {
  return request({ url: '/escape/setting', method: 'get' })
}

// 修改门店名称 { storeName }
export function updateSetting(data) {
  return request({ url: '/escape/setting', method: 'put', data })
}
