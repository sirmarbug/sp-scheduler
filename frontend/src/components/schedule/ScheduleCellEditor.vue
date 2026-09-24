<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CellOptionType } from '@/types'

interface ScheduleCellEditorProps {
  modelValue: boolean
  loading: boolean
  options: CellOptionType[]
  hasCurrentAssignment: boolean
  shiftLabels: Record<string, string>
}

const props = withDefaults(defineProps<ScheduleCellEditorProps>(), {
  loading: false,
  hasCurrentAssignment: false,
  shiftLabels: () => ({}),
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', option: CellOptionType): void
  (e: 'unassign'): void
}>()

const { t } = useI18n()

function handleSelect(option: CellOptionType) {
  emit('select', option)
}

function handleUnassign() {
  emit('unassign')
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card class="schedule-cell-editor">
      <q-card-section>
        <q-inner-loading :showing="loading" />
        <div v-if="!loading && props.options.length === 0">{{ t('schedule.noOptions') }}</div>
        <q-list v-else bordered>
          <q-item v-for="option in props.options" :key="`${option.shiftId}-${option.role}`" clickable @click="handleSelect(option)">
            <q-item-section>{{ props.shiftLabels[option.shiftId] ?? option.shiftId }} — {{ option.role }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions v-if="props.hasCurrentAssignment" align="right">
        <q-btn flat color="negative" :label="t('schedule.unassign')" @click="handleUnassign" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.schedule-cell-editor {
  width: 100%;
  max-width: 22rem;
}
</style>
