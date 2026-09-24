<template>
  <div class="daily-chart" :style="{ height: height + 'px' }">
    <div v-show="hasData" ref="chartRef" class="daily-chart__canvas" role="img" :aria-label="summaryText"></div>
    <el-empty v-if="!hasData" :image-size="70" description="这段时间还没有收款" class="daily-chart__empty" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import useSettingsStore from '@/store/modules/settings'
import { dayLabel, weekdayText, yuan } from '../shared'

echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({
  // 每日汇总（接口顺序：今天在前）{ date, label, wechat, alipay, cash, online, total, count }
  days: { type: Array, default: () => [] },
  height: { type: Number, default: 260 }
})

// 三个计入合计的渠道，按堆叠顺序（下→上）。颜色取 escape.scss 里的渠道色：微信青绿、支付宝蓝、现金橙
const SERIES = [
  { key: 'wechat', name: '微信', cssVar: '--esc-wechat', fallback: '#1baf7a' },
  { key: 'alipay', name: '支付宝', cssVar: '--esc-alipay', fallback: '#2a78d6' },
  { key: 'cash', name: '现金', cssVar: '--esc-cash', fallback: '#eb6834' }
]

const settingsStore = useSettingsStore()
const chartRef = ref(null)
let chart = null
let observer = null

// 图表从左到右按日期先后
const ordered = computed(() => [...props.days].reverse())
const hasData = computed(() => ordered.value.some((d) => Number(d.total) > 0 || Number(d.online) > 0))

const summaryText = computed(() => {
  const list = ordered.value
  if (!list.length) return '每日收款图表'
  const sum = list.reduce((acc, d) => acc + Number(d.total || 0), 0)
  const top = list.reduce((best, d) => (Number(d.total) > Number(best.total) ? d : best), list[0])
  return `近 ${list.length} 天三项合计 ${yuan(sum)}，最高是 ${dayLabel(top.date)} ${yuan(top.total)}`
})

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name)
  return (value && value.trim()) || fallback
}

function compactYuan(value) {
  const n = Number(value) || 0
  if (Math.abs(n) >= 10000) return '¥' + (n / 10000).toFixed(n % 10000 === 0 ? 0 : 1) + '万'
  return '¥' + n.toLocaleString('en-US')
}

function buildOption() {
  const dark = document.documentElement.classList.contains('dark')
  const surface = cssVar('--el-bg-color-overlay', dark ? '#1d1e1f' : '#ffffff')
  const textSecondary = cssVar('--el-text-color-secondary', '#909399')
  const textRegular = cssVar('--el-text-color-regular', '#606266')
  const textPrimary = cssVar('--el-text-color-primary', '#303133')
  const gridLine = cssVar('--el-border-color-lighter', '#ebeef5')
  const baseLine = cssVar('--el-border-color', '#dcdfe6')
  const list = ordered.value
  const many = list.length > 10
  const colorOf = (s) => cssVar(s.cssVar, s.fallback)

  // 只在最新一天和最高一天的柱顶标出合计，其余看提示框和下方表格
  let maxIndex = 0
  list.forEach((d, i) => {
    if (Number(d.total) > Number(list[maxIndex].total)) maxIndex = i
  })
  const labelled = new Set([list.length - 1, maxIndex].filter((i) => i >= 0 && Number(list[i]?.total) > 0))

  const topKeyOf = (d) => {
    for (let i = SERIES.length - 1; i >= 0; i--) {
      if (Number(d[SERIES[i].key]) > 0) return SERIES[i].key
    }
    return null
  }

  const series = SERIES.map((s) => ({
    name: s.name,
    type: 'bar',
    stack: 'total',
    barMaxWidth: many ? 14 : 24,
    emphasis: { focus: 'series' },
    itemStyle: {
      color: colorOf(s),
      borderColor: surface,
      borderWidth: 1
    },
    data: list.map((d, i) => {
      const cents = Number(d[s.key]) || 0
      const isTop = topKeyOf(d) === s.key
      return {
        value: cents > 0 ? cents / 100 : '-',
        itemStyle: isTop ? { borderRadius: [4, 4, 0, 0] } : undefined,
        label: isTop && labelled.has(i)
          ? { show: true, position: 'top', formatter: yuan(d.total), color: textPrimary, fontSize: 12, fontWeight: 600 }
          : undefined
      }
    })
  }))

  return {
    animationDuration: 300,
    textStyle: { fontFamily: 'inherit' },
    grid: { left: 8, right: 12, top: 44, bottom: 4, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
      textStyle: { color: textRegular, fontSize: 12 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
      backgroundColor: cssVar('--el-bg-color-overlay', '#fff'),
      borderColor: cssVar('--el-border-color-light', '#e4e7ed'),
      textStyle: { color: textRegular, fontSize: 12 },
      confine: true,
      formatter: (params) => {
        const d = list[params[0]?.dataIndex ?? 0]
        if (!d) return ''
        const row = (dot, label, value, strong = false) =>
          `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;line-height:22px">` +
          `<span style="display:inline-flex;align-items:center;gap:6px">${dot}${label}</span>` +
          `<span style="font-variant-numeric:tabular-nums;${strong ? `font-weight:600;color:${textPrimary}` : ''}">${value}</span></div>`
        const dot = (color) => `<span style="width:8px;height:8px;border-radius:2px;background:${color};display:inline-block"></span>`
        const blank = '<span style="width:8px;display:inline-block"></span>'
        return [
          `<div style="font-weight:600;color:${textPrimary};margin-bottom:4px">${dayLabel(d.date)} ${weekdayText(d.date)}</div>`,
          ...SERIES.map((s) => row(dot(colorOf(s)), s.name, yuan(d[s.key]))),
          `<div style="border-top:1px solid ${gridLine};margin:4px 0"></div>`,
          row(blank, '三项合计', yuan(d.total), true),
          row(blank, '线上（不计入合计）', yuan(d.online)),
          row(blank, '收款笔数', `${d.count || 0} 笔`)
        ].join('')
      }
    },
    xAxis: {
      type: 'category',
      data: list.map((d) => (many ? String(d.date).slice(5) : `${dayLabel(d.date)}\n${weekdayText(d.date)}`)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: baseLine } },
      axisLabel: { color: textSecondary, fontSize: 12, lineHeight: 16, hideOverlap: true }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: textSecondary, fontSize: 12, formatter: compactYuan },
      splitLine: { lineStyle: { color: gridLine, type: 'solid', width: 1 } },
      splitNumber: 4
    },
    series
  }
}

function render() {
  if (!chartRef.value || !hasData.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  chart.setOption(buildOption(), true)
  chart.resize()
}

watch(() => props.days, () => nextTick(render), { deep: true })
// 切换深浅色时页面的颜色变量稍后才生效，等一下再重画
watch(() => settingsStore.isDark, () => setTimeout(render, 80))

onMounted(() => {
  nextTick(render)
  if (window.ResizeObserver && chartRef.value) {
    observer = new ResizeObserver(() => {
      if (chart && chartRef.value && chartRef.value.clientWidth > 0) chart.resize()
    })
    observer.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped>
.daily-chart {
  position: relative;
  width: 100%;
}

.daily-chart__canvas {
  width: 100%;
  height: 100%;
}

.daily-chart__empty {
  height: 100%;
  padding: 0;
}
</style>
