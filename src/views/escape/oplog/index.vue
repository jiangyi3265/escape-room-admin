<template>
  <div class="app-container esc-page oplog-page">
    <el-form :model="query" inline @submit.prevent>
      <el-form-item label="来源">
        <el-select v-model="query.actorType" placeholder="全部" clearable style="width: 120px" @change="search">
          <el-option v-for="a in ACTOR_TYPES" :key="a.value" :label="a.label" :value="a.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="对象">
        <el-select v-model="query.targetType" placeholder="全部" clearable style="width: 120px" @change="search">
          <el-option v-for="t in TARGET_TYPES" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="日期">
        <el-date-picker
          v-model="query.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :shortcuts="DATE_SHORTCUTS"
          @change="search"
        />
      </el-form-item>
      <el-form-item label="关键字">
        <el-input v-model="query.keyword" placeholder="操作人 / 操作 / 内容" clearable style="width: 180px" @keyup.enter="search" @clear="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="search">查询</el-button>
        <el-button icon="Refresh" @click="reset()">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="esc-toolbar">
      <div class="esc-toolbar__left">
        <span class="esc-hint">门店端、管理后台和系统自动处理的操作都会记在这里，只能查看，不能修改</span>
      </div>
      <div class="esc-toolbar__right">
        <el-tooltip content="刷新" placement="top">
          <el-button circle icon="Refresh" @click="getList" />
        </el-tooltip>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" row-key="logId" class="oplog-table">
      <template #empty>
        <el-empty v-if="loaded" :image-size="80" description="没有符合条件的操作记录" />
      </template>
      <el-table-column label="时间" width="150">
        <template #default="{ row }"><span class="esc-num">{{ timeText(row.createdAt) }}</span></template>
      </el-table-column>
      <el-table-column label="来源" width="96" align="center">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="tagTypeOf(ACTOR_TYPES, row.actorType)">{{ row.actorTypeText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作人" width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.actorName || '系统' }}
          <div v-if="row.actorType === 'staff'" class="esc-cell-sub">{{ row.actorRoleText }}</div>
        </template>
      </el-table-column>
      <el-table-column label="对象" width="96" align="center">
        <template #default="{ row }">{{ row.targetText || labelOf(TARGET_TYPES, row.targetType, '—') }}</template>
      </el-table-column>
      <el-table-column label="操作" prop="action" width="140" show-overflow-tooltip />
      <el-table-column label="内容" min-width="300">
        <template #default="{ row }"><div class="oplog-table__summary">{{ row.summary }}</div></template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="query.pageNum"
      v-model:limit="query.pageSize"
      @pagination="getList"
    />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { listOplog } from '@/api/escape/oplog'
import { ACTOR_TYPES, DATE_SHORTCUTS, TARGET_TYPES, labelOf, tagTypeOf, timeText, useListPage } from '../shared'

defineOptions({ name: 'EscOplog' })

const { loading, loaded, rows, total, query, getList, search, reset } = useListPage(listOplog, {
  actorType: '',
  targetType: '',
  keyword: '',
  dateRange: []
}, { pageSize: 20 })

onMounted(getList)
</script>

<style scoped>
.oplog-table__summary {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-primary);
}
</style>
