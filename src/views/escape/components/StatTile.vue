<template>
  <div class="stat-tile" :class="{ 'is-accent': accent, 'is-hero': hero, 'is-link': !!to }" @click="go">
    <div class="stat-tile__label">
      <span v-if="swatch" class="stat-tile__swatch" :style="{ background: swatch }"></span>
      <span>{{ label }}</span>
    </div>
    <div class="stat-tile__value" :data-stat="label">{{ value }}</div>
    <div v-if="sub || $slots.sub" class="stat-tile__sub">
      <slot name="sub">{{ sub }}</slot>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  sub: { type: String, default: '' },
  // 渠道色块（与图表颜色一致）
  swatch: { type: String, default: '' },
  // 突出显示（如三项合计）
  accent: { type: Boolean, default: false },
  // 页面主数字（大号）
  hero: { type: Boolean, default: false },
  // 点击跳转
  to: { type: [String, Object], default: '' }
})

const router = useRouter()

function go() {
  if (props.to) router.push(props.to)
}
</script>

<style scoped lang="scss">
.stat-tile {
  min-width: 0;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-overlay);
  box-sizing: border-box;

  &.is-accent {
    border-color: var(--el-color-primary-light-7);
    background: var(--el-color-primary-light-9);
  }

  &.is-link {
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:hover {
      border-color: var(--el-color-primary-light-5);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }
  }
}

.stat-tile__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-tile__swatch {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.stat-tile__value {
  margin-top: 6px;
  font-size: 22px;
  line-height: 30px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-tile.is-hero .stat-tile__value {
  font-size: 36px;
  line-height: 44px;
}

.stat-tile__sub {
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
