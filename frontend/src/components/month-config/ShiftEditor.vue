<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, watch } from 'vue'
import { required, time } from '@/validations'
import type { BalanceBucket, ShiftDtoType, ShiftType, UpsertShiftRequest } from '@/types'

interface ShiftEditorProps {
  modelValue: boolean
  shift: ShiftDtoType | null
  loading: boolean
}

const props = withDefaults(defineProps<ShiftEditorProps>(), {
  loading: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: UpsertShiftRequest): void
}>()

const { t } = useI18n()

const balanceBucketOptions: BalanceBucket[] = ['first', 'mid', 'second']
const typeOptions: ShiftType[] = ['auto', 'manual']

const form = ref<UpsertShiftRequest>(buildEmptyForm())

function buildEmptyForm(): UpsertShiftRequest {
  return {
    label: '',
    start: '',
    end: '',
    shortLabel: '',
    balanceBucket: 'first',
    type: 'manual',
    enabled: true,
    requiredManagerCount: 0,
    requiredCashierCount: 0,
  }
}

watch(
  () => [props.modelValue, props.shift] as const,
  ([visible, shift]) => {
    if (!visible) return
    form.value = shift
      ? {
          label: shift.label,
          start: shift.start,
          end: shift.end,
          shortLabel: shift.shortLabel,
          balanceBucket: shift.balanceBucket,
          type: shift.type,
          enabled: shift.enabled,
          requiredManagerCount: shift.requiredManagerCount,
          requiredCashierCount: shift.requiredCashierCount,
        }
      : buildEmptyForm()
  },
  { immediate: true }
)

function handleSubmit() {
  emit('save', form.value)
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card class="shift-editor">
      <q-card-section>
        <div class="text-h6">{{ props.shift ? t('monthConfig.shiftEditor.editTitle') : t('monthConfig.shiftEditor.createTitle') }}</div>
      </q-card-section>
      <q-card-section>
        <q-inner-loading :showing="props.loading" />
        <q-form class="shift-editor__form" @submit.prevent="handleSubmit">
          <q-input v-model="form.label" :label="t('monthConfig.shiftEditor.label')" :rules="[required]" />
          <q-input v-model="form.shortLabel" :label="t('monthConfig.shiftEditor.shortLabel')" :rules="[required]" />
          <q-input v-model="form.start" :label="t('monthConfig.shiftEditor.start')" placeholder="HH:mm" :rules="[required, time]" />
          <q-input v-model="form.end" :label="t('monthConfig.shiftEditor.end')" placeholder="HH:mm" :rules="[required, time]" />
          <q-select v-model="form.balanceBucket" :options="balanceBucketOptions" :label="t('monthConfig.shiftEditor.balanceBucket')" />
          <q-select v-model="form.type" :options="typeOptions" :label="t('monthConfig.shiftEditor.type')" />
          <q-input
            v-model.number="form.requiredManagerCount"
            type="number"
            min="0"
            :label="t('monthConfig.shiftEditor.requiredManagerCount')"
          />
          <q-input
            v-model.number="form.requiredCashierCount"
            type="number"
            min="0"
            :label="t('monthConfig.shiftEditor.requiredCashierCount')"
          />
          <q-toggle v-model="form.enabled" :label="t('monthConfig.shiftEditor.enabled')" />
          <div class="shift-editor__actions">
            <q-btn flat :label="t('common.cancel')" @click="emit('update:modelValue', false)" />
            <q-btn type="submit" color="primary" :label="t('common.save')" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.shift-editor {
  width: 100%;
  max-width: 26rem;

  &__form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }
}
</style>
