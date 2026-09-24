import request from '@/utils/request'

// 主题列表（status=deleted 查看已删除）
export function listTheme(query) {
  return request({ url: '/escape/theme/list', method: 'get', params: query })
}

// 在用主题 [{ themeId, themeName }]
export function themeOptions() {
  return request({ url: '/escape/theme/options', method: 'get' })
}

// 筛选用的主题名称（含历史记录里的旧名称）[{ themeName, current }]
export function themeFilterNames() {
  return request({ url: '/escape/theme/filter-names', method: 'get' })
}

// 新增 { themeName, sortOrder }
export function addTheme(data) {
  return request({ url: '/escape/theme', method: 'post', data })
}

export function updateTheme(themeId, data) {
  return request({ url: '/escape/theme/' + themeId, method: 'put', data })
}

export function delTheme(themeId) {
  return request({ url: '/escape/theme/' + themeId, method: 'delete' })
}
