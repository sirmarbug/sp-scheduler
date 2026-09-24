<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import ShiftEditor from '@/components/month-config/ShiftEditor.vue'
import type { DayDtoType, ShiftDtoType, UpsertShiftRequest } from '@/types'

interface DayConfigEditorProps {
  day: DayDtoType
  loading: boolean
}

const props = withDefaults(defineProps<DayConfigEditorProps>(), {
  loading: false,
})

const emit = defineEmits<{
  (e: 'create', payload: UpsertShiftRequest): void
  (e: 'update', shiftId: string, payload: UpsertShiftRequest): void
  (e: 'remove', shiftId: string): void
}>()

const { t } = useI18n()
const confirmDialog = useConfirmDialog()

const editorVisible = ref(false)
const editingShift = ref<ShiftDtoType | null>(null)

function openCreateShift() {
  editingShift.value = null
  editorVisible.value = true
}

function openEditShift(shift: ShiftDtoType) {
  editingShift.value = shift
  editorVisible.value = true
}

function handleSave(payload: UpsertShiftRequest) {
  if (editingShift.value) {
    emit('update', editingShift.value.id, payload)
  } else {
    emit('create', payload)
  }
  editorVisible.value = false
}

function handleToggleEnabled(shift: ShiftDtoType) {
  emit('update', shift.id, {
    label: shift.label,
    start: shift.start,
    end: shift.end,
    shortLabel: shift.shortLabel,
    balanceBucket: shift.balanceBucket,
    type: shift.type,
    enabled: !shift.enabled,
    requiredManagerCount: shift.requiredManagerCount,
    requiredCashierCount: shift.requiredCashierCount,
  })
}

async function handleRemove(shift: ShiftDtoType) {
  const confirmed = await confirmDialog.open(
    t('monthConfig.confirmDeleteShift.title'),
    t('monthConfig.confirmDeleteShift.message', { label: shift.label })
  )
  if (!confirmed) return
  emit('remove', shift.id)
}
</script>

<template>
  <div class="day-config-editor">
    <q-list bordered>
      <q-item v-for="shift in props.day.shifts" :key="shift.id">
        <q-item-section>
          <q-item-label>{{ shift.label }} ({{ shift.start }}–{{ shift.end }})</q-item-label>
          <q-item-label caption>
            {{ t('monthConfig.shiftEditor.requiredManagerCount') }}: {{ shift.requiredManagerCount }} ·
            {{ t('monthConfig.shiftEditor.requiredCashierCount') }}: {{ shift.requiredCashierCount }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row items-center q-gutter-x-xs">
            <q-toggle :model-value="shift.enabled" @update:model-value="handleToggleEnabled(shift)" />
            <q-btn flat round icon="edit" @click="openEditShift(shift)" />
            <q-btn flat round icon="delete" @click="handleRemove(shift)" />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <q-btn class="q-mt-sm" flat color="primary" :label="t('monthConfig.addShift')" @click="openCreateShift" />

    <ShiftEditor v-model="editorVisible" :shift="editingShift" :loading="props.loading" @save="handleSave" />

    <q-dialog v-model="confirmDialog.visible.value">
      <q-card>
        <q-card-section class="text-h6">{{ confirmDialog.title.value }}</q-card-section>
        <q-card-section>{{ confirmDialog.message.value }}</q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" @click="confirmDialog.reject" />
          <q-btn flat color="negative" :label="t('common.delete')" @click="confirmDialog.confirm" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped lang="scss">
.day-config-editor {
  padding: 0.5rem 0;
}
</style>
